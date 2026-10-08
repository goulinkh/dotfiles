import { execFile } from "node:child_process";
import { basename } from "node:path";
import { homedir } from "node:os";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

function shortenPath(cwd: string): string {
	const home = homedir();
	if (home && cwd === home) return "~";
	if (home && cwd.startsWith(`${home}/`)) return `~${cwd.slice(home.length)}`;
	if (cwd === "/") return cwd;
	return `…/${basename(cwd)}`;
}

function formatContextLimit(tokens: number): string {
	if (tokens < 1_000) return `${tokens}`;
	if (tokens < 1_000_000) return `${Math.round(tokens / 1_000)}k`;
	return `${(tokens / 1_000_000).toFixed(1)}m`;
}

function countChangedFiles(output: string): number {
	return output.split(/\r?\n/).filter(line => line.length > 0).length;
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

/** Replace better-claude-code-ui's status line with a compact personal variant. */
export default function compactStatusLine(pi: ExtensionAPI): void {
	pi.on("session_start", (_event, ctx) => {
		if (ctx.mode !== "tui") return;

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
			let changedFiles = 0;
			let refreshInFlight = false;
			const refreshGitStatus = () => {
				if (refreshInFlight) return;
				refreshInFlight = true;
				execFile("git", ["--no-optional-locks", "status", "--porcelain=v1", "--untracked-files=all"], { cwd: ctx.cwd, encoding: "utf8" }, (error, stdout) => {
					refreshInFlight = false;
					if (error) return;
					const nextChangedFiles = countChangedFiles(stdout);
					if (nextChangedFiles === changedFiles) return;
					changedFiles = nextChangedFiles;
					tui.requestRender();
				});
			};
			refreshGitStatus();
			const refreshTimer = setInterval(refreshGitStatus, 5_000);
			refreshTimer.unref?.();
			const unsubscribe = footerData.onBranchChange(() => tui.requestRender());
			return {
				dispose: () => {
					unsubscribe();
					clearInterval(refreshTimer);
				},
				invalidate() {},
				render(width: number): string[] {
					const model = ctx.model?.id ?? "no-model";
					const branch = footerData.getGitBranch();
					const usage = ctx.getContextUsage();
					const contextLimit = ctx.model?.contextWindow ?? 0;
					const contextTokens = usage?.tokens ?? 0;
					const leftParts: string[] = [theme.fg("muted", model), theme.fg("dim", shortenPath(ctx.cwd))];
					if (branch) leftParts.push(theme.fg("dim", ` ${branch}`));
					if (changedFiles > 0) leftParts.push(theme.fg("dim", ` ${changedFiles}`));
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
					const left = leftParts.join(separator);
					const right = rightParts.join(separator);
					if (!right) return [truncateToWidth(left, width, "")];
					const padding = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
					return [truncateToWidth(`${left}${padding}${right}`, width, "")];
				},
			};
		});
	});
}
