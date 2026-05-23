import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";

// DELETE /api/workflows/hidden/[workflowId]
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ workflowId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    const { workflowId } = await params;
    const db = createServerSupabase();
    const { error } = await db.from("hidden_workflows").delete().eq("user_id", userId).eq("workflow_id", workflowId);
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
}
