import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { checkProjectAccess } from "@/lib/server/access";

// GET /api/projects/[projectId]/chats
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { projectId } = await params;
    const db = createServerSupabase();

    const access = await checkProjectAccess(projectId, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "Project not found" }, { status: 404 });

    const { data, error } = await db
        .from("chats")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
}
