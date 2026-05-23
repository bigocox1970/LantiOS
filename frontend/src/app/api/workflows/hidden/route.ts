import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";

// GET /api/workflows/hidden
export async function GET(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    const db = createServerSupabase();
    const { data, error } = await db.from("hidden_workflows").select("workflow_id").eq("user_id", userId);
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    return NextResponse.json((data ?? []).map((r) => r.workflow_id));
}

// POST /api/workflows/hidden
export async function POST(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    const { workflow_id } = (await request.json()) as { workflow_id: string };
    if (!workflow_id?.trim()) return NextResponse.json({ detail: "workflow_id is required" }, { status: 400 });
    const db = createServerSupabase();
    const { error } = await db.from("hidden_workflows").upsert({ user_id: userId, workflow_id }, { onConflict: "user_id,workflow_id" });
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
}
