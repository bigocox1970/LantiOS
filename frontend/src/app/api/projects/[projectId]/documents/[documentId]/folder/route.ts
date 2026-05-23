import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { checkProjectAccess } from "@/lib/server/access";

// PATCH /api/projects/[projectId]/documents/[documentId]/folder — move doc to folder
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string; documentId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { projectId, documentId } = await params;
    const body = (await request.json()) as { folder_id: string | null };
    const db = createServerSupabase();

    const access = await checkProjectAccess(projectId, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "Project not found" }, { status: 404 });

    if (body.folder_id) {
        const { data: folder } = await db
            .from("project_subfolders")
            .select("id")
            .eq("id", body.folder_id)
            .eq("project_id", projectId)
            .single();
        if (!folder) return NextResponse.json({ detail: "Folder not found" }, { status: 404 });
    }

    const { data, error } = await db
        .from("documents")
        .update({ folder_id: body.folder_id ?? null, updated_at: new Date().toISOString() })
        .eq("id", documentId)
        .eq("project_id", projectId)
        .select("*")
        .single();
    if (error || !data) return NextResponse.json({ detail: "Document not found" }, { status: 404 });
    return NextResponse.json(data);
}
