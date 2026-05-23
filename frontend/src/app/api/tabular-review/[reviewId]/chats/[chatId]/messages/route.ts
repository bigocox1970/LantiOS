import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { ensureReviewAccess } from "@/lib/server/access";

// GET /api/tabular-review/[reviewId]/chats/[chatId]/messages
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ reviewId: string; chatId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { reviewId, chatId } = await params;
    const db = createServerSupabase();

    const { data: review } = await db.from("tabular_reviews").select("id, user_id, project_id").eq("id", reviewId).single();
    if (!review) return NextResponse.json({ detail: "Review not found" }, { status: 404 });
    const access = await ensureReviewAccess(review, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "Review not found" }, { status: 404 });

    const { data: chat, error: chatError } = await db.from("tabular_review_chats").select("id, review_id").eq("id", chatId).single();
    if (chatError || !chat || chat.review_id !== reviewId) return NextResponse.json({ detail: "Chat not found" }, { status: 404 });

    const { data: messages } = await db
        .from("tabular_review_chat_messages")
        .select("id, role, content, annotations, created_at")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

    return NextResponse.json(messages ?? []);
}
