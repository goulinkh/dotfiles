/** Read the router's live status rather than caching a route for the session. */
export function modelLabel(provider: string | undefined, id: string | undefined, routerStatus?: string): string {
	const model = id ?? "no-model";
	if (provider !== "auto" || id !== "gpt-auto") return model;
	const target = /^gpt-auto: ([^\s/]+\/[^\s]+) \(/.exec(routerStatus ?? "")?.[1];
	return target ? `${model} (${target.slice(target.indexOf("/") + 1)})` : model;
}
