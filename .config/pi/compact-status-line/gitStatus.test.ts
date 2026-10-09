import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatGitStatus, parseGitStatus } from "./gitStatus.ts";
import { changedWorktree } from "./testing/fixtures.ts";

const theme = { fg: (color: string, text: string) => `<${color}>${text}</${color}>` };

describe("parseGitStatus", () => {
	it("counts both index and working-tree changes without counting rename/copy sources or ignored files", () => {
		assert.deepEqual(parseGitStatus(changedWorktree), {
			branch: "feature/topic", staged: 5, unstaged: 2, untracked: 2, conflicts: 1, ahead: 3, behind: 2,
		});
	});
	for (const [xy, staged, unstaged] of [["A.", 1, 0], [".D", 0, 1], ["AM", 1, 1], ["T.", 1, 0], [".M", 0, 1]] as const) {
		it(`classifies ${xy} without conflating staged and unstaged files`, () => {
			const result = parseGitStatus(`1 ${xy} N... file\0`);
			assert.equal(result.staged, staged);
			assert.equal(result.unstaged, unstaged);
			assert.equal(result.conflicts, 0);
		});
	}
	for (const xy of ["DD", "AU", "UD", "UA", "DU", "AA", "UU"]) {
		it(`counts unmerged ${xy} only as a conflict`, () => {
			const result = parseGitStatus(`u ${xy} N... file\0`);
			assert.equal(result.conflicts, 1);
			assert.equal(result.staged, 0);
			assert.equal(result.unstaged, 0);
		});
	}
	it("counts a dirty submodule once rather than counting its internal files", () => {
		assert.equal(parseGitStatus("1 .M S.MU submodule\0").unstaged, 1);
	});
	it("shows a short commit identifier for detached HEAD", () => {
		assert.equal(parseGitStatus("# branch.head (detached)\0# branch.oid abcdef123456789\0").branch, "@abcdef1");
		assert.equal(parseGitStatus("# branch.head (detached)\0").branch, "detached");
	});
	it("handles an unborn branch without inventing divergence", () => {
		assert.deepEqual(parseGitStatus("# branch.oid (initial)\0# branch.head main\0"), {
			branch: "main", staged: 0, unstaged: 0, untracked: 0, conflicts: 0, ahead: 0, behind: 0,
		});
	});
	it("ignores empty, unknown, and malformed records", () => {
		const result = parseGitStatus("# branch.ab invalid\0# unknown header\0x unknown\0" + "1 \0\0");
		assert.deepEqual(result, parseGitStatus(""));
	});
});

describe("formatGitStatus", () => {
	it("shows a green clean branch and checkmark without zero counters", () => {
		assert.equal(formatGitStatus(theme, parseGitStatus("# branch.head main\0"), null), "<success> main</success> <success>✓</success>");
	});
	it("uses separate semantic colors for each nonzero category and highlights conflicts", () => {
		assert.equal(formatGitStatus(theme, parseGitStatus(changedWorktree), null),
			"<error> feature/topic</error> <success>+5</success> <warning>~2</warning> <accent>?2</accent> <error>!1</error> <success>↑3</success> <warning>↓2</warning>");
	});
	it("colors a dirty but conflict-free branch yellow", () => {
		assert.equal(formatGitStatus(theme, parseGitStatus("# branch.head main\0? file\0"), null), "<warning> main</warning> <accent>?1</accent>");
	});
	it("keeps upstream divergence separate from working-tree cleanliness", () => {
		assert.equal(formatGitStatus(theme, parseGitStatus("# branch.head main\0# branch.ab +2 -4\0"), null),
			"<success> main</success> <success>✓</success> <success>↑2</success> <warning>↓4</warning>");
	});
	it("renders unknown Git state dimly rather than claiming it is clean", () => {
		assert.equal(formatGitStatus(theme, undefined, "main"), "<dim> main</dim>");
	});
	it("hides the segment outside a repository", () => {
		assert.equal(formatGitStatus(theme, undefined, null), "");
		assert.equal(formatGitStatus(theme, parseGitStatus(""), null), "");
	});
});
