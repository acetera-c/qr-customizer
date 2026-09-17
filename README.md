# QR Customizer

A dependency-free, browser-based tool for generating customizable QR codes — change the color, round the pixel corners, adjust the eye/pupil radius, and drop a logo in the center.

No build step, no `npm install`, and **no external network requests** — the QR encoding library (`qrcode-generator.js`) is vendored locally in this folder instead of loaded from a CDN, so the tool works fully offline and isn't affected by network/firewall restrictions. All visual rendering (colors, rounded modules, eye/pupil shaping, logo overlay) is done locally with `<canvas>`.

> Note: this project was built without a JS build tool (Vite/React) because Node.js, npm, and Homebrew aren't installed on this machine, and installing Xcode Command Line Tools requires an interactive GUI step. If you'd like a React version later, install Node (e.g. via [nodejs.org](https://nodejs.org) or Homebrew) and ask to have it converted.

## Running it

**Recommended:** serve it locally rather than double-clicking the file, since some browsers restrict local scripts when opened directly via `file://`:

```bash
perl serve.pl 8765
```

(`python3 -m http.server` would also work, but `python3`/Node/Homebrew aren't functional on this machine since Xcode Command Line Tools aren't installed — `serve.pl` is a tiny zero-dependency Perl static file server included for that reason.)

Then visit `http://localhost:8765`.

If something goes wrong, a red error banner will appear at the top of the page with details — open the browser's DevTools console (usually `Cmd+Option+I`) for the full stack trace if you need to debug further.

## Features

- **Content** — encode any URL or text.
- **Color** — pick a foreground and background color, or use the hue slider for quick picks.
- **Pixels** — slider to round the QR data modules from sharp squares to soft dots.
- **Pupils** — independent radius sliders for the outer "eye frame" and inner "pupil" of each finder pattern corner.
- **Center logo** — upload an image, choose a square / rounded / circular frame, and adjust its size. Error correction automatically switches to high (H) when a logo is present, to keep the code scannable.
- **Download** — export the result as a PNG.

## Files

- `index.html` — markup and layout
- `style.css` — dark-themed styling
- `app.js` — QR matrix generation glue + custom canvas rendering + UI wiring
