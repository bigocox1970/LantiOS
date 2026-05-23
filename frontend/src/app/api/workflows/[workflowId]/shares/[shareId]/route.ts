import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";

// DELETE /api/workflows/[workflowId]/shares/[shareId]
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ workflowId: string; shareId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    const { workflowId, shareId } = await params;
    const db = createServerSupabase();

    const { data: wf } = await db.from("workflows").select("id").eq("id", workflowId).eq("user_id", userId).single();
    if (!wf) return NextResponse.json({ detail: "Workflow not found" }, { status: 404 });

    await db.from("workflow_shares").delete().eq("id", shareId).eq("workflow_id", workflowId);
    return new NextResponse(null, { status: 204 });
}
