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
  text: "https://www.tesla.com/",
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

// Builds a renderer-agnostic list of primitives describing the QR code, so
// the canvas preview and the SVG export are always generated from identical
// geometry rather than two separate drawing implementations.
function buildShapes() {
  const matrix = buildMatrix(state.text, !!state.logoImage);
  const count = matrix.length;
  const moduleSize = CANVAS_SIZE / (count + QUIET_ZONE_MODULES * 2);
  const offset = moduleSize * QUIET_ZONE_MODULES;
  const shapes = [];

  shapes.push({
    type: "rect",
    x: 0,
    y: 0,
    w: CANVAS_SIZE,
    h: CANVAS_SIZE,
    r: 0,
    fill: state.bgColor,
  });

  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!matrix[row][col]) continue;
      if (isInFinderZone(row, col, count)) continue;
      shapes.push({
        type: "rect",
        x: offset + col * moduleSize,
        y: offset + row * moduleSize,
        w: moduleSize,
        h: moduleSize,
        r: (moduleSize / 2) * state.pixelRadius,
        fill: state.fgColor,
      });
    }
  }

  const finderOrigins = [
    [0, 0],
    [0, count - 7],
    [count - 7, 0],
  ];
  finderOrigins.forEach(([row, col]) => {
    const originX = offset + col * moduleSize;
    const originY = offset + row * moduleSize;
    const outerSize = moduleSize * 7;
    const ringSize = moduleSize * 5;
    const pupilSize = moduleSize * 3;

    shapes.push({
      type: "rect",
      x: originX,
      y: originY,
      w: outerSize,
      h: outerSize,
      r: (outerSize / 2) * state.eyeRadius,
      fill: state.fgColor,
    });
    shapes.push({
      type: "rect",
      x: originX + moduleSize,
      y: originY + moduleSize,
      w: ringSize,
      h: ringSize,
      r: (ringSize / 2) * state.eyeRadius,
      fill: state.bgColor,
    });
    shapes.push({
      type: "rect",
      x: originX + moduleSize * 2,
      y: originY + moduleSize * 2,
      w: pupilSize,
      h: pupilSize,
      r: (pupilSize / 2) * state.pupilRadius,
      fill: state.fgColor,
    });
  });

  if (state.logoImage) {
    const size = count * moduleSize * (state.logoSizePct / 100);
    const centerX = CANVAS_SIZE / 2;
    const centerY = CANVAS_SIZE / 2;
    const boxSize = size + size * 0.16 * 2;

    if (state.logoShape === "circle") {
      shapes.push({
        type: "circle",
        cx: centerX,
        cy: centerY,
        radius: boxSize / 2,
        fill: state.bgColor,
      });
    } else {
      shapes.push({
        type: "rect",
        x: centerX - boxSize / 2,
        y: centerY - boxSize / 2,
        w: boxSize,
        h: boxSize,
        r: state.logoShape === "rounded" ? boxSize * 0.28 : boxSize * 0.06,
        fill: state.bgColor,
      });
    }

    shapes.push({
      type: "image",
      x: centerX - size / 2,
      y: centerY - size / 2,
      w: size,
      h: size,
      href: state.logoImage.src,
      clipShape: state.logoShape,
      clipRadius: state.logoShape === "rounded" ? size * 0.24 : size * 0.04,
    });
  }

  return shapes;
}

function drawShapesToCanvas(shapes) {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  shapes.forEach((shape) => {
    if (shape.type === "rect") {
      ctx.fillStyle = shape.fill;
      roundRect(ctx, shape.x, shape.y, shape.w, shape.h, shape.r);
      ctx.fill();
      return;
    }

    if (shape.type === "circle") {
      ctx.fillStyle = shape.fill;
      ctx.beginPath();
      ctx.arc(shape.cx, shape.cy, shape.radius, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (shape.type === "image" && state.logoImage) {
      ctx.save();
      if (shape.clipShape === "circle") {
        ctx.beginPath();
        ctx.arc(shape.x + shape.w / 2, shape.y + shape.h / 2, shape.w / 2, 0, Math.PI * 2);
        ctx.clip();
      } else {
        roundRect(ctx, shape.x, shape.y, shape.w, shape.h, shape.clipRadius);
        ctx.clip();
      }
      ctx.drawImage(state.logoImage, shape.x, shape.y, shape.w, shape.h);
      ctx.restore();
    }
  });
}

function num(value) {
  return Math.round(value * 1000) / 1000;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildSvgString(shapes) {
  const defs = [];
  const body = [];
  let clipCounter = 0;

  shapes.forEach((shape) => {
    if (shape.type === "rect") {
      const rx = shape.r > 0 ? ` rx="${num(Math.min(shape.r, shape.w / 2, shape.h / 2))}"` : "";
      body.push(
        `<rect x="${num(shape.x)}" y="${num(shape.y)}" width="${num(shape.w)}" ` +
          `height="${num(shape.h)}"${rx} fill="${escapeXml(shape.fill)}"/>`
      );
      return;
    }

    if (shape.type === "circle") {
      body.push(
        `<circle cx="${num(shape.cx)}" cy="${num(shape.cy)}" ` +
          `r="${num(shape.radius)}" fill="${escapeXml(shape.fill)}"/>`
      );
      return;
    }

    if (shape.type === "image") {
      const clipId = `logo-clip-${clipCounter++}`;
      if (shape.clipShape === "circle") {
        defs.push(
          `<clipPath id="${clipId}"><circle cx="${num(shape.x + shape.w / 2)}" ` +
            `cy="${num(shape.y + shape.h / 2)}" r="${num(shape.w / 2)}"/></clipPath>`
        );
      } else {
        defs.push(
          `<clipPath id="${clipId}"><rect x="${num(shape.x)}" y="${num(shape.y)}" ` +
            `width="${num(shape.w)}" height="${num(shape.h)}" ` +
            `rx="${num(shape.clipRadius)}"/></clipPath>`
        );
      }
      // preserveAspectRatio="none" matches how canvas drawImage stretches the
      // logo to fill the box, keeping the SVG identical to the preview.
      // Both xlink:href and href are emitted: Illustrator and other SVG 1.1
      // consumers only read xlink:href, and without it they treat the logo as
      // a broken external link and drop it.
      body.push(
        `<image x="${num(shape.x)}" y="${num(shape.y)}" width="${num(shape.w)}" ` +
          `height="${num(shape.h)}" preserveAspectRatio="none" ` +
          `clip-path="url(#${clipId})" ` +
          `xlink:href="${escapeXml(shape.href)}" href="${escapeXml(shape.href)}"/>`
      );
    }
  });

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" ` +
    `width="${CANVAS_SIZE}" ` +
    `height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}">` +
    (defs.length ? `<defs>${defs.join("")}</defs>` : "") +
    body.join("") +
    `</svg>`
  );
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
  drawShapesToCanvas(buildShapes());
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

document.getElementById("downloadPngBtn").addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "qr-code.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

document.getElementById("downloadSvgBtn").addEventListener("click", () => {
  try {
    const svg = buildSvgString(buildShapes());
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = "qr-code.svg";
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    showFatalError("Could not export SVG: " + err.message);
    console.error(err);
  }
});

}
