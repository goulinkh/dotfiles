import * as fs from "node:fs/promises";
import * as path from "node:path";

export interface RequestCaptureResult {
	ok: boolean;
	request?: string;
	aborted?: boolean;
	source?: "explicit" | "stdin" | "file";
}

export interface HeadlessRequestOptions {
	explicitRequest?: string;
	stdinRequest?: string;
	useStdin: boolean;
	existingRequest: string;
}

export class RequestWriteError extends Error {
	constructor(requestPath: string, cause: unknown) {
		super(`Cannot write request file ${requestPath}: ${cause instanceof Error ? cause.message : String(cause)}`, {
			cause,
		});
		this.name = "RequestWriteError";
	}
}

export const NO_REQUEST_ERROR = (requestPath: string): string =>
	`No request found. Write your request to ${requestPath}, pass --request "<text>", or pipe it on stdin before running headless.`;

export function normalizeRequest(text: string): string {
	return `${text.replace(/\s+$/, "")}\n`;
}

export function resolveRequestPath(requestFile: string, workspace: string): string {
	return path.isAbsolute(requestFile) ? requestFile : path.resolve(workspace, requestFile);
}

export async function readExistingRequest(requestPath: string): Promise<string> {
	return Bun.file(requestPath)
		.text()
		.catch(() => "");
}

export async function writeRequest(requestPath: string, request: string): Promise<void> {
	try {
		await fs.mkdir(path.dirname(requestPath), { recursive: true });
		await Bun.write(requestPath, normalizeRequest(request));
	} catch (cause) {
		throw new RequestWriteError(requestPath, cause);
	}
}

export function resolveHeadlessRequest(options: HeadlessRequestOptions): RequestCaptureResult {
	const { explicitRequest, stdinRequest, useStdin, existingRequest } = options;
	if (explicitRequest !== undefined && explicitRequest !== "-" && explicitRequest.trim().length > 0) {
		return { ok: true, request: explicitRequest, source: "explicit" };
	}
	if (useStdin && stdinRequest !== undefined && stdinRequest.trim().length > 0) {
		return { ok: true, request: stdinRequest, source: "stdin" };
	}
	if (existingRequest.trim().length > 0) {
		return { ok: true, request: existingRequest, source: "file" };
	}
	return { ok: false, aborted: true };
}
