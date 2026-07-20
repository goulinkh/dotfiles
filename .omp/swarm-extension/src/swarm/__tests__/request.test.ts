import { afterAll, afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	NO_REQUEST_ERROR,
	RequestWriteError,
	normalizeRequest,
	readExistingRequest,
	resolveHeadlessRequest,
	resolveRequestPath,
	writeRequest,
} from "../request";

let workspace: string;

beforeEach(async () => {
	workspace = await fs.mkdtemp(path.join(os.tmpdir(), "swarm-request-test-"));
});

afterEach(async () => {
	await fs.rm(workspace, { recursive: true, force: true });
});

afterAll(() => {
	process.stdout.write("request capture tests passed\n");
});

describe("request utilities", () => {
	it("normalizes trailing whitespace to exactly one newline without changing leading text", () => {
		expect(normalizeRequest("  keep leading\n\n  ")).toBe("  keep leading\n");
		expect(normalizeRequest(normalizeRequest("request"))).toBe("request\n");
	});

	it("resolves relative request paths against the workspace and preserves absolute paths", () => {
		const absolute = path.join(workspace, "absolute.md");
		expect(resolveRequestPath("nested/request.md", workspace)).toBe(path.join(workspace, "nested/request.md"));
		expect(resolveRequestPath(absolute, "/other")).toBe(absolute);
	});

	it("reads existing request content and returns empty text for a missing file", async () => {
		const requestPath = path.join(workspace, "request.md");
		expect(await readExistingRequest(requestPath)).toBe("");
		await Bun.write(requestPath, "existing request\n");
		expect(await readExistingRequest(requestPath)).toBe("existing request\n");
	});

	it("creates parent directories and writes normalized request content", async () => {
		const requestPath = path.join(workspace, "nested", "request.md");
		await writeRequest(requestPath, "request body  \n\n");
		expect(await Bun.file(requestPath).text()).toBe("request body\n");
	});

	it("reports request write failures with the target path", async () => {
		const parentFile = path.join(workspace, "not-a-directory");
		await Bun.write(parentFile, "blocking file");
		const requestPath = path.join(parentFile, "request.md");
		await expect(writeRequest(requestPath, "request")).rejects.toBeInstanceOf(RequestWriteError);
		await expect(writeRequest(requestPath, "request")).rejects.toThrow(requestPath);
	});

	it("uses explicit request text before stdin and the existing file", () => {
		expect(
			resolveHeadlessRequest({
				explicitRequest: "explicit",
				stdinRequest: "stdin",
				useStdin: true,
				existingRequest: "existing",
			}),
		).toEqual({ ok: true, request: "explicit", source: "explicit" });
	});

	it("uses request text from stdin when selected", () => {
		expect(
			resolveHeadlessRequest({
				explicitRequest: "-",
				stdinRequest: "stdin request",
				useStdin: true,
				existingRequest: "existing",
			}),
		).toEqual({ ok: true, request: "stdin request", source: "stdin" });
	});

	it("ignores stdin when unavailable and falls back to the existing request", () => {
		expect(
			resolveHeadlessRequest({
				stdinRequest: "unavailable stdin",
				useStdin: false,
				existingRequest: "existing",
			}),
		).toEqual({ ok: true, request: "existing", source: "file" });
	});

	it("aborts when every headless request source is empty", () => {
		expect(
			resolveHeadlessRequest({
				explicitRequest: " ",
				stdinRequest: "\n",
				useStdin: true,
				existingRequest: "",
			}),
		).toEqual({ ok: false, aborted: true });
	});

	it("provides one actionable missing-request error", () => {
		const requestPath = path.join(workspace, "request.md");
		const message = NO_REQUEST_ERROR(requestPath);
		expect(message).toContain(requestPath);
		expect(message).toContain("--request");
		expect(message).toContain("stdin");
	});
});
