const $ = (id) => document.getElementById(id);

function setStatus(msg) {
  $("status").textContent = msg || "";
}

$("send").addEventListener("click", async () => {
  const text = $("input").value.trim();
  if (!text) return setStatus("入力してください。");

  try {
    setStatus("analyzing…");

    const feeling = await analyzeFeeling(text);
    const pinterest = await analyzePinterest(feeling.keywords);

    visualData = { ...visualData, ...feeling, ...pinterest };

    life = 1.0;
    fading = false;
    generatedTime = millis();
    memoryLayer.saved = false;

    setStatus(`warmth:${visualData.warmth.toFixed(2)} calm:${visualData.calm.toFixed(2)} energy:${visualData.energy.toFixed(2)}`);
  } catch (e) {
    console.error(e);
    setStatus("LLM API error. サーバ・キー・endpointを確認してください。");
  }
});

$("permission").addEventListener("click", async () => {
  try {
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function"
    ) {
      const state = await DeviceOrientationEvent.requestPermission();
      if (state !== "granted") return setStatus("センサー許可が拒否されました。");
    }
    window.addEventListener("deviceorientation", (event) => {
      tiltX = event.gamma || 0;
      tiltY = event.beta || 0;
    });
    setStatus("sensor enabled");
  } catch (e) {
    console.error(e);
    setStatus("sensor error");
  }
});
