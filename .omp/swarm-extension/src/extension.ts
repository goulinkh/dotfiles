/**
 * Swarm Extension — Multi-agent pipeline orchestration from YAML definitions.
 *
 * Registers:
 * - /swarm run <file.yaml>   — Execute a swarm pipeline
 * - /swarm status             — Show current pipeline status
 *
 * Usage: Add this extension's directory to your extensions config,
 * then use /swarm in any oh-my-pi session.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { AgentProgress, ExtensionAPI, ExtensionCommandContext } from "@oh-my-pi/pi-coding-agent";
import { formatDuration } from "@oh-my-pi/pi-utils";
import { buildDependencyGraph, buildExecutionWaves, detectCycles } from "./swarm/dag";
import { PipelineController, type PipelineResult } from "./swarm/pipeline";
import {
	renderAgentOutput,
	renderStreamPanel,
	renderSwarmOutputs,
	renderSwarmProgress,
	renderSwarmStatusLine,
	type StreamAgentView,
} from "./swarm/render";
import {
	NO_REQUEST_ERROR,
	readExistingRequest,
	resolveRequestPath,
	writeRequest,
} from "./swarm/request";
import { parseSwarmYaml, type SwarmDefinition, validateSwarmDefinition } from "./swarm/schema";
import { StateTracker } from "./swarm/state";

export default function swarmExtension(pi: ExtensionAPI): void {
	pi.setLabel("Swarm Orchestrator");

	pi.registerCommand("swarm", {
		description: "Run a multi-agent swarm pipeline from YAML",
		getArgumentCompletions: prefix => {
			const subcommands = ["run", "status", "help"];
			if (!prefix) return subcommands.map(s => ({ label: s, value: s }));
			return subcommands.filter(s => s.startsWith(prefix)).map(s => ({ label: s, value: s }));
		},
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			const parts = args.trim().split(/\s+/);
			const subcommand = parts[0] ?? "help";

			switch (subcommand) {
				case "run": {
					const yamlPath = parts[1];
					if (!yamlPath) {
						ctx.ui.notify("Usage: /swarm run <path/to/pipeline.yaml>", "error");
						return;
					}
					await handleRun(yamlPath, ctx, pi);
					return;
				}
				case "status": {
					await handleStatus(parts[1], ctx);
					return;
				}
				default:
					ctx.ui.notify(
						[
							"Swarm — multi-agent pipeline orchestrator",
							"",
							"  /swarm run <file.yaml>     Run a pipeline",
							"  /swarm status [name]       Show pipeline status",
							"  /swarm help                Show this help",
						].join("\n"),
						"info",
					);
					return;
			}
		},
	});
}

// ============================================================================
// /swarm run
// ============================================================================

async function handleRun(yamlPath: string, ctx: ExtensionCommandContext, pi: ExtensionAPI): Promise<void> {
	// 1. Resolve and read YAML
	const resolvedPath = path.isAbsolute(yamlPath) ? yamlPath : path.resolve(ctx.cwd, yamlPath);

	let content: string;
	try {
		content = await Bun.file(resolvedPath).text();
	} catch {
		ctx.ui.notify(`Cannot read file: ${resolvedPath}`, "error");
		return;
	}

	// 2. Parse YAML
	let def: SwarmDefinition;
	try {
		def = parseSwarmYaml(content);
	} catch (err) {
		ctx.ui.notify(`YAML error: ${err instanceof Error ? err.message : String(err)}`, "error");
		return;
	}

	// 3. Validate
	const validationErrors = validateSwarmDefinition(def);
	if (validationErrors.length > 0) {
		ctx.ui.notify(`Validation errors:\n${validationErrors.map(e => `  - ${e}`).join("\n")}`, "error");
		return;
	}

	// 4. Build DAG
	const deps = buildDependencyGraph(def);
	const cycleNodes = detectCycles(deps);
	if (cycleNodes) {
		ctx.ui.notify(`Cycle detected in agent dependencies: [${cycleNodes.join(", ")}]`, "error");
		return;
	}
	const waves = buildExecutionWaves(deps);

	// 5. Resolve workspace (relative to YAML file location)
	const workspace = path.isAbsolute(def.workspace)
		? def.workspace
		: path.resolve(path.dirname(resolvedPath), def.workspace);

	// Ensure workspace exists
	await fs.mkdir(workspace, { recursive: true });

	// 5b. Capture the operator's request interactively and seed the request file.
	if (def.requestFile) {
		const seeded = await seedRequestFile(def.requestFile, workspace, ctx, pi, def.name);
		if (!seeded) return; // cancelled with no usable request
	}

	// 6. Initialize state tracker
	const stateTracker = new StateTracker(workspace, def.name);
	await stateTracker.init([...def.agents.keys()], def.targetCount, def.mode);

	// 7. Log start
	const agentList = [...def.agents.keys()].join(", ");
	const waveDesc = waves.map((w, i) => `wave ${i + 1}: [${w.join(", ")}]`).join("; ");
	pi.logger.debug("Swarm starting", {
		name: def.name,
		mode: def.mode,
		agents: agentList,
		waves: waveDesc,
		workspace,
	});

	ctx.ui.notify(
		`Starting swarm '${def.name}': ${def.agents.size} agents, ${waves.length} waves, ${def.targetCount} iteration(s)`,
		"info",
	);

	// 8. Live surfaces: a compact progress line pinned in the omp status bar,
	// plus a below-editor panel that streams each running agent's output as it
	// is produced. Finalized output is posted to the transcript on completion.
	const statusKey = `swarm-${def.name}`;
	const streamKey = `swarm-stream-${def.name}`;
	const running = new Map<string, StreamAgentView>();

	const updateStatus = () => {
		ctx.ui.setStatus(statusKey, renderSwarmStatusLine(stateTracker.state));
	};
	const updateStream = () => {
		const panel = renderStreamPanel([...running.values()]);
		ctx.ui.setWidget(streamKey, panel.length > 0 ? panel : undefined, { placement: "belowEditor" });
	};
	updateStatus();

	// 9. Run pipeline
	const controller = new PipelineController(def, waves, stateTracker);

	let result: PipelineResult;
	try {
		result = await controller.run({
			workspace,
			onProgress: () => updateStatus(),
			onAgentProgress: (name, progress: AgentProgress) => {
				if (progress.status === "running") {
					running.set(name, {
						name,
						durationMs: progress.durationMs,
						currentTool: progress.currentTool,
						recentOutput: progress.recentOutput,
						tokens: progress.tokens,
					});
				} else {
					running.delete(name);
				}
				updateStream();
				updateStatus();
			},
			onAgentComplete: name => {
				running.delete(name);
				updateStream();
				const agent = stateTracker.state.agents[name];
				const chunk = agent ? renderAgentOutput(agent) : [];
				if (chunk.length === 0) return;
				pi.sendMessage(
					{
						customType: "swarm-agent-output",
						content: [{ type: "text", text: [`## ${def.name} · ${name}`, "", ...chunk].join("\n") }],
						display: true,
						details: { swarmName: def.name, agent: name, status: agent?.status },
					},
					{ triggerTurn: false },
				);
			},
			modelRegistry: ctx.modelRegistry,
			settings: pi.pi.settings,
		});
	} finally {
		ctx.ui.setStatus(statusKey, undefined);
		ctx.ui.setWidget(streamKey, undefined);
	}

	// 10. Show the summary after the live surfaces have been cleared.

	const elapsed = stateTracker.state.completedAt
		? formatDuration(stateTracker.state.completedAt - stateTracker.state.startedAt)
		: "unknown";

	const summaryParts = [
		`Swarm '${def.name}' ${result.status}`,
		`${result.iterations}/${def.targetCount} iterations`,
		`elapsed: ${elapsed}`,
	];

	if (result.errors.length > 0) {
		summaryParts.push(`${result.errors.length} error(s)`);
	}

	const summaryType = result.status === "completed" ? "info" : "error";
	ctx.ui.notify(summaryParts.join(" | "), summaryType);

	// Log errors
	if (result.errors.length > 0) {
		pi.logger.warn("Swarm completed with errors", { errors: result.errors });
	}

	// 11. Send summary to the conversation so the LLM knows what happened
	const summaryMessage = buildSummaryMessage(def, result, stateTracker, workspace);
	pi.sendMessage(
		{
			customType: "swarm-result",
			content: [{ type: "text", text: summaryMessage }],
			display: true,
			details: {
				swarmName: def.name,
				status: result.status,
				iterations: result.iterations,
				errorCount: result.errors.length,
			},
		},
		{ triggerTurn: false },
	);
}

// ============================================================================
// /swarm status
// ============================================================================

async function handleStatus(name: string | undefined, ctx: ExtensionCommandContext): Promise<void> {
	if (!name) {
		ctx.ui.notify("Usage: /swarm status <name>  (reads .swarm_<name>/state/pipeline.json from cwd)", "info");
		return;
	}

	const stateTracker = new StateTracker(ctx.cwd, name);
	const state = await stateTracker.load();
	if (!state) {
		ctx.ui.notify(`No state found for swarm '${name}' in ${ctx.cwd}`, "error");
		return;
	}

	const lines = renderSwarmProgress(state);
	const outputs = renderSwarmOutputs(state);
	if (outputs.length > 0) {
		lines.push("", "### Agent Output", "", ...outputs);
	}
	ctx.ui.notify(lines.join("\n"), "info");
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Capture the operator's request in-session and write it to the pipeline's
 * request file (resolved relative to the workspace) before the run starts.
 *
 * Interactive TUI: opens an editor prefilled with any existing request, so the
 * operator types/edits their request without leaving the session. Cancelling
 * keeps a pre-existing non-empty request and aborts only when none exists.
 *
 * Headless (no UI): the file must already exist and be non-empty — there is no
 * surface to prompt on. Returns false with a notification otherwise.
 */
