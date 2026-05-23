import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { checkProjectAccess } from "@/lib/server/access";

// POST /api/chat/create
export async function POST(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;

    const body = (await request.json()) as { project_id?: unknown };
    let projectId: string | null = null;
    if (body?.project_id !== undefined) {
        if (body.project_id === null) {
            projectId = null;
        } else if (typeof body.project_id === "string" && body.project_id.trim()) {
            projectId = body.project_id.trim();
        } else {
            return NextResponse.json({ detail: "project_id must be a non-empty string or null" }, { status: 400 });
        }
    }

    const db = createServerSupabase();
    if (projectId) {
        const access = await checkProjectAccess(projectId, userId, userEmail, db);
        if (!access.ok) return NextResponse.json({ detail: "Project not found" }, { status: 404 });
    }

    const { data, error } = await db
        .from("chats")
        .insert({ user_id: userId, project_id: projectId ?? null })
        .select("id")
        .single();

    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    return NextResponse.json({ id: data.id });
}
