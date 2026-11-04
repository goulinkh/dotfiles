// A small line-at-a-time syntax highlighter for the Files preview.
//
// Herdr's built-in Editor highlights with syntect's default grammars, which
// have no TypeScript (it falls back to the JavaScript grammar and turns most
// of a typed file green) and no TOML, HCL, Nix, Dockerfile, Vue or Svelte.
// It can't scroll to a line either. This lexer is not a parser: it knows
// comments, strings, numbers, keywords, types, calls and a few
// per-language shapes (YAML keys, Markdown, tags, diffs), which is what
// reading code in a side panel needs. Lines are lexed in order and only as
// far as the view has scrolled, carrying multi-line comment and string state.

const words = (s) => new Set(s.split(/\s+/).filter(Boolean));

const C_LIKE = { line: ["//"], block: [["/*", "*/"]], strings: ['"', "'"], capsTypes: true };

const JS_KEYWORDS = "as async await break case catch class const continue debugger default delete do else export extends finally for from function get if import in instanceof let new of return set static switch throw try typeof var void while with yield";
const TS_KEYWORDS = JS_KEYWORDS + " abstract asserts declare enum implements infer interface is keyof module namespace override private protected public readonly satisfies type unique";
const JS = {
  ...C_LIKE, strings: ['"', "'", "`"], multi: ["`"], decorators: true,
  keywords: words(JS_KEYWORDS),
  constants: words("true false null undefined NaN Infinity this super arguments"),
  types: words(""),
};
const TS = { ...JS, keywords: words(TS_KEYWORDS), types: words("any bigint boolean never number object string symbol unknown void") };

const C_TYPES = "auto bool char double float int long short signed unsigned void size_t ssize_t int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t uintptr_t intptr_t wchar_t";
const C = {
  ...C_LIKE, preprocessor: true,
  keywords: words("break case const continue default do else enum extern for goto if inline register restrict return sizeof static struct switch typedef union volatile while"),
  constants: words("true false NULL nullptr"),
  types: words(C_TYPES),
};
const CPP = {
  ...C,
  keywords: words("alignas alignof break case catch class const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do dynamic_cast else enum explicit export extern for friend goto if inline mutable namespace new noexcept operator private protected public register reinterpret_cast return sizeof static static_assert static_cast struct switch template this throw try typedef typeid typename union using virtual volatile while override final"),
  constants: words("true false nullptr NULL this"),
};

