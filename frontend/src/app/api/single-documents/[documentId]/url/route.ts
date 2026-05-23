import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { getSignedUrl } from "@/lib/server/storage";
import { loadActiveVersion } from "@/lib/server/documentVersions";
import { ensureDocAccess } from "@/lib/server/access";

function versionedFilename(filename: string, version: number | null): string {
    if (!version || version < 1) return filename;
    const dot = filename.lastIndexOf(".");
    const stem = dot > 0 ? filename.slice(0, dot) : filename;
    const ext = dot > 0 ? filename.slice(dot) : ".docx";
    return `${stem} [Edited V${version}]${ext}`;
}

function resolveDownloadFilename(originalFilename: string, displayName: string | null | undefined, versionNumber: number | null): string {
    const dot = originalFilename.lastIndexOf(".");
    const origExt = dot > 0 ? originalFilename.slice(dot) : "";
    if (displayName && displayName.trim()) {
        const trimmed = displayName.trim();
        const trimmedDot = trimmed.lastIndexOf(".");
        const hasExt = trimmedDot > 0 && trimmed.slice(trimmedDot).toLowerCase().match(/^\.[a-z0-9]{1,6}$/);
        if (hasExt) return trimmed;
        return origExt ? `${trimmed}${origExt}` : trimmed;
    }
    return versionedFilename(originalFilename, versionNumber);
}

// GET /api/single-documents/[documentId]/url
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

    const { data: doc, error } = await db
        .from("documents")
        .select("id, filename, user_id, project_id")
        .eq("id", documentId)
        .single();
    if (error || !doc) return NextResponse.json({ detail: "Document not found" }, { status: 404 });
    const access = await ensureDocAccess(doc, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "Document not found" }, { status: 404 });

    const active = await loadActiveVersion(documentId, db, versionIdParam);
    if (!active) return NextResponse.json({ detail: "No file available" }, { status: 404 });

    const downloadFilename = resolveDownloadFilename(doc.filename as string, active.display_name, active.version_number);
    const url = await getSignedUrl(active.storage_path, 3600, downloadFilename);
    if (!url) return NextResponse.json({ detail: "Storage not configured" }, { status: 503 });

    return NextResponse.json({
        url,
        document_id: documentId,
        filename: downloadFilename,
        version_id: active.id,
        has_pdf_rendition: !!active.pdf_storage_path,
    });
}
