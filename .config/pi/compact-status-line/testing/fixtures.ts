/** Synthetic porcelain v2 records with tricky filenames; no account or repository data. */
export const changedWorktree = [
	"# branch.oid abcdef123456789", "# branch.head feature/topic", "# branch.ab +3 -2",
	"1 M. N... staged.txt", "1 .M N... unstaged.txt", "1 MM N... both.txt", "1 D. N... deleted.txt",
	"2 R. N... renamed.txt", "u UU rename-source.txt",
	"2 C. N... copied.txt", "? copy-source.txt",
	"? new.txt", "? newline\n1 M. filename.txt", "u UU N... conflict.txt", "! ignored.txt",
].join("\0") + "\0";
