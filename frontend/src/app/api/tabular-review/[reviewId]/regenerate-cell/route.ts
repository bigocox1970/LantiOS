import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { downloadFile } from "@/lib/server/storage";
import { loadActiveVersion } from "@/lib/server/documentVersions";
import { normalizeDocxZipPaths } from "@/lib/server/convert";
import { ensureReviewAccess, filterAccessibleDocumentIds } from "@/lib/server/access";
import { getUserModelSettings } from "@/lib/server/userSettings";
import { providerForModel, completeText, streamChatWithTools, type UserApiKeys } from "@/lib/server/llm";
import { checkAndConsumeCredit } from "@/lib/server/credits";

function formatPromptSuffix(format?: string, tags?: string[]): string {
    switch (format) {
        case "bulleted_list": return ' The "summary" field in your JSON response must be a markdown bulleted list only — no prose. Format: each item on its own line, prefixed with "* " (asterisk + single space), e.g.\n* First item\n* Second item\n* Third item';
        case "number": return ' The "summary" field in your JSON response must be a single number only. No units or explanation.';
        case "percentage": return ' The "summary" field in your JSON response must be a single percentage value only (e.g. 42%). No explanation.';
        case "monetary_amount": return ' The "summary" field in your JSON response must be the monetary value only, including currency symbol (e.g. $1,234.56). No explanation.';
        case "currency": return ' The "summary" field in your JSON response must contain only the currency code(s). Wrap each code in double square brackets, e.g. [[USD]] or [[EUR]]. No other text.';
        case "yes_no": return ' The "summary" field in your JSON response must be [[Yes]] or [[No]] only. The "reasoning" field MUST include an inline citation [[page:N||quote:verbatim excerpt ≤25 words]] pointing to the exact language in the document that supports the Yes/No answer.';
        case "date": return ' The "summary" field in your JSON response must be the date only in DD Month YYYY format (e.g. 1 January 2024). If a range, give both dates separated by an em dash. The "reasoning" field MUST include an inline citation [[page:N||quote:verbatim excerpt ≤25 words]] pointing to the exact place in the document where the date is found.';
        case "tag": return tags?.length ? ` The \"summary\" field in your JSON response must contain exactly one tag wrapped in double square brackets. Available tags: ${tags.map((t) => `[[${t}]]`).join(", ")}. No other text. The \"reasoning\" field MUST include an inline citation [[page:N||quote:verbatim excerpt ≤25 words]] pointing to the exact language in the document that supports the chosen tag.` : "";
        default: return "";
    }
}

function providerLabel(provider: string): string {
    if (provider === "claude") return "Anthropic";
    if (provider === "openai") return "OpenAI";
    return "Gemini";
}

function missingModelApiKey(model: string, apiKeys: UserApiKeys) {
    const provider = providerForModel(model);
    if (apiKeys[provider]?.trim()) return null;
    return { provider, model, detail: `${providerLabel(provider)} API key is required to use ${model}.` };
}

async function extractPdfMarkdown(buf: ArrayBuffer): Promise<string> {
    try {
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as string);
        const pdf = await (pdfjsLib as unknown as { getDocument: (opts: unknown) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: { str?: string }[] }> }> }> } }).getDocument({ data: new Uint8Array(buf) }).promise;
        const pages: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const tc = await page.getTextContent();
            const text = tc.items.filter((it): it is { str: string } => "str" in it).map((it) => it.str).join(" ").trim();
            if (text) pages.push(`## Page ${i}\n\n${text}`);
        }
        return pages.join("\n\n");
    } catch { return ""; }
}

async function extractDocxMarkdown(buf: ArrayBuffer): Promise<string> {
    try {
        const mammoth = await import("mammoth");
        const normalized = await normalizeDocxZipPaths(Buffer.from(buf));
        const { value: html } = await mammoth.convertToHtml({ buffer: normalized });
        return html
            .replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, (_, l, t) => "#".repeat(Number(l)) + " " + t + "\n\n")
            .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
            .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
            .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
            .replace(/<[^>]+>/g, "")
            .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
            .replace(/\n{3,}/g, "\n\n").trim();
    } catch { return ""; }
}

