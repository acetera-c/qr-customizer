// QR Customizer — vanilla JS, no build step.
// Uses the tiny `qrcode-generator` library (vendored locally, see
// qrcode-generator.js — no external network dependency) purely to compute
// the dark/light module matrix; all visual rendering (colors, rounded
// pixels, eye/pupil radius, center logo) is done by hand on a <canvas>.

function showFatalError(message) {
  const banner = document.getElementById("errorBanner");
  if (!banner) {
    window.alert(message);
    return;
  }
  banner.hidden = false;
  banner.textContent = message;
}

if (typeof qrcode !== "function") {
  showFatalError(
    "Could not load the QR encoding library (qrcode-generator.js). " +
      "Make sure qrcode-generator.js is in the same folder as index.html, " +
      "and that you're loading this page over http:// (via the included " +
      "server) rather than double-clicking the file, since some browsers " +
      "restrict local script loading for file:// pages."
  );
  throw new Error("qrcode-generator library not found");
}

const canvas = document.getElementById("qrCanvas");
const ctx = canvas.getContext("2d");
const CANVAS_SIZE = canvas.width; // square canvas
const QUIET_ZONE_MODULES = 3;

const state = {
  text: "https://cursor.com",
  fgColor: "#000000",
  bgColor: "#ffffff",
  pixelRadius: 0, // 0-1
  eyeRadius: 0, // 0-1 (outer finder square)
  pupilRadius: 0, // 0-1 (inner finder square)
  logoImage: null, // HTMLImageElement | null
  logoSizePct: 22, // % of QR width
  logoShape: "square", // square | rounded | circle
};

function buildMatrix(text, useHighErrorCorrection) {
  const ecLevel = useHighErrorCorrection ? "H" : "Q";
  const qr = qrcode(0, ecLevel);
  qr.addData(text || " ");
  qr.make();
  const count = qr.getModuleCount();
  const matrix = [];
  for (let r = 0; r < count; r++) {
    const row = [];
    for (let c = 0; c < count; c++) {
      row.push(qr.isDark(r, c));
    }
    matrix.push(row);
  }
  return matrix;
}

function isInFinderZone(row, col, count) {
  const zones = [
    [0, 0],
    [0, count - 7],
    [count - 7, 0],
  ];
  return zones.some(([zr, zc]) => row >= zr && row < zr + 7 && col >= zc && col < zc + 7);
}

function roundRect(c, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + radius, y);
  c.arcTo(x + w, y, x + w, y + h, radius);
  c.arcTo(x + w, y + h, x, y + h, radius);
  c.arcTo(x, y + h, x, y, radius);
  c.arcTo(x, y, x + w, y, radius);
  c.closePath();
}

function drawFinderPattern(c, originX, originY, moduleSize, eyeRadiusPct, pupilRadiusPct) {
  const outerSize = moduleSize * 7;
  const ringSize = moduleSize * 5;
  const pupilSize = moduleSize * 3;

  c.fillStyle = state.fgColor;
  roundRect(c, originX, originY, outerSize, outerSize, (outerSize / 2) * eyeRadiusPct);
  c.fill();

  c.fillStyle = state.bgColor;
  roundRect(
    c,
    originX + moduleSize,
    originY + moduleSize,
    ringSize,
    ringSize,
    (ringSize / 2) * eyeRadiusPct
  );
  c.fill();

  c.fillStyle = state.fgColor;
  roundRect(
    c,
    originX + moduleSize * 2,
    originY + moduleSize * 2,
    pupilSize,
    pupilSize,
    (pupilSize / 2) * pupilRadiusPct
  );
  c.fill();
}

function drawLogo(c, centerX, centerY, size) {
  if (!state.logoImage) return;

  const padding = size * 0.16;
  const boxSize = size + padding * 2;
  const boxX = centerX - boxSize / 2;
  const boxY = centerY - boxSize / 2;

  c.save();
  c.fillStyle = state.bgColor;
  if (state.logoShape === "circle") {
    c.beginPath();
    c.arc(centerX, centerY, boxSize / 2, 0, Math.PI * 2);
    c.fill();
  } else {
    const r = state.logoShape === "rounded" ? boxSize * 0.28 : boxSize * 0.06;
    roundRect(c, boxX, boxY, boxSize, boxSize, r);
    c.fill();
  }
  c.restore();

  c.save();
  const imgX = centerX - size / 2;
  const imgY = centerY - size / 2;
  if (state.logoShape === "circle") {
    c.beginPath();
    c.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
    c.clip();
  } else {
    const r = state.logoShape === "rounded" ? size * 0.24 : size * 0.04;
    roundRect(c, imgX, imgY, size, size, r);
    c.clip();
  }
  c.drawImage(state.logoImage, imgX, imgY, size, size);
  c.restore();
}

function render() {
  try {
    renderUnsafe();
    document.getElementById("errorBanner").hidden = true;
  } catch (err) {
    showFatalError("Error while rendering the QR code: " + err.message);
    console.error(err);
  }
}

