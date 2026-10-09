import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { describePath, formatPath, loadPathDescription } from "./pathStatus.ts";

let home: string;
beforeEach(async () => { home = await mkdtemp(join(tmpdir(), "pi-path-status-test-")); });
afterEach(async () => { await rm(home, { recursive: true, force: true }); });
const measure = (text: string) => Array.from(text).length;

describe("describePath", () => {
	it("shows full paths with home substitution rather than collapsing them to the basename", () => {
		assert.equal(formatPath(describePath("/Volumes/Disk1/Lab/project", home), 80, measure), "/Volumes/Disk1/Lab/project");
		assert.equal(formatPath(describePath(join(home, "work/project"), home), 80, measure), "~/work/project");
	});
	it("handles home, root, and component boundaries", () => {
		assert.equal(formatPath(describePath(home, home), 80, measure), "~");
		assert.equal(formatPath(describePath("/", home), 80, measure), "/");
		assert.equal(formatPath(describePath("/home/alex/project", "/home/al"), 80, measure), "/home/alex/project");
		assert.equal(formatPath(describePath("/work/project", ""), 80, measure), "/work/project");
	});
	it("normalizes trailing slashes without changing logical symlink paths", () => {
		assert.equal(formatPath(describePath(home + "/linked/project/", home + "/"), 80, measure), "~/linked/project");
	});
});

describe("loadPathDescription", () => {
	it("finds shortest unique prefixes among sibling directories", async () => {
		await Promise.all(["personal/projects/pi-usage", "performance", "personal/prototype"].map(directory => mkdir(join(home, directory), { recursive: true })));
		const description = await loadPathDescription(join(home, "personal/projects/pi-usage"), home);
		assert.deepEqual(description.segments.map(segment => segment.shortName), ["pers", "proj", "pi-usage"]);
		assert.equal(formatPath(description, 0, measure), "~/pers/proj/pi-usage");
	});
	for (const marker of [".git", "package.json", ".shorten_folder_marker"]) {
		it(`keeps directories with ${marker} as anchors`, async () => {
			await mkdir(join(home, "workspace/project/implementation/src"), { recursive: true });
			await writeFile(join(home, "workspace/project", marker), "synthetic marker");
			const description = await loadPathDescription(join(home, "workspace/project/implementation/src"), home);
			assert.equal(description.segments[1].anchor, true);
			assert.equal(formatPath(description, 0, measure), "~/w/project/i/src");
		});
	}
	it("includes symlinks among competitors but excludes ordinary files", async () => {
		await mkdir(join(home, "workspace/project"), { recursive: true });
		await writeFile(join(home, "workspace.txt"), "synthetic file");
		assert.equal((await loadPathDescription(join(home, "workspace/project"), home)).segments[0].shortName, "w");
		await symlink(join(home, "workspace"), join(home, "workspace-copy"));
		assert.equal((await loadPathDescription(join(home, "workspace/project"), home)).segments[0].shortName, "workspace");
	});
	it("refreshes uniqueness when a new sibling appears", async () => {
		await mkdir(join(home, "workspace/project"), { recursive: true });
		assert.equal((await loadPathDescription(join(home, "workspace/project"), home)).segments[0].shortName, "w");
		await mkdir(join(home, "water"));
		assert.equal((await loadPathDescription(join(home, "workspace/project"), home)).segments[0].shortName, "wo");
	});
	it("preserves the leading dot and complete Unicode characters", async () => {
		await Promise.all([".config/project", ".cache", "界long/project", "界later"].map(directory => mkdir(join(home, directory), { recursive: true })));
		assert.equal((await loadPathDescription(join(home, ".config/project"), home)).segments[0].shortName, ".co");
		assert.equal((await loadPathDescription(join(home, "界long/project"), home)).segments[0].shortName, "界lo");
	});
	it("falls back to full names when directory metadata cannot be read", async () => {
		const cwd = join(home, "missing/unknown/project");
		assert.deepEqual(await loadPathDescription(cwd, home), describePath(cwd, home));
	});
});

describe("formatPath", () => {
	it("keeps full names until space is needed, then shortens left-to-right", async () => {
		await mkdir(join(home, "workspace/service/project"), { recursive: true });
		const description = await loadPathDescription(join(home, "workspace/service/project"), home);
		assert.equal(formatPath(description, 80, measure), "~/workspace/service/project");
		assert.equal(formatPath(description, 22, measure), "~/w/service/project");
		assert.equal(formatPath(description, 18, measure), "~/w/s/project");
	});
	it("never abbreviates the first absolute-path directory or final directory", () => {
		const description = describePath("/Volumes/Disk1/Lab/project", home);
		for (const segment of description.segments) segment.shortName = segment.name[0];
		assert.equal(formatPath(description, 0, measure), "/Volumes/D/L/project");
	});
	it("caps path length at the configured 80 columns even when the footer has more room", () => {
		const description = describePath(join(home, "a".repeat(50), "b".repeat(50), "project"), home);
		description.segments[0].shortName = "a";
		description.segments[1].shortName = "b";
		assert.equal(formatPath(description, 200, measure), `~/a/${"b".repeat(50)}/project`);
	});
	it("uses the caller's terminal-column measurement without mutating its description", async () => {
		await mkdir(join(home, "workspace/service/project"), { recursive: true });
		const description = await loadPathDescription(join(home, "workspace/service/project"), home);
		const original = structuredClone(description);
		assert.equal(formatPath(description, 28, measure), "~/workspace/service/project");
		assert.equal(formatPath(description, 28, text => measure(text) * 2), "~/w/s/project");
		assert.deepEqual(description, original);
	});
});
