/**
 * Filesystem state tracker for swarm pipeline execution.
 *
 * Persists pipeline and per-agent state to `.swarm_<name>/` in the workspace.
 * Supports resumability by loading state from disk.
 */
import * as fs from "node:fs/promises";
import * as path from "node:path";

// ============================================================================
// State types
// ============================================================================

export type PipelineStatus = "idle" | "running" | "completed" | "failed" | "aborted";
export type AgentStatus = "pending" | "waiting" | "running" | "completed" | "failed";

/** Max chars of an agent's output persisted into pipeline.json (keeps state bounded). */
export const MAX_PERSISTED_OUTPUT_CHARS = 4000;

export interface AgentState {
	name: string;
	status: AgentStatus;
	iteration: number;
	wave: number;
	startedAt?: number;
	completedAt?: number;
	error?: string;
	/** Agent's final output text (truncated to MAX_PERSISTED_OUTPUT_CHARS). */
	output?: string;
	/** True when `output` was truncated for persistence. */
	outputTruncated?: boolean;
	/** Filesystem path to the full, untruncated output artifact (read via `read`). */
	outputPath?: string;
	/** Resolved model string, e.g. "anthropic/claude-opus-4.8". */
	resolvedModel?: string;
	/** Cumulative tokens across the agent's turns. */
	tokens?: number;
	/** Assistant request count across the run. */
	requests?: number;
}

export interface SwarmState {
	name: string;
	status: PipelineStatus;
	mode: string;
	iteration: number;
	targetCount: number;
	agents: Record<string, AgentState>;
	startedAt: number;
	completedAt?: number;
}

// ============================================================================
// State tracker
// ============================================================================

export class StateTracker {
	#swarmDir: string;
	#state: SwarmState;

	constructor(workspaceDir: string, name: string) {
		this.#swarmDir = path.join(workspaceDir, `.swarm_${name}`);
		this.#state = {
			name,
			status: "idle",
			mode: "sequential",
			iteration: 0,
			targetCount: 1,
			agents: {},
			startedAt: Date.now(),
		};
	}

	get swarmDir(): string {
		return this.#swarmDir;
	}

	get state(): Readonly<SwarmState> {
		return this.#state;
	}

	async init(agentNames: string[], targetCount: number, mode: string): Promise<void> {
		await fs.mkdir(path.join(this.#swarmDir, "state"), { recursive: true });
		await fs.mkdir(path.join(this.#swarmDir, "logs"), { recursive: true });
		await fs.mkdir(path.join(this.#swarmDir, "context"), { recursive: true });

		this.#state.targetCount = targetCount;
		this.#state.mode = mode;
		this.#state.status = "running";
		this.#state.startedAt = Date.now();

		for (const name of agentNames) {
			this.#state.agents[name] = {
				name,
				status: "pending",
				iteration: 0,
				wave: 0,
			};
		}

		await this.#persist();
	}

	async updateAgent(name: string, update: Partial<AgentState>): Promise<void> {
		const agent = this.#state.agents[name];
		if (!agent) return;
		Object.assign(agent, update);
		await this.#persist();
	}

	async updatePipeline(update: Partial<SwarmState>): Promise<void> {
		Object.assign(this.#state, update);
		await this.#persist();
	}

	async appendLog(agentName: string, message: string): Promise<void> {
		const logPath = path.join(this.#swarmDir, "logs", `${agentName}.log`);
		const timestamp = new Date().toISOString();
		await fs.appendFile(logPath, `[${timestamp}] ${message}\n`);
	}

	async appendOrchestratorLog(message: string): Promise<void> {
		const logPath = path.join(this.#swarmDir, "logs", "orchestrator.log");
		const timestamp = new Date().toISOString();
		await fs.appendFile(logPath, `[${timestamp}] ${message}\n`);
	}

	async load(): Promise<SwarmState | null> {
		const statePath = path.join(this.#swarmDir, "state", "pipeline.json");
		try {
			const content = await Bun.file(statePath).text();
			this.#state = JSON.parse(content) as SwarmState;
			return this.#state;
		} catch {
			return null;
		}
	}

	async #persist(): Promise<void> {
		await Bun.write(path.join(this.#swarmDir, "state", "pipeline.json"), JSON.stringify(this.#state, null, 2));
	}
}
