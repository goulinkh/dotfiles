/** Build filesystem-aware directory labels once, then shorten them without I/O during rendering. */
import { readdir } from "node:fs/promises";
import { dirname, join, normalize, parse, sep } from "node:path";

// Anchor markers mirror ~/dotfiles/.p10k.zsh; marked directories stay readable.
const ANCHOR_MARKERS = new Set([
	".bzr", ".citc", ".git", ".hg", ".node-version", ".python-version", ".go-version", ".ruby-version",
	".lua-version", ".java-version", ".perl-version", ".php-version", ".tool-versions", ".mise.toml",
	".shorten_folder_marker", ".svn", ".terraform", "CVS", "Cargo.toml", "composer.json", "go.mod", "package.json", "stack.yaml",
]);

type PathDescription = {
	prefix: string;
	segments: { name: string; shortName: string; directory: string; anchor: boolean }[];
};

/** Describe an absolute path with zsh-style `~` substitution, keeping its full directory names.
 * Home substitution requires an exact path-component boundary. The first absolute-path directory
 * and the final directory are anchors; `~` itself is the first anchor for paths under home.
 */
export function describePath(cwd: string, home: string): PathDescription {
	const directory = normalize(cwd);
	const homeDirectory = home ? normalize(home) : "";
	const isUnderHome = homeDirectory !== "" && (directory === homeDirectory || directory.startsWith(homeDirectory.endsWith(sep) ? homeDirectory : homeDirectory + sep));
	let parent = isUnderHome ? homeDirectory : parse(directory).root;
	const names = directory.slice(parent.length).split(sep).filter(Boolean);
	return {
		prefix: isUnderHome ? names.length ? "~/" : "~" : parent,
		segments: names.map((name, index) => {
			parent = join(parent, name);
			return { name, shortName: name, directory: parent, anchor: index === names.length - 1 || (!isUnderHome && index === 0) };
		}),
	};
}

/** Find shortest unique directory prefixes and project anchors, like Powerlevel10k.
 * @note Reads directory-entry metadata only, never file contents. Unreadable directories retain
 * their full names. Symlinks are included among prefix competitors to avoid ambiguous labels.
 */
export async function loadPathDescription(cwd: string, home: string): Promise<PathDescription> {
	const description = describePath(cwd, home);
	const entries = new Map<string, ReturnType<typeof readEntries>>();
	function readEntries(directory: string) {
		return readdir(directory, { withFileTypes: true }).catch(() => null);
	}
	function getEntries(directory: string) {
		let pending = entries.get(directory);
		if (!pending) {
			pending = readEntries(directory);
			entries.set(directory, pending);
		}
		return pending;
	}
	await Promise.all(description.segments.map(async segment => {
		if (segment.anchor) return;
		const [children, siblings] = await Promise.all([getEntries(segment.directory), getEntries(dirname(segment.directory))]);
		if (!children || !siblings) return;
		if (children.some(child => ANCHOR_MARKERS.has(child.name))) {
			segment.anchor = true;
			return;
		}
		const competitors = siblings.filter(entry => entry.isDirectory() || entry.isSymbolicLink()).map(entry => entry.name);
		const characters = Array.from(segment.name);
		const minimumPrefix = Math.max(1, characters.findIndex(character => character !== ".") + 1);
		for (let length = minimumPrefix; length < characters.length; length++) {
			const prefix = characters.slice(0, length).join("");
			if (!competitors.some(name => name !== segment.name && name.startsWith(prefix))) {
				segment.shortName = prefix;
				break;
			}
		}
	}));
	return description;
}

/** Shorten intermediate directories left-to-right only when the full path no longer fits.
 * Mirrors the configured 80-column cap and empty shortening delimiter. Anchors stay intact even
 * when they exceed the budget; the enclosing footer is responsible for final terminal clipping.
 * `getWidth` must measure terminal columns, not string length.
 */
export function formatPath(description: PathDescription, maxColumns: number, getWidth: (text: string) => number): string {
	const budget = Math.max(0, Math.min(80, maxColumns));
	const names = description.segments.map(segment => segment.name);
	const render = () => description.prefix + names.join("/");
	for (let index = 0; index < names.length && getWidth(render()) > budget; index++) {
		if (!description.segments[index].anchor) names[index] = description.segments[index].shortName;
	}
	return render();
}
