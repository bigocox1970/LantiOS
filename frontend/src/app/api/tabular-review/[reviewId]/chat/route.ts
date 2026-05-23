import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { runLLMStream, TABULAR_TOOLS, type ChatMessage, type TabularCellStore } from "@/lib/server/chatTools";
import { completeText, providerForModel, type UserApiKeys } from "@/lib/server/llm";
import { ensureReviewAccess } from "@/lib/server/access";
import { getUserModelSettings } from "@/lib/server/userSettings";

export const maxDuration = 300;

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

function parseCellContent(raw: unknown): { summary: string; flag?: string; reasoning?: string } | null {
    if (!raw) return null;
    if (typeof raw === "object" && raw !== null && "summary" in raw) {
        const c = raw as { summary?: unknown; flag?: unknown; reasoning?: unknown };
        return { summary: String(c.summary ?? ""), flag: (["green", "grey", "yellow", "red"] as const).includes(c.flag as "green") ? (c.flag as string) : undefined, reasoning: typeof c.reasoning === "string" ? c.reasoning : "" };
    }
    if (typeof raw === "string") {
        try {
            const p = JSON.parse(raw) as { summary?: unknown; value?: unknown; flag?: unknown; reasoning?: unknown };
            return { summary: String(p.summary ?? p.value ?? "").trim(), flag: (["green", "grey", "yellow", "red"] as const).includes(p.flag as "green") ? (p.flag as string) : undefined, reasoning: typeof p.reasoning === "string" ? p.reasoning : "" };
        } catch { return { summary: raw, flag: "grey", reasoning: "" }; }
    }
    return null;
}

const TABULAR_CITATIONS_BLOCK_RE = /<CITATIONS>\s*([\s\S]*?)\s*<\/CITATIONS>/;
function parseTabularCitations(text: string) {
    const match = text.match(TABULAR_CITATIONS_BLOCK_RE);
    if (!match) return [];
    try { return JSON.parse(match[1]) as { ref: number; col_index: number; row_index: number; quote: string }[]; } catch { return []; }
}
function extractTabularAnnotations(fullText: string, tabularStore: TabularCellStore) {
    return parseTabularCitations(fullText).map((c) => ({
        type: "tabular_citation" as const,
        ref: c.ref,
        col_index: c.col_index,
        row_index: c.row_index,
        col_name: tabularStore.columns[c.col_index]?.name ?? `Col ${c.col_index}`,
        doc_name: tabularStore.documents[c.row_index]?.filename ?? `Row ${c.row_index}`,
        quote: c.quote,
    }));
}

function buildTabularMessages(messages: ChatMessage[], tabularStore: TabularCellStore, reviewTitle: string, assistantName?: string | null): unknown[] {
    const docList = tabularStore.documents.map((d, i) => `- ROW:${i} "${d.filename}"`).join("\n");
    const colList = tabularStore.columns.map((c, i) => `- COL:${i} "${c.name}"`).join("\n");
    const identity = assistantName?.trim() ? `You are ${assistantName.trim()}, an AI legal assistant` : `You are an AI legal assistant built into Lanti-OS`;
    const systemContent = `${identity}. You are helping with the tabular review titled "${reviewTitle}".\n\nThe review extracts specific fields from multiple legal documents into a structured table.\nYou do NOT have the cell content yet — call read_table_cells to fetch the cells you need before answering.\n\nDOCUMENTS (rows):\n${docList || "- (none)"}\n\nCOLUMNS (fields):\n${colList || "- (none)"}\n\nTABULAR CITATION INSTRUCTIONS:\nWhen you reference specific cell content, place a numbered marker [1], [2], etc. inline in your prose at the point of reference.\n\nAfter your complete response, append a <CITATIONS> block containing a JSON array with one entry per marker:\n\n<CITATIONS>\n[\n  {"ref": 1, "col_index": 0, "row_index": 2, "quote": "verbatim text from the cell"},\n  {"ref": 2, "col_index": 1, "row_index": 0, "quote": "another excerpt"}\n]\n</CITATIONS>\n\nRules:\n- col_index and row_index are 0-based\n- Only cite cells you have read via read_table_cells\n- quote should be verbatim text from the cell's summary\n- Omit <CITATIONS> if you make no citations\n- Do not fabricate cell content\n- Answer in clear, concise prose. You may use markdown formatting.`;
    const formatted: unknown[] = [{ role: "system", content: systemContent }];
    for (const msg of messages) formatted.push({ role: msg.role, content: msg.content ?? "" });
    return formatted;
}