const LANGS = {
  js: JS,
  ts: TS,
  go: {
    ...C_LIKE, strings: ['"', "'", "`"], multi: ["`"], raw: ["`"],
    keywords: words("break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var"),
    constants: words("true false nil iota"),
    types: words("any bool byte comparable complex64 complex128 error float32 float64 int int8 int16 int32 int64 rune string uint uint8 uint16 uint32 uint64 uintptr"),
  },
  rust: {
    ...C_LIKE, strings: ['"'], multi: ['"'], rustChars: true, attributes: true, macros: true,
    keywords: words("as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return static struct super trait type unsafe use where while yield"),
    constants: words("true false self Self None Some Ok Err"),
    types: words("bool char f32 f64 i8 i16 i32 i64 i128 isize str u8 u16 u32 u64 u128 usize String Vec Option Result Box"),
  },
  python: {
    line: ["#"], strings: ['"""', "'''", '"', "'"], multi: ['"""', "'''"], decorators: true, capsTypes: true,
    keywords: words("and as assert async await break class continue def del elif else except finally for from global if import in is lambda match case nonlocal not or pass raise return try while with yield"),
    constants: words("True False None self cls"),
    types: words("bool bytes dict float frozenset int list object set str tuple type"),
  },
  ruby: {
    line: ["#"], strings: ['"', "'"], capsTypes: true, symbols: true,
    keywords: words("alias and begin break case class def defined? do else elsif end ensure for if in module next not or redo rescue retry return then undef unless until when while yield require require_relative attr_reader attr_writer attr_accessor private protected public"),
    constants: words("true false nil self super"),
  },
  shell: {
    line: ["#"], hashNeedsSpace: true, strings: ['"', "'"], variables: true, commands: true, flags: true,
    ident: /[A-Za-z_][\w.-]*/y,
    keywords: words("if then else elif fi for in while until do done case esac function select time return local export readonly declare typeset unset set shift source alias exit break continue eval exec trap"),
    constants: words("true false"),
  },
  c: C,
  cpp: CPP,
  java: {
    ...C_LIKE, decorators: true,
    keywords: words("abstract assert break case catch class const continue default do else enum extends final finally for goto if implements import instanceof interface native new package private protected public record return sealed permits static strictfp super switch synchronized this throw throws transient try var void volatile while yield"),
    constants: words("true false null this super"),
    types: words("boolean byte char double float int long short void String Object"),
  },
  kotlin: {
    ...C_LIKE, strings: ['"""', '"', "'"], multi: ['"""'], decorators: true,
    keywords: words("abstract annotation as break by catch class companion const constructor continue crossinline data do else enum expect actual external final finally for fun get if import in infix init inline inner interface internal is lateinit noinline object open operator out override package private protected public reified return sealed set super suspend tailrec this throw try typealias val var vararg when where while"),
    constants: words("true false null this super it"),
  },
  swift: {
    ...C_LIKE, strings: ['"""', '"'], multi: ['"""'], decorators: true,
    keywords: words("actor associatedtype async await break case catch class continue default defer deinit do else enum extension fallthrough fileprivate final for func guard if import in init inout internal is let mutating nonisolated open operator private protocol public repeat rethrows return some any static struct subscript switch throw throws try typealias var weak where while"),
    constants: words("true false nil self Self super"),
  },
  csharp: {
    ...C_LIKE, preprocessor: true,
    keywords: words("abstract as async await base break case catch checked class const continue default delegate do else enum event explicit extern finally fixed for foreach goto if implicit in interface internal is lock namespace new operator out override params private protected public readonly record ref return sealed sizeof stackalloc static struct switch throw try typeof unchecked unsafe using var virtual void volatile when where while yield get set init"),
    constants: words("true false null this base"),
    types: words("bool byte char decimal double float int long object sbyte short string uint ulong ushort dynamic"),
  },
  scala: {
    ...C_LIKE, strings: ['"""', '"', "'"], multi: ['"""'], decorators: true,
    keywords: words("abstract case catch class def do else enum export extends final finally for forSome given if implicit import lazy match new object override package private protected return sealed then throw trait try type using val var while with yield"),
    constants: words("true false null this super"),
  },
  dart: {
    ...C_LIKE, strings: ["'''", '"""', '"', "'"], multi: ["'''", '"""'], decorators: true,
    keywords: words("abstract as assert async await base break case catch class const continue covariant default deferred do dynamic else enum export extends extension external factory final finally for get hide if implements import in interface is late library mixin new on operator part required rethrow return sealed set show static super switch sync throw try typedef var void when while with yield"),
    constants: words("true false null this super"),
  },
  php: {
    ...C_LIKE, line: ["//", "#"], variables: true,
    keywords: words("abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty enddeclare endfor endforeach endif endswitch endwhile enum extends final finally fn for foreach function global goto if implements include include_once instanceof insteadof interface isset list match namespace new or print private protected public readonly require require_once return static switch throw trait try unset use var while xor yield"),
    constants: words("true false null TRUE FALSE NULL"),
  },
  zig: {
    ...C_LIKE, strings: ['"', "'"],
    keywords: words("addrspace align allowzero and anyframe anytype asm async await break callconv catch comptime const continue defer else enum errdefer error export extern fn for if inline linksection noalias noinline nosuspend opaque or orelse packed pub resume return struct suspend switch test threadlocal try union unreachable usingnamespace var volatile while"),
    constants: words("true false null undefined"),
    types: words("bool f16 f32 f64 f128 i8 i16 i32 i64 i128 isize u8 u16 u32 u64 u128 usize void noreturn type anyerror comptime_int comptime_float"),
  },
  lua: {
    block: [["--[[", "]]"]], line: ["--"], strings: ['"', "'", ["[[", "]]"]], multi: ["[["], raw: ["[["],
    keywords: words("and break do else elseif end for function goto if in local not or repeat return then until while"),
    constants: words("true false nil self"),
  },
  sql: {
    line: ["--"], block: [["/*", "*/"]], strings: ["'", '"'], keywordsCI: true,
    keywords: words("add all alter and any as asc begin between by case cascade check column commit constraint create cross database default delete desc distinct drop else end exists foreign from full group having if in index inner insert into is join key left like limit not null offset on or order outer primary references returning right rollback select set table then transaction trigger truncate union unique update using values view when where with"),
    constants: words("true false null"),
    types: words("bigint boolean bytea char date decimal double float int integer interval json jsonb numeric real serial smallint text time timestamp timestamptz uuid varchar"),
  },
  haskell: {
    block: [["{-", "-}"]], line: ["--"], strings: ['"'], capsTypes: true,
    keywords: words("case class data default deriving do else foreign if import in infix infixl infixr instance let module newtype of then type where"),
    constants: words("True False Nothing Just"),
  },
  elixir: {
    line: ["#"], strings: ['"""', '"', "'"], multi: ['"""'], capsTypes: true, symbols: true, decorators: true,
    keywords: words("after alias and case catch cond def defp defmodule defmacro defstruct defprotocol defimpl do else end fn for if import in not or quote raise receive require rescue try unless unquote use when with"),
    constants: words("true false nil"),
  },
  nix: {
    line: ["#"], block: [["/*", "*/"]], strings: ['"', ["''", "''"]], multi: ["''", '"'], raw: ["''"],
    keywords: words("assert else if in inherit let or rec then with import"),
    constants: words("true false null builtins"),
  },
  hcl: {
    line: ["#", "//"], block: [["/*", "*/"]], strings: ['"'], keys: "=",
    keywords: words("resource data variable output locals module provider terraform for in if each count depends_on dynamic content lifecycle"),
    constants: words("true false null"),
  },
  proto: {
    ...C_LIKE,
    keywords: words("syntax package import option message enum service rpc returns repeated optional required oneof map reserved extend stream to max public weak"),
    constants: words("true false"),
    types: words("double float int32 int64 uint32 uint64 sint32 sint64 fixed32 fixed64 sfixed32 sfixed64 bool string bytes"),
  },
  graphql: {
    line: ["#"], strings: ['"""', '"'], multi: ['"""'], capsTypes: true, decorators: true,
    keywords: words("query mutation subscription fragment on type input enum interface union scalar schema extend implements directive"),
    constants: words("true false null"),
  },
  css: {
    ...C_LIKE, strings: ['"', "'"], css: true, capsTypes: false,
    ident: /-?[A-Za-z_][\w-]*/y,
    keywords: words("important"),
    constants: words(""),
  },
  json: { line: ["//"], block: [["/*", "*/"]], strings: ['"'], keys: ":", stringKeys: true, constants: words("true false null") },
  toml: { line: ["#"], strings: ['"""', "'''", '"', "'"], multi: ['"""', "'''"], raw: ["'''", "'"], keys: "=", sections: true, constants: words("true false inf nan") },
  ini: { line: ["#", ";"], strings: ['"', "'"], keys: "=", sections: true, constants: words("true false yes no on off") },
  make: { line: ["#"], strings: ['"', "'"], variables: true, targets: true, commands: true, ident: /[A-Za-z_][\w.-]*/y, keywords: words("ifeq ifneq ifdef ifndef else endif include define endef export override set") },
  dockerfile: {
    line: ["#"], strings: ['"', "'"], variables: true, commands: true, flags: true, ident: /[A-Za-z_][\w.-]*/y,
    keywords: words("FROM AS RUN CMD LABEL MAINTAINER EXPOSE ENV ADD COPY ENTRYPOINT VOLUME USER WORKDIR ARG ONBUILD STOPSIGNAL HEALTHCHECK SHELL if then else fi for do done in"),
  },
  // Line-shaped languages with their own scanners.
  yaml: { special: "yaml" },
  markdown: { special: "markdown" },
  html: { special: "html" },
  diff: { special: "diff" },
};

