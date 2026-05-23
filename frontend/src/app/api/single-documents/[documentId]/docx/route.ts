import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { buildContentDisposition, downloadFile } from "@/lib/server/storage";
import { loadActiveVersion } from "@/lib/server/documentVersions";
import { ensureDocAccess } from "@/lib/server/access";

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
    if (!versionNumber || versionNumber < 1) return originalFilename;
    const stem = dot > 0 ? originalFilename.slice(0, dot) : originalFilename;
    const ext = dot > 0 ? originalFilename.slice(dot) : ".docx";
    return `${stem} [Edited V${versionNumber}]${ext}`;
}

// GET /api/single-documents/[documentId]/docx
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

    const raw = await downloadFile(active.storage_path);
    if (!raw) return NextResponse.json({ detail: "Document bytes not available" }, { status: 404 });

    return new Response(Buffer.from(raw), {
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": buildContentDisposition(
                "inline",
                resolveDownloadFilename(doc.filename as string, active.display_name, active.version_number),
            ),
        },
    });
}
