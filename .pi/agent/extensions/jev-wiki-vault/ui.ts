/**
 * Quiet pi-jev-wiki's transcript UI: a wiki report shows only when the wiki gains something
 * (a page written or updated, a claim filed or reinforced, a claim waiting for review).
 * Evaluations that add nothing draw nothing at all, collapsed or expanded; errors still show.
 *
 * Covers the automatic capture brief (`jev-wiki` messages) and the agent's calls to the
 * capture tools. The parsing follows pi-jev-wiki 1.0.x's brief format; a report it cannot
 * read falls back to pi-jev-wiki's own rendering instead of disappearing.
 */
import { getMarkdownTheme, keyText, type ExtensionAPI, type Theme, type ToolRenderers } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Text, type Component } from "@earendil-works/pi-tui";
import { additionsFromBrief, clip, describeAdditions, hasAdditions, plural } from "./brief.ts";

/** Tools whose results are briefs from Jev's adjudication. */
const BRIEF_TOOLS = new Set(["wiki_insights", "wiki_ingest"]);
/** Read-only reports: they never add anything, so only their errors show. */
const SILENT_TOOLS = new Set(["wiki_status", "wiki_toc", "wiki_triage"]);

const MARK_COLOR = { "+": "success", "✎": "accent", "↻": "accent", "?": "warning", "✓": "success", "!": "warning" } as const;

function compact(
	theme: Theme,
	pad: number,
	headline: string,
	items: Array<{ mark: string; text: string }>,
	notes: string[] = [],
	more = "for Jev's full report",
): Component {
	const lines = [`${theme.fg("customMessageLabel", theme.bold("wiki"))} ${theme.fg("muted", headline)}`];
	for (const item of items) {
		const color = MARK_COLOR[item.mark as keyof typeof MARK_COLOR] ?? "muted";
		lines.push(`  ${theme.fg(color, item.mark)} ${theme.fg("toolOutput", item.text)}`);
	}
	for (const note of notes) lines.push(`  ${theme.fg("warning", note)}`);
	const key = (() => {
		try {
			return keyText("app.tools.expand");
		} catch {
			return "";
		}
	})();
	if (key) lines.push(`  ${theme.fg("dim", `(${key} ${more})`)}`);
	return new Text(lines.join("\n"), pad, 0);
}

function full(theme: Theme, pad: number, headline: string, markdown: string): Component {
	const container = new Container();
	container.addChild(new Text(`${theme.fg("customMessageLabel", theme.bold("wiki"))} ${theme.fg("muted", headline)}`, pad, 0));
	container.addChild(new Markdown(markdown, pad, 0, getMarkdownTheme(), { color: (text: string) => theme.fg("toolOutput", text) }));
	return container;
}

function textOf(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content
		.filter((part): part is { type: "text"; text: string } => part?.type === "text" && typeof part.text === "string")
		.map((part) => part.text)
		.join("\n");
}

/** Show a brief only when it adds something; undefined means "not a brief, render it as usual". */
function renderBrief(text: string, theme: Theme, pad: number, expanded: boolean): Component | undefined {
	const additions = additionsFromBrief(text);
	if (!additions) return undefined;
	if (!hasAdditions(additions)) return new Container();
	const { headline, items } = describeAdditions(additions);
	return expanded ? full(theme, pad, headline, text) : compact(theme, pad, headline, items);
}

function renderError(toolName: string, text: string, theme: Theme, pad: number, expanded: boolean): Component {
	const first = text.split("\n").find((line) => line.trim()) ?? "failed";
	return new Text(theme.fg("error", `${toolName}: ${expanded ? text.trim() : clip(first, 200)}`), pad, 0);
}

function quietTool(toolName: string): ToolRenderers {
	return {
		renderShell: "self",
		// The result says everything worth seeing; the call line alone would announce an evaluation.
		renderCall: () => new Container(),
		renderResult: (result, options, theme, context) => {
			if (options.isPartial || context.isPartial) return new Container();
			const text = textOf(result.content);
			if (context.isError) return renderError(toolName, text, theme, context.outputPad);
			if (SILENT_TOOLS.has(toolName)) return new Container();
			if (toolName === "wiki_finalize") {
				const details = (result.details ?? {}) as { updated?: unknown; broken?: unknown };
				const updated = Array.isArray(details.updated) ? details.updated.filter((page): page is string => typeof page === "string") : [];
				if (updated.length === 0) return new Container();
				const broken = Array.isArray(details.broken) ? details.broken.length : 0;
				const headline = `updated ${plural(updated.length, "page")}`;
				if (options.expanded) return full(theme, context.outputPad, headline, text);
				const notes = broken > 0 ? [`${plural(broken, "broken link")} — ask Pi to run wiki_lint`] : [];
				return compact(theme, context.outputPad, headline, updated.map((page) => ({ mark: "✓", text: page })), notes, "for details");
			}
			return (
				renderBrief(text, theme, context.outputPad, options.expanded) ??
				new Text(theme.fg("toolOutput", options.expanded ? text : clip(text, 200)), context.outputPad, 0)
			);
		},
	};
}

export function registerQuietWikiUi(pi: ExtensionAPI): void {
	pi.registerMessageRenderer?.("jev-wiki", (message, options, theme) => {
		const text = textOf(message.content);
		return renderBrief(text, theme, options.outputPad, options.expanded);
	});
	pi.registerToolRenderer?.((toolName, next) => {
		if (BRIEF_TOOLS.has(toolName) || SILENT_TOOLS.has(toolName) || toolName === "wiki_finalize") return quietTool(toolName);
		return next();
	});
}
