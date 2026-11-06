export function severity(value: number, warning: number, error: number): "warning" | "error" | undefined {
	return value >= error ? "error" : value >= warning ? "warning" : undefined;
}

export function highlight(theme: { fg(color: "muted" | "warning" | "error", text: string): string }, text: string, value: number, warning: number, error: number): string {
	const color = severity(value, warning, error);
	return theme.fg(color ?? "muted", text);
}
