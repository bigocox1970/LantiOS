import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { uploadFile, versionStorageKey } from "@/lib/server/storage";
import { docxToPdf } from "@/lib/server/convert";
import { ensureDocAccess } from "@/lib/server/access";

// GET /api/single-documents/[documentId]/versions
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ documentId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { documentId } = await params;
    const db = createServerSupabase();

    const { data: doc } = await db
        .from("documents")
        .select("id, current_version_id, user_id, project_id")
        .eq("id", documentId)
        .single();
    if (!doc) return NextResponse.json({ detail: "Document not found" }, { status: 404 });
    const access = await ensureDocAccess(doc, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "Document not found" }, { status: 404 });

    const { data: rows } = await db
        .from("document_versions")
        .select("id, version_number, source, created_at, display_name")
        .eq("document_id", documentId)
        .order("created_at", { ascending: true });

    return NextResponse.json({ current_version_id: doc.current_version_id, versions: rows ?? [] });
}

// POST /api/single-documents/[documentId]/versions — upload new version
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ documentId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { documentId } = await params;
    const db = createServerSupabase();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ detail: "file is required" }, { status: 400 });

    const { data: doc } = await db
        .from("documents")
        .select("id, filename, file_type, user_id, project_id")
        .eq("id", documentId)
        .single();
    if (!doc) return NextResponse.json({ detail: "Document not found" }, { status: 404 });
    const access = await ensureDocAccess(doc, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "Document not found" }, { status: 404 });

    const suffix = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
    if (doc.file_type && suffix && doc.file_type !== suffix) {
        return NextResponse.json(
            { detail: `Uploaded file type (${suffix}) does not match document type (${doc.file_type}).` },
            { status: 400 },
        );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const versionSlug = crypto.randomUUID().replace(/-/g, "");
    const key = versionStorageKey(userId, documentId, versionSlug, file.name);
    const contentType =
        suffix === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    try {
        await uploadFile(
            key,
            fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength) as ArrayBuffer,
            contentType,
        );
    } catch (e) {
        console.error("[versions/upload] storage write failed", e);
        return NextResponse.json({ detail: "Failed to upload new version." }, { status: 500 });
    }

    let pdfStoragePath: string | null = null;
    if (suffix === "docx" || suffix === "doc") {
        try {
            const pdfBuf = await docxToPdf(fileBuffer);
            const pdfKey = `converted-pdfs/${userId}/${documentId}/${versionSlug}.pdf`;
            await uploadFile(
                pdfKey,
                pdfBuf.buffer.slice(pdfBuf.byteOffset, pdfBuf.byteOffset + pdfBuf.byteLength) as ArrayBuffer,
                "application/pdf",
            );
            pdfStoragePath = pdfKey;
        } catch (err) {
            console.error(`[versions/upload] DOCX→PDF conversion failed for ${file.name}:`, err);
        }
    } else if (suffix === "pdf") {
        pdfStoragePath = key;
    }

    const { data: maxRow } = await db
        .from("document_versions")
        .select("version_number")
        .eq("document_id", documentId)
        .in("source", ["upload", "user_upload", "assistant_edit"])
        .order("version_number", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
    const nextVersionNumber = ((maxRow?.version_number as number | null) ?? 1) + 1;

    const displayNameRaw = formData.get("display_name");
    const defaultDisplayName =
        typeof displayNameRaw === "string" && displayNameRaw.trim()
            ? displayNameRaw.trim().slice(0, 200)
            : file.name;

    const { data: versionRow, error: verErr } = await db
        .from("document_versions")
        .insert({
            document_id: documentId,
            storage_path: key,
            pdf_storage_path: pdfStoragePath,
            source: "user_upload",
            version_number: nextVersionNumber,
            display_name: defaultDisplayName,
        })
        .select("id, version_number, source, created_at, display_name")
        .single();
    if (verErr || !versionRow) {
        console.error("[versions/upload] insert failed", verErr);
        return NextResponse.json({ detail: "Failed to record new version." }, { status: 500 });
    }

    const documentsUpdate: Record<string, unknown> = { current_version_id: versionRow.id };
    const providedDisplayName =
        typeof displayNameRaw === "string" && displayNameRaw.trim()
            ? displayNameRaw.trim().slice(0, 200)
            : null;
    if (providedDisplayName) {
        const hasExt = /\.[a-z0-9]{1,6}$/i.test(providedDisplayName);
        const existingExt = (doc.filename as string | null)?.match(/\.[a-z0-9]{1,6}$/i)?.[0];
        const uploadedExt = suffix ? `.${suffix}` : "";
        const ext = hasExt ? "" : uploadedExt || existingExt || "";
        documentsUpdate.filename = `${providedDisplayName}${ext}`;
    }
    await db.from("documents").update(documentsUpdate).eq("id", documentId);

    return NextResponse.json(versionRow, { status: 201 });
}
