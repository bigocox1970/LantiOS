import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { downloadFile, uploadFile } from "@/lib/server/storage";
import { resolveTrackedChange } from "@/lib/server/docxTrackedChanges";
import { buildDownloadUrl } from "@/lib/server/downloadTokens";
import { loadActiveVersion } from "@/lib/server/documentVersions";
import { ensureDocAccess } from "@/lib/server/access";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ documentId: string; editId: string }> },
) {
    return handleEditResolution(request, await params, "accept");
}

async function handleEditResolution(
    _request: NextRequest,
    { documentId, editId }: { documentId: string; editId: string },
    mode: "accept" | "reject",
): Promise<NextResponse> {
    const auth = await requireAuth(_request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const db = createServerSupabase();

    const { data: edit } = await db
        .from("document_edits")
        .select("id, document_id, change_id, del_w_id, ins_w_id, status")
        .eq("id", editId)
        .eq("document_id", documentId)
        .single();
    if (!edit) return NextResponse.json({ detail: "Edit not found" }, { status: 404 });

    if (edit.status !== "pending") {
        const { data: doc } = await db
            .from("documents")
            .select("current_version_id, filename, user_id, project_id")
            .eq("id", documentId)
            .single();
        if (!doc) return NextResponse.json({ detail: "Document not found" }, { status: 404 });
        const accessResolved = await ensureDocAccess(doc, userId, userEmail, db);
        if (!accessResolved.ok) return NextResponse.json({ detail: "Document not found" }, { status: 404 });
        const activeForResolved = await loadActiveVersion(documentId, db);
        return NextResponse.json({
            ok: true,
            already_resolved: true,
            status: edit.status,
            version_id: doc.current_version_id ?? null,
            download_url: activeForResolved
                ? buildDownloadUrl(activeForResolved.storage_path, (doc.filename as string) ?? "document.docx")
                : null,
            remaining_pending: 0,
        });
    }

    const { data: doc } = await db
        .from("documents")
        .select("id, current_version_id, user_id, project_id")
        .eq("id", documentId)
        .single();
    if (!doc) return NextResponse.json({ detail: "Document not found" }, { status: 404 });
    const access = await ensureDocAccess(doc, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "Document not found" }, { status: 404 });

    const active = await loadActiveVersion(documentId, db);
    const latestPath = active?.storage_path ?? null;
    if (!latestPath) return NextResponse.json({ detail: "No file to edit" }, { status: 404 });

    const raw = await downloadFile(latestPath);
    if (!raw) return NextResponse.json({ detail: "Document bytes not available" }, { status: 404 });

    const wIds = [edit.del_w_id, edit.ins_w_id].filter((v): v is string => typeof v === "string" && v.length > 0);
    const { bytes: resolvedBytes, found } = await resolveTrackedChange(Buffer.from(raw), wIds, mode);

    if (!found) {
        await db
            .from("document_edits")
            .update({ status: mode === "accept" ? "accepted" : "rejected", resolved_at: new Date().toISOString() })
            .eq("id", editId);
        const { data: filenameRow } = await db.from("documents").select("filename").eq("id", documentId).single();
        return NextResponse.json({
            ok: true,
            version_id: doc.current_version_id,
            download_url: buildDownloadUrl(latestPath, (filenameRow?.filename as string) ?? "document.docx"),
            remaining_pending: 0,
        });
    }

    const ab = resolvedBytes.buffer.slice(
        resolvedBytes.byteOffset,
        resolvedBytes.byteOffset + resolvedBytes.byteLength,
    ) as ArrayBuffer;
    await uploadFile(latestPath, ab, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    await db
        .from("document_edits")
        .update({ status: mode === "accept" ? "accepted" : "rejected", resolved_at: new Date().toISOString() })
        .eq("id", editId);

    const { count: remainingPending } = await db
        .from("document_edits")
        .select("id", { count: "exact", head: true })
        .eq("document_id", documentId)
        .eq("status", "pending");

    const { data: filenameRow } = await db.from("documents").select("filename").eq("id", documentId).single();
    return NextResponse.json({
        ok: true,
        version_id: doc.current_version_id,
        download_url: buildDownloadUrl(latestPath, (filenameRow?.filename as string) ?? "document.docx"),
        remaining_pending: remainingPending ?? 0,
    });
}
