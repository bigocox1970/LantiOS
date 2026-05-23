import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { downloadFile } from "@/lib/server/storage";
import { loadActiveVersion } from "@/lib/server/documentVersions";
import { normalizeDocxZipPaths } from "@/lib/server/convert";
import { ensureReviewAccess, filterAccessibleDocumentIds } from "@/lib/server/access";
import { getUserModelSettings } from "@/lib/server/userSettings";
import { providerForModel, streamChatWithTools, completeText, type UserApiKeys } from "@/lib/server/llm";

export const maxDuration = 300;

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

type CellResult = { summary: string; flag: "green" | "grey" | "yellow" | "red"; reasoning: string };
type Column = { index: number; name: string; prompt: string; format?: string; tags?: string[] };

async function queryTabularAllColumns(model: string, filename: string, documentText: string, columns: Column[], onResult: (columnIndex: number, result: CellResult) => Promise<void>, apiKeys?: UserApiKeys): Promise<void> {
    const columnsDesc = columns.map((col) => {
        const suffix = formatPromptSuffix(col.format as never, col.tags);
        return `Column ${col.index} — "${col.name}": ${col.prompt}${suffix} If not found, state "Not Found".`;
    }).join("\n");

    const SYSTEM = `You are a legal document analyst. Extract information for each column listed below.\n\nFor each column, output exactly one minified JSON object on its own line (no line breaks inside the JSON), then a newline. Process columns in order and output each result as soon as you finish it.\n\nLine format:\n{"column_index": <N>, "summary": <string>, "flag": <"green"|"grey"|"yellow"|"red">, "reasoning": <string>}\n\nRules:\n- "summary": the extracted value with inline citations [[page:N||quote:verbatim excerpt ≤25 words]] after every factual claim. No explanation or reasoning here.\n- "flag": green = standard/favorable, yellow = needs attention, red = problematic/unfavorable, grey = neutral/not found\n- "reasoning": brief explanation of the extraction\n- Output ONLY the JSON lines themselves. Do NOT wrap the response in markdown code fences, and do not add any preamble or summary.`;
    const USER = `Document: ${filename}\n\n${documentText.slice(0, 120_000)}\n\n---\nColumns to extract:\n${columnsDesc}`;

    let contentBuffer = "";
    const pending: Promise<unknown>[] = [];
    const processLine = async (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        try {
            const parsed = JSON.parse(trimmed) as { column_index?: unknown; summary?: unknown; flag?: unknown; reasoning?: unknown };
            if (typeof parsed.column_index !== "number") return;
            const col = columns.find((c) => c.index === parsed.column_index);
            if (!col) return;
            await onResult(parsed.column_index, {
                summary: String(parsed.summary ?? "").trim() || "Not addressed",
                flag: (["green", "grey", "yellow", "red"] as const).includes(parsed.flag as "green") ? (parsed.flag as CellResult["flag"]) : "grey",
                reasoning: String(parsed.reasoning ?? ""),
            });
        } catch { /* malformed line */ }
    };

    try {
        await streamChatWithTools({ model, systemPrompt: SYSTEM, messages: [{ role: "user", content: USER }], tools: [], apiKeys, callbacks: {
            onContentDelta: (delta) => {
                contentBuffer += delta;
                let newlineIdx: number;
                while ((newlineIdx = contentBuffer.indexOf("\n")) !== -1) {
                    const completedLine = contentBuffer.slice(0, newlineIdx);
                    contentBuffer = contentBuffer.slice(newlineIdx + 1);
                    pending.push(processLine(completedLine));
                }
            },
        } });
    } catch (err) { console.error("[queryTabularAllColumns] stream failed", err); }

    if (contentBuffer.trim()) pending.push(processLine(contentBuffer));
    await Promise.all(pending);
}