export async function seedRequestFile(
	requestFile: string,
	workspace: string,
	ctx: ExtensionCommandContext,
	pi: ExtensionAPI,
	swarmName: string,
): Promise<boolean> {
	const requestPath = resolveRequestPath(requestFile, workspace);
	const existing = await readExistingRequest(requestPath);
	let request = existing;

	if (!ctx.hasUI) {
		if (existing.trim().length === 0) {
			ctx.ui.notify(NO_REQUEST_ERROR(requestPath), "error");
			return false;
		}
	} else {
		const edited = await ctx.ui.editor(
			`Swarm request for '${path.basename(requestFile)}' — describe what you want done`,
			existing,
			undefined,
			{ promptStyle: true },
		);

		// Cancelled (Esc): keep an existing request, otherwise abort.
		if (edited === undefined) {
			if (existing.trim().length === 0) {
				ctx.ui.notify("Swarm cancelled — no request provided.", "warning");
				return false;
			}
		} else {
			if (edited.trim().length === 0) {
				ctx.ui.notify("Swarm cancelled — request was empty.", "warning");
				return false;
			}
			request = edited;
			try {
				await writeRequest(requestPath, request);
			} catch (error) {
				ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
				return false;
			}
		}
	}

	pi.sendMessage(
		{
			customType: "swarm-request",
			content: [
				{
					type: "text",
					text: [`## ${swarmName} · request`, "", request.replace(/\s+$/, "")].join("\n"),
				},
			],
			display: true,
			details: { swarmName, requestFile },
		},
		{ triggerTurn: false },
	);
	return true;
}