function renderUnsafe() {
  const useHighEC = !!state.logoImage;
  const matrix = buildMatrix(state.text, useHighEC);
  const count = matrix.length;
  const moduleSize = CANVAS_SIZE / (count + QUIET_ZONE_MODULES * 2);
  const offset = moduleSize * QUIET_ZONE_MODULES;

  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.fillStyle = state.bgColor;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  ctx.fillStyle = state.fgColor;
  for (let r = 0; r < count; r++) {
    for (let c2 = 0; c2 < count; c2++) {
      if (!matrix[r][c2]) continue;
      if (isInFinderZone(r, c2, count)) continue;
      const x = offset + c2 * moduleSize;
      const y = offset + r * moduleSize;
      const radius = (moduleSize / 2) * state.pixelRadius;
      roundRect(ctx, x, y, moduleSize, moduleSize, radius);
      ctx.fill();
    }
  }

  const finderOrigins = [
    [0, 0],
    [0, count - 7],
    [count - 7, 0],
  ];
  finderOrigins.forEach(([r, c2]) => {
    drawFinderPattern(
      ctx,
      offset + c2 * moduleSize,
      offset + r * moduleSize,
      moduleSize,
      state.eyeRadius,
      state.pupilRadius
    );
  });

  if (state.logoImage) {
    const qrPixelWidth = count * moduleSize;
    const logoSize = qrPixelWidth * (state.logoSizePct / 100);
    drawLogo(ctx, CANVAS_SIZE / 2, CANVAS_SIZE / 2, logoSize);
  }
}

function hexFromHue(hue) {
  const c = hslToRgb(hue / 360, 0.85, 0.5);
  return rgbToHex(c[0], c[1], c[2]);
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

// --- Wiring up UI ---
// Wrapped in a try/catch so that if a required element is ever missing,
// we show a visible error instead of silently leaving every control dead.
try {
  wireUpUI();
  render();
} catch (err) {
  showFatalError("Error setting up the QR customizer UI: " + err.message);
  console.error(err);
}

function wireUpUI() {

document.getElementById("qrText").addEventListener("input", (e) => {
  state.text = e.target.value;
  render();
});

document.getElementById("fgColor").addEventListener("input", (e) => {
  state.fgColor = e.target.value;
  syncActiveSwatch(null);
  render();
});

document.getElementById("bgColor").addEventListener("input", (e) => {
  state.bgColor = e.target.value;
  render();
});

document.getElementById("hueSlider").addEventListener("input", (e) => {
  const hex = hexFromHue(Number(e.target.value));
  state.fgColor = hex;
  document.getElementById("fgColor").value = hex;
  syncActiveSwatch(null);
  render();
});

document.querySelectorAll(".swatch-toggle").forEach((el) => {
  el.addEventListener("click", () => {
    state.fgColor = el.dataset.color;
    document.getElementById("fgColor").value = el.dataset.color;
    syncActiveSwatch(el);
    render();
  });
});

function syncActiveSwatch(activeEl) {
  document.querySelectorAll(".swatch-toggle").forEach((el) => {
    el.classList.toggle("active", el === activeEl);
  });
}

document.getElementById("pixelSlider").addEventListener("input", (e) => {
  state.pixelRadius = Number(e.target.value) / 100;
  document.getElementById("pixelValue").textContent = `${e.target.value}%`;
  render();
});

document.getElementById("eyeSlider").addEventListener("input", (e) => {
  state.eyeRadius = Number(e.target.value) / 100;
  document.getElementById("eyeValue").textContent = `${e.target.value}%`;
  render();
});

document.getElementById("pupilSlider").addEventListener("input", (e) => {
  state.pupilRadius = Number(e.target.value) / 100;
  document.getElementById("pupilValue").textContent = `${e.target.value}%`;
  render();
});

document.getElementById("logoSizeSlider").addEventListener("input", (e) => {
  state.logoSizePct = Number(e.target.value);
  document.getElementById("logoSizeValue").textContent = `${e.target.value}%`;
  render();
});

document.querySelectorAll(".shape-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".shape-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    state.logoShape = btn.dataset.shape;
    render();
  });
});

const logoInput = document.getElementById("logoInput");
const logoUploadBtn = document.getElementById("logoUploadBtn");
const logoRemoveBtn = document.getElementById("logoRemoveBtn");

logoUploadBtn.addEventListener("click", () => logoInput.click());

logoInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      state.logoImage = img;
      logoRemoveBtn.hidden = false;
      render();
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

logoRemoveBtn.addEventListener("click", () => {
  state.logoImage = null;
  logoInput.value = "";
  logoRemoveBtn.hidden = true;
  render();
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`.panel[data-panel="${tab.dataset.tab}"]`).classList.add("active");
  });
});

document.getElementById("downloadBtn").addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "qr-code.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

}
