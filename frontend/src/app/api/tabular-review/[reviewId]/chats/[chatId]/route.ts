import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";

// DELETE /api/tabular-review/[reviewId]/chats/[chatId]
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ reviewId: string; chatId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    const { chatId } = await params;
    const db = createServerSupabase();
    const { error } = await db.from("tabular_review_chats").delete().eq("id", chatId).eq("user_id", userId);
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
}
