import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { downloadFile } from "@/lib/server/storage";
import { loadActiveVersion } from "@/lib/server/documentVersions";
import { ensureDocAccess } from "@/lib/server/access";

// POST /api/single-documents/download-zip
export async function POST(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;

    const { document_ids } = (await request.json()) as { document_ids?: string[] };
    if (!Array.isArray(document_ids) || document_ids.length === 0) {
        return NextResponse.json({ detail: "document_ids is required" }, { status: 400 });
    }

    const db = createServerSupabase();
    const { data: rawDocs, error } = await db
        .from("documents")
        .select("id, filename, file_type, current_version_id, user_id, project_id")
        .in("id", document_ids);
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });

    const accessChecks = await Promise.all(
        (rawDocs ?? []).map(async (d) => ({
            doc: d,
            access: await ensureDocAccess(d as { user_id: string; project_id: string | null }, userId, userEmail, db),
        })),
    );
    const docs = accessChecks.filter((x) => x.access.ok).map((x) => x.doc as { id: string; filename: string });
    if (!docs || docs.length === 0) return NextResponse.json({ detail: "No documents found" }, { status: 404 });

    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();

    await Promise.all(
        docs.map(async (doc) => {
            const active = await loadActiveVersion(doc.id, db);
            if (!active) return;
            const raw = await downloadFile(active.storage_path);
            if (!raw) return;
            zip.file(doc.filename, Buffer.from(raw));
        }),
    );

    const content = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    return new Response(new Uint8Array(content), {
        headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": 'attachment; filename="documents.zip"',
        },
    });
}
