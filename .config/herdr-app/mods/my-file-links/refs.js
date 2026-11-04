// File references in terminal text: `src/a.ts:20`, `./b.py:3:7`,
// `c.go:20–24` (agents' ranges), `d.rs(20,5)` (tsc), `e.md#L20-L24`,
// `File "f.py", line 20` (Python tracebacks), absolute and ~/ paths.
// Candidates only: whether one is a file is asked on its machine.

const REF = /(?<![\w\/.~@$%+-])((?:~|\.{1,2})?\/?(?:[\w@.+-]+\/)*[\w@+-][\w@.+-]*)(?::(\d+)(?::\d+)?(?:\s?[-–—]\s?(\d+))?|\((\d+)(?:,\s?\d+)?\)|#L(\d+)(?:-L?(\d+))?|",? line (\d+))?/g;
const URL = /\b[a-z][\w+.-]*:\/\/\S+/gi;

/** Candidates in text order: { path, line, end }. */
export function references(text) {
  const out = [];
  for (const raw of text.split("\n")) {
    const line = raw.replace(URL, " ");
    for (const m of line.matchAll(REF)) {
      const path = m[1].replace(/\.+$/, "");
      if (!path || path.length > 400) continue;
      // A folder separator or a file extension; not a version or a bare word.
      if (!path.includes("/") && !/\.[A-Za-z][\w-]*$/.test(path)) continue;
      if (/^[\d.]+$/.test(path) || path === "/" || path === "~" || /^\.+\/?$/.test(path)) continue;
      const from = Number(m[2] ?? m[4] ?? m[5] ?? m[7]) || null;
      const to = Number(m[3] ?? m[6]) || null;
      out.push({ path, line: from, end: from && to && to > from ? to : from });
    }
  }
  return out;
}

// Prints, for each path argument, where it is as an absolute file path, or
// an empty line: as given, then under the terminal's folder, then under its
// repository, then without a diff's a/ b/ prefix, then as the unique file in
// the repository ending with that path (for the first 40 misses).
export const RESOLVE = `
cwd=$1; shift
top=$(cd "$cwd" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null)
misses=0
for p do
  case $p in "~/"*) p=$HOME/\${p#"~/"} ;; esac
  found=
  case $p in
    /*) [ -f "$p" ] && found=$p ;;
    *)
      for base in "$cwd" "$top"; do
        [ -n "$base" ] || continue
        if [ -f "$base/$p" ]; then found=$base/$p; break; fi
        case $p in
          [ab]/*) if [ -f "$base/\${p#?/}" ]; then found=$base/\${p#?/}; break; fi ;;
        esac
      done
      if [ -z "$found" ] && [ -n "$top" ] && [ "$misses" -lt 40 ]; then
        misses=$((misses + 1))
        m=$(git -C "$top" ls-files -- "$p" "*/$p" 2>/dev/null | head -n 2)
        [ -n "$m" ] && [ "$(printf '%s\\n' "$m" | wc -l)" -eq 1 ] && found=$top/$m
      fi ;;
  esac
  printf '%s\\n' "$found"
done
`;

/** Collapses `.` and `..` in an absolute path. */
export function normalize(path) {
  const out = [];
  for (const part of path.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return "/" + out.join("/");
}
