# visual-explain

A small visual demonstration, not a moving document. Works with the model you
select; no provider API calls or model switching are built into the skill.

## Use

Reload Pi with `/reload`, then, for example:

```text
/visual-explain ~/Downloads/ubuntu-project-ebooks/01-understanding-ubuntu.epub — explain phased updates
/visual-explain https://github.com/OWNER/REPO/pull/123 — show the behavior that changed
/visual-explain /path/to/repo — show why the second lookup is faster
```

Pi also supports `/skill:visual-explain`. Claude Code discovers the linked
skill as `/visual-explain` (restart if needed). Other compatible agents can
read `SKILL.md`. Existing `/explain` stays unchanged.

## New default: prototype first

1. Read the target and only the context needed for one mechanism.
2. Describe the visual idea in at most three sentences.
3. Build one HTML file: one stable scene, one example, roughly 15–30 seconds.
4. Do a small browser check if available, then stop for feedback.

The scene should demonstrate something you can see: accumulation, propagation,
blocking, transformation, comparison. It should remain useful with its caption
hidden. Aim for 15 or fewer words on the stage, not paragraphs in boxes.
Controls and collapsed source notes sit below it.

Small scope does not mean primitive visuals. The first prototype should use
intentional, subject-specific illustration: cutaways, layered spatial views,
meaningful particles, geometric constructions, or 3D/shaders where warranted.
Choose the rendering medium for the explanation; don't default to boxes and
arrows, decorative transitions or a generic aesthetic. Advanced rendering is
allowed without a separate opt-in; new dependency installations still require
approval. Spend effort on one crafted visual rather than a larger diagram.

No mandatory research documents, storyboard files, README, dependency installs,
large screenshot matrices or video export. The default output is `index.html`
in a new output folder. A broad topic is narrowed to one useful example, not
converted into a comprehensive animated architecture diagram.

Add `plan only`, `approve treatment first`, audience, focus, duration or an
output directory as needed. Add `export video` or request thorough verification
only when you want the heavier capture workflow. No narration by default.

## Optional supporting resources

- `assets/scene.html`: blank playback shell; no visual treatment to imitate.
- `references/sources.md`: EPUB, PR and other extraction/context guidance.
- `references/rendering.md`: rendering details, verification and FFmpeg export.
- `scripts/capture.mjs`: Playwright determinism checks and frame capture.

Only load those resources when needed. The HTML needs just a browser.
Automated capture needs Playwright and a browser; video encoding also needs
FFmpeg. Keep any optional dependencies in the output project, not dotfiles.

The deterministic `render(t)` contract is retained. Technical correctness is
necessary, but doesn't establish that the visual explanation is useful; the
first prototype is deliberately small so the user can judge that cheaply.
