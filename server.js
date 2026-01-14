import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.post("/api/analyze", async (req, res) => {
  try {
    const { text } = req.body ?? {};
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "text is required" });
    }

    const endpoint = process.env.OPENAI_API_ENDPOINT;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!endpoint) return res.status(500).json({ error: "OPENAI_API_ENDPOINT is not set" });
    if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY is not set" });

    // OpenAI Chat Completions互換(proxy想定)
    const payload = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "あなたは感情解析APIです。ユーザー文章から感情を数値化し、指定のJSONのみを返してください。余計な文章は禁止です。"
        },
        {
          role: "user",
          content:
  "以下の文章から感情を解析し、JSONだけを返してください。\n\n" +
  "出力JSON（必須）:\n" +
  "{\n" +
  '  "warmth": 0〜1,\n' +
  '  "calm": 0〜1,\n' +
  '  "energy": 0〜1,\n' +
  '  "keywords": ["...","..."]\n' +
  "}\n\n" +
  "文章:\n" +
  '"""' + text + '"""'

        }
      ],
      temperature: 0.3
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
      return res.status(r.status).json({
        error: "LLM proxy request failed",
        details: data
      });
    }

    const content = data?.choices?.[0]?.message?.content ?? "";

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      return res.status(502).json({
        error: "Model output was not valid JSON",
        raw: content,
        full: data
      });
    }

    const clamp01 = (x) => Math.max(0, Math.min(1, Number(x)));
    const safe = {
      warmth: clamp01(parsed.warmth),
      calm: clamp01(parsed.calm),
      energy: clamp01(parsed.energy),
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.map(String).slice(0, 8)
        : ["mood"]
    };

    return res.json(safe);
  } catch (e) {
    return res.status(500).json({ error: "server error", message: String(e) });
  }
});

// Cloud Shellは8080プレビューが基本
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
console.log("Server running at http://localhost:" + PORT);
});
