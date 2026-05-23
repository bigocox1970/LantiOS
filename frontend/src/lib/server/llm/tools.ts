import type { OpenAIToolSchema } from "./types";

export type ClaudeTool = {
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
};

export function toClaudeTools(tools: OpenAIToolSchema[]): ClaudeTool[] {
    return tools.map((t) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: normalizeSchema(t.function.parameters),
    }));
}

export type GeminiFunctionDeclaration = {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
};

export function toGeminiTools(tools: OpenAIToolSchema[]): GeminiFunctionDeclaration[] {
    return tools.map((t) => {
        const params = normalizeSchema(t.function.parameters);
        const hasProps =
            params &&
            typeof params === "object" &&
            Object.keys((params as { properties?: Record<string, unknown> }).properties ?? {}).length > 0;
        return {
            name: t.function.name,
            description: t.function.description,
            ...(hasProps ? { parameters: params } : {}),
        };
    });
}

function normalizeSchema(schema: unknown): Record<string, unknown> {
    if (!schema || typeof schema !== "object") {
        return { type: "object", properties: {} };
    }
    const s = schema as Record<string, unknown>;
    const type = s.type;
    const out: Record<string, unknown> = { ...s };

    if (type === "object") {
        const props = (s.properties as Record<string, unknown>) ?? {};
        const normProps: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(props)) {
            normProps[k] = normalizeSchema(v);
        }
        out.properties = normProps;
    }
    if (type === "array" && s.items) {
        out.items = normalizeSchema(s.items);
    }
    return out;
}
