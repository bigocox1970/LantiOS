import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import {
    buildProjectDocContext,
    buildMessages,
    buildWorkflowStore,
    enrichWithPriorEvents,
    extractAnnotations,
    runLLMStream,
    PROJECT_EXTRA_TOOLS,
    type ChatMessage,
} from "@/lib/server/chatTools";
import { getUserApiKeys } from "@/lib/server/userSettings";
import { checkProjectAccess } from "@/lib/server/access";

export const maxDuration = 300;

const PROJECT_SYSTEM_PROMPT_EXTRA = `PROJECT CONTEXT:
You are operating within a project folder that contains a collection of legal documents the user has organised for a single matter. The user's questions will usually refer to one or more documents in this project — your job is to find the relevant files to work on. Use list_documents to see what is available and fetch_documents / read_document to pull in any documents you need before answering.

A document may currently be displayed in the user's side panel; when provided, treat it as context for the user's likely focus, but do NOT assume it is the only or definitive document the user is asking about. If the request could apply to other files in the project, identify and read those as well. Prefer coverage across the relevant project documents over an over-narrow reading of only the displayed one.

REPLICATING A DOCUMENT:
When the user wants to use an existing project document as a starting point for a new file (e.g. "use this NDA as a template", "make me a copy of the SOW so I can edit it", "duplicate this and adapt it for company X"), call the replicate_document tool with the source doc_id. This creates a byte-for-byte copy as a new project document, returns a fresh doc_id slug, and shows a download/open card in the UI. Then call edit_document on the returned slug to make the user's requested changes — do NOT call generate_docx for cases where the user clearly wants the existing document's structure and formatting preserved.`;

// POST /api/projects/[projectId]/chat — streaming
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { projectId } = await params;

    const { messages, chat_id, model, displayed_doc, attached_documents } = (await request.json()) as {
        messages: ChatMessage[];
        chat_id?: string;
        model?: string;
        displayed_doc?: { filename: string; document_id: string };
        attached_documents?: { filename: string; document_id: string }[];
    };

    const db = createServerSupabase();
    const projectAccess = await checkProjectAccess(projectId, userId, userEmail, db);
    if (!projectAccess.ok) return NextResponse.json({ detail: "Project not found" }, { status: 404 });

    let chatId = chat_id ?? null;
    let chatTitle: string | null = null;

    if (chatId) {
        const { data: existing } = await db
            .from("chats")
            .select("id, title, project_id")
            .eq("id", chatId)
            .single();
        const canUse = !!existing && existing.project_id === projectId;
        if (!canUse) chatId = null;
        else chatTitle = existing!.title;
    }

    if (!chatId) {
        const { data: newChat, error } = await db
            .from("chats")
            .insert({ user_id: userId, project_id: projectId })
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

    const { docIndex, docStore, folderPaths } = await buildProjectDocContext(projectId, userId, db);
    const docAvailability = Object.entries(docIndex).map(([doc_id, info]) => ({
        doc_id,
        filename: info.filename,
        folder_path: folderPaths.get(doc_id),
    }));

    const enrichedMessages = await enrichWithPriorEvents(messages, chatId, db, docIndex);
    const messagesForLLM: ChatMessage[] = displayed_doc
        ? enrichedMessages.map((m, i) => {
              if (i !== enrichedMessages.length - 1 || m.role !== "user") return m;
              return { ...m, content: `${m.content}\n\ndisplayed_doc: ${displayed_doc.filename}, displayed_doc_id: ${displayed_doc.document_id}` };
          })
        : enrichedMessages;

    let systemPromptExtra = PROJECT_SYSTEM_PROMPT_EXTRA;
    if (attached_documents?.length) {
        const slugByDocumentId = new Map<string, string>();
        for (const [slug, info] of Object.entries(docIndex)) {
            if (info.document_id) slugByDocumentId.set(info.document_id, slug);
        }
        const lines = attached_documents.map((d) => {
            const slug = slugByDocumentId.get(d.document_id);
            return slug ? `- ${slug}: ${d.filename}` : `- ${d.filename}`;
        });
        systemPromptExtra += `\n\nUSER-ATTACHED DOCUMENTS FOR THIS TURN:\nThe user has attached the following document(s) directly to their latest message. Treat these as the primary focus of the request unless their message clearly says otherwise.\n${lines.join("\n")}`;
    }

    const { data: profileRow } = await db.from("user_profiles").select("assistant_name").eq("user_id", userId).maybeSingle();
    const apiMessages = buildMessages(messagesForLLM, docAvailability, profileRow?.assistant_name, systemPromptExtra);
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
                    extraTools: PROJECT_EXTRA_TOOLS,
                    workflowStore,
                    model,
                    apiKeys,
                    projectId,
                });

                const annotations = extractAnnotations(fullText, docIndex, events);
                await db.from("chat_messages").insert({
                    chat_id: capturedChatId,
                    role: "assistant",
                    content: events.length ? events : null,
                    annotations: annotations.length ? annotations : null,
                });

                if (!capturedChatTitle && lastUser?.content) {
                    await db.from("chats").update({ title: lastUser.content.slice(0, 120) }).eq("id", capturedChatId);
                }
            } catch (err) {
                console.error("[project-chat/stream] error:", err);
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