const EXT = {
  js: "js", mjs: "js", cjs: "js", jsx: "js",
  ts: "ts", tsx: "ts", mts: "ts", cts: "ts",
  go: "go", rs: "rust", py: "python", pyi: "python", rb: "ruby", rake: "ruby", gemspec: "ruby",
  sh: "shell", bash: "shell", zsh: "shell", fish: "shell", ksh: "shell", envrc: "shell",
  c: "c", h: "c", cc: "cpp", cpp: "cpp", cxx: "cpp", hpp: "cpp", hh: "cpp", hxx: "cpp", m: "c", mm: "cpp",
  java: "java", kt: "kotlin", kts: "kotlin", swift: "swift", cs: "csharp", scala: "scala", sc: "scala", dart: "dart",
  groovy: "java", gradle: "java", php: "php", zig: "zig", lua: "lua", sql: "sql",
  hs: "haskell", ex: "elixir", exs: "elixir", nix: "nix", tf: "hcl", tfvars: "hcl", hcl: "hcl",
  proto: "proto", graphql: "graphql", gql: "graphql",
  css: "css", scss: "css", sass: "css", less: "css",
  json: "json", jsonc: "json", json5: "json", jsonl: "json", ndjson: "json", lock: "json", ipynb: "json",
  toml: "toml", ini: "ini", cfg: "ini", conf: "ini", properties: "ini", editorconfig: "ini", env: "ini",
  yaml: "yaml", yml: "yaml",
  md: "markdown", markdown: "markdown", mdx: "markdown",
  html: "html", htm: "html", xml: "html", svg: "html", vue: "html", svelte: "html", astro: "html", xhtml: "html", plist: "html",
  diff: "diff", patch: "diff",
  mk: "make", just: "make",
  dockerfile: "dockerfile", containerfile: "dockerfile",
};
const NAMES = {
  makefile: "make", gnumakefile: "make", justfile: "make", ".justfile": "make",
  dockerfile: "dockerfile", containerfile: "dockerfile",
  ".bashrc": "shell", ".zshrc": "shell", ".zshenv": "shell", ".zprofile": "shell", ".zlogin": "shell", ".profile": "shell", ".bash_profile": "shell",
  ".gitignore": "ini", ".gitattributes": "ini", ".gitconfig": "ini", ".npmrc": "ini", ".env": "ini",
  "go.mod": "go", "go.sum": "ini", "cargo.lock": "toml", "pipfile": "toml", "gemfile": "ruby", "rakefile": "ruby", "vagrantfile": "ruby",
  "jenkinsfile": "java", "cmakelists.txt": "make",
};

