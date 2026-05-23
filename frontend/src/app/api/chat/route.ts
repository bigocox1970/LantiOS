import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import {
    buildDocContext,
    buildMessages,
    enrichWithPriorEvents,
    buildWorkflowStore,
    extractAnnotations,
    runLLMStream,
    type ChatMessage,
} from "@/lib/server/chatTools";
import { getUserApiKeys } from "@/lib/server/userSettings";
import { checkProjectAccess } from "@/lib/server/access";

export const maxDuration = 300;

// GET /api/chat — list chats
export async function GET(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    const db = createServerSupabase();

    const { searchParams } = new URL(request.url);
    const requestedLimit = parseInt(searchParams.get("limit") ?? "", 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : null;

    const { data: ownProjects, error: projErr } = await db.from("projects").select("id").eq("user_id", userId);
    if (projErr) return NextResponse.json({ detail: projErr.message }, { status: 500 });
    const ownProjectIds = ((ownProjects ?? []) as { id: string }[]).map((p) => p.id);

    const filter =
        ownProjectIds.length > 0
            ? `user_id.eq.${userId},project_id.in.(${ownProjectIds.join(",")})`
            : `user_id.eq.${userId}`;

    let query = db.from("chats").select("*").or(filter).order("created_at", { ascending: false });
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
}

// POST /api/chat — streaming
export async function POST(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;

    const body = (await request.json()) as Record<string, unknown>;

    // Parse messages
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
        return NextResponse.json({ detail: "messages must be a non-empty array" }, { status: 400 });
    }
    const messages = body.messages as ChatMessage[];

    // Parse chat_id
    let chat_id: string | null = null;
    if (body.chat_id !== undefined && body.chat_id !== null) {
        if (typeof body.chat_id !== "string" || !body.chat_id.trim()) {
            return NextResponse.json({ detail: "chat_id must be a non-empty string" }, { status: 400 });
        }
        chat_id = body.chat_id.trim();
    }

    // Parse project_id
    let projectIdProvided = false;
    let projectId: string | null = null;
    if (body.project_id !== undefined) {
        projectIdProvided = true;
        if (body.project_id === null) {
            projectId = null;
        } else if (typeof body.project_id === "string" && body.project_id.trim()) {
            projectId = body.project_id.trim();
        } else {
            return NextResponse.json({ detail: "project_id must be a non-empty string or null" }, { status: 400 });
        }
    }

    // Parse model
    let model: string | undefined;
    if (body.model !== undefined) {
        if (typeof body.model !== "string" || !body.model.trim()) {
            return NextResponse.json({ detail: "model must be a non-empty string" }, { status: 400 });
        }
        model = body.model.trim();
    }

    const db = createServerSupabase();
    let chatId = chat_id;
    let chatTitle: string | null = null;
    let resolvedProjectId: string | null = projectId;

    if (chatId) {
        const { data: existing } = await db.from("chats").select("*").eq("id", chatId).maybeSingle();
        if (!existing) return NextResponse.json({ detail: "Chat not found" }, { status: 404 });

        const row = existing as { user_id: string; project_id: string | null; title: string | null };
        let hasAccess = row.user_id === userId;
        if (!hasAccess && row.project_id) {
            const access = await checkProjectAccess(row.project_id, userId, userEmail, db);
            if (access.ok) hasAccess = true;
        }
        if (!hasAccess) return NextResponse.json({ detail: "Chat not found" }, { status: 404 });

        const existingProjectId = row.project_id ?? null;
        if (projectIdProvided && projectId !== existingProjectId) {
            return NextResponse.json({ detail: "project_id does not match chat" }, { status: 400 });
        }
        resolvedProjectId = existingProjectId;
        chatTitle = row.title;
    }

    if (!chatId) {
        if (resolvedProjectId) {
            const access = await checkProjectAccess(resolvedProjectId, userId, userEmail, db);
            if (!access.ok) return NextResponse.json({ detail: "Project not found" }, { status: 404 });
        }
        const { data: newChat, error } = await db
            .from("chats")
            .insert({ user_id: userId, project_id: resolvedProjectId })
            .select("id, title")
            .single();
        if (error || !newChat) return NextResponse.json({ detail: "Failed to create chat" }, { status: 500 });
        chatId = newChat.id as string;
        chatTitle = newChat.title;
    }

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
        await db.from("chat_messages").insert({
            chat_id: chatId,
            role: "user",
            content: lastUser.content,
            files: lastUser.files ?? null,
            workflow: lastUser.workflow ?? null,
        });
    }

    const { docIndex, docStore } = await buildDocContext(messages, userId, db, chatId);
    const docAvailability = Object.entries(docIndex).map(([doc_id, info]) => ({ doc_id, filename: info.filename }));
    const enrichedMessages = await enrichWithPriorEvents(messages, chatId, db, docIndex);
    const { data: profileRow } = await db.from("user_profiles").select("assistant_name").eq("user_id", userId).maybeSingle();
    const apiMessages = buildMessages(enrichedMessages, docAvailability, profileRow?.assistant_name);
    const workflowStore = await buildWorkflowStore(userId, userEmail, db);
    const apiKeys = await getUserApiKeys(userId, db);

    const capturedChatId = chatId;
    const capturedChatTitle = chatTitle;
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const write = (line: string) => controller.enqueue(encoder.encode(line));
            try {
                write(`data: ${JSON.stringify({ type: "chat_id", chatId: capturedChatId })}\n\n`);

                const { fullText, events } = await runLLMStream({
                    apiMessages,
                    docStore,
                    docIndex,
                    userId,
                    db,
                    write,
                    workflowStore,
                    model,
                    apiKeys,
                    projectId: resolvedProjectId,
                });

                const annotations = extractAnnotations(fullText, docIndex, events);
                await db.from("chat_messages").insert({
                    chat_id: capturedChatId,
                    role: "assistant",
                    content: events.length ? events : null,
                    annotations: annotations.length ? annotations : null,
                });

                if (!capturedChatTitle && lastUser?.content) {
                    await db
                        .from("chats")
                        .update({ title: lastUser.content.slice(0, 120) })
                        .eq("id", capturedChatId);
                }
            } catch (err) {
                console.error("[chat/stream] error:", err);
                try {
                    write(`data: ${JSON.stringify({ type: "error", message: "Stream error" })}\n\n`);
                    write("data: [DONE]\n\n");
                } catch { /* ignore */ }
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}
