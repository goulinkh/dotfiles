/**
 * Read what a pi-jev-wiki brief adds to the wiki. Pure functions, tested by brief.test.ts;
 * the parsing follows the brief format of pi-jev-wiki 1.0.x (renderBrief in its extension.ts).
 */
export interface WikiAdditions {
	/** Pages pi-jev-wiki wrote or merged on its own (writer mode auto). */
	written: string[];
	/** Draft pages waiting to be promoted (writer mode draft). */
	drafted: string[];
	/** Claims accepted for filing that the agent still has to write (guided mode). */
	filed: string[];
	/** Existing pages whose claims gained support. */
	reinforced: string[];
	/** Claims below the auto-accept threshold, queued for review. */
	review: string[];
}

const CLAIM_PREVIEW = 100;

export function clip(text: string, max = CLAIM_PREVIEW): string {
	const flat = text.replace(/\s+/g, " ").trim();
	return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function list(value: string): string[] {
	return value
		.split(",")
		.map((item) => item.trim().replace(/^`|`$/g, ""))
		.filter(Boolean);
}

/** Read what a pi-jev-wiki brief adds. Undefined when the text is not a brief. */
export function additionsFromBrief(text: string): WikiAdditions | undefined {
	if (!/^Claims: \d+ · file \d+ · reinforce \d+ · review \d+/m.test(text)) return undefined;
	const additions: WikiAdditions = { written: [], drafted: [], filed: [], reinforced: [], review: [] };
	let section = "";
	for (const line of text.split("\n")) {
		const heading = /^### (.+)$/.exec(line);
		if (heading) {
			section = heading[1].trim();
			continue;
		}
		const written = /^Written automatically \([^)]*\): (.+)$/.exec(line);
		if (written) {
			additions.written.push(...list(written[1]));
			continue;
		}
		const drafted = /^Drafts written \([^)]*\): (.+)$/.exec(line);
		if (drafted) {
			additions.drafted.push(...list(drafted[1]));
			continue;
		}
		const bullet = /^- (.+)$/.exec(line);
		if (!bullet) continue;
		const body = bullet[1];
		if (section === "File into wiki") {
			const split = body.indexOf(" — ");
			const claim = split >= 0 ? body.slice(split + 3) : body;
			additions.filed.push(clip(claim.replace(/ \[user-stated:[^\]]*\]/, "").replace(/ \(files: [^)]*\)$/, "")));
		} else if (section === "Reinforce existing knowledge") {
			additions.reinforced.push(/^`([^`]+)`/.exec(body)?.[1] ?? clip(body));
		} else if (section.startsWith("Needs review")) {
			const split = body.lastIndexOf(" — ");
			additions.review.push(clip(split >= 0 ? body.slice(0, split) : body));
		}
	}
	return additions;
}

export function hasAdditions(additions: WikiAdditions): boolean {
	return (
		additions.written.length + additions.drafted.length + additions.filed.length + additions.reinforced.length + additions.review.length >
		0
	);
}

export function plural(count: number, one: string, many = `${one}s`): string {
	return `${count} ${count === 1 ? one : many}`;
}

/** One summary line plus one line per addition, uncolored. */
export function describeAdditions(additions: WikiAdditions): { headline: string; items: Array<{ mark: string; text: string }> } {
	const parts: string[] = [];
	const items: Array<{ mark: string; text: string }> = [];
	if (additions.written.length > 0) {
		parts.push(`wrote ${plural(additions.written.length, "page")}`);
		for (const page of additions.written) items.push({ mark: "+", text: page });
	} else if (additions.filed.length > 0) {
		parts.push(`${plural(additions.filed.length, "claim")} to file`);
		for (const claim of additions.filed) items.push({ mark: "+", text: claim });
	}
	if (additions.drafted.length > 0) {
		parts.push(plural(additions.drafted.length, "draft"));
		for (const page of additions.drafted) items.push({ mark: "✎", text: page });
	}
	if (additions.reinforced.length > 0) {
		parts.push(`reinforced ${plural(additions.reinforced.length, "page")}`);
		for (const page of additions.reinforced) items.push({ mark: "↻", text: page });
	}
	if (additions.review.length > 0) {
		parts.push(`${plural(additions.review.length, "claim")} for review`);
		for (const claim of additions.review) items.push({ mark: "?", text: claim });
	}
	return { headline: parts.join(" · "), items };
}
