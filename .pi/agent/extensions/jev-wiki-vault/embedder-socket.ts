/**
 * Let Pi exit while pi-jev-wiki's embedder connection is idle.
 *
 * pi-jev-wiki 1.0 connects to its shared embedding daemon at session start (once the model is
 * cached) and never closes that socket, so a run without the TUI (`pi -p`, scripts, subagents)
 * prints its answer and then never exits. The daemon's sockets are unref'd as they are created.
 * Every request and connection attempt has its own timeout timer, which keeps the process alive
 * while it is in flight; only the idle connection stops doing so. Remove once pi-jev-wiki closes
 * the connection at session shutdown.
 */
import { syncBuiltinESMExports } from "node:module";
import net from "node:net";

const KEY = Symbol.for("jev-wiki-vault.embedder-socket");
// <tmpdir>/pi-jev-wiki-embed-<hash>.sock, or \\.\pipe\pi-jev-wiki-embed-<hash> on Windows.
const EMBEDDER = /pi-jev-wiki-embed-[0-9a-f]+(\.sock)?$/;

function pathOf(target: unknown): string | undefined {
	if (typeof target === "string") return target;
	const path = (target as { path?: unknown } | null | undefined)?.path;
	return typeof path === "string" ? path : undefined;
}

/** Install once per process, kept across /reload so connect is never wrapped twice. */
export function letPiExitWhileEmbedderIdle(): void {
	const holder = globalThis as typeof globalThis & { [KEY]?: true };
	if (holder[KEY]) return;
	holder[KEY] = true;
	const realConnect = net.connect;
	const connect = function connect(this: unknown, ...args: unknown[]): net.Socket {
		const socket = (realConnect as (...args: unknown[]) => net.Socket).apply(this, args);
		const path = pathOf(args[0]);
		if (path && EMBEDDER.test(path)) socket.unref();
		return socket;
	} as typeof net.connect;
	net.connect = connect;
	net.createConnection = connect;
	// Named ESM imports (import { connect } from "node:net") see the wrapper too.
	syncBuiltinESMExports();
}
