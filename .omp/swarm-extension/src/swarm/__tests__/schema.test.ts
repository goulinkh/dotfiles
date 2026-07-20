import { describe, expect, it } from "bun:test";
import { parseSwarmYaml, validateSwarmDefinition } from "../schema";

function buildYaml(requestFile: string): string {
	return `
swarm:
  name: request-test
  workspace: .
  request_file: ${JSON.stringify(requestFile)}
  agents:
    worker:
      role: worker
      task: do work
`;
}

describe("swarm request_file schema", () => {
	it("trims a configured request file path", () => {
		const definition = parseSwarmYaml(buildYaml("  .fable/request.md  "));
		expect(definition.requestFile).toBe(".fable/request.md");
		expect(validateSwarmDefinition(definition)).not.toContain(
			"swarm.request_file must not be empty when provided",
		);
	});

	it("reports the existing validation error for an empty request file path", () => {
		const definition = parseSwarmYaml(buildYaml("   "));
		expect(definition.requestFile).toBe("");
		expect(validateSwarmDefinition(definition)).toContain(
			"swarm.request_file must not be empty when provided",
		);
	});
});
