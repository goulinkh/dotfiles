#!/usr/bin/env bun
/**
 * Direct pipeline runner — executes a swarm pipeline outside of the TUI.
 *
 * Usage: bun cli.ts <path-to-yaml>
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { discoverAuthStorage } from "@oh-my-pi/pi-coding-agent";
import { ModelRegistry } from "@oh-my-pi/pi-coding-agent/config/model-registry";
import { Settings } from "@oh-my-pi/pi-coding-agent/config/settings";
import { buildDependencyGraph, buildExecutionWaves, detectCycles } from "./swarm/dag";
import { PipelineController } from "./swarm/pipeline";
import { renderSwarmProgress } from "./swarm/render";
import {
	NO_REQUEST_ERROR,
	readExistingRequest,
	resolveHeadlessRequest,
	resolveRequestPath,
	writeRequest,
} from "./swarm/request";
import { parseSwarmYaml, validateSwarmDefinition } from "./swarm/schema";
import { StateTracker } from "./swarm/state";

interface CliArgs {
	yamlPath: string;
	request?: string;
}

function parseCliArgs(args: string[]): CliArgs {
	let yamlPath: string | undefined;
	let request: string | undefined;
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--request" || arg === "-r") {
			const value = args[index + 1];
			if (value === undefined) {
				console.error(`${arg} requires a value`);
				process.exit(1);
			}
			request = value;
			index += 1;
		} else if (yamlPath === undefined) {
			yamlPath = arg;
		} else {
			console.error(`Unexpected argument: ${arg}`);
			process.exit(1);
		}
	}
	if (yamlPath === undefined) {
		console.error('Usage: omp-swarm <path-to-yaml> [--request "<text>" | --request -]');
		process.exit(1);
	}
	return { yamlPath, request };
}

const { yamlPath, request: explicitRequest } = parseCliArgs(process.argv.slice(2));

const resolvedPath = path.resolve(yamlPath);
console.log(`Reading: ${resolvedPath}`);

const content = await Bun.file(resolvedPath).text();
const def = parseSwarmYaml(content);

console.log(`Swarm: ${def.name}`);
console.log(`Mode: ${def.mode}`);
console.log(`Target count: ${def.targetCount}`);
console.log(`Agents: ${[...def.agents.keys()].join(", ")}`);

// Validate
const errors = validateSwarmDefinition(def);
if (errors.length > 0) {
	console.error("Validation errors:", errors);
	process.exit(1);
}

// Build DAG
const deps = buildDependencyGraph(def);
const cycles = detectCycles(deps);
if (cycles) {
	console.error("Cycle detected:", cycles);
	process.exit(1);
}
const waves = buildExecutionWaves(deps);
console.log(`Waves: ${waves.map((w, i) => `W${i + 1}:[${w.join(",")}]`).join(" -> ")}`);

// Resolve workspace
const workspace = path.isAbsolute(def.workspace)
	? def.workspace
	: path.resolve(path.dirname(resolvedPath), def.workspace);

await fs.mkdir(workspace, { recursive: true });
console.log(`Workspace: ${workspace}`);

// Resolve the headless request from explicit text, stdin, or the existing file.
if (def.requestFile) {
	const requestPath = resolveRequestPath(def.requestFile, workspace);
	const existingRequest = await readExistingRequest(requestPath);
	const useStdin = explicitRequest === "-" || (explicitRequest === undefined && process.stdin.isTTY !== true);
	const stdinRequest = useStdin ? await Bun.stdin.text() : undefined;
	const capture = resolveHeadlessRequest({
		explicitRequest,
		stdinRequest,
		useStdin,
		existingRequest,
	});
	if (!capture.ok || capture.request === undefined) {
		console.error(NO_REQUEST_ERROR(requestPath));
		process.exit(1);
	}
	if (capture.source === "explicit" || capture.source === "stdin") {
		try {
			await writeRequest(requestPath, capture.request);
		} catch (error) {
			console.error(error instanceof Error ? error.message : String(error));
			process.exit(1);
		}
	}
	console.log(`Request: ${requestPath}`);
} else if (explicitRequest !== undefined) {
	console.error("This pipeline does not define swarm.request_file; --request cannot be used.");
	process.exit(1);
}

// Initialize
const stateTracker = new StateTracker(workspace, def.name);
await stateTracker.init([...def.agents.keys()], def.targetCount, def.mode);

// Auth + settings
const authStorage = await discoverAuthStorage();
const modelRegistry = new ModelRegistry(authStorage);
const settings = Settings.isolated();

// Progress display
let lastProgressDump = 0;
const PROGRESS_INTERVAL_MS = 5000;

// Run
console.log("\n--- Pipeline starting ---\n");

const controller = new PipelineController(def, waves, stateTracker);
const result = await controller.run({
	workspace,
	onProgress: () => {
		const now = Date.now();
		if (now - lastProgressDump > PROGRESS_INTERVAL_MS) {
			lastProgressDump = now;
			const lines = renderSwarmProgress(stateTracker.state);
			console.log(lines.join("\n"));
			console.log();
		}
	},
	modelRegistry,
	settings,
});

console.log("\n--- Pipeline finished ---\n");
console.log(`Status: ${result.status}`);
console.log(`Iterations completed: ${result.iterations}/${def.targetCount}`);
if (result.errors.length > 0) {
	console.log(`Errors (${result.errors.length}):`);
	for (const err of result.errors) {
		console.log(`  - ${err}`);
	}
}
console.log(`\nState saved to: ${stateTracker.swarmDir}`);

// Final state dump
const lines = renderSwarmProgress(stateTracker.state);
console.log(lines.join("\n"));
