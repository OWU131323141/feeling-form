import express from "express";
import dotenv from "dotenv";
import http from "http";
import { WebSocketServer } from "ws";

dotenv.config();

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

/** =========================
 *  Utility
 *  ========================= */
function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
function clamp(x, a, b) {
  const n = Number(x);
  if (!Number.isFinite(n)) return a;
  return Math.max(a, Math.min(b, n));
}
function tryParseJsonLoose(text) {
  if (typeof text !== "string") return null;
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }
  return null;
}

async function callLLM(messages, temperature = 0.3) {
  const endpoint = process.env.OPENAI_API_ENDPOINT;
  const apiKey = process.env.OPENAI_API_KEY;

  if (!endpoint) throw new Error("OPENAI_API_ENDPOINT is not set");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const payload = {
    model: "gpt-4o-mini",
    messages,
    temperature
  };

  const r = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + apiKey
    },
    body: JSON.stringify(payload)
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error("LLM request failed: " + r.status);
    e.details = data;
    throw e;
  }

  const content = data?.choices?.[0]?.message?.content ?? "";
  return content;
}

/** =========================
 *  1) 感情解析 API
 *  ========================= */
app.post("/api/analyze", async (req, res) => {
  try {
    const { text } = req.body ?? {};
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "text is required" });
    }

    const content = await callLLM([
      {
        role: "system",
        content:
          "あなたは感情解析APIです。ユーザー文章から感情を数値化し、指定のJSONのみを返してください。余計な文章は禁止です。"
      },
      {
        role: "user",
        content: `以下の文章から感情を解析し、JSONだけを返してください。

出力JSON（必須）:
{
  "warmth": 0〜1,
  "calm": 0〜1,
  "energy": 0〜1,
  "keywords": ["...","..."]
}

文章:
"""${text}"""`
      }
    ], 0.3);

    const parsed = tryParseJsonLoose(content);
    if (!parsed) {
      return res.status(502).json({ error: "Model output was not valid JSON", raw: content });
    }

    const safe = {
      warmth: clamp01(parsed.warmth),
      calm: clamp01(parsed.calm),
      energy: clamp01(parsed.energy),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String).slice(0, 8) : ["mood"]
    };

    return res.json(safe);
  } catch (e) {
    return res.status(500).json({ error: "server error", message: String(e), details: e.details ?? null });
  }
});

/** =========================
 *  2) motionPlan API
 *  ========================= */
