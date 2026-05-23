import JSZip from "jszip";

export async function normalizeDocxZipPaths(buffer: Buffer): Promise<Buffer> {
    let zip: JSZip;
    try {
        zip = await JSZip.loadAsync(buffer);
    } catch {
        return buffer;
    }
    const renames: [string, string][] = [];
    zip.forEach((relativePath) => {
        if (relativePath.includes("\\")) {
            renames.push([relativePath, relativePath.replace(/\\/g, "/")]);
        }
    });
    if (renames.length === 0) return buffer;
    for (const [oldPath, newPath] of renames) {
        const entry = zip.file(oldPath);
        if (!entry) continue;
        const content = await entry.async("nodebuffer");
        zip.remove(oldPath);
        zip.file(newPath, content);
    }
    return zip.generateAsync({ type: "nodebuffer" });
}

// LibreOffice is not available on Netlify serverless. Callers catch this and
// set pdfStoragePath = null; the frontend falls back to docx-preview rendering.
export async function docxToPdf(_buffer: Buffer): Promise<Buffer> {
    throw new Error("PDF conversion is not available in this environment");
}

export function convertedPdfKey(userId: string, docId: string): string {
    return `converted-pdfs/${userId}/${docId}.pdf`;
}
