/** Parse and present one Git snapshot so branch colors and counters describe the same refresh. */
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

type GitStatus = {
	branch: string | null;
	staged: number;
	unstaged: number;
	untracked: number;
	conflicts: number;
	ahead: number;
	behind: number;
};

/** Parse `git status --porcelain=v2 --branch -z` into per-file and local upstream counts.
 * A file can be both staged and unstaged; conflicts count only as conflicts. Rename/copy source
 * paths are separate NUL records and must not be mistaken for another changed file.
 */
export function parseGitStatus(output: string): GitStatus {
	const status: GitStatus = { branch: null, staged: 0, unstaged: 0, untracked: 0, conflicts: 0, ahead: 0, behind: 0 };
	let objectId = "";
	const records = output.split("\0");
	for (let index = 0; index < records.length; index++) {
		const record = records[index];
		if (record.startsWith("# branch.head ")) {
			status.branch = record.slice(14);
		} else if (record.startsWith("# branch.oid ")) {
			objectId = record.slice(13);
		} else if (record.startsWith("# branch.ab ")) {
			const divergence = record.match(/^# branch\.ab \+(\d+) -(\d+)$/);
			if (divergence) {
				status.ahead = Number(divergence[1]);
				status.behind = Number(divergence[2]);
			}
		} else if (record.startsWith("? ")) {
			status.untracked++;
		} else if (record.startsWith("u ")) {
			status.conflicts++;
		} else if (record.startsWith("1 ") || record.startsWith("2 ")) {
			if (record.startsWith("2 ")) index++;
			if (record.length < 4) continue;
			if (record[2] !== ".") status.staged++;
			if (record[3] !== ".") status.unstaged++;
		}
	}
	if (status.branch === "(detached)") status.branch = objectId && objectId !== "(initial)" ? `@${objectId.slice(0, 7)}` : "detached";
	return status;
}

/** Format an Oh My Zsh-style Git segment using semantic colors and nonzero counters.
 * `+` staged, `~` unstaged, `?` untracked, `!` conflicts, `↑` ahead, `↓` behind; `✓` means
 * a clean working tree. A pending/failed snapshot leaves only a dim fallback branch.
 */
export function formatGitStatus(theme: Pick<ExtensionContext["ui"]["theme"], "fg">, status: GitStatus | undefined, fallbackBranch: string | null): string {
	const branch = status?.branch ?? fallbackBranch;
	if (!branch) return "";
	const hasChanges = status !== undefined && (status.staged > 0 || status.unstaged > 0 || status.untracked > 0 || status.conflicts > 0);
	const branchColor = status === undefined ? "dim" : status.conflicts > 0 ? "error" : hasChanges ? "warning" : "success";
	const parts = [theme.fg(branchColor, ` ${branch}`)];
	if (!status) return parts[0];
	if (!hasChanges) parts.push(theme.fg("success", "✓"));
	if (status.staged) parts.push(theme.fg("success", `+${status.staged}`));
	if (status.unstaged) parts.push(theme.fg("warning", `~${status.unstaged}`));
	if (status.untracked) parts.push(theme.fg("accent", `?${status.untracked}`));
	if (status.conflicts) parts.push(theme.fg("error", `!${status.conflicts}`));
	if (status.ahead) parts.push(theme.fg("success", `↑${status.ahead}`));
	if (status.behind) parts.push(theme.fg("warning", `↓${status.behind}`));
	return parts.join(" ");
}