/** The language key for a file path (by name, then extension), or null for plain text. */
export function languageFor(path) {
  const name = path.split(/[\\/]/).pop().toLowerCase();
  if (NAMES[name]) return NAMES[name];
  if (name.startsWith("dockerfile.") || name.endsWith(".dockerfile")) return "dockerfile";
  if (name.startsWith(".env.")) return "ini";
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? EXT[name.slice(dot + 1)] ?? null : null;
}

/** Text styles per token kind, from the theme's terminal colors so light and dark both work. */
export function tokenStyles(t) {
  return {
    comment: { color: t.dim, italic: true },
    string: { color: t.ansi2 },
    number: { color: t.ansi1 },
    constant: { color: t.ansi1 },
    keyword: { color: t.ansi5 },
    type: { color: t.ansi3 },
    function: { color: t.ansi4 },
    operator: { color: t.ansi6 },
    meta: { color: t.ansi3 },
    property: { color: t.ansi1 },
    variable: { color: t.ansi1 },
    tag: { color: t.ansi1 },
    attr: { color: t.ansi3 },
    heading: { color: t.ansi1, bold: true },
    bold: { bold: true },
    italic: { italic: true },
    link: { color: t.ansi4 },
    url: { color: t.dim },
    code: { color: t.ansi2 },
    added: { color: t.ansi2 },
    removed: { color: t.ansi1 },
    hunk: { color: t.ansi6 },
    header: { color: t.foreground, bold: true },
  };
}

