import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { buildContentDisposition, downloadFile } from "@/lib/server/storage";
import { loadActiveVersion } from "@/lib/server/documentVersions";
import { ensureDocAccess } from "@/lib/server/access";

// GET /api/single-documents/[documentId]/display
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
        .select("id, filename, file_type, user_id, project_id")
        .eq("id", documentId)
        .single();
    if (!doc) return NextResponse.json({ detail: "Document not found" }, { status: 404 });
    const access = await ensureDocAccess(doc, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "Document not found" }, { status: 404 });

    const active = await loadActiveVersion(documentId, db, versionIdParam);
    if (!active) return NextResponse.json({ detail: "No file available" }, { status: 404 });

    const fileType = (doc.file_type as string) ?? "";
    const isDocx = fileType === "docx" || fileType === "doc";
    const servePath = isDocx && active.pdf_storage_path ? active.pdf_storage_path : active.storage_path;
    const raw = await downloadFile(servePath);
    if (!raw) return NextResponse.json({ detail: "Document not found in storage" }, { status: 404 });

    if (fileType === "pdf" || (isDocx && active.pdf_storage_path)) {
        return new Response(Buffer.from(raw), {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": buildContentDisposition("inline", doc.filename as string),
            },
        });
    } else {
        return new Response(Buffer.from(raw), {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "Content-Disposition": buildContentDisposition("inline", doc.filename as string),
            },
        });
    }
}
