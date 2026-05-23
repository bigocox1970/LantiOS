import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { ensureReviewAccess } from "@/lib/server/access";

// POST /api/tabular-review/[reviewId]/clear-cells
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ reviewId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { reviewId } = await params;
    const { document_ids } = (await request.json()) as { document_ids?: string[] };

    if (!Array.isArray(document_ids) || document_ids.length === 0) {
        return NextResponse.json({ detail: "document_ids is required" }, { status: 400 });
    }

    const db = createServerSupabase();
    const { data: review, error: reviewError } = await db.from("tabular_reviews").select("id, user_id, project_id").eq("id", reviewId).single();
    if (reviewError || !review) return NextResponse.json({ detail: "Review not found" }, { status: 404 });
    const access = await ensureReviewAccess(review, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "Review not found" }, { status: 404 });

    const { error } = await db
        .from("tabular_cells")
        .update({ content: null, status: "pending" })
        .eq("review_id", reviewId)
        .in("document_id", document_ids);
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
}