// ---- the generic scanner

const NUMBER = /(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*)?\.?\d[\d_]*(?:[eE][+-]?\d+)?)[A-Za-z%]*/y;
const IDENT = /[A-Za-z_$][\w$]*/y;
const OPERATOR = /[+\-*/%=<>!&|^~?:]+/y;
const SPACE = /\s+/y;
const VARIABLE = /\$(?:\{[^}]*\}?|\([^)]*\)?|[A-Za-z_]\w*|[0-9@#?$!*-])/y;
const DECORATOR = /@[A-Za-z_][\w.]*/y;
const RUST_CHAR = /'(?:\\(?:x[0-9a-fA-F]{2}|u\{[0-9a-fA-F]+\}|.)|[^\\'])'/y;
const LIFETIME = /'[A-Za-z_]\w*/y;
const FLAG = /--?[A-Za-z0-9][\w-]*/y;

function sticky(re, s, i) {
  re.lastIndex = i;
  const m = re.exec(s);
  return m ? m[0] : null;
}

/** Index just past the closing `close` from `i`, honouring backslash escapes; -1 if the line ends first. */
function closeOf(s, i, close, escapes) {
  for (let j = i; j < s.length; j++) {
    if (escapes && s[j] === "\\") { j++; continue; }
    if (s.startsWith(close, j)) return j + close.length;
  }
  return -1;
}

function nextChar(s, i) {
  while (i < s.length && (s[i] === " " || s[i] === "\t")) i++;
  return s[i] ?? "";
}

function prevChar(s, i) {
  i--;
  while (i >= 0 && (s[i] === " " || s[i] === "\t")) i--;
  return s[i] ?? "";
}

// Collects tokens, folding whitespace into the token before it and merging
// neighbours of one kind, so a row is as few elements as possible.
class Out {
  constructor() { this.tokens = []; }
  push(text, kind) {
    if (!text) return;
    const last = this.tokens[this.tokens.length - 1];
    if (last && (last[1] === kind || (kind === null && !text.trim()))) last[0] += text;
    else this.tokens.push([text, kind ?? null]);
  }
}

