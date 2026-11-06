import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import inlineFastModeStatus from "./inlineFastModeStatus.ts";
import { modelLabel } from "./modelLabel.ts";
import { highlight } from "./severity.ts";

const FAST_MODE_STATUS_KEY = "compact-status-line:fast-mode";

function formatContextLimit(tokens: number): string {
	if (tokens < 1_000) return `${tokens}`;
	if (tokens < 1_000_000) return `${Math.round(tokens / 1_000)}k`;
	return `${(tokens / 1_000_000).toFixed(1)}m`;
}

/** Replace better-claude-code-ui's status line with a compact personal variant.
 * Project path and Git details belong to the multiplexer.
 * @note Registers lifecycle handlers and wraps widget updates for inline fast-mode status.
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
		for (const entry of ctx.sessionManager.getBranch()) {
			if (entry.type === "message" && entry.message.role === "user") turns++;
		}

		pi.on("message_end", event => {
			if (event.message?.role === "user") turns++;
		});

		ctx.ui.setFooter((_tui, theme, footerData) => {
			return {
				invalidate() {},
				render(width: number): string[] {
					const usage = ctx.getContextUsage();
					const contextLimit = ctx.model?.contextWindow ?? 0;
					const contextTokens = usage?.tokens ?? 0;
					const statuses = footerData.getExtensionStatuses();
					const model = modelLabel(ctx.model?.provider, ctx.model?.id, statuses.get("jev-router"));
					const fastModeIcon = statuses.get(FAST_MODE_STATUS_KEY);
					const modelText = theme.fg("muted", model) + (fastModeIcon ? ` ${theme.fg("accent", fastModeIcon)}` : "");
					const leftParts: string[] = [modelText];
					if (contextTokens > 0) {
						const percent = contextLimit > 0 ? Math.round((contextTokens / contextLimit) * 100) : 0;
						const contextText = contextLimit > 0 ? `${percent}%/${formatContextLimit(contextLimit)}` : `${contextTokens}`;
						leftParts.push(highlight(theme, `ctx ${contextText}`, percent, 65, 85));
					}
					if (turns > 0) {
						leftParts.push(highlight(theme, `${turns} ${turns === 1 ? "turn" : "turns"}`, turns, 10, 15));
					}
					const separator = theme.fg("dim", " · ");
					const left = truncateToWidth(leftParts.join(separator), width, "");
					// pi-usage reserves its own columns before calling this renderer.
					// Fill the remaining width so its appended account usage aligns right.
					return [left + " ".repeat(Math.max(0, width - visibleWidth(left)))];
				},
			};
		});
	});
}
