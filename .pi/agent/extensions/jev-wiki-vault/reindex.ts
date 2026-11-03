/**
 * Bring this machine's semantic index in step with the vault: pages other machines pushed,
 * project wikis that appeared, and ones that were deleted. pi-jev-wiki itself only reindexes a
 * wiki when it finalizes there, and never adopts new wikis on its own.
 *
 *   node reindex.ts
 *
 * Run by vault-sync.sh after a sync that moved the vault's HEAD. Uses pi-jev-wiki's own indexer,
 * so only new or changed chunks are embedded, through the shared embedder process. Never
 * downloads the model: until the first `wiki_index action=rebuild` in Pi it reports and stops.
 * Prints one line per wiki it changed. Exit codes: 0 done, 3 nothing to do yet, 1 failed.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const SKIPPED = 3;
const agentDir = resolve(process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent"));
const vault = resolve(process.env.PI_WIKI_VAULT || join(homedir(), "pi-wiki-vault"));
const packageDir = process.env.PI_JEV_WIKI_DIR || join(agentDir, "npm", "node_modules", "pi-jev-wiki");

// The embedder connection keeps the event loop alive, so every path ends in process.exit.
// Stay under vault-sync.sh's 10-minute stale-lock limit.
setTimeout(() => {
	console.log("timed out after 8 minutes");
	process.exit(1);
}, 8 * 60_000).unref();

function done(code: number, message?: string): never {
	if (message) console.log(message);
	process.exit(code);
}

interface VectorConfig {
	enabled?: boolean;
	model?: string;
	dtype?: string | null;
	dimensions?: number | null;
}

function vectorConfig(): VectorConfig {
	try {
		const config = JSON.parse(readFileSync(join(agentDir, "jev-wiki.json"), "utf8"));
		return config?.search?.vector ?? {};
	} catch {
		return {};
	}
}

/** The vault's wiki roots: global/ and each projects/<name>/ that has pages. */
function vaultWikiRoots(): string[] {
	const roots = [join(vault, "global")];
	const projects = join(vault, "projects");
	if (existsSync(projects)) {
		for (const entry of readdirSync(projects, { withFileTypes: true })) {
			if (entry.isDirectory()) roots.push(join(projects, entry.name));
		}
	}
	return roots.filter((root) => existsSync(join(root, "wiki")));
}

async function loadPiJevWiki() {
	if (!existsSync(join(packageDir, "package.json"))) done(SKIPPED, `skipped: pi-jev-wiki is not installed at ${packageDir}`);
	// Load its TypeScript sources the way Pi does. The one Pi API the indexer reaches is
	// withFileMutationQueue, which serializes page writes; indexing only reads pages.
	const { createJiti } = await import(pathToFileURL(createRequire(join(packageDir, "package.json")).resolve("jiti")).href);
	const jiti = createJiti(join(packageDir, "src", "extension.ts"), {
		virtualModules: {
			"@earendil-works/pi-coding-agent": {
				withFileMutationQueue: <T>(_path: string, task: () => Promise<T>) => task(),
			},
		},
	});
	const load = (path: string) => jiti.import(join(packageDir, "src", path));
	const [index, registry, db] = await Promise.all([
		load("vector/index.ts"),
		load("vector/registry.ts"),
		load("vector/db.ts"),
	]);
	return { ...index, ...registry, ...db };
}

async function main(): Promise<number> {
	const vector = vectorConfig();
	if (vector.enabled === false) return SKIPPED;
	const model = vector.model || "performance";
	const wiki = await loadPiJevWiki();

	const status = await wiki.vectorStatus(agentDir, model, vector.dimensions ?? undefined, vector.dtype ?? undefined);
	// pi-jev-wiki's own test for "cached" in wiki_index status.
	if (status.modelsBytes < status.downloadBytes * 0.5) {
		done(SKIPPED, `skipped: the ${model} embedding model is not downloaded; run wiki_index action=rebuild all=true in Pi once`);
	}

	const lines: string[] = [];
	const inVault = (root: string) => resolve(root).startsWith(vault + sep);

	// Adopt new wikis, and forget ones whose folder another machine deleted.
	for (const root of vaultWikiRoots()) {
		const { registration, created } = await wiki.registerWiki(agentDir, root);
		if (created) lines.push(`${registration.name}: registered`);
	}
	const store = wiki.vectorDbFor(wiki.vectorDataDir(agentDir));
	for (const entry of (await wiki.readRegistry(agentDir)).wikis) {
		if (!inVault(entry.root) || existsSync(join(entry.root, "wiki"))) continue;
		await wiki.unregisterWiki(agentDir, entry.name);
		await store.purgeWiki(entry.name);
		lines.push(`${entry.name}: removed (deleted from the vault)`);
	}

	let failed = false;
	for (const entry of (await wiki.readRegistry(agentDir)).wikis) {
		if (!entry.enabled || !inVault(entry.root)) continue;
		try {
			const report = await wiki.indexWiki({
				agentDir,
				wiki: entry.name,
				root: entry.root,
				model,
				...(vector.dtype ? { dtype: vector.dtype } : {}),
				...(vector.dimensions ? { dimensions: vector.dimensions } : {}),
			});
			if (report.embedded > 0 || report.removed > 0) {
				lines.push(`${entry.name}: ${report.embedded} embedded, ${report.removed} removed, ${report.total} chunks`);
			}
		} catch (error) {
			failed = true;
			lines.push(`${entry.name}: failed, ${(error as Error).message}`);
		}
	}
	await wiki.closeVectorDbs().catch(() => undefined);
	if (lines.length > 0) console.log(lines.join("\n"));
	return failed ? 1 : 0;
}

main().then(
	(code) => done(code),
	(error) => done(1, `failed: ${(error as Error)?.message ?? String(error)}`),
);
