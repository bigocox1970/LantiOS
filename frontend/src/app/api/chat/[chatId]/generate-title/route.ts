import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { completeText } from "@/lib/server/llm";
import { getUserModelSettings } from "@/lib/server/userSettings";
import { checkProjectAccess } from "@/lib/server/access";

// POST /api/chat/[chatId]/generate-title
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ chatId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { chatId } = await params;

    const body = (await request.json()) as { message?: unknown };
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return NextResponse.json({ detail: "message is required" }, { status: 400 });

    const db = createServerSupabase();
    const { data: chat, error } = await db.from("chats").select("*").eq("id", chatId).maybeSingle();
    if (error || !chat) return NextResponse.json({ detail: "Chat not found" }, { status: 404 });

    const row = chat as { user_id: string; project_id: string | null };
    let hasAccess = row.user_id === userId;
    if (!hasAccess && row.project_id) {
        const access = await checkProjectAccess(row.project_id, userId, userEmail, db);
        if (access.ok) hasAccess = true;
    }
    if (!hasAccess) return NextResponse.json({ detail: "Chat not found" }, { status: 404 });

    try {
        const { title_model, api_keys } = await getUserModelSettings(userId, db);
        const titleText = await completeText({
            model: title_model,
            user: `Generate a concise title (3–6 words) for a chat in an AI Legal Platform that starts with this message. The title should describe the topic or document — do NOT include words like "Legal Assistant", "AI", "Chat", or any similar prefix. Return only the title, no quotes or punctuation.\n\nMessage: ${message.slice(0, 500)}`,
            maxTokens: 64,
            apiKeys: api_keys,
        });
        const title = titleText.trim() || message.slice(0, 60);
        await db.from("chats").update({ title }).eq("id", chatId);
        return NextResponse.json({ title });
    } catch (err) {
        console.error("[generate-title]", err);
        return NextResponse.json({ detail: "Failed to generate title" }, { status: 500 });
    }
}
