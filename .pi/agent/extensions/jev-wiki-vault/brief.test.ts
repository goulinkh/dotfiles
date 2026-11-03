// Run: node brief.test.ts
import assert from "node:assert/strict";
import { additionsFromBrief, describeAdditions, hasAdditions } from "./brief.ts";

let checks = 0;
function check(name: string, fn: () => void): void {
	try {
		fn();
		checks++;
	} catch (error) {
		console.error(`FAIL ${name}`);
		throw error;
	}
}

// The brief pi-jev-wiki showed after a real capture (writer mode auto).
const autoBrief = `## Wiki ingest brief — session 2026-11-03

Claims: 3 · file 1 · reinforce 0 · review 0 · advised against 2

### File into wiki
- new page (decision) — User preference: code-review tooling for pi must never use sub-agents. [user-stated: use \`status: user-stated\`]
  grounded 0.79 · derivable 0.29 · importance 0.67 · criticality 0.45

### Suggested not to add (Jev's reminders)
- [unsupported] earendil-works/pi-review was selected as the minimal review extension — not grounded in evidence
- [unsupported] Several pi review packages violate the no-sub-agent rule — not grounded in evidence

Raw session record: \`raw/sessions/2026-11-03-session-2026-11-03-151222.md\`
Written automatically (auto): general/decision-code-review-tooling-for-pi.md


Write or merge the accepted pages following the llm-wiki skill, then call wiki_finalize.`;

const nothingAdded = `## Wiki ingest brief — session 2026-11-03

Claims: 2 · file 0 · reinforce 0 · review 0 · advised against 2

### Suggested not to add (Jev's reminders)
- [derivable] The project uses pnpm — readable from package.json
- [duplicate] Node 22 is required — already in \`general/runtime.md\`

Raw session record: \`raw/sessions/x.md\``;

const guided = `## Wiki ingest brief — session 2026-11-03

Claims: 4 · file 2 · reinforce 1 · review 1 · advised against 0

### File into wiki
- merge → \`architecture/storage.md\` — Pages are written atomically — never in place (files: \`src/io.ts\`)
  grounded 0.91 · derivable 0.20 · importance 0.70 · criticality 0.30
- new page (gotcha, topic \`ci\` (new, suggested)) — CI caches break when the lockfile moves
  grounded 0.85 · derivable 0.10 · importance 0.50 · criticality 0.20

### Reinforce existing knowledge
- \`decisions/node-22.md\` (merge into claim \`node-version\`) — Node 22 is the minimum

### Needs review (below threshold)
- Retries are capped at three — evidence quote missing; support 0.62

### Next steps (guided mode)
1. Write or merge the **File/Reinforce** claims.
5. Call \`wiki_finalize\` with the touched page paths.`;

check("auto brief adds the written page", () => {
	const additions = additionsFromBrief(autoBrief);
	assert.ok(additions);
	assert.deepEqual(additions.written, ["general/decision-code-review-tooling-for-pi.md"]);
	assert.equal(additions.filed.length, 1);
	assert.match(additions.filed[0], /^User preference: code-review tooling/);
	assert.doesNotMatch(additions.filed[0], /user-stated/);
	assert.deepEqual(additions.reinforced, []);
	assert.deepEqual(additions.review, []);
	assert.equal(hasAdditions(additions), true);
});

check("auto brief summary lists pages, not rejections", () => {
	const { headline, items } = describeAdditions(additionsFromBrief(autoBrief)!);
	assert.equal(headline, "wrote 1 page");
	assert.deepEqual(items, [{ mark: "+", text: "general/decision-code-review-tooling-for-pi.md" }]);
});

check("a brief that only rejects adds nothing", () => {
	const additions = additionsFromBrief(nothingAdded);
	assert.ok(additions);
	assert.equal(hasAdditions(additions), false);
});

check("guided brief: claims to file, reinforcement, review", () => {
	const additions = additionsFromBrief(guided)!;
	assert.deepEqual(additions.written, []);
	assert.deepEqual(additions.filed, ["Pages are written atomically — never in place", "CI caches break when the lockfile moves"]);
	assert.deepEqual(additions.reinforced, ["decisions/node-22.md"]);
	assert.deepEqual(additions.review, ["Retries are capped at three"]);
	const { headline, items } = describeAdditions(additions);
	assert.equal(headline, "2 claims to file · reinforced 1 page · 1 claim for review");
	assert.deepEqual(
		items.map((item) => item.mark),
		["+", "+", "↻", "?"],
	);
});

check("review-only brief still shows", () => {
	const additions = additionsFromBrief(
		"Claims: 1 · file 0 · reinforce 0 · review 1 · advised against 0\n\n### Needs review (below threshold)\n- A claim — low support",
	)!;
	assert.equal(hasAdditions(additions), true);
	assert.equal(describeAdditions(additions).headline, "1 claim for review");
});

check("drafts and pre-compaction prefix", () => {
	const additions = additionsFromBrief(
		`Captured before compaction:\n\n## Wiki ingest brief — session\n\nClaims: 1 · file 1 · reinforce 0 · review 0 · advised against 0\n\n### File into wiki\n- new page (fact) — X\n\nDrafts written (draft): drafts/a.md, drafts/b.md`,
	)!;
	assert.deepEqual(additions.drafted, ["drafts/a.md", "drafts/b.md"]);
	assert.equal(describeAdditions(additions).headline, "1 claim to file · 2 drafts");
});

check("text that is not a brief is left alone", () => {
	assert.equal(additionsFromBrief("No insights submitted."), undefined);
	assert.equal(additionsFromBrief("Adjudicating 3 insights…"), undefined);
});

check("long claims are clipped", () => {
	const long = "a".repeat(300);
	const additions = additionsFromBrief(`Claims: 1 · file 1 · reinforce 0 · review 0 · advised against 0\n\n### File into wiki\n- new page (fact) — ${long}`)!;
	assert.equal(additions.filed[0].length, 100);
	assert.ok(additions.filed[0].endsWith("…"));
});

console.log(`brief: ${checks} checks pass`);
