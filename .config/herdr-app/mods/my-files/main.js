// A lazy file browser for the focused pane's folder, with bounded read-only previews.
//
// my-files: Herdr's files mod with a better preview.
// - Code is lexed by ./highlight.js (TypeScript, Go, Rust, Python, shell,
//   YAML, TOML, Markdown, HTML, diffs, ...) instead of the Editor's syntect
//   grammars, which have no TypeScript and color most of a typed file green.
// - Markdown files render (README, docs), with a Source toggle.
// - Other mods open a file here at a line range by setting shared
//   "my-files.open" = { path, on, line, end, at }: the tree unfolds to it and
//   the preview scrolls to the range and tints it. The my-file-links picker
//   (cmd-shift-o, or the header button) uses it for paths in the terminal.
// The preview is no longer an editor: text can't be selected there.
import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, Scrollbar, TextView, v_virtual_list, VirtualListScrollHandle } from "gpui-base";
import { spaces, panes, focused, exec, readTextFile, watchFolder, theme, settings, window, shared, setShared, run, nextCommand } from "herdr";
import { Highlighter, languageFor, tokenStyles } from "./highlight.js";

function location() {
  const space = spaces().find(s => s.active), f = focused();
  const pane = f?.pane ? panes().find(p => p.pane === f.pane) : null;
  const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] : null) : space?.machine ?? null;
  return { cwd: pane?.cwd || f?.cwd || space?.folder, on, space: space?.id };
}
const key = () => JSON.stringify(location());
const PER_FOLDER = 500, TOTAL = 5000;
const CODE_TEXT = 12, CODE_ROW = 19, TAB = "    ", MAX_TEXT = 400000;
const OPEN = "my-files.open";
const absolute = (path) => /^(\/|[A-Za-z]:[\\/])/.test(path);
const tint = (color, alpha) => /^#[0-9a-fA-F]{6}$/.test(color) ? color + alpha : color;
const range = (target) => target ? (target.end && target.end !== target.line ? `${target.line}–${target.end}` : `${target.line}`) : "";

async function directory(path, on) {
  if (!on && window()?.platform === "windows") {
    // Windows PowerShell otherwise uses the console code page; exec decodes UTF-8.
    // Reparse points keep directory attributes even when dangling; check their target.
    const r = await exec("powershell", ["-NoProfile", "-Command", "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); & { param($p) @(Get-ChildItem -LiteralPath $p -Force -ErrorAction Stop | Where-Object Name -ne '.git' | Select-Object -First 501 | ForEach-Object { @{ name=$_.Name; dir=($_.PSIsContainer -and (-not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -or ($_.Target -and [IO.Directory]::Exists(([IO.Path]::Combine([IO.Path]::GetDirectoryName($_.FullName), $_.Target[0])))))) } }) | ConvertTo-Json -Compress } '" + path.replaceAll("'", "''") + "'"]);
    if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
    const result = JSON.parse(r.stdout || "[]");
    return Array.isArray(result) ? result : [result];
  }
  const script = 'n=0; for p in "$1"/* "$1"/.[!.]* "$1"/..?*; do [ -e "$p" ] || [ -L "$p" ] || continue; name=${p##*/}; [ "$name" = .git ] && continue; if [ -d "$p" ]; then kind=d; else kind=f; fi; printf "%s\\0%s\\0" "$kind" "$name"; n=$((n+1)); [ "$n" -gt 500 ] && break; done; test -d "$1"';
  const r = await exec("sh", ["-c", script, "files", path], { on });
  if (r.code !== 0) throw new Error(r.stderr || "Cannot list this folder");
  const fields = r.stdout.split("\0"), out = [];
  for (let i = 0; i + 1 < fields.length; i += 2) out.push({ name: fields[i + 1], dir: fields[i] === "d" });
  return out;
}

export default class Files extends View {
  init(_props, cx) {
    this.saved = new Map();
    this.entries = new Map(); this.folders = new Set(); this.pending = new Set(); this.marks = {};
    this.scroller = VirtualListScrollHandle.new();
    this.seq = 0;
    this.refresh(cx);
    // `herdr-app do my-files.open:<path>[:line[-end]]` (on the shown folder's machine).
    cx.spawn(async cx => {
      for (;;) {
        const command = await nextCommand();
        const m = /^open:(.+?)(?::(\d+)(?:[-–](\d+))?)?$/.exec(command);
        if (!m) continue;
        setShared(OPEN, { path: m[1], on: this.on ?? null, line: Number(m[2]) || null, end: Number(m[3] || m[2]) || null, at: Date.now() });
        cx.notify();
      }
    });
    cx.timer.every(10000, cx => this.refresh(cx));
  }

