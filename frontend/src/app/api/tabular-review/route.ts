import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { checkProjectAccess, filterAccessibleDocumentIds, listAccessibleProjectIds } from "@/lib/server/access";

// GET /api/tabular-review
export async function GET(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const db = createServerSupabase();

    const { searchParams } = new URL(request.url);
    const projectIdFilter = searchParams.get("project_id") || null;

    const projectIds = await listAccessibleProjectIds(userId, userEmail, db);
    if (projectIdFilter && !projectIds.includes(projectIdFilter)) return NextResponse.json([]);

    let ownQuery = db.from("tabular_reviews").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (projectIdFilter) ownQuery = ownQuery.eq("project_id", projectIdFilter);

    const sharedProjectIds = projectIdFilter ? [projectIdFilter] : projectIds;
    const [{ data: own, error: ownErr }, { data: shared, error: sharedErr }, { data: sharedDirect, error: sharedDirectErr }] =
        await Promise.all([
            ownQuery,
            sharedProjectIds.length > 0
                ? db.from("tabular_reviews").select("*").in("project_id", sharedProjectIds).neq("user_id", userId).order("created_at", { ascending: false })
                : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
            userEmail && !projectIdFilter
                ? db.from("tabular_reviews").select("*").filter("shared_with", "cs", JSON.stringify([userEmail])).neq("user_id", userId).order("created_at", { ascending: false })
                : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
        ]);
    if (ownErr) return NextResponse.json({ detail: ownErr.message }, { status: 500 });
    if (sharedErr) console.warn("[tabular] shared-by-project query failed:", sharedErr.message);
    if (sharedDirectErr) console.warn("[tabular] shared-by-email query failed:", sharedDirectErr.message);

    const seen = new Set<string>();
    const reviews: Record<string, unknown>[] = [];
    for (const r of [...(own ?? []), ...(shared ?? []), ...(sharedDirect ?? [])]) {
        const id = (r as { id: string }).id;
        if (seen.has(id)) continue;
        seen.add(id);
        reviews.push(r as Record<string, unknown>);
    }

    const reviewIds = reviews.map((r) => (r as { id: string }).id);
    const docCounts: Record<string, number> = {};
    const reviewsWithExplicitDocs = new Set<string>();
    for (const review of reviews) {
        const id = (review as { id: string }).id;
        if (Array.isArray(review.document_ids)) {
            reviewsWithExplicitDocs.add(id);
            docCounts[id] = new Set(review.document_ids).size;
        }
    }
    if (reviewIds.length > 0) {
        const { data: cells } = await db.from("tabular_cells").select("review_id, document_id").in("review_id", reviewIds);
        if (cells) {
            const seen2 = new Set<string>();
            for (const cell of cells) {
                const key = `${cell.review_id}:${cell.document_id}`;
                if (!seen2.has(key)) {
                    seen2.add(key);
                    if (!reviewsWithExplicitDocs.has(cell.review_id)) {
                        docCounts[cell.review_id] = (docCounts[cell.review_id] ?? 0) + 1;
                    }
                }
            }
        }
    }

    return NextResponse.json(reviews.map((r) => ({ ...r, document_count: docCounts[(r as { id: string }).id] ?? 0 })));
}

// POST /api/tabular-review
export async function POST(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;

    const { title, document_ids, columns_config, workflow_id, project_id } = (await request.json()) as {
        title?: string;
        document_ids: string[];
        columns_config: { index: number; name: string; prompt: string }[];
        workflow_id?: string;
        project_id?: string;
    };

    const db = createServerSupabase();
    if (project_id) {
        const access = await checkProjectAccess(project_id, userId, userEmail, db);
        if (!access.ok) return NextResponse.json({ detail: "Project not found" }, { status: 404 });
    }

    const allowedDocumentIds = Array.isArray(document_ids)
        ? await filterAccessibleDocumentIds(document_ids, userId, userEmail, db)
        : [];

    const { data: review, error } = await db
        .from("tabular_reviews")
        .insert({
            user_id: userId,
            title: title ?? null,
            columns_config,
            document_ids: allowedDocumentIds,
            project_id: project_id ?? null,
            workflow_id: workflow_id ?? null,
        })
        .select("*")
        .single();
    if (error || !review) return NextResponse.json({ detail: error?.message ?? "Failed to create review" }, { status: 500 });

    const cells = allowedDocumentIds.flatMap((docId) =>
        columns_config.map((col) => ({ review_id: review.id, document_id: docId, column_index: col.index, status: "pending" })),
    );
    if (cells.length) await db.from("tabular_cells").insert(cells);

    return NextResponse.json(review, { status: 201 });
}
