import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { ensureDocAccess } from "@/lib/server/access";

// PATCH /api/single-documents/[documentId]/versions/[versionId] — rename version
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ documentId: string; versionId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { documentId, versionId } = await params;
    const db = createServerSupabase();

    const { data: doc } = await db
        .from("documents")
        .select("id, user_id, project_id")
        .eq("id", documentId)
        .single();
    if (!doc) return NextResponse.json({ detail: "Document not found" }, { status: 404 });
    const access = await ensureDocAccess(doc, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "Document not found" }, { status: 404 });

    const body = (await request.json()) as { display_name?: unknown };
    const displayName =
        typeof body?.display_name === "string" && body.display_name.trim()
            ? body.display_name.trim().slice(0, 200)
            : null;

    const { data: updated, error } = await db
        .from("document_versions")
        .update({ display_name: displayName })
        .eq("id", versionId)
        .eq("document_id", documentId)
        .select("id, version_number, source, created_at, display_name")
        .single();
    if (error || !updated) return NextResponse.json({ detail: "Version not found" }, { status: 404 });
    return NextResponse.json(updated);
}