// POST /api/tabular-review/[reviewId]/chat
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ reviewId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { reviewId } = await params;

    const { messages, chat_id: existingChatId, review_title: clientReviewTitle, project_name: clientProjectName } = (await request.json()) as {
        messages: ChatMessage[];
        chat_id?: string;
        review_title?: string;
        project_name?: string;
    };

    const lastUser = [...(messages ?? [])].reverse().find((m) => m.role === "user");
    if (!lastUser?.content?.trim()) {
        return NextResponse.json({ detail: "messages must include a user message" }, { status: 400 });
    }

    const db = createServerSupabase();
    const { data: review, error } = await db.from("tabular_reviews").select("*").eq("id", reviewId).single();
    if (error || !review) return NextResponse.json({ detail: "Review not found" }, { status: 404 });
    const reviewAccess = await ensureReviewAccess(review, userId, userEmail, db);
    if (!reviewAccess.ok) return NextResponse.json({ detail: "Review not found" }, { status: 404 });

    const { data: cells } = await db.from("tabular_cells").select("*").eq("review_id", reviewId);
    const docIds = [...new Set((cells ?? []).map((c: { document_id: string }) => c.document_id))];
    let docs: { id: string; filename: string }[] = [];
    if (docIds.length > 0) {
        const { data } = await db.from("documents").select("id, filename").in("id", docIds).order("created_at", { ascending: true });
        docs = (data ?? []) as { id: string; filename: string }[];
    }

    const sortedColumns = ((review.columns_config ?? []) as { index: number; name: string }[]).sort((a, b) => a.index - b.index);
    const tabularStore: TabularCellStore = {
        columns: sortedColumns,
        documents: docs,
        cells: new Map((cells ?? []).map((c: { column_index: number; document_id: string; content: unknown }) => [`${c.column_index}:${c.document_id}`, parseCellContent(c.content)])),
    };

    const { tabular_model, api_keys } = await getUserModelSettings(userId, db);
    const missingKey = missingModelApiKey(tabular_model, api_keys);
    if (missingKey) return NextResponse.json({ code: "missing_api_key", ...missingKey }, { status: 422 });

    let chatId = existingChatId ?? null;
    let chatTitle: string | null = null;
    const isFirstExchange = messages.filter((m) => m.role === "user").length === 1;

    if (chatId) {
        const { data: existing } = await db.from("tabular_review_chats").select("id, title, review_id, user_id").eq("id", chatId).single();
        const canUse = !!existing && (existing.review_id === reviewId || existing.user_id === userId);
        if (!canUse || !existing) chatId = null;
        else chatTitle = existing.title;
    }

    if (!chatId) {
        const { data: newChat } = await db.from("tabular_review_chats").insert({ review_id: reviewId, user_id: userId }).select("id, title").single();
        chatId = newChat?.id ?? null;
        chatTitle = newChat?.title ?? null;
    }

    if (chatId) {
        await db.from("tabular_review_chat_messages").insert({ chat_id: chatId, role: "user", content: lastUser.content });
    }

    const { data: profileRow } = await db.from("user_profiles").select("assistant_name").eq("user_id", userId).maybeSingle();
    const apiMessages = buildTabularMessages(messages, tabularStore, review.title || "Untitled Review", profileRow?.assistant_name);
    const capturedChatId = chatId;
    const capturedChatTitle = chatTitle;
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const write = (line: string) => controller.enqueue(encoder.encode(line));
            if (capturedChatId) write(`data: ${JSON.stringify({ type: "chat_id", chatId: capturedChatId })}\n\n`);
            try {
                const { fullText, events } = await runLLMStream({
                    apiMessages,
                    docStore: new Map(),
                    docIndex: {},
                    userId,
                    db,
                    write,
                    extraTools: TABULAR_TOOLS,
                    tabularStore,
                    buildCitations: (text) => extractTabularAnnotations(text, tabularStore),
                    model: tabular_model,
                    apiKeys: api_keys,
                });

                const annotations = extractTabularAnnotations(fullText, tabularStore);
                if (capturedChatId) {
                    await db.from("tabular_review_chat_messages").insert({ chat_id: capturedChatId, role: "assistant", content: events.length ? events : null, annotations: annotations.length ? annotations : null });
                    await db.from("tabular_review_chats").update({ updated_at: new Date().toISOString() }).eq("id", capturedChatId);
                }

                if (capturedChatId && isFirstExchange && !capturedChatTitle && lastUser.content) {
                    const { title_model } = await getUserModelSettings(userId, db);
                    const contextLines: string[] = [];
                    if (clientProjectName) contextLines.push(`Project: ${clientProjectName}`);
                    if (clientReviewTitle ?? review.title) contextLines.push(`Tabular review: ${clientReviewTitle ?? review.title}`);
                    const contextBlock = contextLines.length ? `This chat is in the context of a tabular review.\n${contextLines.join("\n")}\n\n` : "";
                    try {
                        const rawTitle = await completeText({ model: title_model, user: `${contextBlock}Generate a short title (4-6 words) for a chat that starts with the message below. Return only the title, no punctuation, no quotes:\n\n${lastUser.content}`, maxTokens: 64, apiKeys: api_keys });
                        const title = rawTitle.trim().slice(0, 80) || null;
                        if (title) {
                            await db.from("tabular_review_chats").update({ title }).eq("id", capturedChatId);
                            write(`data: ${JSON.stringify({ type: "chat_title", chatId: capturedChatId, title })}\n\n`);
                        }
                    } catch { /* ignore title generation failure */ }
                }
            } catch (err) {
                console.error("[tabular/chat] error", err);
                try {
                    write(`data: ${JSON.stringify({ type: "error", message: String(err) })}\n\n`);
                    write("data: [DONE]\n\n");
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
