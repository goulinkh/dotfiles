import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const MODEL = "anthropic/claude-opus-5.5";
const UPSTREAM = "google-vertex/us";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Native Anthropic requests do not apply compat.openRouterRouting from models.json.
export default function (pi: ExtensionAPI) {
  pi.on("before_provider_request", (event, ctx) => {
    const payload = event.payload;
    if (ctx.model?.provider !== "openrouter" || !isRecord(payload) || payload.model !== MODEL) {
      return;
    }

    const routing = isRecord(payload.provider) ? payload.provider : {};
    return {
      ...payload,
      provider: {
        ...routing,
        order: [UPSTREAM],
        only: [UPSTREAM],
        allow_fallbacks: false,
        zdr: true,
      },
    };
  });
}