async function queryTabularCell(model: string, filename: string, documentText: string, columnPrompt: string, format?: string, tags?: string[], apiKeys?: UserApiKeys) {
    const suffix = formatPromptSuffix(format as never, tags);
    const fullPrompt = `${columnPrompt}${suffix} If not found, state "Not Found". Leave all reasoning and explanation in the "reasoning" field only.`;
    const EXTRACTION_SYSTEM = `You are a legal document analyst. Return ONLY valid JSON:\n{"summary": string, "flag": "green"|"grey"|"yellow"|"red", "reasoning": string}\n\nThe "summary" and "reasoning" field values may use markdown formatting — the values are still plain JSON strings (escape newlines as \\n), but the text inside will be rendered as markdown in the UI.\n\nThe "summary" field must contain only the extracted value with inline citations — no explanation or reasoning. Every factual claim in "summary" must be followed immediately by a citation in the format [[page:N||quote:exact quoted text]], where N is the page number and the quote is a short verbatim excerpt (≤ 25 words). All reasoning and explanation belongs in "reasoning" only.`;
    let raw: string;
    try {
        raw = await completeText({ model, systemPrompt: EXTRACTION_SYSTEM, user: `Document: ${filename}\n\n${documentText.slice(0, 120_000)}\n\n---\nInstruction: ${fullPrompt}`, maxTokens: 2048, apiKeys });
    } catch (err) {
        console.error("[queryTabularCell] completion failed", err);
        return null;
    }
    try {
        const parsed = JSON.parse(raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "").trim()) as { summary?: unknown; value?: unknown; flag?: unknown; reasoning?: unknown };
        return {
            summary: String(parsed.summary ?? parsed.value ?? "").trim() || "Not addressed",
            flag: (["green", "grey", "yellow", "red"] as const).includes(parsed.flag as "green") ? (parsed.flag as "green") : "grey",
            reasoning: String(parsed.reasoning ?? ""),
        };
    } catch {
        return raw.trim() ? { summary: raw.trim().slice(0, 500), flag: "grey" as const, reasoning: "" } : null;
    }
}

// POST /api/tabular-review/[reviewId]/regenerate-cell
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ reviewId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { reviewId } = await params;
    const { document_id, column_index } = (await request.json()) as { document_id: string; column_index: number };

    if (!document_id || column_index == null) {
        return NextResponse.json({ detail: "document_id and column_index are required" }, { status: 400 });
    }

    const db = createServerSupabase();
    const { data: review, error: reviewError } = await db.from("tabular_reviews").select("*").eq("id", reviewId).single();
    if (reviewError || !review) return NextResponse.json({ detail: "Review not found" }, { status: 404 });
    const access = await ensureReviewAccess(review, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "Review not found" }, { status: 404 });

    const column = (review.columns_config as { index: number; name: string; prompt: string; format?: string; tags?: string[] }[]).find((c) => c.index === column_index);
    if (!column) return NextResponse.json({ detail: "Column not found" }, { status: 400 });

    const docAllowed = await filterAccessibleDocumentIds([document_id], userId, userEmail, db);
    if (docAllowed.length === 0) return NextResponse.json({ detail: "Document not found" }, { status: 404 });

    const { data: doc } = await db.from("documents").select("id, filename, file_type").eq("id", document_id).single();
    if (!doc) return NextResponse.json({ detail: "Document not found" }, { status: 404 });

    const docActive = await loadActiveVersion(document_id, db);
    const { tabular_model, api_keys } = await getUserModelSettings(userId, db);
    const missingKey = missingModelApiKey(tabular_model, api_keys);
    if (missingKey) return NextResponse.json({ code: "missing_api_key", ...missingKey }, { status: 422 });

    const credit = await checkAndConsumeCredit(userId, db);
    if (!credit.ok) {
        return NextResponse.json({ detail: credit.detail, code: "credit_limit" }, { status: credit.status });
    }

    await db.from("tabular_cells").update({ status: "generating", content: null }).eq("review_id", reviewId).eq("document_id", document_id).eq("column_index", column_index);

    let markdown = "";
    if (docActive) {
        const buf = await downloadFile(docActive.storage_path);
        if (buf) {
            try {
                markdown = (doc.file_type as string) === "pdf" ? await extractPdfMarkdown(buf) : await extractDocxMarkdown(buf);
            } catch (err) { console.error(`[regenerate-cell] extraction error`, err); }
        }
    }

    const result = await queryTabularCell(tabular_model, doc.filename as string, markdown, column.prompt, column.format, column.tags, api_keys);
    if (!result) {
        await db.from("tabular_cells").update({ status: "error" }).eq("review_id", reviewId).eq("document_id", document_id).eq("column_index", column_index);
        return NextResponse.json({ detail: "Generation failed" }, { status: 500 });
    }

    await db.from("tabular_cells").update({ content: JSON.stringify(result), status: "done" }).eq("review_id", reviewId).eq("document_id", document_id).eq("column_index", column_index);
    return NextResponse.json(result);
}
