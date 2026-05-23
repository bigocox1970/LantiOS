import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";

// GET /api/workflows/[workflowId]/shares
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ workflowId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    const { workflowId } = await params;
    const db = createServerSupabase();

    const { data: wf } = await db.from("workflows").select("id").eq("id", workflowId).eq("user_id", userId).eq("is_system", false).single();
    if (!wf) return NextResponse.json({ detail: "Workflow not found or not editable" }, { status: 404 });

    const { data: shares, error } = await db.from("workflow_shares").select("id, shared_with_email, allow_edit, created_at").eq("workflow_id", workflowId).order("created_at", { ascending: true });
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    return NextResponse.json(shares ?? []);
}
