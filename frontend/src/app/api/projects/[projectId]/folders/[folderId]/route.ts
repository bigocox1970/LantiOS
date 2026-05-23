import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { checkProjectAccess } from "@/lib/server/access";

async function loadProjectFolder(
    db: ReturnType<typeof createServerSupabase>,
    projectId: string,
    folderId: string,
): Promise<{ id: string; parent_folder_id: string | null } | null> {
    const { data } = await db
        .from("project_subfolders")
        .select("id, parent_folder_id")
        .eq("id", folderId)
        .eq("project_id", projectId)
        .maybeSingle();
    return (data as { id: string; parent_folder_id: string | null } | null) ?? null;
}

// PATCH /api/projects/[projectId]/folders/[folderId]
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string; folderId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { projectId, folderId } = await params;
    const body = (await request.json()) as { name?: string; parent_folder_id?: string | null };

    const db = createServerSupabase();
    const access = await checkProjectAccess(projectId, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "Project not found" }, { status: 404 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.name != null) updates.name = body.name.trim();
    if ("parent_folder_id" in body) {
        if (body.parent_folder_id) {
            const parent = await loadProjectFolder(db, projectId, body.parent_folder_id);
            if (!parent) return NextResponse.json({ detail: "Parent folder not found" }, { status: 404 });

            let cur: string | null = body.parent_folder_id;
            while (cur) {
                if (cur === folderId) {
                    return NextResponse.json({ detail: "Cannot move a folder into itself or a descendant" }, { status: 400 });
                }
                const p = await loadProjectFolder(db, projectId, cur);
                if (!p) return NextResponse.json({ detail: "Parent folder not found" }, { status: 404 });
                cur = p?.parent_folder_id ?? null;
            }
        }
        updates.parent_folder_id = body.parent_folder_id ?? null;
    }

    const { data, error } = await db
        .from("project_subfolders")
        .update(updates)
        .eq("id", folderId)
        .eq("project_id", projectId)
        .select("*")
        .single();
    if (error || !data) return NextResponse.json({ detail: "Folder not found" }, { status: 404 });
    return NextResponse.json(data);
}

// DELETE /api/projects/[projectId]/folders/[folderId]
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string; folderId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { projectId, folderId } = await params;
    const db = createServerSupabase();

    const access = await checkProjectAccess(projectId, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "Project not found" }, { status: 404 });

    const folder = await loadProjectFolder(db, projectId, folderId);
    if (!folder) return NextResponse.json({ detail: "Folder not found" }, { status: 404 });

    await db.from("documents").update({ folder_id: null }).eq("folder_id", folderId).eq("project_id", projectId);
    const { error } = await db.from("project_subfolders").delete().eq("id", folderId).eq("project_id", projectId);
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
}
