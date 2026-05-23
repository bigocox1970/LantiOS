import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { deleteFile } from "@/lib/server/storage";

// DELETE /api/single-documents/[documentId]
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ documentId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    const { documentId } = await params;
    const db = createServerSupabase();

    const { data: doc, error } = await db
        .from("documents")
        .select("id")
        .eq("id", documentId)
        .eq("user_id", userId)
        .single();
    if (error || !doc) return NextResponse.json({ detail: "Document not found" }, { status: 404 });

    const { data: versions } = await db
        .from("document_versions")
        .select("storage_path, pdf_storage_path")
        .eq("document_id", documentId);
    await Promise.all(
        (versions ?? []).flatMap((v) =>
            [v.storage_path, v.pdf_storage_path]
                .filter((p): p is string => typeof p === "string" && p.length > 0)
                .map((p) => deleteFile(p).catch(() => {})),
        ),
    );
    await db.from("documents").delete().eq("id", documentId);
    return new NextResponse(null, { status: 204 });
}
