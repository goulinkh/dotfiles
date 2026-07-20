/**
 * TUI progress rendering for swarm pipeline status.
 */
import { formatDuration, truncate } from "@oh-my-pi/pi-utils";
import type { AgentState, SwarmState } from "./state";

const STATUS_LABELS: Record<string, string> = {
	completed: "[done]",
	running: "[....]",
	failed: "[FAIL]",
	pending: "[    ]",
	waiting: "[wait]",
	idle: "[idle]",
	aborted: "[stop]",
};

export function renderSwarmProgress(state: SwarmState): string[] {
	const lines: string[] = [];

	const statusLabel = state.status.toUpperCase();
	lines.push(`Swarm: ${state.name} [${statusLabel}]`);
	lines.push(`Mode: ${state.mode} | Iteration: ${state.iteration + 1}/${state.targetCount}`);
	lines.push("");

	const agents: AgentState[] = Object.values(state.agents);
	if (agents.length === 0) {
		lines.push("  (no agents)");
		return lines;
	}

	for (const agent of agents) {
		const icon = STATUS_LABELS[agent.status] ?? "[????]";
		const duration = formatAgentDuration(agent);
		const meta = formatAgentMeta(agent);
		const errorSuffix = agent.error ? ` - ${truncate(agent.error, 60)}` : "";
		lines.push(`  ${icon} ${agent.name}: ${agent.status}${duration}${meta}${errorSuffix}`);
	}

	// Summary line
	const completed = agents.filter(a => a.status === "completed").length;
	const failed = agents.filter(a => a.status === "failed").length;
	const running = agents.filter(a => a.status === "running").length;

	lines.push("");
	const parts = [`${completed}/${agents.length} done`];
	if (running > 0) parts.push(`${running} running`);
	if (failed > 0) parts.push(`${failed} failed`);
	if (state.startedAt) {
		parts.push(`elapsed: ${formatDuration(Date.now() - state.startedAt)}`);
	}
	lines.push(`  ${parts.join(" | ")}`);

	return lines;
}

function formatAgentDuration(agent: { startedAt?: number; completedAt?: number; status: string }): string {
	if (agent.startedAt && agent.completedAt) {
		return ` (${formatDuration(agent.completedAt - agent.startedAt)})`;
	}
	if (agent.startedAt && (agent.status === "running" || agent.status === "waiting")) {
		return ` (${formatDuration(Date.now() - agent.startedAt)}...)`;
	}
	return "";
}

/** Compact run metadata for the live status line: model + token cost when known. */
function formatAgentMeta(agent: AgentState): string {
	const parts: string[] = [];
	if (agent.resolvedModel) parts.push(shortModel(agent.resolvedModel));
	if (typeof agent.tokens === "number" && agent.tokens > 0) parts.push(`${formatTokens(agent.tokens)} tok`);
	return parts.length > 0 ? ` [${parts.join(", ")}]` : "";
}

/** Drop the provider prefix and any thinking suffix: "anthropic/claude-opus-4.8:high" -> "claude-opus-4.8". */
function shortModel(model: string): string {
	const afterProvider = model.includes("/") ? model.slice(model.indexOf("/") + 1) : model;
	return afterProvider.split(":")[0];
}

function formatTokens(tokens: number): string {
	if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
	return String(tokens);
}

/**
 * Detailed per-agent output for `/swarm status`. Reads persisted state, so it
 * works after the run completes and even from a fresh omp session. Each agent's
 * final output is followed by a `read`-able path to the full artifact.
 */
export function renderSwarmOutputs(state: SwarmState): string[] {
	const lines: string[] = [];
	for (const agent of Object.values(state.agents)) {
		const output = agent.output?.trim();
		if (!output) continue;
		lines.push(`#### ${agent.name}`, "", output);
		if (agent.outputTruncated) {
			lines.push("", `… [truncated]${agent.outputPath ? ` — full output: ${agent.outputPath}` : ""}`);
		} else if (agent.outputPath) {
			lines.push("", `(full output: ${agent.outputPath})`);
		}
		lines.push("");
	}
	return lines;
}
