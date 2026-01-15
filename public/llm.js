async function postJson(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(`HTTP ${r.status}`);
    e.data = data;
    throw e;
  }
  return data;
}

async function analyzeFeeling(text) {
  return await postJson("/api/analyze", { text });
}

async function getMotionPlan(text, feeling) {
  return await postJson("/api/motionplan", { text, feeling });
}
