import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionCommandContext } from "@oh-my-pi/pi-coding-agent";
import { seedRequestFile } from "../../extension";
import { NO_REQUEST_ERROR } from "../request";

let workspace: string;

beforeEach(async () => {
	workspace = await fs.mkdtemp(path.join(os.tmpdir(), "swarm-seed-test-"));
});

afterEach(async () => {
	vi.restoreAllMocks();
	await fs.rm(workspace, { recursive: true, force: true });
});

function createHarness(edited: string | undefined, hasUI = true) {
	const editor = vi.fn(async () => edited);
	const notify = vi.fn();
	const sendMessage = vi.fn();
	const ctx = {
		hasUI,
		ui: { editor, notify },
	} as unknown as ExtensionCommandContext;
	const pi = { sendMessage } as unknown as ExtensionAPI;
	return { ctx, pi, editor, notify, sendMessage };
}

describe("seedRequestFile", () => {
	it("writes a normalized interactive request and echoes it to the transcript", async () => {
		const harness = createHarness("  requested work  \n\n");
		const seeded = await seedRequestFile("nested/request.md", workspace, harness.ctx, harness.pi, "demo");

		expect(seeded).toBe(true);
		expect(await Bun.file(path.join(workspace, "nested/request.md")).text()).toBe("  requested work\n");
		expect(harness.editor).toHaveBeenCalledWith(
			"Swarm request for 'request.md' — describe what you want done",
			"",
			undefined,
			{ promptStyle: true },
		);
		expect(harness.sendMessage).toHaveBeenCalledTimes(1);
		expect(harness.sendMessage).toHaveBeenCalledWith(
			{
				customType: "swarm-request",
				content: [{ type: "text", text: "## demo · request\n\n  requested work" }],
				display: true,
				details: { swarmName: "demo", requestFile: "nested/request.md" },
			},
			{ triggerTurn: false },
		);
	});

	it("keeps and echoes an existing request when the editor is cancelled", async () => {
		const requestPath = path.join(workspace, "request.md");
		await Bun.write(requestPath, "existing request  \n");
		const harness = createHarness(undefined);

		expect(await seedRequestFile("request.md", workspace, harness.ctx, harness.pi, "demo")).toBe(true);
		expect(await Bun.file(requestPath).text()).toBe("existing request  \n");
		expect(harness.sendMessage).toHaveBeenCalledTimes(1);
		expect(harness.sendMessage.mock.calls[0][0].content[0].text).toBe("## demo · request\n\nexisting request");
	});

	it("aborts a cancelled editor when there is no existing request", async () => {
		const harness = createHarness(undefined);

		expect(await seedRequestFile("request.md", workspace, harness.ctx, harness.pi, "demo")).toBe(false);
		expect(harness.notify).toHaveBeenCalledWith("Swarm cancelled — no request provided.", "warning");
		expect(harness.sendMessage).not.toHaveBeenCalled();
	});

	it("aborts an intentionally empty interactive request", async () => {
		const harness = createHarness(" \n\t");

		expect(await seedRequestFile("request.md", workspace, harness.ctx, harness.pi, "demo")).toBe(false);
		expect(harness.notify).toHaveBeenCalledWith("Swarm cancelled — request was empty.", "warning");
		expect(harness.sendMessage).not.toHaveBeenCalled();
	});

	it("uses the shared missing-request error when no UI or file is available", async () => {
		const harness = createHarness(undefined, false);
		const requestPath = path.join(workspace, "request.md");

		expect(await seedRequestFile("request.md", workspace, harness.ctx, harness.pi, "demo")).toBe(false);
		expect(harness.notify).toHaveBeenCalledWith(NO_REQUEST_ERROR(requestPath), "error");
		expect(harness.editor).not.toHaveBeenCalled();
		expect(harness.sendMessage).not.toHaveBeenCalled();
	});

	it("reports a request write failure instead of throwing", async () => {
		const parentFile = path.join(workspace, "not-a-directory");
		await Bun.write(parentFile, "blocking file");
		const harness = createHarness("request");

		expect(
			await seedRequestFile("not-a-directory/request.md", workspace, harness.ctx, harness.pi, "demo"),
		).toBe(false);
		expect(harness.notify).toHaveBeenCalledWith(expect.stringContaining("Cannot write request file"), "error");
		expect(harness.sendMessage).not.toHaveBeenCalled();
	});
});
