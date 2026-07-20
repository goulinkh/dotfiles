/**
 * TUI progress rendering for swarm pipeline status.
 */
import { formatDuration, truncate } from "@oh-my-pi/pi-utils";
import type { AgentState, SwarmState } from "./state";

/** Minimal per-agent view the live stream panel needs, mapped from `AgentProgress`. */
export interface StreamAgentView {
	name: string;
	durationMs?: number;
	currentTool?: string;
	recentOutput: string[];
	tokens: number;
}

const STATUS_LABELS: Record<string, string> = {
	completed: "[done]",
	running: "[....]",
	failed: "[FAIL]",
	pending: "[    ]",
	waiting: "[wait]",
	idle: "[idle]",
	aborted: "[stop]",
};

/** Single-glyph per-agent status for the compact pinned status line. */
const STATUS_GLYPHS: Record<string, string> = {
	completed: "✓",
	running: "⠧",
	failed: "✗",
	pending: "○",
	waiting: "⋯",
	idle: "○",
	aborted: "✗",
};

/** omp's braille spinner frames; running agents animate across status pushes. */
const SPINNER_FRAMES = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";

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

/**
 * One compact line for the omp footer/status bar (`ctx.ui.setStatus`), styled
 * to sit beside the built-in prompt segments rather than as a multi-line block.
 * Full per-agent detail lives in the end-of-run summary and `/swarm status`.
 */
export function renderSwarmStatusLine(state: SwarmState): string {
	const agents = Object.values(state.agents);
	const completed = agents.filter(a => a.status === "completed").length;

	// Head: name, iteration (multi-pass only), overall progress, elapsed. Kept
	// first so it survives the status bar's right-truncation of the agent chips.
	const head = [`⬡ ${state.name}`];
	if (state.targetCount > 1) head.push(`iter ${state.iteration + 1}/${state.targetCount}`);
	head.push(`${completed}/${agents.length}`);
	if (state.startedAt) {
		head.push(`Σ${formatDuration((state.completedAt ?? Date.now()) - state.startedAt)}`);
	}

	// Per-agent chips: which stage is where. Running agents carry their own
	// elapsed so a slow worker is obvious at a glance.
	const spinner = SPINNER_FRAMES[Math.floor(Date.now() / 100) % SPINNER_FRAMES.length];
	const chips = agents.map(agent => {
		const glyph = agent.status === "running" ? spinner : (STATUS_GLYPHS[agent.status] ?? "?");
		if (agent.status === "running" && agent.startedAt) {
			return `${glyph} ${agent.name} ${formatDuration(Date.now() - agent.startedAt)}`;
		}
		return `${glyph}${agent.name}`;
	});

	return [...head, ...chips].join(" · ");
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
		const chunk = renderAgentOutput(agent);
		if (chunk.length === 0) continue;
		lines.push(...chunk, "");
	}
	return lines;
}

/**
 * One agent's final output block: a `#### name` header, the (possibly
 * truncated) output, and a `read`-able path to the full artifact. Empty when
 * the agent produced no output. Shared by the live completion message, the
 * end-of-run summary, and `/swarm status`.
 */
export function renderAgentOutput(agent: AgentState): string[] {
	const output = agent.output?.trim();
	if (!output) return [];
	const lines = [`#### ${agent.name}`, ""];
	const meta = formatAgentMeta(agent).trim();
	if (meta) lines.push(meta, "");
	lines.push(output);
	if (agent.outputTruncated) {
		lines.push("", `… [truncated]${agent.outputPath ? ` — full output: ${agent.outputPath}` : ""}`);
	} else if (agent.outputPath) {
		lines.push("", `(full output: ${agent.outputPath})`);
	}
	return lines;
}

/** How many trailing output lines the live stream panel shows per agent. */
const STREAM_TAIL_LINES = 4;

/**
 * Live below-editor panel: for each running agent, a header line (spinner,
 * name, elapsed, current tool, tokens) plus the tail of its streaming output.
 * Driven by `AgentProgress` events so output appears as it is produced.
 */
export function renderStreamPanel(running: StreamAgentView[]): string[] {
	if (running.length === 0) return [];
	const spinner = SPINNER_FRAMES[Math.floor(Date.now() / 100) % SPINNER_FRAMES.length];
	const lines: string[] = [];
	for (const agent of running) {
		const parts = [`${spinner} ${agent.name}`];
		if (agent.durationMs && agent.durationMs > 0) parts.push(formatDuration(agent.durationMs));
		if (agent.currentTool) parts.push(agent.currentTool);
		if (agent.tokens > 0) parts.push(`${formatTokens(agent.tokens)} tok`);
		lines.push(parts.join(" · "));
		const tail = agent.recentOutput.map(line => line.trim()).filter(line => line.length > 0).slice(-STREAM_TAIL_LINES);
		for (const line of tail) lines.push(`    ${truncate(line, 100)}`);
	}
	return lines;
}
