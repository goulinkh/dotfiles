import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";

/**
 * Route every task/eval subagent to the parent session's live model, so
 * switching the main model (e.g. Sol ↔ Opus) also switches its subagents.
 * Service tier (fast mode) already follows via `tier.subagent: inherit`.
 */
export default function inheritSubagentModel(pi: ExtensionAPI) {
  pi.on("before_subagent_spawn", (_event, ctx) => {
    const model = ctx.model;
    if (model === undefined) return;
    const selector = `${model.provider}/${model.id}`;
    return { model: selector, note: `inherits ${selector}` };
  });
}
