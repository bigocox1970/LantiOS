import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { checkProjectAccess } from "@/lib/server/access";

// POST /api/projects/[projectId]/folders
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { projectId } = await params;
    const { name, parent_folder_id } = (await request.json()) as { name: string; parent_folder_id?: string | null };
    if (!name?.trim()) return NextResponse.json({ detail: "name is required" }, { status: 400 });

    const db = createServerSupabase();
    const access = await checkProjectAccess(projectId, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "Project not found" }, { status: 404 });

    if (parent_folder_id) {
        const { data: parent } = await db
            .from("project_subfolders")
            .select("id")
            .eq("id", parent_folder_id)
            .eq("project_id", projectId)
            .single();
        if (!parent) return NextResponse.json({ detail: "Parent folder not found" }, { status: 404 });
    }

    const { data, error } = await db
        .from("project_subfolders")
        .insert({ project_id: projectId, user_id: userId, name: name.trim(), parent_folder_id: parent_folder_id ?? null })
        .select("*")
        .single();
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
}