function scan(lang, line, state, out) {
  let i = 0;
  const n = line.length;
  if (state) {
    const end = closeOf(line, 0, state.end, state.escapes);
    if (end < 0) { out.push(line, state.kind); return state; }
    out.push(line.slice(0, end), state.kind);
    i = end;
    state = null;
  }
  // Shell-like command position: the first word of a command is a call.
  let command = lang.commands ? true : false;
  const strings = lang.strings ?? [];
  while (i < n) {
    const c = line[i];
    const space = sticky(SPACE, line, i);
    if (space) { out.push(space, null); i += space.length; continue; }

    if (lang.targets && i === 0) {
      const m = /^[^\s:#=][^:#=]*(?=:(?!=))/.exec(line);
      if (m) { out.push(m[0], "function"); i = m[0].length; command = false; continue; }
    }
    if (lang.sections && c === "[" && !line.slice(0, i).trim()) {
      const end = line.lastIndexOf("]");
      if (end > i) { out.push(line.slice(i, end + 1), "type"); i = end + 1; continue; }
    }

    let matched = false;
    for (const [open, close] of lang.block ?? []) {
      if (!line.startsWith(open, i)) continue;
      const end = line.indexOf(close, i + open.length);
      if (end < 0) { out.push(line.slice(i), "comment"); return { kind: "comment", end: close, escapes: false }; }
      out.push(line.slice(i, end + close.length), "comment");
      i = end + close.length;
      matched = true;
      break;
    }
    if (matched) continue;
    for (const p of lang.line ?? []) {
      if (!line.startsWith(p, i)) continue;
      if (p === "#" && lang.hashNeedsSpace && i > 0 && !/[\s;(|&]/.test(line[i - 1])) continue;
      out.push(line.slice(i), "comment");
      return null;
    }

    if (c === "#" && lang.preprocessor && !line.slice(0, i).trim()) { out.push(line.slice(i), "meta"); return null; }
    if (c === "#" && lang.attributes && (line[i + 1] === "[" || (line[i + 1] === "!" && line[i + 2] === "["))) {
      const end = line.indexOf("]", i);
      const stop = end < 0 ? n : end + 1;
      out.push(line.slice(i, stop), "meta");
      i = stop;
      continue;
    }

    if (c === "'" && lang.rustChars) {
      const ch = sticky(RUST_CHAR, line, i);
      if (ch) { out.push(ch, "string"); i += ch.length; continue; }
      const life = sticky(LIFETIME, line, i);
      if (life) { out.push(life, "meta"); i += life.length; continue; }
    }

    for (const q of strings) {
      const [open, close] = Array.isArray(q) ? q : [q, q];
      if (!line.startsWith(open, i)) continue;
      const escapes = !(lang.raw ?? []).includes(open);
      const end = closeOf(line, i + open.length, close, escapes);
      if (end < 0) {
        out.push(line.slice(i), "string");
        return (lang.multi ?? []).includes(open) ? { kind: "string", end: close, escapes } : null;
      }
      const text = line.slice(i, end);
      const key = lang.stringKeys && nextChar(line, end) === lang.keys;
      out.push(text, key ? "property" : "string");
      i = end;
      matched = true;
      break;
    }
    if (matched) { command = false; continue; }

    if (c === "$" && lang.variables) {
      const v = sticky(VARIABLE, line, i);
      if (v) { out.push(v, "variable"); i += v.length; command = false; continue; }
    }
    if (c === "@" && (lang.decorators || lang.css)) {
      const d = sticky(DECORATOR, line, i);
      if (d) { out.push(d, lang.css ? "keyword" : "meta"); i += d.length; continue; }
    }
    if (lang.css && (c === "#" || c === ".")) {
      const hex = c === "#" && /^#[0-9a-fA-F]{3,8}\b/.exec(line.slice(i, i + 10));
      if (hex) { out.push(hex[0], "number"); i += hex[0].length; continue; }
      const sel = /^[#.]-?[A-Za-z_][\w-]*/.exec(line.slice(i));
      if (sel && !/\d/.test(line[i + 1] ?? "")) { out.push(sel[0], "type"); i += sel[0].length; continue; }
    }
    if (c === ":" && lang.symbols && /[A-Za-z_]/.test(line[i + 1] ?? "") && line[i - 1] !== ":") {
      const sym = /^:[A-Za-z_]\w*[?!]?/.exec(line.slice(i));
      if (sym) { out.push(sym[0], "constant"); i += sym[0].length; continue; }
    }
    if (c === "-" && lang.flags && (i === 0 || /\s/.test(line[i - 1]))) {
      const f = sticky(FLAG, line, i);
      if (f) { out.push(f, null); i += f.length; continue; }
    }

    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(line[i + 1] ?? ""))) {
      if (!(i > 0 && /[\w$]/.test(line[i - 1]))) {
        const num = sticky(NUMBER, line, i);
        if (num) { out.push(num, "number"); i += num.length; command = false; continue; }
      }
    }

    const word = sticky(lang.ident ?? IDENT, line, i);
    if (word) {
      out.push(word, classify(lang, word, line, i, command));
      const lower = lang.keywordsCI ? word.toLowerCase() : word;
      command = Boolean(lang.commands && lang.keywords?.has(lower) && !["in", "function"].includes(word));
      i += word.length;
      continue;
    }

    const op = sticky(OPERATOR, line, i);
    if (op) {
      out.push(op, "operator");
      i += op.length;
      if (lang.commands && /[|;&]/.test(op)) command = true;
      continue;
    }
    if (lang.commands && (c === "(" || c === "`" || c === "{")) command = true;
    out.push(c, null);
    i++;
  }
  return state;
}

function classify(lang, word, line, i, command) {
  const key = lang.keywordsCI ? word.toLowerCase() : word;
  const before = prevChar(line, i);
  const after = nextChar(line, i + word.length);
  // A member (`.then`, `.type`) is never a keyword.
  if (before === "." && !lang.css) return after === "(" ? "function" : null;
  if (lang.keywords?.has(key)) return "keyword";
  if (lang.constants?.has(key)) return "constant";
  if (lang.types?.has(key)) return "type";
  if (lang.keys && after === lang.keys && !line.slice(0, i).trim()) return "property";
  if (lang.css && after === ":" && /^\s/.test(line)) return "property";
  if (after === "(" || (lang.macros && after === "!")) return "function";
  if (command) return "function";
  if (lang.capsTypes && /^[A-Z]/.test(word)) return word.length > 1 && /^[A-Z][A-Z0-9_]+$/.test(word) ? "constant" : "type";
  return null;
}

// ---- line-shaped languages

const YAML_VALUE = {
  line: ["#"], hashNeedsSpace: true, strings: ['"', "'"],
  constants: words("true false null yes no on off True False TRUE FALSE Null NULL ~"),
  ident: /[A-Za-z_][\w.\/-]*/y,
};

function yaml(line, out) {
  if (/^(---|\.\.\.)(\s|$)/.test(line)) { out.push(line, "comment"); return; }
  const m = /^(\s*(?:-\s+)*)((?:"[^"]*"|'[^']*'|[^\s#'"][^#]*?))(\s*:)(?=\s|$)/.exec(line);
  let rest = line;
  if (m) {
    for (const part of m[1].split(/(-)/)) out.push(part, part === "-" ? "operator" : null);
    out.push(m[2], "property");
    out.push(m[3], "operator");
    rest = line.slice(m[0].length);
  } else {
    const dash = /^(\s*)(-)(\s|$)/.exec(line);
    if (dash) { out.push(dash[1], null); out.push("-", "operator"); rest = line.slice(dash[1].length + 1); }
  }
  const anchor = /^(\s*)([&*][\w-]+|!!?[\w-]+|[|>][+-]?\d*)(?=\s|$)/.exec(rest);
  if (anchor) { out.push(anchor[1], null); out.push(anchor[2], "meta"); rest = rest.slice(anchor[0].length); }
  scan(YAML_VALUE, rest, null, out);
}

const MD_INLINE = /(`+)([^`]|[^`].*?[^`])\1|\*\*[^*]+\*\*|__[^_]+__|\[([^\]]*)\]\(([^)]*)\)|<https?:[^>]+>|https?:\/\/[^\s)>\]]+/g;

