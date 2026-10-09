import type { ExtensionUIContext, ExtensionWidgetOptions } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

const WIDGET_KEY = "pi-plugins:statusline";
const REGISTRY_KEY = Symbol.for("@pi-plugins/statusline-registry");
const FAST_MODE_ICON = "\uf0e7"; // nf-fa-bolt, not the lightning emoji

type StatuslineSegment = { text: string; align: "left" | "right" };
type WidgetContent = string[] | Parameters<ExtensionUIContext["setWidget"]>[1];

/** Move the fast-mode indicator into a footer status, preserving other plugin segments.
 * The status reflects the plugin's own enabled/model/API eligibility checks, not a second toggle.
 * Load before fast-mode; the returned cleanup restores the UI callback without mutating its registry.
 * @note Wraps setWidget and updates UI state through setStatus.
 * @experimental Uses the shared statusline registry of @pi-plugins/fast-mode 0.1.13.
 */
export default function inlineFastModeStatus(ui: Pick<ExtensionUIContext, "setWidget" | "setStatus">, statusKey: string): () => void {
	const setWidget = ui.setWidget;
	const wrappedSetWidget = (key: string, content: WidgetContent, options?: ExtensionWidgetOptions): void => {
		const registry = Reflect.get(globalThis, REGISTRY_KEY) as Map<string, StatuslineSegment> | undefined;
		if (key !== WIDGET_KEY || !(registry instanceof Map)) {
			if (key === WIDGET_KEY) ui.setStatus(statusKey, undefined);
			if (Array.isArray(content)) setWidget(key, content, options);
			else setWidget(key, content, options);
			return;
		}

		ui.setStatus(statusKey, content !== undefined && registry.has("fast-mode") ? FAST_MODE_ICON : undefined);
		const otherSegments = [...registry].filter(([segmentKey]) => segmentKey !== "fast-mode");
		if (content === undefined || otherSegments.length === 0) {
			setWidget(key, undefined, options);
			return;
		}

		otherSegments.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
		setWidget(key, (_tui, theme) => ({
			invalidate() {},
			render(width: number): string[] {
				const left = otherSegments.filter(([, segment]) => segment.align === "left").map(([, segment]) => segment.text).join(" · ");
				const right = otherSegments.filter(([, segment]) => segment.align === "right").map(([, segment]) => segment.text).join(" · ");
				const margin = Math.min(width, 1);
				const gap = width - margin - visibleWidth(left) - visibleWidth(right);
				const minimumGap = left && right ? 2 : 0;
				const line = right && gap >= minimumGap ? `${left}${" ".repeat(gap)}${right}` : [left, right].filter(Boolean).join(" · ");
				return [truncateToWidth(" ".repeat(margin) + theme.fg("dim", line), width, "")];
			},
		}), options);
	};
	ui.setStatus(statusKey, undefined);
	ui.setWidget = wrappedSetWidget;
	return () => {
		if (ui.setWidget === wrappedSetWidget) ui.setWidget = setWidget;
		ui.setStatus(statusKey, undefined);
	};
}
