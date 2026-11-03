// Run: node ~/.pi/agent/extensions/jev-wiki-vault/project-name.test.ts
import assert from "node:assert/strict";
import { pickRemote, projectNameFromRemote } from "./project-name.ts";

const cases: Array<[string, string]> = [
	["git@github.com:canonical/ubuntu.com.git", "ubuntu.com"],
	["https://github.com/goulinkh/dotfiles", "dotfiles"],
	["ssh://git@gitlab.com/group/sub/repo.git", "repo"],
	["git+ssh://git.launchpad.net/launchpad", "launchpad"],
	["https://git.launchpad.net/launchpad", "launchpad"],
	["git+ssh://goulin@git.launchpad.net/~goulinkh/launchpad", "launchpad"],
	["git+ssh://git.launchpad.net/~launchpad-committers/launchpad-typescript-client", "launchpad-typescript-client"],
	["git+ssh://git.launchpad.net/~goulinkh/launchpad/+git/launchpad", "launchpad"],
	["git+ssh://git.launchpad.net/~goulinkh/+git/test-project", "test-project"],
	["https://git.launchpad.net/ubuntu/+source/lptools", "lptools"],
	["git+ssh://git.launchpad.net/~ubuntu-core-dev/ubuntu/+source/livecd-rootfs/+git/livecd-rootfs", "livecd-rootfs"],
	["git+ssh://git.qastaging.paddev.net/~goulinkh/launchpad-ui", "launchpad-ui"],
	["lp:launchpad", "launchpad"],
	["lp:~goulinkh/launchpad-ui", "launchpad-ui"],
	["lp:~goulinkh/+git/test-project", "test-project"],
	["git+ssh://goulin@git.launchpad.test:9422/~goulinkh/launchpad", "launchpad"],
	["/srv/git/local-repo.git", "local-repo"],
	["", ""],
];

for (const [url, expected] of cases) {
	assert.equal(projectNameFromRemote(url) ?? "", expected, url);
}
assert.equal(pickRemote({ origin: "o", upstream: "u" }), "u");
assert.equal(pickRemote({ origin: "o", fork: "f" }), "o");
assert.equal(pickRemote({ zeta: "z", alpha: "a" }), "a");
assert.equal(pickRemote({}), undefined);
console.log(`project-name: ${cases.length + 4} checks pass`);
