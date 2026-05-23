import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";

// POST /api/workflows/[workflowId]/share
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ workflowId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { workflowId } = await params;
    const { emails, allow_edit } = (await request.json()) as { emails: string[]; allow_edit: boolean };

    if (!emails?.length) return NextResponse.json({ detail: "emails is required" }, { status: 400 });
    const normalizedEmails = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (normalizedEmails.length === 0) return NextResponse.json({ detail: "emails is required" }, { status: 400 });
    const normalizedUserEmail = (userEmail ?? "").trim().toLowerCase();
    if (normalizedUserEmail && normalizedEmails.includes(normalizedUserEmail)) {
        return NextResponse.json({ detail: "You cannot share a workflow with yourself." }, { status: 400 });
    }

    const db = createServerSupabase();
    const { data: wf } = await db.from("workflows").select("id").eq("id", workflowId).eq("user_id", userId).eq("is_system", false).single();
    if (!wf) return NextResponse.json({ detail: "Workflow not found or not editable" }, { status: 404 });

    const rows = normalizedEmails.map((email) => ({ workflow_id: workflowId, shared_by_user_id: userId, shared_with_email: email, allow_edit: allow_edit ?? false }));
    const { error } = await db.from("workflow_shares").upsert(rows, { onConflict: "workflow_id,shared_with_email" });
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
}
