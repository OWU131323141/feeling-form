// Feeling → Form (stable)
// ✅ noLoopしない / fadeしない / canvas消さない
// ✅ UI切替で真っ黒事故にならない

let visualData = {
  motion: "drift",
  hue: 210, sat: 40, bri: 80,
  baseRadius: 140,
  noiseScale: 0.8,
  noiseAmp: 35,
  rotSpeed: 0.004,
  strokeW: 1.2,
  breathSpeed: 0.9,
  pulsePower: 2.0,
  jitter: 2.0
};

let tiltX = 0, tiltY = 0;

function setup(){
  pixelDensity(1);
  frameRate(30);
  setAttributes("antialias", false);
  createCanvas(windowWidth, windowHeight, WEBGL);
  colorMode(HSB, 360, 100, 100, 100);
  noiseDetail(3, 0.5);

  window.__FEELING_FORM__ = {
    getCanvas: () => document.querySelector("canvas"),
    getState: () => ({ visualData, tiltX, tiltY })
  };

  window.addEventListener("FEELING_START", (ev) => {
    const plan = ev?.detail?.plan || {};
    applyPlan(plan);
  });
}

function windowResized(){ resizeCanvas(windowWidth, windowHeight); }

function applyPlan(plan){
  if (!plan || typeof plan !== "object") return;

  const m = String(plan.motion || "").trim();
  if (["breathing","tremble","pulse","drift"].includes(m)) visualData.motion = m;

  const p = plan.params || {};
  visualData.hue        = clamp(num(p.hue, visualData.hue), 0, 360);
  visualData.sat        = clamp(num(p.sat, visualData.sat), 10, 95);
  visualData.bri        = clamp(num(p.bri, visualData.bri), 10, 95);

  visualData.baseRadius = clamp(num(p.baseRadius, visualData.baseRadius), 70, 240);
  visualData.noiseScale = clamp(num(p.noiseScale, visualData.noiseScale), 0.2, 1.6);
  visualData.noiseAmp   = clamp(num(p.noiseAmp, visualData.noiseAmp), 5, 110);

  visualData.rotSpeed   = clamp(num(p.rotSpeed, visualData.rotSpeed), 0.0005, 0.016);
  visualData.strokeW    = clamp(num(p.strokeW, visualData.strokeW), 0.6, 2.2);

  visualData.breathSpeed= clamp(num(p.breathSpeed, visualData.breathSpeed), 0.2, 2.2);
  visualData.pulsePower = clamp(num(p.pulsePower, visualData.pulsePower), 1.0, 4.0);
  visualData.jitter     = clamp(num(p.jitter, visualData.jitter), 0, 12);
}

function draw(){
  if (typeof window.tiltX === "number") tiltX = window.tiltX;
  if (typeof window.tiltY === "number") tiltY = window.tiltY;

  background(0,0,0,100);

  const rx = map(tiltY, -45, 45, -1.0, 1.0);
  const ry = map(tiltX, -45, 45, -1.0, 1.0);
  const rotBase = Number(visualData.rotSpeed || 0.004);

  const motion = visualData.motion || "drift";
  if (motion === "drift"){
    rotateX(rx + frameCount * rotBase * 0.45);
    rotateY(ry + frameCount * rotBase * 0.55);
  } else if (motion === "breathing"){
    rotateX(rx + frameCount * rotBase * 0.28);
    rotateY(ry + frameCount * rotBase * 0.28);
  } else if (motion === "pulse"){
    rotateX(rx + frameCount * rotBase * 0.75);
    rotateY(ry + frameCount * rotBase * 0.95);
  } else { // tremble
    rotateX(rx + frameCount * rotBase * 0.7 + sin(frameCount * 0.10) * 0.04);
    rotateY(ry + frameCount * rotBase * 0.7 + cos(frameCount * 0.09) * 0.04);
  }

  noFill();
  stroke(Number(visualData.hue), Number(visualData.sat), Number(visualData.bri), 85);
  strokeWeight(Number(visualData.strokeW));

  const baseRadius0 = Number(visualData.baseRadius);
  const noiseScale  = Number(visualData.noiseScale);
  const noiseAmp0   = Number(visualData.noiseAmp);
  const t = frameCount * 0.012;

  let radiusMod = 0;
  if (motion === "breathing"){
    const sp = Number(visualData.breathSpeed);
    radiusMod = sin(frameCount * 0.018 * sp) * 18;
  } else if (motion === "pulse"){
    const pow = Number(visualData.pulsePower);
    const s = (sin(frameCount * 0.06) + 1) / 2;
    radiusMod = (Math.pow(s, pow) - 0.25) * 55;
  } else if (motion === "tremble"){
    const j = Number(visualData.jitter);
    radiusMod = (noise(t * 7, 10) - 0.5) * 24 + sin(frameCount * 0.33) * j;
  } else {
    radiusMod = sin(frameCount * 0.008) * 14;
  }

  const tiltEffect = map(Math.abs(tiltX), 0, 45, 0, 90);
  const r = (baseRadius0 + radiusMod + tiltEffect);

  drawSphereStrip(r, noiseScale, noiseAmp0, t);
}

function drawSphereStrip(r, noiseScale, noiseAmp, t){
  const detailLat = 20;
  const detailLon = 22;

  for (let i=0; i<detailLat; i++){
    const lat1 = map(i, 0, detailLat, -HALF_PI, HALF_PI);
    const lat2 = map(i+1, 0, detailLat, -HALF_PI, HALF_PI);
    beginShape(TRIANGLE_STRIP);
    for (let j=0; j<=detailLon; j++){
      const lon = map(j, 0, detailLon, -PI, PI);
      vtx(r, lat1, lon, noiseScale, noiseAmp, t);
      vtx(r, lat2, lon, noiseScale, noiseAmp, t);
    }
    endShape();
  }
}

function vtx(r, lat, lon, noiseScale, noiseAmp, t){
  const nx = cos(lat) * cos(lon);
  const ny = sin(lat);
  const nz = cos(lat) * sin(lon);
  const n = noise(nx * noiseScale + 10, ny * noiseScale + 10, nz * noiseScale + t);
  const rr = r + (n - 0.5) * 2 * noiseAmp;
  vertex(rr * nx, rr * ny, rr * nz);
}

function num(v,f){ const n=Number(v); return Number.isFinite(n)?n:f; }
function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }
