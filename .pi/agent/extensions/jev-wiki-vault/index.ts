/**
 * jev-wiki-vault: keep pi-jev-wiki memory out of project repositories, in one
 * private vault that is synced across machines with git.
 *
 * - Points each git checkout at `<vault>/projects/<project>/` through a git-ignored
 *   `.pi/jev-wiki.json`. Projects are named from their remote URL (GitHub,
 *   Launchpad, ...), so every clone, fork, and machine shares one wiki; override a
 *   name with `aliases` in `<vault>/projects.json`.
 * - Mirrors Pi's `/login openrouter` key into `jev-wiki.env`. pi-jev-wiki's automatic
 *   capture and retrieval read keys only from the environment or that file.
 * - Syncs the vault in the background on session start, shortly after work
 *   settles, and at shutdown. `/vault-sync` syncs now; `/vault-sync status` reports.
 *
 * Machine setup (vault clone, pi-jev-wiki config, sync timer): ~/dotfiles/setup-pi-wiki.sh
 */
import { spawn } from "node:child_process";
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentDir, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { pickRemote, projectNameFromRemote, sanitize } from "./project-name.ts";

const SYNC_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "vault-sync.sh");
/** Give pi-jev-wiki time to finish the capture it starts when work settles. */
const SETTLED_SYNC_DELAY_MS = 2 * 60_000;
const KEY_VARIABLE = "JEV_WIKI_API_KEY";
const POINTER = join(".pi", "jev-wiki.json");

interface Project {
	top: string;
	name: string;
	remote?: string;
}

function vaultDir(): string {
	return process.env.PI_WIKI_VAULT || join(homedir(), "pi-wiki-vault");
}

function readJson(path: string): Record<string, unknown> | undefined {
	try {
		const value: unknown = JSON.parse(readFileSync(path, "utf8"));
		return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
	} catch {
		return undefined;
	}
}

/** Drop credentials and per-user login names so the same remote reads the same on every machine. */
function redactRemote(url: string): string {
	return url.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/@]+@/i, "$1");
}

export default function jevWikiVault(pi: ExtensionAPI) {
	let settledTimer: ReturnType<typeof setTimeout> | undefined;

	async function git(cwd: string, args: string[]): Promise<string | undefined> {
		const result = await pi.exec("git", ["-C", cwd, ...args], { timeout: 10_000 });
		return result.code === 0 ? result.stdout.trim() : undefined;
	}

	function startSync(): void {
		if (!existsSync(SYNC_SCRIPT) || !existsSync(join(vaultDir(), ".git"))) return;
		const child = spawn("bash", [SYNC_SCRIPT, "sync"], {
			detached: true,
			stdio: "ignore",
			env: { ...process.env, PI_WIKI_VAULT: vaultDir() },
		});
		child.on("error", () => {});
		child.unref();
	}

	/** Mirror the `/login openrouter` key into the env file named by the jev-wiki config. */
	async function refreshKey(ctx: ExtensionContext): Promise<boolean> {
		const key = await ctx.modelRegistry.getApiKeyForProvider("openrouter").catch(() => undefined);
		if (!key) return false;
		const path = join(getAgentDir(), "jev-wiki.env");
		const content = `# Written by the jev-wiki-vault extension from Pi's /login openrouter key.\n${KEY_VARIABLE}=${key}\n`;
		if (!existsSync(path) || readFileSync(path, "utf8") !== content) writeFileSync(path, content, { mode: 0o600 });
		chmodSync(path, 0o600);
		return true;
	}

	async function resolveProject(cwd: string): Promise<Project | undefined> {
		const top = await git(cwd, ["rev-parse", "--show-toplevel"]);
		if (!top) return undefined;
		const remotes: Record<string, string> = {};
		for (const remoteName of (await git(cwd, ["remote"]))?.split("\n").filter(Boolean) ?? []) {
			const url = await git(cwd, ["remote", "get-url", remoteName]);
			if (url) remotes[remoteName] = url;
		}
		const remote = pickRemote(remotes);
		const derived = (remote && projectNameFromRemote(remote)) || sanitize(basename(top)) || "unnamed";
		const aliases = readJson(join(vaultDir(), "projects.json"))?.aliases;
		const alias = aliases && typeof aliases === "object" ? (aliases as Record<string, unknown>)[derived] : undefined;
		const name = (typeof alias === "string" && sanitize(alias)) || derived;
		return { top, name, remote: remote ? redactRemote(remote) : undefined };
	}

	/** Point pi-jev-wiki at the vault and make sure the pointer never enters the project's history. */
	async function linkProject(cwd: string, project: Project, ctx: ExtensionContext): Promise<void> {
		const pointer = join(cwd, POINTER);
		if ((await git(cwd, ["ls-files", "--error-unmatch", "--", pointer])) !== undefined) {
			if (ctx.hasUI) ctx.ui.notify(`jev-wiki-vault: ${POINTER} is tracked by this repository; leaving it alone`, "warning");
			return;
		}
		const wikiRoot = join(vaultDir(), "projects", project.name);
		const existing = readJson(pointer) ?? {};
		if (existing.wikiRoot !== wikiRoot) {
			mkdirSync(dirname(pointer), { recursive: true });
			writeFileSync(pointer, `${JSON.stringify({ ...existing, wikiRoot }, null, 2)}\n`);
		}
		const ignored = await pi.exec("git", ["-C", cwd, "check-ignore", "-q", "--", pointer], { timeout: 10_000 });
		if (ignored.code !== 0) {
			const exclude = await git(cwd, ["rev-parse", "--git-path", "info/exclude"]);
			if (exclude) {
				const path = resolve(cwd, exclude);
				mkdirSync(dirname(path), { recursive: true });
				appendFileSync(path, "\n# pi-jev-wiki pointer to the central vault (jev-wiki-vault extension)\n**/.pi/jev-wiki.json\n");
			}
		}
		mkdirSync(wikiRoot, { recursive: true });
		if (project.remote) {
			const remotesFile = join(wikiRoot, "remotes.txt");
			const known = existsSync(remotesFile) ? readFileSync(remotesFile, "utf8").split("\n") : [];
			if (!known.includes(project.remote)) appendFileSync(remotesFile, `${project.remote}\n`);
		}
	}

	pi.on("session_start", async (_event, ctx) => {
		const warnings: string[] = [];
		if (!existsSync(join(getAgentDir(), "jev-wiki.json")) || !existsSync(join(vaultDir(), ".git"))) {
			warnings.push("vault not set up on this machine; run ~/dotfiles/setup-pi-wiki.sh");
		}
		if (!(await refreshKey(ctx))) warnings.push("no OpenRouter key; run /login openrouter so the wiki can reach Jev");
		try {
			const project = await resolveProject(ctx.cwd);
			if (project && resolve(project.top) !== resolve(vaultDir())) await linkProject(ctx.cwd, project, ctx);
		} catch (error) {
			warnings.push(`could not link this project: ${error instanceof Error ? error.message : String(error)}`);
		}
		const conflict = join(vaultDir(), ".git", "vault-sync-conflict");
		if (existsSync(conflict)) warnings.push(readFileSync(conflict, "utf8").trim());
		if (ctx.hasUI) for (const warning of warnings) ctx.ui.notify(`jev-wiki-vault: ${warning}`, "warning");
		startSync();
	});

	pi.on("agent_settled", async () => {
		if (settledTimer) clearTimeout(settledTimer);
		settledTimer = setTimeout(() => {
			settledTimer = undefined;
			startSync();
		}, SETTLED_SYNC_DELAY_MS);
		settledTimer.unref?.();
	});

	pi.on("session_shutdown", async () => {
		if (settledTimer) clearTimeout(settledTimer);
		settledTimer = undefined;
		startSync();
	});

	pi.registerCommand("vault-sync", {
		description: "Sync the pi-jev-wiki memory vault now (argument: status)",
		handler: async (args, ctx) => {
			const mode = args.trim() === "status" ? "status" : "sync";
			const project = await resolveProject(ctx.cwd).catch(() => undefined);
			const result = await pi.exec("bash", [SYNC_SCRIPT, mode], { timeout: 120_000 });
			const lines = [
				project ? `project: ${project.name} → ${join(vaultDir(), "projects", project.name)}` : "project: (not a git repository; using the global wiki)",
				(result.stdout || result.stderr).trim(),
			];
			ctx.ui.notify(lines.join("\n"), result.code === 0 ? "info" : "warning");
		},
	});
}
