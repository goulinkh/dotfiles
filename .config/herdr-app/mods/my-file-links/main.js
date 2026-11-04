// Open a file the focused terminal mentions in the Files panel (my-files).
// Reads the terminal's screen and recent history (`hc read`), keeps the
// paths that are files on the terminal's machine, newest first, with their
// line or range (`a.ts:20–24`). Type to filter, ↑/↓ and Enter (or click) to
// open, Esc to leave. Works for terminals on other machines too.
// Herdr's own Cmd+click opens only files on this computer, with `open`.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, Scrollbar, v_virtual_list, VirtualListScrollHandle } from "gpui-base";
import { spaces, panes, focused, exec, hc, run, theme, props, closeOverlay, setShared } from "herdr";
import { references, RESOLVE, normalize } from "./refs.js";

const ROW = 34, HISTORY = "1500", MAX_CANDIDATES = 300;

function location() {
  const space = spaces().find((s) => s.active), f = focused();
  const pane = f?.pane ? panes().find((p) => p.pane === f.pane) : null;
  const terminal = f?.terminal ?? pane?.terminal ?? null;
  const on = f?.pane === null ? (terminal?.includes("/") ? terminal.split("/")[0] : null) : space?.machine ?? null;
  return { terminal, cwd: pane?.cwd || f?.cwd || space?.folder || null, on };
}

const span = (r) => (r.line ? (r.end && r.end !== r.line ? `${r.line}–${r.end}` : `${r.line}`) : "");

export default class FileLinks extends View {
  init(_props, cx) {
    this.items = null;
    this.error = null;
    this.filter = "";
    this.at = 0;
    this.scroller = VirtualListScrollHandle.new();
    this.handle = cx.focus_handle();
    this.input = InputState.new({ placeholder: "Open a file the terminal mentions…" });
    this.input.on("change", (_e, cx) => { this.filter = this.input.value(); this.at = 0; this.scroller.scroll_to_item(0); cx.notify(); });
    this.input.on("submit", () => this.open(this.shown()[this.at]));
    this.input.focus();
    cx.timer.after(400, () => this.input.focus());
    const where = location();
    this.where = where;
    if (!where.terminal) { this.error = "Focus a terminal first"; return; }
    cx.spawn(async (cx) => {
      try { this.items = await this.load(where); }
      catch (e) { this.error = String(e?.message ?? e); }
      cx.notify();
    });
  }

  async load({ terminal, cwd, on }) {
    const read = await hc(["read", terminal, "--lines", HISTORY]);
    if (read.code !== 0) throw new Error(read.stderr.trim() || `Cannot read ${terminal}`);
    // Newest first, one row per file and range.
    const refs = references(read.stdout).reverse();
    const paths = [...new Set(refs.map((r) => r.path))].slice(0, MAX_CANDIDATES);
    if (!paths.length) return [];
    const r = await exec("sh", ["-c", RESOLVE, "resolve", cwd || "/", ...paths], { on });
    if (r.code !== 0) throw new Error(r.stderr.trim() || "Cannot check the files");
    const found = r.stdout.split("\n");
    const where = new Map(paths.map((p, i) => [p, found[i] ? normalize(found[i]) : null]));
    const seen = new Set(), items = [];
    for (const ref of refs) {
      const abs = where.get(ref.path);
      if (!abs) continue;
      const id = `${abs}:${ref.line ?? ""}:${ref.end ?? ""}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const show = cwd && abs.startsWith(cwd + "/") ? abs.slice(cwd.length + 1) : abs;
      items.push({ id, abs, show, on, line: ref.line, end: ref.end });
    }
    return items;
  }

  shown() {
    const f = this.filter.trim().toLowerCase();
    return (this.items ?? []).filter((i) => !f || `${i.show}:${span(i)}`.toLowerCase().includes(f));
  }

  open(item) {
    if (!item) return;
    closeOverlay(props().overlay);
    setShared("my-files.open", { path: item.abs, on: item.on ?? null, line: item.line, end: item.end, at: Date.now() });
    run("layout.select", { stack: "panel-body", child: "files" });
    run("layout.show", { id: "panel" });
  }

  row(item, selected, t) {
    const cut = item.show.lastIndexOf("/");
    return h_flex().h(ROW).mx(4).px(10).gap(8).items_center().rounded(7).when(selected, (el) => el.bg(t.selected))
      .child(h_flex().flex_1().min_w(0)
        .child(div().min_w(0).flex_shrink(1).truncate().text_ellipsis_start().text_color(t.dim).child(cut >= 0 ? item.show.slice(0, cut + 1) : ""))
        .child(div().flex_none().text_color(t.foreground).child(item.show.slice(cut + 1))))
      .when(Boolean(item.line), (el) => el.child(div().flex_none().px(6).py(1).rounded(4).bg(t.raised).text_size(11).text_color(t.muted).child(span(item))));
  }

  render() {
    const t = theme();
    const list = this.shown();
    this.at = Math.max(0, Math.min(this.at, list.length - 1));
    const move = (step, cx) => {
      if (!list.length) return;
      this.at = (this.at + step + list.length) % list.length;
      this.scroller.scroll_to_item(this.at);
      cx.notify();
    };
    const note = this.error ?? (this.items === null ? "Reading the terminal…" : list.length ? null : this.items.length ? "No match" : "No file paths on this terminal's screen");
    return v_flex().id("file-links").track_focus(this.handle).w_full().p(16).gap(10).bg(t.popover).text_size(13)
      .on_key_down((e, cx) => {
        if (e.key === "escape") return closeOverlay(props().overlay);
        if (e.key === "down") move(1, cx);
        else if (e.key === "up") move(-1, cx);
        else return;
        cx.stop_propagation();
      })
      .child(h_flex().items_center().gap(8)
        .child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child("Open in Files"))
        .child(div().text_size(11).text_color(t.dim).child(this.where?.terminal ?? "")))
      .child(h_flex().h(36).flex_none().px(10).gap(8).items_center().rounded(9).border_1().border_color(t.accent).bg(t.background)
        .child(svg("mods/workspace-chrome/search.svg").size(15).text_color(t.dim))
        .child(Input.new(this.input).flex_1().h_full().text_size(12.8).text_color(t.foreground)))
      .when(Boolean(note), (el) => el.child(div().px(10).py(6).text_color(t.dim).child(note)))
      .when(!note, (el) => el.child(div().h(Math.min(14 * ROW, list.length * ROW)).flex_none().relative()
        .child(v_virtual_list("file-links-list", list.length, ROW, (i) => list[i].id, (r) => list.slice(r.start, r.end).map((item, k) => this.row(item, r.start + k === this.at, t)))
          .track_scroll(this.scroller).size_full()
          .on_item_click((id) => this.open(list.find((i) => i.id === id))))
        .child(Scrollbar.vertical("file-links-list").viewport_from_layout().absolute().inset_0())));
  }
}
