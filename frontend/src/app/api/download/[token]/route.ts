import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { buildContentDisposition, downloadFile } from "@/lib/server/storage";
import { verifyDownload } from "@/lib/server/downloadTokens";
import { ensureDocAccess } from "@/lib/server/access";

function contentTypeFor(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.endsWith(".docx"))
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (lower.endsWith(".pdf")) return "application/pdf";
    if (lower.endsWith(".xlsx"))
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return "application/octet-stream";
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ token: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;

    const { token } = await params;
    const info = verifyDownload(token);
    if (!info) return NextResponse.json({ detail: "Invalid link" }, { status: 404 });

    const db = createServerSupabase();
    const { data: byStoragePath } = await db
        .from("document_versions")
        .select("id, document_id")
        .eq("storage_path", info.path)
        .maybeSingle();

    if (!byStoragePath) return NextResponse.json({ detail: "File not found" }, { status: 404 });

    const { data: doc } = await db
        .from("documents")
        .select("id, user_id, project_id")
        .eq("id", byStoragePath.document_id)
        .single();
    if (!doc) return NextResponse.json({ detail: "File not found" }, { status: 404 });

    const access = await ensureDocAccess(doc, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "File not found" }, { status: 404 });

    const raw = await downloadFile(info.path);
    if (!raw) return NextResponse.json({ detail: "File not found" }, { status: 404 });

    return new Response(Buffer.from(raw), {
        headers: {
            "Content-Type": contentTypeFor(info.filename),
            "Content-Disposition": buildContentDisposition("attachment", info.filename),
        },
    });
}
