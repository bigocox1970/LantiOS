import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { attachActiveVersionPaths, attachLatestVersionNumbers } from "@/lib/server/documentVersions";

// GET /api/projects/[projectId]
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { projectId } = await params;
    const db = createServerSupabase();

    const { data: project, error } = await db.from("projects").select("*").eq("id", projectId).single();
    if (error || !project) return NextResponse.json({ detail: "Project not found" }, { status: 404 });

    const canAccess =
        project.user_id === userId ||
        (userEmail && Array.isArray(project.shared_with) && project.shared_with.includes(userEmail));
    if (!canAccess) return NextResponse.json({ detail: "Project not found" }, { status: 404 });

    const [{ data: docs }, { data: folderData }] = await Promise.all([
        db.from("documents").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
        db.from("project_subfolders").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
    ]);
    const docsTyped = (docs ?? []) as unknown as { id: string; current_version_id?: string | null }[];
    await attachLatestVersionNumbers(db, docsTyped);
    await attachActiveVersionPaths(db, docsTyped);
    return NextResponse.json({ ...project, is_owner: project.user_id === userId, documents: docsTyped, folders: folderData ?? [] });
}

// PATCH /api/projects/[projectId]
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { projectId } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const updates: Record<string, unknown> = {};
    if (body.name != null) updates.name = body.name;
    if (body.cm_number != null) updates.cm_number = body.cm_number;
    if (Array.isArray(body.shared_with)) {
        const normalizedUserEmail = userEmail?.trim().toLowerCase();
        const seen = new Set<string>();
        const cleaned: string[] = [];
        for (const raw of body.shared_with) {
            if (typeof raw !== "string") continue;
            const e = raw.trim().toLowerCase();
            if (!e || seen.has(e)) continue;
            if (normalizedUserEmail && e === normalizedUserEmail) {
                return NextResponse.json({ detail: "You cannot share a project with yourself." }, { status: 400 });
            }
            seen.add(e);
            cleaned.push(e);
        }
        updates.shared_with = cleaned;
    }

    const db = createServerSupabase();
    const { data, error } = await db
        .from("projects")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", projectId)
        .eq("user_id", userId)
        .select("*")
        .single();
    if (error || !data) return NextResponse.json({ detail: "Project not found" }, { status: 404 });

    const [{ data: docs }, { data: folderData }] = await Promise.all([
        db.from("documents").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
        db.from("project_subfolders").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
    ]);
    const docsTyped = (docs ?? []) as unknown as { id: string; current_version_id?: string | null }[];
    await attachActiveVersionPaths(db, docsTyped);
    return NextResponse.json({ ...data, documents: docsTyped, folders: folderData ?? [] });
}

// DELETE /api/projects/[projectId]
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    const { projectId } = await params;
    const db = createServerSupabase();
    const { error } = await db.from("projects").delete().eq("id", projectId).eq("user_id", userId);
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
}