function markdownInline(text, out) {
  let last = 0;
  for (const m of text.matchAll(MD_INLINE)) {
    out.push(text.slice(last, m.index), null);
    const s = m[0];
    if (s.startsWith("`")) out.push(s, "code");
    else if (s.startsWith("**") || s.startsWith("__")) out.push(s, "bold");
    else if (s.startsWith("[")) {
      out.push("[", null); out.push(m[3], "link"); out.push("](", null); out.push(m[4], "url"); out.push(")", null);
    } else out.push(s, "url");
    last = m.index + s.length;
  }
  out.push(text.slice(last), null);
}

function markdown(line, state, out) {
  const fence = /^(\s*)(`{3,}|~{3,})\s*([\w+#.-]*)/.exec(line);
  if (state?.fence) {
    if (fence && fence[2][0] === state.fence[0] && fence[2].length >= state.fence.length && !line.slice(fence[0].length).trim()) {
      out.push(line, "comment");
      return null;
    }
    const lang = state.lang && LANGS[state.lang];
    if (lang && !lang.special) return { ...state, inner: scan(lang, line, state.inner, out) };
    if (lang?.special === "yaml") { yaml(line, out); return state; }
    out.push(line, "code");
    return state;
  }
  if (fence) {
    out.push(line, "comment");
    const tag = fence[3].toLowerCase();
    return { fence: fence[2], lang: EXT[tag] ?? (LANGS[tag] ? tag : tag === "console" || tag === "shell" ? "shell" : null), inner: null };
  }
  if (/^\s{0,3}#{1,6}(\s|$)/.test(line)) { out.push(line, "heading"); return null; }
  if (/^\s*>/.test(line)) { out.push(line, "comment"); return null; }
  if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push(line, "comment"); return null; }
  const item = /^(\s*)([-*+]|\d+[.)])(\s+)/.exec(line);
  if (item) {
    out.push(item[1], null); out.push(item[2], "operator"); out.push(item[3], null);
    markdownInline(line.slice(item[0].length), out);
    return null;
  }
  markdownInline(line, out);
  return null;
}

// Tags, attributes and comments; text between tags stays plain.
function html(line, state, out) {
  let i = 0;
  const n = line.length;
  if (state?.comment) {
    const end = line.indexOf("-->");
    if (end < 0) { out.push(line, "comment"); return state; }
    out.push(line.slice(0, end + 3), "comment");
    i = end + 3;
    state = null;
  }
  let inTag = Boolean(state?.tag);
  while (i < n) {
    if (!inTag) {
      if (line.startsWith("<!--", i)) {
        const end = line.indexOf("-->", i + 4);
        if (end < 0) { out.push(line.slice(i), "comment"); return { comment: true }; }
        out.push(line.slice(i, end + 3), "comment");
        i = end + 3;
        continue;
      }
      const tag = /^<\/?[A-Za-z!?][\w:.-]*/.exec(line.slice(i));
      if (tag) { out.push(tag[0], "tag"); i += tag[0].length; inTag = true; continue; }
      const entity = /^&[#\w]+;/.exec(line.slice(i));
      if (entity) { out.push(entity[0], "constant"); i += entity[0].length; continue; }
      const next = line.slice(i + 1).search(/[<&]/);
      const stop = next < 0 ? n : i + 1 + next;
      out.push(line.slice(i, stop), null);
      i = stop;
      continue;
    }
    const space = sticky(SPACE, line, i);
    if (space) { out.push(space, null); i += space.length; continue; }
    if (line.startsWith("/>", i) || line[i] === ">" || line.startsWith("?>", i)) {
      const len = line[i] === ">" ? 1 : 2;
      out.push(line.slice(i, i + len), "tag");
      i += len;
      inTag = false;
      continue;
    }
    const q = line[i];
    if (q === '"' || q === "'") {
      const end = line.indexOf(q, i + 1);
      const stop = end < 0 ? n : end + 1;
      out.push(line.slice(i, stop), "string");
      i = stop;
      continue;
    }
    const attr = /^[^\s=>\/"']+/.exec(line.slice(i));
    if (attr) { out.push(attr[0], "attr"); i += attr[0].length; continue; }
    out.push(line[i], null);
    i++;
  }
  return inTag ? { tag: true } : null;
}

function diff(line, out) {
  if (/^(diff |index |\+\+\+ |--- |similarity |rename |new file|deleted file)/.test(line)) out.push(line, "header");
  else if (line.startsWith("@@")) out.push(line, "hunk");
  else if (line.startsWith("+")) out.push(line, "added");
  else if (line.startsWith("-")) out.push(line, "removed");
  else out.push(line, null);
}

/**
 * Lexes `lines` lazily: `tokens(i)` returns line i as [text, kind] pairs
 * (kind null = plain), lexing every earlier line first so multi-line comments
 * and strings carry over. Cached, so a frame only pays for new lines.
 */
export class Highlighter {
  constructor(language, lines) {
    this.lang = language ? LANGS[language] ?? null : null;
    this.lines = lines;
    this.cache = [];
    this.state = null;
  }

  tokens(index) {
    if (!this.lang) return [[this.lines[index] ?? "", null]];
    while (this.cache.length <= index && this.cache.length < this.lines.length) {
      const line = this.lines[this.cache.length];
      const out = new Out();
      try {
        const special = this.lang.special;
        if (special === "yaml") yaml(line, out);
        else if (special === "markdown") this.state = markdown(line, this.state, out);
        else if (special === "html") this.state = html(line, this.state, out);
        else if (special === "diff") diff(line, out);
        else this.state = scan(this.lang, line, this.state, out);
      } catch {
        out.tokens = [[line, null]];
        this.state = null;
      }
      this.cache.push(out.tokens.length ? out.tokens : [["", null]]);
    }
    return this.cache[index] ?? [["", null]];
  }
}