function buildSummaryMessage(
	def: SwarmDefinition,
	result: PipelineResult,
	stateTracker: StateTracker,
	workspace: string,
): string {
	const lines: string[] = [];
	lines.push(`## Swarm Pipeline: ${def.name}`);
	lines.push("");
	lines.push(`- **Status**: ${result.status}`);
	lines.push(`- **Mode**: ${def.mode}`);
	lines.push(`- **Iterations**: ${result.iterations}/${def.targetCount}`);
	lines.push(`- **Workspace**: ${workspace}`);
	lines.push(`- **State dir**: ${stateTracker.swarmDir}`);
	lines.push("");

	lines.push("### Agent Results");
	lines.push("");
	for (const [name, agent] of Object.entries(stateTracker.state.agents)) {
		const duration =
			agent.startedAt && agent.completedAt ? formatDuration(agent.completedAt - agent.startedAt) : "n/a";
		const meta: string[] = [];
		if (agent.resolvedModel) meta.push(agent.resolvedModel);
		if (agent.tokens) meta.push(`${agent.tokens} tok`);
		const metaSuffix = meta.length > 0 ? ` · ${meta.join(" · ")}` : "";
		lines.push(`- **${name}**: ${agent.status} (${duration})${metaSuffix}${agent.error ? ` — ${agent.error}` : ""}`);
	}

	// Per-agent output was streamed into the transcript live as each agent
	// finished, so it is not repeated here. `/swarm status` replays it from
	// persisted state on demand.
	lines.push("", `_Per-agent output streamed above; replay with_ \`/swarm status ${def.name}\`.`);

	if (result.errors.length > 0) {
		lines.push("");
		lines.push("### Errors");
		lines.push("");
		for (const error of result.errors) {
			lines.push(`- ${error}`);
		}
	}

	return lines.join("\n");
}

