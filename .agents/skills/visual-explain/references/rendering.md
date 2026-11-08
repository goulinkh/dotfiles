# Scene contract, verification and export

Optional reference for API questions, requested thorough verification or video
export. Do not run this whole workflow for the default lightweight prototype.

## Required API

```js
window.scene = {
  duration: 20,             // finite positive seconds
  width: 1600, height: 900, // integer design/export pixels
  chapters: [{ time: 0, title: 'The question' }],
  ready: Promise.resolve(),
  render(t) { /* draw a complete frame */ },
  setCaptureMode(enabled) { /* pause, hide controls, lock stage dimensions */ }
};
```

`#stage` is the sole export surface. In capture mode its bounding rectangle must
match width/height at a viewport of those dimensions. Keep playback controls
and source details outside it. The first call to `render(t)` must work for any
finite time once `ready` resolves; clamp to `[0, duration]`. Reject NaN and
infinities. Use even dimensions for standard H.264/yuv420p export.

`ready` resolves after all fonts, decoded images, geometry and required shader
preparation are ready, or rejects with an actionable error. Avoid lazy loading
that changes a frame after the promise has resolved. Render synchronously;
the screenshot is taken immediately after the call returns. Avoid media and
async tasks inside `render`.

Changing controls or capture mode must not change the meaning of time or the
visual state at a given timestamp. The stage must be independent of its prior
frames. Do not animate caption layout or font loading independently.

## How to make time pure

Compute positions, opacity and visibility from absolute time:

```js
const clamp01 = x => Math.min(1, Math.max(0, x));
const progress = (t, start, end) => clamp01((t - start) / (end - start));
const ease = p => p * p * (3 - 2 * p);
const x = (a, b, p) => a + (b - a) * p;

function render(t) {
  // Explicit values even before/after this beat. No dependence on the last x.
  token.setAttribute('cx', x(100, 700, ease(progress(t, 5, 9))));
}
```

- **SVG/DOM:** assign all mutable attributes/content; don't append another copy
  on each render or use CSS transitions/animation/SMIL for scene motion.
- **Canvas:** reset transform, alpha and compositing; clear/fill the whole
  frame; redraw from fixed data. Balance save/restore calls.
- **Three.js:** assign every changing transform, camera, material and uniform;
  use `t` for shader time, not `Clock.getElapsedTime()`. Disable temporal effects
  that rely on the previous frame. Explicitly call the renderer.
- **Shaders:** fixed resolution, deterministic inputs; avoid temporal noise,
  feedback buffers, audio clocks or frame-counter uniforms.
- **Simulations:** use a closed-form solution or precomputed fixed trajectory;
  never step forward from the last frame.
- **Randomness:** prefer fixed seeded scene data generated once, or a stateless
  hash of object index and fixed seed. Don't advance a PRNG on each render.

The preview loop may use `performance.now()` only to choose the timestamp
passed to the renderer. Export never waits real time. Start paused, and respect
reduced-motion preferences with a static/manual alternative. Controls should
have labels, keyboard focus and readable status; do not announce captions to
screen readers on every animation frame.

The starter `../assets/scene.html` is a blank playback shell, not a visual
treatment. Reuse its transport code if helpful; create subject-specific artwork
and deterministic rendering, update the accessible description and source notes.
Never deliver the empty scaffold as the user's explanation.

## Browser verification

Use available browser tools first. The optional bundled Node script requires
Playwright, but generated SVG/HTML scenes themselves require no Node packages.
Keep dependencies in the output project, never in dotfiles or the input repo.
Ask before installing large browser runtimes. For example, if authorised:

```sh
cd <output-project>
npm install --save-dev playwright
# Only if a suitable browser is not already available:
npx playwright install chromium
```

Alternatively set `CHROMIUM_EXECUTABLE_PATH` to an existing compatible browser
executable. Do not change an existing browser profile; Playwright uses an
isolated context. Run from the output project so Playwright resolves there:

```sh
node <skill-dir>/scripts/capture.mjs index.html verification
```

Use a new/empty destination. The script blocks HTTP(S) requests, checks the API,
captures first/last/quarter and chapter-boundary frames, compares repeated
out-of-order timestamps and fresh page loads, and writes sample images plus
`capture.json`. Every scene asset must therefore be local or inline. Keep the
browser build, device scale, viewport and fonts fixed for reproducibility;
cross-device pixel identity is not promised. The script accepts local HTML,
not a remote URL, and is for trusted generated scenes, not untrusted source
HTML. If a library needs HTTP/module loading, adapt a local-only server and
capture flow without making public requests, or bundle it into the HTML.

Inspect the images, not only the report. Capture additional beat/transition
midpoints if not covered by the samples. Check at half-size and check controls
in a narrow browser. Verify facts and visual causality against the actual source
and the scene's source notes (or `sources.md` if separately requested).
Pixel equality at sampled timestamps does not prove all times are deterministic.
If the test fails, fix the renderer rather than hiding the nondeterminism with
arbitrary delays, patched random functions or screenshot animations settings.

## Optional video export

Only when requested. Frame generation may take time and substantial disk
space. The same script first verifies the scene, then captures exact times:

```sh
node <skill-dir>/scripts/capture.mjs index.html frames --frames --fps=30
ffmpeg -n -framerate 30 -start_number 0 -i frames/frame-%06d.png \
  -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart explanation.mp4
```

Each frame is `render(i / fps)` for `0 <= i < ceil(duration * fps)`; the video
length rounds up to a whole frame. `-n` refuses to overwrite an existing video.
Confirm installed encoders rather than assuming FFmpeg includes libx264.
Verify output duration, dimensions, first/last frames and playback, and retain
the editable HTML and source notes. Do not call this a screen recording.

Narration is opt-in. Put the editable script and timing cues in the output
project, align audio to this timeline, and validate both audio and captions.
Never send private source content to an external voice API without approval.
