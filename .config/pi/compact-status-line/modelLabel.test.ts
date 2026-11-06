import assert from "node:assert/strict";
import { test } from "node:test";
import { modelLabel } from "./modelLabel.ts";

test("GPT Auto follows route changes in the same session", () => {
	assert.equal(modelLabel("auto", "gpt-auto", "gpt-auto: openai-codex/gpt-6.1-sol (high, pinned)"), "gpt-auto (gpt-6.1-sol)");
	assert.equal(modelLabel("auto", "gpt-auto", "gpt-auto: openai-codex/gpt-6-astra (high, adaptive)"), "gpt-auto (gpt-6-astra)");
});

test("unselected routes and concrete models do not display a stale route", () => {
	for (const status of [undefined, "gpt-auto: Jev (not yet pinned)", "invalid"]) {
		assert.equal(modelLabel("auto", "gpt-auto", status), "gpt-auto");
	}
	assert.equal(modelLabel("openai-codex", "gpt-6-astra", "gpt-auto: openai-codex/gpt-6.1-sol (high, pinned)"), "gpt-6-astra");
	assert.equal(modelLabel(undefined, undefined), "no-model");
});
