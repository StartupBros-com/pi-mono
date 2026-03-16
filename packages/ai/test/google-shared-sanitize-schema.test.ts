import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";
import { convertTools } from "../src/providers/google-shared.js";
import type { Tool } from "../src/types.js";

describe("convertTools schema sanitization for OpenAPI (useParameters=true)", () => {
	it("converts anyOf with const entries to enum", () => {
		const tool = {
			name: "test_tool",
			description: "A test tool",
			parameters: Type.Object({
				mode: Type.Union([Type.Literal("fast"), Type.Literal("slow"), Type.Literal("auto")]),
			}),
		};

		const result = convertTools([tool], true);
		const params = result![0].functionDeclarations[0].parameters as Record<string, unknown>;
		const properties = params.properties as Record<string, unknown>;
		const mode = properties.mode as Record<string, unknown>;

		expect(mode.enum).toEqual(["fast", "slow", "auto"]);
		expect(mode.anyOf).toBeUndefined();
		expect(mode.const).toBeUndefined();
	});

	it("strips patternProperties", () => {
		const tool = {
			name: "test_tool",
			description: "A test tool",
			parameters: {
				type: "object",
				properties: {
					metadata: {
						type: "object",
						patternProperties: {
							"^x-": { type: "string" },
						},
					},
				},
			},
		} as unknown as Tool;

		const result = convertTools([tool], true);
		const params = result![0].functionDeclarations[0].parameters as Record<string, unknown>;
		const properties = params.properties as Record<string, unknown>;
		const metadata = properties.metadata as Record<string, unknown>;

		expect(metadata.patternProperties).toBeUndefined();
		expect(metadata.type).toBe("object");
	});

	it("converts standalone const to single-value enum", () => {
		const tool = {
			name: "test_tool",
			description: "A test tool",
			parameters: {
				type: "object",
				properties: {
					version: { const: "v2" },
				},
			},
		} as unknown as Tool;

		const result = convertTools([tool], true);
		const params = result![0].functionDeclarations[0].parameters as Record<string, unknown>;
		const properties = params.properties as Record<string, unknown>;
		const version = properties.version as Record<string, unknown>;

		expect(version.enum).toEqual(["v2"]);
		expect(version.const).toBeUndefined();
	});

	it("does not sanitize when useParameters is false", () => {
		const tool = {
			name: "test_tool",
			description: "A test tool",
			parameters: Type.Object({
				mode: Type.Union([Type.Literal("fast"), Type.Literal("slow")]),
			}),
		};

		const result = convertTools([tool], false);
		const decl = result![0].functionDeclarations[0];

		// Should use parametersJsonSchema, not parameters
		expect(decl.parametersJsonSchema).toBeDefined();
		expect(decl.parameters).toBeUndefined();
	});

	it("handles nested schemas recursively", () => {
		const tool = {
			name: "test_tool",
			description: "A test tool",
			parameters: {
				type: "object",
				properties: {
					config: {
						type: "object",
						properties: {
							level: {
								anyOf: [{ const: "low" }, { const: "high" }],
							},
						},
					},
				},
			},
		} as unknown as Tool;

		const result = convertTools([tool], true);
		const params = result![0].functionDeclarations[0].parameters as Record<string, unknown>;
		const properties = params.properties as Record<string, unknown>;
		const config = properties.config as Record<string, unknown>;
		const configProps = config.properties as Record<string, unknown>;
		const level = configProps.level as Record<string, unknown>;

		expect(level.enum).toEqual(["low", "high"]);
		expect(level.anyOf).toBeUndefined();
	});
});
