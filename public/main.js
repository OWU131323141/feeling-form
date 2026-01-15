const $ = (id) => document.getElementById(id);

const uiInput = $("uiInput");
const uiArt   = $("uiArt");

const inputEl = $("input");
const countEl = $("count");
const statusEl = $("status");
const miniEl = $("mini");

function setStatus(msg){ statusEl.textContent = msg || ""; }
function setMini(msg){ miniEl.textContent = msg || ""; }

function clamp01(x){
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function show(which){
  if (which === "input"){
    uiInput.style.display = "flex";
    uiArt.style.display = "none";
    setMini("ready");
    setTimeout(() => inputEl.focus(), 50);
  } else {
    uiInput.style.display = "none";
    uiArt.style.display = "block";
    setMini("live");
  }
}

/* counter */
function updateCount(){
  const t = inputEl.value || "";
  countEl.textContent = String(Math.min(280, t.length));
}
inputEl.addEventListener("input", updateCount);
updateCount();

/* room */
function getRoom(){
  const params = new URLSearchParams(location.search);
  return params.get("room") || "1234";
}

/* WebSocket (PC=index is viewer) */
let ws;
function wsUrl(){
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}`;
}
function connectWS(){
  const room = getRoom();
  ws = new WebSocket(wsUrl());

  ws.onopen = () => {
    ws.send(JSON.stringify({ type:"join", room, role:"viewer" }));
  };

  ws.onmessage = (ev) => {
    let msg; try{ msg = JSON.parse(ev.data);}catch{return;}
    if (msg.type === "tilt"){
      window.tiltX = Number(msg.x ?? msg.tiltX ?? 0) || 0;
      window.tiltY = Number(msg.y ?? msg.tiltY ?? 0) || 0;
    }
  };

  ws.onclose = () => setTimeout(connectWS, 800);
  ws.onerror = () => { try{ ws.close(); }catch{} };
}
connectWS();

/* copy controller link */
$("copyRoomLink").addEventListener("click", async () => {
  const room = getRoom();
  const url = new URL(location.href);
  url.pathname = url.pathname.replace(/\/[^/]*$/, "/controller.html");
  url.search = `?room=${encodeURIComponent(room)}`;
  await navigator.clipboard.writeText(url.toString());
  setMini("copied ✓");
  setTimeout(() => setMini("live"), 1000);
});

/* back */
$("back").addEventListener("click", () => {
  show("input");
  setStatus("");
});

/* local sensor (optional) */
$("permission").addEventListener("click", async () => {
  try{
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      const state = await DeviceOrientationEvent.requestPermission();
      if (state !== "granted") return setStatus("sensor permission denied");
    }
    window.addEventListener("deviceorientation", (e) => {
      window.tiltX = e.gamma || 0;
      window.tiltY = e.beta || 0;
    }, true);
    setStatus("sensor enabled (this device)");
  }catch(e){
    console.error(e);
    setStatus("sensor error");
  }
});

/* HUD update */
function setHUD(feeling){
  $("vWarmth").textContent = clamp01(feeling.warmth).toFixed(2);
  $("vCalm").textContent   = clamp01(feeling.calm).toFixed(2);
  $("vEnergy").textContent = clamp01(feeling.energy).toFixed(2);
  $("keywords").textContent = (Array.isArray(feeling.keywords) ? feeling.keywords.slice(0,8) : ["mood"]).join(" / ");
}

/* generate */
$("send").addEventListener("click", async () => {
  const text = (inputEl.value || "").trim();
  if (!text) return setStatus("入力してね");

  try{
    setStatus("analyzing…");
    setMini("analyzing…");

    const feeling = await analyzeFeeling(text);
    const plan = await getMotionPlan(text, feeling);

    setHUD(feeling);
    show("art");

    window.dispatchEvent(new CustomEvent("FEELING_START", {
      detail: { text, feeling, plan }
    }));

    setStatus("");
    setMini(`live (room ${getRoom()})`);
  }catch(e){
    console.error(e);
    setStatus("LLM API error");
    setMini("error");
  }
});

/* init */
window.addEventListener("load", () => {
  show("input");
  setMini(`ready (room ${getRoom()})`);
});
