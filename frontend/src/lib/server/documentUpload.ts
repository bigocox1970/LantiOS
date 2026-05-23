import { NextResponse } from "next/server";
import { createServerSupabase } from "./supabase";
import { storageKey, uploadFile } from "./storage";
import { docxToPdf, convertedPdfKey } from "./convert";

const ALLOWED_TYPES = new Set(["pdf", "docx", "doc"]);

async function countPdfPages(buf: ArrayBuffer): Promise<number | null> {
    try {
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as string);
        const pdf = await (
            pdfjsLib as unknown as {
                getDocument: (opts: unknown) => { promise: Promise<{ numPages: number }> };
            }
        ).getDocument({ data: new Uint8Array(buf) }).promise;
        return pdf.numPages;
    } catch {
        return null;
    }
}

async function extractStructureTree(content: ArrayBuffer, fileType: string): Promise<unknown[] | null> {
    try {
        if (fileType === "pdf") {
            const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as string);
            const pdf = await (
                pdfjsLib as unknown as {
                    getDocument: (opts: unknown) => {
                        promise: Promise<{
                            numPages: number;
                            getOutline: () => Promise<{ title?: string }[]>;
                        }>;
                    };
                }
            ).getDocument({ data: new Uint8Array(content) }).promise;
            if (pdf.numPages <= 5) return null;
            const outline = await pdf.getOutline();
            if (outline?.length) {
                return outline.map((item, i) => ({
                    id: `h1-${i}`,
                    title: item.title ?? `Item ${i + 1}`,
                    level: 1,
                    page_number: null,
                    children: [],
                }));
            }
            return Array.from({ length: pdf.numPages }, (_, i) => ({
                id: `page-${i + 1}`,
                title: `Page ${i + 1}`,
                level: 1,
                page_number: i + 1,
                children: [],
            }));
        } else {
            const mammoth = await import("mammoth");
            const result = await mammoth.extractRawText({ buffer: Buffer.from(content) });
            const lines = result.value.split("\n").filter((l) => l.trim());
            const nodes = lines.slice(0, 30).map((line, i) => ({
                id: `h1-${i}`,
                title: line.slice(0, 100),
                level: 1,
                page_number: null,
                children: [],
            }));
            return nodes.length ? nodes : null;
        }
    } catch {
        return null;
    }
}

export async function handleDocumentUpload(
    file: File,
    userId: string,
    projectId: string | null,
    db: ReturnType<typeof createServerSupabase>,
    status201 = true,
): Promise<NextResponse> {
    const filename = file.name;
    const suffix = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
    if (!ALLOWED_TYPES.has(suffix)) {
        return NextResponse.json(
            { detail: `Unsupported file type: ${suffix}. Allowed: pdf, docx, doc` },
            { status: 400 },
        );
    }

    const content = Buffer.from(await file.arrayBuffer());

    const { data: doc, error: insertErr } = await db
        .from("documents")
        .insert({
            project_id: projectId,
            user_id: userId,
            filename,
            file_type: suffix,
            size_bytes: content.byteLength,
            status: "processing",
        })
        .select("*")
        .single();

    if (insertErr || !doc) {
        return NextResponse.json({ detail: "Failed to create document record" }, { status: 500 });
    }

    try {
        const docId = doc.id as string;
        const key = storageKey(userId, docId, filename);
        const contentType =
            suffix === "pdf"
                ? "application/pdf"
                : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        await uploadFile(key, content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer, contentType);

        const rawBuf = content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength) as ArrayBuffer;
        const tree = await extractStructureTree(rawBuf, suffix);
        const pageCount = suffix === "pdf" ? await countPdfPages(rawBuf) : null;

        let pdfStoragePath: string | null = null;
        if (suffix === "docx" || suffix === "doc") {
            try {
                const pdfBuf = await docxToPdf(content);
                const pdfKey = convertedPdfKey(userId, docId);
                await uploadFile(
                    pdfKey,
                    pdfBuf.buffer.slice(pdfBuf.byteOffset, pdfBuf.byteOffset + pdfBuf.byteLength) as ArrayBuffer,
                    "application/pdf",
                );
                pdfStoragePath = pdfKey;
            } catch (err) {
                console.error(`[upload] DOCX→PDF conversion failed for ${filename}:`, err);
            }
        } else if (suffix === "pdf") {
            pdfStoragePath = key;
        }

        const { data: versionRow, error: verErr } = await db
            .from("document_versions")
            .insert({
                document_id: docId,
                storage_path: key,
                pdf_storage_path: pdfStoragePath,
                source: "upload",
                version_number: 1,
                display_name: filename,
            })
            .select("id")
            .single();
        if (verErr || !versionRow) {
            throw new Error(`Failed to record upload version: ${verErr?.message ?? "unknown"}`);
        }

        await db
            .from("documents")
            .update({
                current_version_id: versionRow.id,
                size_bytes: content.byteLength,
                page_count: pageCount,
                structure_tree: tree ?? null,
                status: "ready",
                updated_at: new Date().toISOString(),
            })
            .eq("id", docId);

        const { data: updated } = await db.from("documents").select("*").eq("id", docId).single();
        const responseDoc = updated ? { ...updated, storage_path: key, pdf_storage_path: pdfStoragePath } : updated;
        return NextResponse.json(responseDoc, { status: status201 ? 201 : 200 });
    } catch (e) {
        await db.from("documents").update({ status: "error" }).eq("id", doc.id);
        return NextResponse.json({ detail: `Document processing failed: ${String(e)}` }, { status: 500 });
    }
}
