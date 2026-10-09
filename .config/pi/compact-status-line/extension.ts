import { execFile } from "node:child_process";
import { homedir } from "node:os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { formatGitStatus, parseGitStatus } from "./gitStatus.ts";
import inlineFastModeStatus from "./inlineFastModeStatus.ts";
import { describePath, formatPath, loadPathDescription } from "./pathStatus.ts";

const FAST_MODE_STATUS_KEY = "compact-status-line:fast-mode";

function formatContextLimit(tokens: number): string {
	if (tokens < 1_000) return `${tokens}`;
	if (tokens < 1_000_000) return `${Math.round(tokens / 1_000)}k`;
	return `${(tokens / 1_000_000).toFixed(1)}m`;
}

function formatDuration(milliseconds: number): string {
	const totalSeconds = Math.floor(milliseconds / 1_000);
	if (totalSeconds < 60) return `${totalSeconds}s`;
	const hours = Math.floor(totalSeconds / 3_600);
	const minutes = Math.floor((totalSeconds % 3_600) / 60);
	const seconds = totalSeconds % 60;
	if (hours < 1) return `${minutes}m ${seconds}s`;
	return `${hours}h ${minutes}m ${seconds}s`;
}

/** Replace better-claude-code-ui's status line with a compact personal variant.
 * @note Registers lifecycle handlers, wraps widget updates, and polls Git/directory metadata while the footer is mounted.
 */
export default function compactStatusLine(pi: ExtensionAPI): void {
	let restoreFastModeStatus: (() => void) | undefined;
	pi.on("session_shutdown", () => {
		restoreFastModeStatus?.();
		restoreFastModeStatus = undefined;
	});
	pi.on("session_start", (_event, ctx) => {
		restoreFastModeStatus?.();
		restoreFastModeStatus = undefined;
		if (ctx.mode !== "tui") return;
		restoreFastModeStatus = inlineFastModeStatus(ctx.ui, FAST_MODE_STATUS_KEY);

		let turns = 0;
		let earliestMilliseconds = Date.now();
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "message" && entry.message.role === "user") turns++;
			if (typeof entry.timestamp === "string") {
				const timestamp = Date.parse(entry.timestamp);
				if (Number.isFinite(timestamp) && timestamp < earliestMilliseconds) earliestMilliseconds = timestamp;
			}
		}
		const sessionStartMilliseconds = earliestMilliseconds;

		pi.on("message_end", event => {
			if (event.message?.role === "user") turns++;
		});

		ctx.ui.setFooter((tui, theme, footerData) => {
			let disposed = false;
			let gitStatus: ReturnType<typeof parseGitStatus> | undefined;
			let pathDescription = describePath(ctx.cwd, homedir());
			let refreshInFlight = false;
			let pathRefreshInFlight = false;
			const refreshGitStatus = () => {
				if (disposed || refreshInFlight) return;
				refreshInFlight = true;
				execFile("git", ["--no-optional-locks", "status", "--porcelain=v2", "--branch", "-z", "--untracked-files=all"], { cwd: ctx.cwd, encoding: "utf8" }, (error, stdout) => {
					refreshInFlight = false;
					if (disposed) return;
					const nextGitStatus = error ? undefined : parseGitStatus(stdout);
					if (JSON.stringify(nextGitStatus) === JSON.stringify(gitStatus)) return;
					gitStatus = nextGitStatus;
					tui.requestRender();
				});
			};
			const refreshPath = async () => {
				if (disposed || pathRefreshInFlight) return;
				pathRefreshInFlight = true;
				try {
					const nextPath = await loadPathDescription(ctx.cwd, homedir());
					if (disposed || JSON.stringify(nextPath) === JSON.stringify(pathDescription)) return;
					pathDescription = nextPath;
					tui.requestRender();
				} finally {
					pathRefreshInFlight = false;
				}
			};
			refreshGitStatus();
			void refreshPath();
			const refreshTimer = setInterval(() => {
				refreshGitStatus();
				void refreshPath();
			}, 5_000);
			refreshTimer.unref?.();
			const unsubscribe = footerData.onBranchChange(() => {
				refreshGitStatus();
				tui.requestRender();
			});
			return {
				dispose: () => {
					disposed = true;
					unsubscribe();
					clearInterval(refreshTimer);
				},
				invalidate() {},
				render(width: number): string[] {
					const model = ctx.model?.id ?? "no-model";
					const usage = ctx.getContextUsage();
					const contextLimit = ctx.model?.contextWindow ?? 0;
					const contextTokens = usage?.tokens ?? 0;
					const fastModeIcon = footerData.getExtensionStatuses().get(FAST_MODE_STATUS_KEY);
					const modelText = theme.fg("muted", model) + (fastModeIcon ? ` ${theme.fg("accent", fastModeIcon)}` : "");
					const leftParts: string[] = [modelText];
					const gitText = formatGitStatus(theme, gitStatus, footerData.getGitBranch());
					if (gitText) leftParts.push(gitText);
					if (contextTokens > 0) {
						const percent = contextLimit > 0 ? Math.round((contextTokens / contextLimit) * 100) : 0;
						const contextText = contextLimit > 0 ? `${percent}%/${formatContextLimit(contextLimit)}` : `${contextTokens}`;
						const warning = contextLimit > 0 && contextTokens > contextLimit * 0.9;
						leftParts.push(theme.fg(warning ? "warning" : "dim", `ctx ${contextText}`));
					}
					const rightParts: string[] = [];
					if (turns > 0) {
						const duration = formatDuration(Date.now() - sessionStartMilliseconds);
						rightParts.push(theme.fg("dim", `${duration} · ${turns} ${turns === 1 ? "turn" : "turns"}`));
					}
					const separator = theme.fg("dim", " · ");
					const right = rightParts.join(separator);
					const fixedWidth = visibleWidth(leftParts.join(separator)) + (right ? visibleWidth(right) + 1 : 0);
					const pathColumns = Math.max(0, width - fixedWidth - visibleWidth(separator));
					leftParts.splice(1, 0, theme.fg("dim", formatPath(pathDescription, pathColumns, visibleWidth)));
					const left = leftParts.join(separator);
					if (!right) return [truncateToWidth(left, width, "")];
					const padding = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
					return [truncateToWidth(`${left}${padding}${right}`, width, "")];
				},
			};
		});
	});
}
