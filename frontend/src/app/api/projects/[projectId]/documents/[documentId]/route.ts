import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { checkProjectAccess } from "@/lib/server/access";
import { downloadFile, storageKey, uploadFile } from "@/lib/server/storage";
import { convertedPdfKey } from "@/lib/server/convert";
import { loadActiveVersion } from "@/lib/server/documentVersions";

function normalizeDocumentFilename(nextName: unknown, currentName: string) {
    if (typeof nextName !== "string") return null;
    const trimmed = nextName.trim().slice(0, 200);
    if (!trimmed) return null;
    if (/\.[a-z0-9]{1,6}$/i.test(trimmed)) return trimmed;
    const ext = currentName.match(/\.[a-z0-9]{1,6}$/i)?.[0] ?? "";
    return `${trimmed}${ext}`;
}

// POST /api/projects/[projectId]/documents/[documentId] — assign or copy existing doc into project
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string; documentId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { projectId, documentId } = await params;
    const db = createServerSupabase();

    const access = await checkProjectAccess(projectId, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "Project not found" }, { status: 404 });

    const { data: doc } = await db.from("documents").select("*").eq("id", documentId).eq("user_id", userId).single();
    if (!doc) return NextResponse.json({ detail: "Document not found" }, { status: 404 });

    if (doc.project_id === projectId) return NextResponse.json(doc);

    if (doc.project_id === null) {
        const { data: updated, error } = await db
            .from("documents")
            .update({ project_id: projectId, updated_at: new Date().toISOString() })
            .eq("id", documentId)
            .select("*")
            .single();
        if (error || !updated) return NextResponse.json({ detail: "Failed to update document" }, { status: 500 });
        return NextResponse.json(updated);
    } else {
        const { data: copy, error } = await db
            .from("documents")
            .insert({
                project_id: projectId,
                user_id: userId,
                filename: doc.filename,
                file_type: doc.file_type,
                size_bytes: doc.size_bytes,
                page_count: doc.page_count,
                structure_tree: doc.structure_tree,
                status: doc.status,
            })
            .select("*")
            .single();
        if (error || !copy) return NextResponse.json({ detail: "Failed to copy document" }, { status: 500 });

        let copyVersionRowId: string | null = null;
        if (doc.current_version_id) {
            const { data: srcV } = await db
                .from("document_versions")
                .select("storage_path, pdf_storage_path, version_number, display_name, source")
                .eq("id", doc.current_version_id)
                .single();
            if (srcV?.storage_path) {
                const srcBytes = await downloadFile(srcV.storage_path);
                if (!srcBytes) return NextResponse.json({ detail: "Failed to read source document bytes" }, { status: 500 });

                const newKey = storageKey(userId, copy.id as string, doc.filename as string);
                const contentType =
                    doc.file_type === "pdf"
                        ? "application/pdf"
                        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                await uploadFile(newKey, srcBytes, contentType);

                let newPdfPath: string | null = null;
                if (srcV.pdf_storage_path) {
                    if (srcV.pdf_storage_path === srcV.storage_path) {
                        newPdfPath = newKey;
                    } else {
                        const pdfBytes = await downloadFile(srcV.pdf_storage_path);
                        if (pdfBytes) {
                            const newPdfKey = convertedPdfKey(userId, copy.id as string);
                            await uploadFile(newPdfKey, pdfBytes, "application/pdf");
                            newPdfPath = newPdfKey;
                        }
                    }
                }

                const { data: newV } = await db
                    .from("document_versions")
                    .insert({
                        document_id: copy.id,
                        storage_path: newKey,
                        pdf_storage_path: newPdfPath,
                        source: (srcV.source as string | null) ?? "upload",
                        version_number: srcV.version_number ?? 1,
                        display_name: srcV.display_name ?? doc.filename,
                    })
                    .select("id")
                    .single();
                copyVersionRowId = (newV?.id as string | null) ?? null;
                if (copyVersionRowId) {
                    await db.from("documents").update({ current_version_id: copyVersionRowId }).eq("id", copy.id);
                }
            }
        }
        return NextResponse.json(copy, { status: 201 });
    }
}

// PATCH /api/projects/[projectId]/documents/[documentId] — rename
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string; documentId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { projectId, documentId } = await params;
    const db = createServerSupabase();

    const access = await checkProjectAccess(projectId, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "Project not found" }, { status: 404 });

    const { data: doc } = await db
        .from("documents")
        .select("id, filename, current_version_id")
        .eq("id", documentId)
        .eq("project_id", projectId)
        .single();
    if (!doc) return NextResponse.json({ detail: "Document not found" }, { status: 404 });

    const body = (await request.json()) as { filename?: unknown };
    const filename = normalizeDocumentFilename(body?.filename, doc.filename as string);
    if (!filename) return NextResponse.json({ detail: "filename is required" }, { status: 400 });

    const { data: updated, error } = await db
        .from("documents")
        .update({ filename, updated_at: new Date().toISOString() })
        .eq("id", documentId)
        .eq("project_id", projectId)
        .select("*")
        .single();
    if (error || !updated) return NextResponse.json({ detail: "Document not found" }, { status: 404 });

    if (doc.current_version_id) {
        await db
            .from("document_versions")
            .update({ display_name: filename })
            .eq("id", doc.current_version_id)
            .eq("document_id", documentId);
    }

    return NextResponse.json(updated);
}
