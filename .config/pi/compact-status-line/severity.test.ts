import assert from "node:assert/strict";
import { test } from "node:test";
import { highlight } from "./severity.ts";
const theme = { fg: (color: string, text: string) => `<${color}>${text}</${color}>` };
for (const [warning, error] of [[65, 85], [10, 15]]) {
	test(`normal text and exact warning/error boundaries ${warning}/${error}`, () => {
		assert.equal(highlight(theme, "value", warning - 1, warning, error), "<muted>value</muted>");
		assert.equal(highlight(theme, "value", warning, warning, error), "<warning>value</warning>");
		assert.equal(highlight(theme, "value", error - 1, warning, error), "<warning>value</warning>");
		assert.equal(highlight(theme, "value", error, warning, error), "<error>value</error>");
	});
}
