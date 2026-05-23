import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { downloadFile } from "@/lib/server/storage";
import { loadActiveVersion } from "@/lib/server/documentVersions";
import { ensureDocAccess } from "@/lib/server/access";
import { extractTrackedChangeIds } from "@/lib/server/docxTrackedChanges";

// GET /api/single-documents/[documentId]/tracked-change-ids
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ documentId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { documentId } = await params;
    const { searchParams } = new URL(request.url);
    const versionIdParam = searchParams.get("version_id");
    const db = createServerSupabase();

    const { data: doc } = await db
        .from("documents")
        .select("id, user_id, project_id")
        .eq("id", documentId)
        .single();
    if (!doc) return NextResponse.json({ detail: "Document not found" }, { status: 404 });
    const access = await ensureDocAccess(doc, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "Document not found" }, { status: 404 });

    const active = await loadActiveVersion(documentId, db, versionIdParam);
    if (!active) return NextResponse.json({ detail: "No file available" }, { status: 404 });

    const raw = await downloadFile(active.storage_path);
    if (!raw) return NextResponse.json({ detail: "Document bytes not available" }, { status: 404 });

    const ids = await extractTrackedChangeIds(Buffer.from(raw));
    return NextResponse.json({ ids });
}