  watch(root, cx) {
    if (this.on || this.watched === root) return;
    this.watched = root;
    const context = this.context;
    cx.spawn(async cx => {
      try { while (this.context === context) { await watchFolder(root); if (this.current(context)) this.refresh(cx); } }
      catch { if (this.context === context) this.watched = null; }
    });
  }

  current(context) {
    return this.context === context && key() === context.key;
  }

  async loadFolder(path, context) {
    const { on, cwd: root } = context;
    const entries = await directory(path ? `${root}/${path}` : root, on);
    if (!this.current(context) || (path && !this.folders.has(path))) return;
    const used = [...this.entries.entries()].filter(([p]) => p !== path).reduce((n, [, e]) => n + e.length, 0);
    this.entries.set(path, entries.slice(0, Math.max(0, Math.min(PER_FOLDER, TOTAL - used))).sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name)));
    if (entries.length > PER_FOLDER || used + entries.length > TOTAL) this.limited = true;
  }

  refresh(cx) {
    const { cwd, on } = location(), next = key();
    if (next !== this.context?.key) {
      if (this.context) this.saved.set(this.context.key, { folders: this.folders, file: this.file, target: this.target, fileOn: this.fileOn });
      const saved = this.saved.get(next);
      this.context = { key: next, cwd, on }; this.root = cwd; this.on = on; this.entries = new Map(); this.folders = new Set(saved?.folders);
      this.pending = new Set(); this.marks = {}; this.show(null); this.shown = null; this.watched = null; this.error = null; this.limited = false;
      this.loading = false;
      if (saved?.file) this.show(saved.file, cx, saved.target, saved.fileOn);
    }
    if (!cwd || this.loading) return;
    const context = this.context;
    this.loading = true;
    this.limited = false;
    cx.spawn(async cx => {
      try {
        for (const path of ["", ...this.folders]) {
          if (!this.current(context)) return;
          await this.loadFolder(path, context);
        }
        const top = await exec("git", ["rev-parse", "--show-toplevel"], { cwd, on }).catch(() => null);
        const marks = {};
        if (top?.code === 0) {
          // Writes nothing under .git (index lock, fsmonitor cookie): the folder watch would refresh again.
          const status = await exec("git", ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"], { cwd, on }).catch(() => null);
          if (status?.code === 0) for (const entry of status.stdout.split("\0").filter(Boolean).slice(0, TOTAL)) {
            const xy = entry.slice(0, 2);
            marks[`${top.stdout.trim()}/${entry.slice(3)}`] = xy === "??" || xy.includes("A") ? "A" : xy.includes("U") ? "U" : xy.includes("D") ? "D" : "M";
          }
        }
        if (!this.current(context)) return;
        this.marks = marks; this.error = null; this.watch(cwd, cx);
      } catch (e) { if (this.current(context)) this.error = String(e); }
      finally { if (this.context === context) this.loading = false; cx.notify(); }
    });
  }

  toggle(path, cx) {
    if (this.folders.has(path)) {
      for (const folder of [...this.folders]) if (folder === path || folder.startsWith(path + "/")) {
        this.folders.delete(folder);
        this.entries.delete(folder);
      }
    } else {
      this.folders.add(path);
      if (!this.entries.has(path) && !this.pending.has(path)) {
        const context = this.context;
        this.pending.add(path);
        cx.spawn(async cx => {
          try { await this.loadFolder(path, context); }
          catch (e) { if (this.current(context)) this.error = String(e); }
          finally { if (this.context === context) this.pending.delete(path); cx.notify(); }
        });
      }
    }
    cx.notify();
  }

  // Unfolds the tree down to a file (a path under the root).
  reveal(path, cx) {
    const parts = path.split("/"), context = this.context;
    const chain = parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"));
    for (const folder of chain) this.folders.add(folder);
    cx.spawn(async cx => {
      for (const folder of chain) {
        if (!this.current(context) || this.entries.has(folder) || this.pending.has(folder)) continue;
        this.pending.add(folder);
        try { await this.loadFolder(folder, context); } catch {}
        finally { this.pending.delete(folder); }
      }
      cx.notify();
    });
  }

  // An open request from another mod: a fresh shared "my-files.open".
  take(cx) {
    const request = shared(OPEN);
    if (!request?.path || request.at === this.request || !(Date.now() - request.at < 15000)) return;
    this.request = request.at;
    const root = this.root, on = request.on ?? null;
    const inside = root && on === (this.on ?? null) && request.path.startsWith(root + "/");
    const path = inside ? request.path.slice(root.length + 1) : request.path;
    if (inside) this.reveal(path, cx);
    this.show(path, cx, request.line ? { line: request.line, end: request.end ?? request.line } : null, inside ? undefined : on);
  }

  // path: under the root, or absolute (then read from `on`, else this folder's machine).
  show(path, cx, target = null, on = undefined) {
    const seq = ++this.seq;
    this.file = path; this.target = target; this.fileOn = on; this.fileError = null;
    this.lines = null; this.highlighter = null; this.markdown = null;
    if (!path || !cx) return;
    const context = this.context, from = on === undefined ? this.on : on;
    const full = absolute(path) ? path : `${this.root}/${path}`;
    cx.spawn(async cx => {
      try {
        const text = await readTextFile(full, { on: from });
        if (seq !== this.seq || !this.current(context)) return;
        if (text === null) { this.fileError = "This file is no longer available"; return; }
        if (text.includes("\0")) { this.fileError = "Binary file · no text preview"; return; }
        const body = text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) + "\n… (file truncated)" : text;
        const lines = body.replace(/\r\n?/g, "\n").split("\n").map(line => line.replaceAll("\t", TAB));
        if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
        const language = languageFor(path);
        this.lines = lines;
        this.highlighter = new Highlighter(language, lines);
        this.gutter = String(lines.length).length * 7.5 + 18;
        this.codeWidth = this.gutter + 24 + lines.reduce((n, line) => Math.max(n, line.length), 0) * CODE_TEXT * 0.62;
        // A README reads rendered; a line to look at needs the source.
        this.markdown = language === "markdown" ? body : null;
        this.rendered = Boolean(this.markdown) && !target;
        this.scrollTo = target ? Math.min(lines.length - 1, Math.max(0, target.line - 1)) : 0;
      } catch { if (seq === this.seq && this.current(context)) this.fileError = "Cannot preview this file (binary, too large, or unreadable)"; }
      finally { cx.notify(); }
    });
  }

  rows(prefix, depth, out, t) {
    if (out.length >= TOTAL || depth > 40) return out;
    for (const entry of this.entries.get(prefix) ?? []) {
      if (out.length >= TOTAL) break;
      const path = prefix ? `${prefix}/${entry.name}` : entry.name, open = this.folders.has(path), mark = this.marks[`${this.root}/${path}`];
      out.push(h_flex().id(`file-${path}`).h(28).flex_none().pl(8 + depth * 18).pr(8).gap(7).items_center().rounded(7).cursor_pointer().hover(s => s.bg(t.hover))
        .when(path === this.shown, el => el.bg(t.selected))
        .on_click((_e, cx) => entry.dir ? this.toggle(path, cx) : this.show(path, cx))
        .child(entry.dir ? svg(`mods/my-files/chevron-${open ? "down" : "right"}.svg`).size(12).flex_none().text_color(t.dim) : div().w(12).flex_none())
        .child(svg(`mods/my-files/${entry.dir ? "folder" : "file"}.svg`).size(14).flex_none().text_color(t.muted))
        .child(div().flex_1().min_w(0).truncate().child(entry.name))
        .when(Boolean(mark), el => el.child(div().text_size(11).text_color(mark === "A" ? t.ansi2 : mark === "D" || mark === "U" ? t.ansi1 : t.blocked).child(mark))));
      if (entry.dir && open) this.rows(path, depth + 1, out, t);
    }
    return out;
  }

  code(t) {
    const styles = tokenStyles(t), lines = this.lines, target = this.target;
    const from = target ? target.line - 1 : -1, to = target ? (target.end ?? target.line) - 1 : -1;
    const band = tint(t.accent, "1f"), edge = tint(t.accent, "40");
    if (this.scrollTo !== null && this.scrollTo !== undefined) {
      this.scroller.scroll_to_item(this.scrollTo, target ? "center" : "top");
      this.scrollTo = null;
    }
    const span = ([text, kind]) => {
      const style = kind && styles[kind];
      let el = div().flex_none().child(text);
      if (style?.color) el = el.text_color(style.color);
      if (style?.italic) el = el.italic();
      if (style?.bold) el = el.font_semibold();
      return el;
    };
    const row = (i) => {
      const hit = i >= from && i <= to;
      return h_flex().h(CODE_ROW).w_full().flex_none().whitespace_nowrap().when(hit, el => el.bg(band))
        .child(div().w(this.gutter).h_full().flex_none().flex().items_center().justify_end().pr(8).text_color(hit ? t.foreground : t.dim).when(hit, el => el.bg(edge)).child(String(i + 1)))
        .child(h_flex().flex_none().pl(10).children(this.highlighter.tokens(i).map(span)));
    };
    return div().flex_1().min_h(0).relative().font_family(settings().font_family ?? "JetBrains Mono").text_size(CODE_TEXT)
      .child(div().id("files-code-x").size_full().overflow_x_scrollbar()
        .child(div().w_full().min_w(this.codeWidth).h_full()
          .child(v_virtual_list("files-code", lines.length, CODE_ROW, i => String(i), visible => {
            const out = [];
            for (let i = visible.start; i < visible.end; i++) out.push(row(i));
            return out;
          }).track_scroll(this.scroller).size_full())))
      .child(Scrollbar.vertical("files-code").viewport_from_layout().absolute().inset_0());
  }

  // A Markdown link: web links open in the browser, files beside this one open here.
  follow(url, cx) {
    if (url.startsWith("#")) return;
    if (/^[a-z][\w+.-]*:/i.test(url)) return void exec("open", [url]);
    const [path, line] = url.split("#L");
    const parts = (path.startsWith("/") ? path : `${this.file.split("/").slice(0, -1).join("/")}/${path}`).split("/"), out = [];
    for (const part of parts) part === ".." ? out.pop() : part && part !== "." && out.push(part);
    const next = (absolute(this.file) || path.startsWith("/") ? "/" : "") + out.join("/");
    if (!absolute(next)) this.reveal(path.endsWith("/") ? `${next}/.` : next, cx);
    if (path.endsWith("/")) this.show(null);
    else this.show(next, cx, Number(line) ? { line: Number(line), end: Number(line) } : null, this.fileOn);
    cx.notify();
  }

  preview(t) {
    if (this.rendered && this.markdown !== null)
      return div().flex_1().min_h(0).child(TextView.markdown(`files-md-${this.seq}`, this.markdown).selectable(true).scrollable(true).size_full().px(16).py(10).text_size(13)
        .on_link_click((url, cx) => this.follow(url, cx)));
    if (this.lines) return this.code(t);
    return div().p(12).text_color(t.dim).child(this.fileError || "Loading file…");
  }

  button(id, label, on, click, t) {
    return div().id(id).h(22).px(7).flex().items_center().rounded(5).flex_none().cursor_pointer().text_size(11)
      .text_color(on ? t.foreground : t.muted).when(on, el => el.bg(t.selected)).hover(s => s.bg(t.hover))
      .on_click(click).child(label);
  }

  render(cx) {
    if (key() !== this.context?.key) this.refresh(cx);
    this.take(cx);
    const t = theme();
    // The tree marks the file the preview shows (or showed, after going back).
    this.shown = this.file && !absolute(this.file) ? this.file : this.shown;
    const title = this.file ? `${this.file}${this.target ? ":" + range(this.target) : ""}` : this.root?.split(/[\\/]/).pop() ?? "";
    return v_flex().id("files").size_full().min_h(0).rounded(10).overflow_hidden().bg(t.background).border_1().border_color(t.border).text_color(t.foreground).text_size(13)
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .when(Boolean(this.file), el => el.child(div().id("files-back").w(20).cursor_pointer().text_color(t.muted).on_click((_e, cx) => { this.show(null); cx.notify(); }).child("←")))
        .child(div().font_semibold().child("Files"))
        .child(div().flex_1().min_w(0).truncate().text_ellipsis_start().text_right().text_size(12).text_color(t.dim).child(title))
        .when(this.markdown !== null && this.markdown !== undefined, el => el.child(this.button("files-md", this.rendered ? "Source" : "Preview", false, (_e, cx) => {
          this.rendered = !this.rendered;
          if (!this.rendered) this.scrollTo = this.target ? this.target.line - 1 : 0;
          cx.notify();
        }, t)))
        .child(div().id("files-links").size(22).flex().flex_none().items_center().justify_center().rounded(5).cursor_pointer().hover(s => s.bg(t.hover))
          .tooltip("Open a file the terminal mentions (⌘⇧O)")
          .on_click(() => run("mod.open", { name: "my-file-links" }))
          .child(svg("mods/workspace-chrome/search.svg").size(13).text_color(t.muted))))
      .when(!this.file, el => el.child(v_flex().id("files-tree").flex_1().min_h(0).overflow_y_scrollbar().p(6).children(this.rows("", 0, [], t))
        .when(Boolean(this.error) || !this.entries.get("")?.length, el => el.child(div().p(8).text_size(12).text_color(t.dim).child(this.error || (this.loading ? "Loading files…" : this.root ? "No files" : "No folder"))))
        .when(this.limited, el => el.child(div().p(8).text_size(11).text_color(t.dim).child("File list limited to 500 entries per folder and 5,000 total")))))
      .when(Boolean(this.file), el => el.child(this.preview(t)));
  }
}
