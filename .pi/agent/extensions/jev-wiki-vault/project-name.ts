/**
 * Derive a stable project name from a git remote URL.
 * Hosting-agnostic: GitHub/GitLab/etc. use the repository name; Launchpad-style
 * paths (`~owner`, `+git`, `+source`) use the Launchpad project or package name.
 */
export function projectNameFromRemote(url: string): string | undefined {
	let path = url.trim();
	if (!path) return undefined;
	if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) {
		path = path.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, ""); // scheme://[user@]host[:port]
	} else if (/^[^/@]+@[^/:]+:/.test(path) || /^[a-z][a-z0-9.-]*:/i.test(path)) {
		path = path.replace(/^[^:]*:/, ""); // scp-like git@host:path, or alias lp:path
	}
	const segments = path
		.split("/")
		.map((segment) => segment.trim())
		.filter(Boolean);
	if (segments.length === 0) return undefined;
	const last = segments.length - 1;
	segments[last] = segments[last].replace(/\.git$/i, "");

	let name: string | undefined;
	const sourceAt = segments.indexOf("+source");
	const gitAt = segments.indexOf("+git");
	if (sourceAt >= 0 && segments[sourceAt + 1]) {
		name = segments[sourceAt + 1]; // [~owner/]distro/+source/<package>[/+git/repo]
	} else if (gitAt >= 0) {
		const target = segments.slice(0, gitAt).filter((segment) => !segment.startsWith("~"));
		name = target[0] ?? segments[gitAt + 1]; // ~owner/<project>/+git/repo, or personal ~owner/+git/<repo>
	} else if (segments[0].startsWith("~")) {
		name = segments[1]; // ~owner/<project>: the owner's default repository for a project
	} else {
		name = segments[last]; // <project> on Launchpad, owner/<repo> elsewhere
	}
	return sanitize(name);
}

export function sanitize(name: string | undefined): string | undefined {
	const slug = (name ?? "")
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/^[-.]+|[-.]+$/g, "");
	return slug || undefined;
}

/** Remote preference: the canonical upstream first, then the default remote. */
export function pickRemote(remotes: Record<string, string>): string | undefined {
	for (const name of ["upstream", "origin"]) if (remotes[name]) return remotes[name];
	const first = Object.keys(remotes).sort()[0];
	return first ? remotes[first] : undefined;
}
