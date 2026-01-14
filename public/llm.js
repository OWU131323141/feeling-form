async function analyzeFeeling(text) {
  const r = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });

  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || "LLM analyze failed");
  return data;
}
