let visualData = {
  warmth: 0.5,
  calm: 0.5,
  energy: 0.5,
  avgHue: 200,
  brightness: 0.5,
  contrast: 0.5
};

let tiltX = 0;
let tiltY = 0;

let life = 0;
let fading = false;
let generatedTime = 0;

let memoryLayer;

function setup() {
  createCanvas(windowWidth, windowHeight, WEBGL);
  colorMode(HSB, 360, 100, 100, 100);
  noiseDetail(4, 0.5);

  memoryLayer = createGraphics(windowWidth, windowHeight, WEBGL);
  memoryLayer.colorMode(HSB, 360, 100, 100, 100);
  memoryLayer.saved = false;

  life = 0;
  generatedTime = millis();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  const old = memoryLayer;
  memoryLayer = createGraphics(windowWidth, windowHeight, WEBGL);
  memoryLayer.colorMode(HSB, 360, 100, 100, 100);
  memoryLayer.push(); memoryLayer.clear(); memoryLayer.pop();
  memoryLayer.saved = false;
  void old;
}

function draw() {
  const bgA = map(life, 0, 1, 80, 20);
  background(0, 0, 0, bgA);

  // 痕跡
  push();
  resetMatrix();
  image(memoryLayer, -width / 2, -height / 2);
  pop();

  if (life <= 0) {
    drawEndHint();
    return;
  }

  // 15秒で終焉へ
  if (!fading && millis() - generatedTime > 15000) fading = true;
  if (fading) life = max(0, life - 0.002);

  // 傾きで視点
  const rx = map(tiltY, -45, 45, -0.6, 0.6);
  const ry = map(tiltX, -45, 45, -0.6, 0.6);
  rotateX(rx + frameCount * 0.001);
  rotateY(ry + frameCount * 0.002);

  const baseRadius = map(visualData.energy, 0, 1, 90, 240) * life;
  const noiseScale = map(visualData.calm, 0, 1, 0.25, 1.6);
  const t = frameCount * 0.01;

  const sat = map(visualData.warmth, 0, 1, 25, 80);
  const bri = map(visualData.brightness, 0, 1, 55, 95);

  noFill();
  stroke(visualData.avgHue, sat, bri, life * 80);
  strokeWeight(1.2);

  drawOrganicSphere(baseRadius, noiseScale, t);

  // 残り香保存
  if (life <= 0.02 && !memoryLayer.saved) saveMemoryLayer(t);
}

function drawEndHint() {
  push();
  resetMatrix();
  fill(255, 35);
  textAlign(CENTER, CENTER);
  textSize(14);
  text("Generate to feel again", 0, height / 2);
  pop();
}

function saveMemoryLayer(t) {
  memoryLayer.saved = true;
  memoryLayer.push();
  memoryLayer.clear();
  memoryLayer.rotateY(frameCount * 0.001);
  memoryLayer.rotateX(frameCount * 0.001);
  memoryLayer.noFill();
  memoryLayer.stroke(visualData.avgHue, 40, 80, 15);
  memoryLayer.strokeWeight(1);
  drawOrganicSphere.call(memoryLayer, 130, 0.9, t);
  memoryLayer.pop();
}

function drawOrganicSphere(r, noiseScale, t) {
  const g = this || window;
  const detail = 30;

  for (let i = 0; i < detail; i++) {
    const lat = map(i, 0, detail, -HALF_PI, HALF_PI);
    g.beginShape();
    for (let j = 0; j <= detail; j++) {
      const lon = map(j, 0, detail, -PI, PI);
      const nx = cos(lat) * cos(lon);
      const ny = sin(lat);
      const nz = cos(lat) * sin(lon);

      const n = noise(nx * noiseScale + 10, ny * noiseScale + 10, nz * noiseScale + t);
      const tiltEffect = map(abs(tiltX), 0, 45, 0, 40);

      const radius = r + (n * 60 + tiltEffect) * life;
      g.vertex(radius * nx, radius * ny, radius * nz);
    }
    g.endShape();
  }
}