// POST /api/tabular-review/[reviewId]/generate
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ reviewId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { reviewId } = await params;
    const db = createServerSupabase();

    const { data: review, error: reviewError } = await db.from("tabular_reviews").select("*").eq("id", reviewId).single();
    if (reviewError || !review) return NextResponse.json({ detail: "Review not found" }, { status: 404 });
    const access = await ensureReviewAccess(review, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "Review not found" }, { status: 404 });

    const columns: Column[] = review.columns_config ?? [];
    if (columns.length === 0) return NextResponse.json({ detail: "No columns configured" }, { status: 400 });

    const { data: cells } = await db.from("tabular_cells").select("*").eq("review_id", reviewId);
    const cellMap = new Map<string, Record<string, unknown>>();
    for (const cell of cells ?? []) cellMap.set(`${cell.document_id}:${cell.column_index}`, cell);

    const docIds = [...new Set((cells ?? []).map((c) => c.document_id))];
    const allowedDocIds = new Set(await filterAccessibleDocumentIds(docIds, userId, userEmail, db));
    let docs: Record<string, unknown>[] = [];
    if (docIds.length > 0) {
        const filteredIds = docIds.filter((id) => allowedDocIds.has(id));
        const { data } = filteredIds.length > 0 ? await db.from("documents").select("id, filename, file_type, page_count").in("id", filteredIds) : { data: [] as Record<string, unknown>[] };
        docs = data ?? [];
    } else if (review.project_id) {
        const { data } = await db.from("documents").select("id, filename, file_type, page_count").eq("project_id", review.project_id).order("created_at", { ascending: true });
        docs = data ?? [];
    }

    const { tabular_model, api_keys } = await getUserModelSettings(userId, db);
    const missingKey = missingModelApiKey(tabular_model, api_keys);
    if (missingKey) return NextResponse.json({ code: "missing_api_key", ...missingKey }, { status: 422 });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const write = (line: string) => controller.enqueue(encoder.encode(line));
            try {
                await Promise.all(
                    docs.map(async (doc) => {
                        const docId = doc.id as string;
                        const filename = doc.filename as string;
                        let markdown = "";
                        const active = await loadActiveVersion(docId, db);
                        if (active) {
                            const buf = await downloadFile(active.storage_path);
                            if (buf) {
                                try {
                                    markdown = (doc.file_type as string) === "pdf" ? await extractPdfMarkdown(buf) : await extractDocxMarkdown(buf);
                                } catch (err) { console.error(`[tabular/generate] extraction error doc=${docId}`, err); }
                            }
                        }

                        const columnsToProcess = columns.filter((col) => {
                            const cell = cellMap.get(`${docId}:${col.index}`);
                            return !(cell?.status === "done" && cell?.content);
                        });
                        if (columnsToProcess.length === 0) return;

                        for (const col of columnsToProcess) {
                            write(`data: ${JSON.stringify({ type: "cell_update", document_id: docId, column_index: col.index, content: null, status: "generating" })}\n\n`);
                            const existingCell = cellMap.get(`${docId}:${col.index}`);
                            if (existingCell) {
                                await db.from("tabular_cells").update({ status: "generating", content: null }).eq("id", existingCell.id);
                            } else {
                                await db.from("tabular_cells").insert({ review_id: reviewId, document_id: docId, column_index: col.index, status: "generating" });
                            }
                        }

                        const receivedColumns = new Set<number>();
                        try {
                            await queryTabularAllColumns(tabular_model, filename, markdown, columnsToProcess, async (columnIndex, result) => {
                                receivedColumns.add(columnIndex);
                                await db.from("tabular_cells").update({ content: JSON.stringify(result), status: "done" }).eq("review_id", reviewId).eq("document_id", docId).eq("column_index", columnIndex);
                                write(`data: ${JSON.stringify({ type: "cell_update", document_id: docId, column_index: columnIndex, content: result, status: "done" })}\n\n`);
                            }, api_keys);
                        } catch (err) { console.error(`[tabular/generate] queryTabularAllColumns error doc=${docId}`, err); }

                        for (const col of columnsToProcess) {
                            if (!receivedColumns.has(col.index)) {
                                await db.from("tabular_cells").update({ status: "error" }).eq("review_id", reviewId).eq("document_id", docId).eq("column_index", col.index);
                                write(`data: ${JSON.stringify({ type: "cell_update", document_id: docId, column_index: col.index, content: null, status: "error" })}\n\n`);
                            }
                        }
                    }),
                );
                write("data: [DONE]\n\n");
            } catch (err) {
                console.error("[tabular/generate] stream error", err);
                try {
                    write(`data: ${JSON.stringify({ type: "error", message: String(err) })}\n\ndata: [DONE]\n\n`);
                } catch { /* ignore */ }
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });
}
