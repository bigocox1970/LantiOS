import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { ensureReviewAccess, filterAccessibleDocumentIds } from "@/lib/server/access";

function parseCellContent(raw: unknown): { summary: string; flag?: string; reasoning?: string } | null {
    if (!raw) return null;
    if (typeof raw === "object" && raw !== null && "summary" in raw) {
        const c = raw as { summary?: unknown; flag?: unknown; reasoning?: unknown };
        return {
            summary: String(c.summary ?? ""),
            flag: (["green", "grey", "yellow", "red"] as const).includes(c.flag as "green") ? (c.flag as string) : undefined,
            reasoning: typeof c.reasoning === "string" ? c.reasoning : "",
        };
    }
    if (typeof raw === "string") {
        try {
            const p = JSON.parse(raw) as { summary?: unknown; value?: unknown; flag?: unknown; reasoning?: unknown };
            return {
                summary: String(p.summary ?? p.value ?? "").trim(),
                flag: (["green", "grey", "yellow", "red"] as const).includes(p.flag as "green") ? (p.flag as string) : undefined,
                reasoning: typeof p.reasoning === "string" ? p.reasoning : "",
            };
        } catch {
            return { summary: raw, flag: "grey", reasoning: "" };
        }
    }
    return null;
}

// GET /api/tabular-review/[reviewId]
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ reviewId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { reviewId } = await params;
    const db = createServerSupabase();

    const { data: review, error } = await db.from("tabular_reviews").select("*").eq("id", reviewId).single();
    if (error || !review) return NextResponse.json({ detail: "Review not found" }, { status: 404 });
    const access = await ensureReviewAccess(review, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "Review not found" }, { status: 404 });

    const { data: cells } = await db.from("tabular_cells").select("*").eq("review_id", reviewId);
    const cellDocIds = [...new Set((cells ?? []).map((c) => c.document_id))];
    const hasExplicitDocIds = Array.isArray(review.document_ids);
    const explicitDocIds = hasExplicitDocIds ? (review.document_ids as string[]) : [];
    const docIds = hasExplicitDocIds ? explicitDocIds : cellDocIds;
    const docsResult = docIds.length > 0 ? await db.from("documents").select("*").in("id", docIds) : { data: [] as Record<string, unknown>[] };

    return NextResponse.json({
        review: { ...review, is_owner: access.isOwner },
        cells: (cells ?? []).map((cell) => ({ ...cell, content: parseCellContent(cell.content) })),
        documents: docsResult.data ?? [],
    });
}

// PATCH /api/tabular-review/[reviewId]
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ reviewId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { reviewId } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const updates: Record<string, unknown> = {};
    if (body.title != null) updates.title = body.title;
    if (body.columns_config != null) updates.columns_config = body.columns_config;
    if (body.project_id !== undefined) updates.project_id = body.project_id;

    let sharedWithUpdate: string[] | undefined;
    if (Array.isArray(body.shared_with)) {
        const normalizedUserEmail = userEmail?.trim().toLowerCase();
        const seen = new Set<string>();
        const cleaned: string[] = [];
        for (const raw of body.shared_with) {
            if (typeof raw !== "string") continue;
            const e = raw.trim().toLowerCase();
            if (!e || seen.has(e)) continue;
            if (normalizedUserEmail && e === normalizedUserEmail) {
                return NextResponse.json({ detail: "You cannot share a tabular review with yourself." }, { status: 400 });
            }
            seen.add(e);
            cleaned.push(e);
        }
        sharedWithUpdate = cleaned;
    }
    updates.updated_at = new Date().toISOString();

    const db = createServerSupabase();
    const { data: existingReview, error: reviewError } = await db.from("tabular_reviews").select("*").eq("id", reviewId).single();
    if (reviewError || !existingReview) return NextResponse.json({ detail: "Review not found" }, { status: 404 });
    const access = await ensureReviewAccess(existingReview, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "Review not found" }, { status: 404 });
    if (sharedWithUpdate !== undefined) {
        if (!access.isOwner) return NextResponse.json({ detail: "Only the review owner can change sharing" }, { status: 403 });
        updates.shared_with = sharedWithUpdate;
    }

    const { data: updatedReview, error: updateError } = await db.from("tabular_reviews").update(updates).eq("id", reviewId).select("*").single();
    if (updateError || !updatedReview) return NextResponse.json({ detail: updateError?.message ?? "Failed to update review" }, { status: 500 });

    let persistedDocumentIds: string[] | undefined;
    if (Array.isArray(body.columns_config) || Array.isArray(body.document_ids)) {
        const { data: existingCells } = await db.from("tabular_cells").select("document_id,column_index").eq("review_id", reviewId);
        const existingKeys = new Set((existingCells ?? []).map((cell) => `${cell.document_id}:${cell.column_index}`));

        let documentIds: string[];
        if (Array.isArray(body.document_ids)) {
            const requestedDocIds = body.document_ids as string[];
            const existingDocIds = (existingCells ?? []).map((cell) => cell.document_id);
            const existingDocIdSet = new Set(existingDocIds);
            const newDocCandidates = requestedDocIds.filter((id) => !existingDocIdSet.has(id));
            const newDocAllowed = await filterAccessibleDocumentIds(newDocCandidates, userId, userEmail, db);
            const newDocAllowedSet = new Set(newDocAllowed);
            const newDocIds = requestedDocIds.filter((id) => existingDocIdSet.has(id) || newDocAllowedSet.has(id));
            const removedDocIds = existingDocIds.filter((id) => !newDocIds.includes(id));

            if (removedDocIds.length > 0) {
                const { error: deleteError } = await db.from("tabular_cells").delete().eq("review_id", reviewId).in("document_id", removedDocIds);
                if (deleteError) return NextResponse.json({ detail: deleteError.message }, { status: 500 });
            }
            documentIds = newDocIds;
        } else {
            documentIds = [...new Set((existingCells ?? []).map((cell) => cell.document_id))];
        }

        if (Array.isArray(body.document_ids)) {
            persistedDocumentIds = documentIds;
            const { error: documentIdsError } = await db.from("tabular_reviews").update({ document_ids: documentIds, updated_at: new Date().toISOString() }).eq("id", reviewId);
            if (documentIdsError) return NextResponse.json({ detail: documentIdsError.message }, { status: 500 });
        }

        const activeColumns = Array.isArray(body.columns_config) ? body.columns_config : (updatedReview.columns_config ?? []);
        const newCells = documentIds.flatMap((documentId) =>
            (activeColumns as { index: number }[])
                .filter((column) => !existingKeys.has(`${documentId}:${column.index}`))
                .map((column) => ({ review_id: reviewId, document_id: documentId, column_index: column.index, status: "pending" })),
        );
        if (newCells.length > 0) {
            const { error: insertError } = await db.from("tabular_cells").insert(newCells);
            if (insertError) return NextResponse.json({ detail: insertError.message }, { status: 500 });
        }
    }

    return NextResponse.json({ ...updatedReview, ...(persistedDocumentIds ? { document_ids: persistedDocumentIds } : {}) });
}

// DELETE /api/tabular-review/[reviewId]
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ reviewId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    const { reviewId } = await params;
    const db = createServerSupabase();
    const { error } = await db.from("tabular_reviews").delete().eq("id", reviewId).eq("user_id", userId);
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
}