app.post("/api/motionplan", async (req, res) => {
  try {
    const { text, feeling } = req.body ?? {};
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "text is required" });
    }

    const f = feeling && typeof feeling === "object" ? feeling : {};
    const warmth = clamp01(f.warmth ?? 0.5);
    const calm = clamp01(f.calm ?? 0.5);
    const energy = clamp01(f.energy ?? 0.5);
    const keywords = Array.isArray(f.keywords) ? f.keywords.map(String).slice(0, 8) : [];

    const content = await callLLM([
      {
        role: "system",
        content:
          "あなたはインタラクティブアートの動き設計AIです。必ずJSONのみを返してください。説明文は禁止。値の範囲を守ってください。"
      },
      {
        role: "user",
        content: `作品ルール：
- motion は次のどれかにする： "breathing" | "tremble" | "pulse" | "drift"
- evidence は、文章中から根拠になった短い抜粋（日本語10〜30文字程度）
- params は下記の範囲に収める（数値は実数でOK）

params の範囲：
{
  "hue": 0〜360,
  "sat": 10〜95,
  "bri": 10〜95,
  "baseRadius": 70〜260,
  "noiseScale": 0.2〜2.0,
  "noiseAmp": 5〜140,
  "rotSpeed": 0.0005〜0.02,
  "strokeW": 0.5〜3.0,
  "fadeSpeed": 0.0008〜0.006,
  "breathSpeed": 0.2〜3.0,
  "pulsePower": 1.0〜5.0,
  "jitter": 0〜18
}

入力文章：
"""${text}"""

参考（すでに別AIで推定した感情値。矛盾しても良いが参考にして）：
warmth=${warmth}, calm=${calm}, energy=${energy}, keywords=${JSON.stringify(keywords)}

出力JSON（必須）：
{
  "mood": "短いラベル",
  "evidence": "文章からの抜粋",
  "motion": "breathing|tremble|pulse|drift",
  "params": { ...上の範囲... }
}`
      }
    ], 0.2);

    const parsed = tryParseJsonLoose(content);
    if (!parsed) {
      return res.status(502).json({ error: "Model output was not valid JSON", raw: content });
    }

    const motionRaw = String(parsed.motion ?? "").trim();
    const motion = ["breathing", "tremble", "pulse", "drift"].includes(motionRaw)
      ? motionRaw
      : "drift";

    const p = parsed.params ?? {};

    const safe = {
      mood: String(parsed.mood ?? "mood").slice(0, 24),
      evidence: String(parsed.evidence ?? "").slice(0, 60),
      motion,
      params: {
        hue: clamp(p.hue ?? (warmth * 60 + 180), 0, 360),
        sat: clamp(p.sat ?? (10 + warmth * 70), 10, 95),
        bri: clamp(p.bri ?? (25 + (0.5 + energy * 0.5) * 60), 10, 95),

        baseRadius: clamp(p.baseRadius ?? (90 + energy * 160), 70, 260),
        noiseScale: clamp(p.noiseScale ?? (0.25 + (1 - calm) * 1.2), 0.2, 2.0),
        noiseAmp: clamp(p.noiseAmp ?? (15 + (1 - calm) * 90 + energy * 30), 5, 140),

        rotSpeed: clamp(p.rotSpeed ?? (0.001 + energy * 0.01), 0.0005, 0.02),
        strokeW: clamp(p.strokeW ?? (0.8 + energy * 1.6), 0.5, 3.0),

        fadeSpeed: clamp(p.fadeSpeed ?? (0.0012 + (1 - calm) * 0.0025), 0.0008, 0.006),
        breathSpeed: clamp(p.breathSpeed ?? (0.5 + (1 - calm) * 0.8), 0.2, 3.0),
        pulsePower: clamp(p.pulsePower ?? (1.2 + energy * 2.8), 1.0, 5.0),
        jitter: clamp(p.jitter ?? ((1 - calm) * 12 + energy * 4), 0, 18)
      }
    };

    return res.json(safe);
  } catch (e) {
    return res.status(500).json({ error: "server error", message: String(e), details: e.details ?? null });
  }
});

/** =========================
 *  3) WebSocket relay (phone -> pc)
 *  ========================= */
const rooms = new Map();

function joinRoom(room, ws) {
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);
  ws.__room = room;
}
function leaveRoom(ws) {
  const room = ws.__room;
  if (!room) return;
  const set = rooms.get(room);
  if (set) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(room);
  }
  ws.__room = null;
}
function broadcast(room, payload, exceptWs = null) {
  const set = rooms.get(room);
  if (!set) return;
  const msg = typeof payload === "string" ? payload : JSON.stringify(payload);
  for (const client of set) {
    if (client.readyState !== 1) continue;
    if (exceptWs && client === exceptWs) continue;
    client.send(msg);
  }
}

/** =========================
 *  Start server (PORT=8080)
 *  ========================= */
const PORT = 8080;
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.__room = null;

  ws.on("message", (buf) => {
    let data;
    try { data = JSON.parse(buf.toString()); } catch { return; }

    const type = String(data?.type ?? "");
    const room = String(data?.room ?? "").trim();
    if (!room) return;

    if (type === "join") {
      leaveRoom(ws);
      joinRoom(room, ws);
      broadcast(room, { type: "status", room, message: "joined" }, ws);
      return;
    }

    if (type === "hello") {
      if (ws.__room !== room) joinRoom(room, ws);
      broadcast(room, { type: "hello", room }, ws);
      return;
    }

    if (type === "tilt") {
      if (ws.__room !== room) joinRoom(room, ws);
      const x = Number(data?.x ?? 0);
      const y = Number(data?.y ?? 0);
      broadcast(room, { type: "tilt", room, x, y }, ws);
      return;
    }
  });

  ws.on("close", () => leaveRoom(ws));
});

server.listen(PORT, () => {
  console.log("Server running at http://localhost:" + PORT);
});
