/**
 * Serve pi-jev-wiki's per-project settings file from memory.
 *
 * pi-jev-wiki reads a project's settings only from `<cwd>/.pi/jev-wiki.json`. Writing that file
 * would create a `.pi` folder in every checkout, which other tools take for the project's Pi
 * folder: pi-review, for one, then looks for REVIEW_GUIDELINES.md beside it and stops there.
 * So `existsSync` and `readFileSync` answer for the registered paths instead, and only while no
 * real file exists: a project's own `.pi/jev-wiki.json` always wins.
 */
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

const KEY = Symbol.for("jev-wiki-vault.virtual-files");

interface Shim {
	files: Map<string, string>;
	onDisk: (path: string) => boolean;
}

function install(): Shim {
	const realExists = fs.existsSync;
	const realRead = fs.readFileSync;
	const files = new Map<string, string>();
	const isVirtual = (path: unknown): path is string => typeof path === "string" && files.has(path) && !realExists(path);
	fs.existsSync = function existsSync(path: fs.PathLike): boolean {
		return isVirtual(path) || realExists(path);
	};
	fs.readFileSync = function readFileSync(path: fs.PathOrFileDescriptor, options?: unknown) {
		if (!isVirtual(path)) return (realRead as (...args: unknown[]) => unknown)(path, options);
		const content = files.get(path) ?? "";
		const encoding = typeof options === "string" ? options : (options as { encoding?: string } | undefined)?.encoding;
		return encoding ? content : Buffer.from(content);
	} as typeof fs.readFileSync;
	// Named ESM imports of node:fs (import { existsSync } from "node:fs") see the wrappers too.
	syncBuiltinESMExports();
	return { files, onDisk: (path) => realExists(path) };
}

/** One shim per process, kept across /reload so the functions are never wrapped twice. */
function shim(): Shim {
	const holder = globalThis as typeof globalThis & { [KEY]?: Shim };
	holder[KEY] ??= install();
	return holder[KEY];
}

/** Answer reads of `path` with `content` until a real file appears there. */
export function serveVirtualFile(path: string, content: string): void {
	shim().files.set(path, content);
}

/** Whether `path` exists on disk, ignoring virtual files. */
export function existsOnDisk(path: string): boolean {
	return shim().onDisk(path);
}
