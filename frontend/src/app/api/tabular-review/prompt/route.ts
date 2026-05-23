import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { completeText } from "@/lib/server/llm";
import { getUserModelSettings } from "@/lib/server/userSettings";

// POST /api/tabular-review/prompt
export async function POST(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const body = (await request.json()) as { title?: unknown; format?: unknown; documentName?: unknown; tags?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ detail: "title is required" }, { status: 400 });

    const format: string = typeof body.format === "string" ? body.format : "text";
    const documentName: string = typeof body.documentName === "string" ? body.documentName.trim() : "";
    const tags: string[] = Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === "string") : [];

    const formatDescriptions: Record<string, string> = {
        text: "free-form text",
        bulleted_list: "a bulleted list",
        number: "a single number",
        percentage: "a percentage value",
        monetary_amount: "a monetary amount",
        currency: "a currency code",
        yes_no: "Yes or No",
        date: "a date",
        tag: tags.length ? `one of these tags: ${tags.join(", ")}` : "a tag",
    };
    const formatHint = formatDescriptions[format] ?? "free-form text";
    const tagsNote = format === "tag" && tags.length ? `\nAvailable tags: ${tags.join(", ")}` : "";
    const docNote = documentName ? `\nDocument type/name: ${documentName}` : "";

    const userMessage =
        `Column title: ${title}` +
        docNote +
        `\nExpected response format: ${formatHint}` +
        tagsNote +
        `\n\nWrite the best extraction prompt for a legal tabular review column with this title. ` +
        `Do NOT include any instruction about the response format in the prompt — ` +
        `format handling is applied separately and must not be duplicated inside the prompt text.`;

    try {
        const { title_model, api_keys } = await getUserModelSettings(userId);
        const raw = await completeText({
            model: title_model,
            systemPrompt: 'You write high-quality column prompts for legal tabular review workflows. Return only valid JSON with a single field: {"prompt": string}. The prompt you write must focus solely on what to extract — never on how to format the response.',
            user: userMessage,
            maxTokens: 512,
            apiKeys: api_keys,
        });
        const parsed = JSON.parse(raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "").trim()) as { prompt?: unknown };
        if (typeof parsed.prompt === "string" && parsed.prompt.trim()) {
            return NextResponse.json({ prompt: parsed.prompt.trim(), source: "llm" });
        } else {
            return NextResponse.json({ detail: "LLM returned an empty prompt" }, { status: 502 });
        }
    } catch {
        return NextResponse.json({ detail: "Failed to generate prompt from LLM" }, { status: 502 });
    }
}
