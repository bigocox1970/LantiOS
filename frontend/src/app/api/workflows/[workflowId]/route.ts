import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";

type Db = ReturnType<typeof createServerSupabase>;
type WorkflowRecord = { id: string; user_id: string | null; is_system: boolean; [key: string]: unknown };

function withWorkflowAccess<T extends Record<string, unknown>>(
    workflow: T,
    access: { allowEdit: boolean; isOwner: boolean; sharedByName?: string | null },
) {
    return { ...workflow, allow_edit: access.allowEdit, is_owner: access.isOwner, shared_by_name: access.sharedByName ?? null };
}

async function resolveWorkflowAccess(workflowId: string, userId: string, userEmail: string | null | undefined, db: Db) {
    const { data: workflow } = await db.from("workflows").select("*").eq("id", workflowId).single();
    if (!workflow) return null;
    const workflowRecord = workflow as WorkflowRecord;
    if (workflowRecord.user_id === userId) return { workflow: workflowRecord, allowEdit: true, isOwner: true };
    const normalizedUserEmail = (userEmail ?? "").trim().toLowerCase();
    if (!normalizedUserEmail) return null;
    const { data: share } = await db.from("workflow_shares").select("allow_edit").eq("workflow_id", workflowId).eq("shared_with_email", normalizedUserEmail).maybeSingle();
    if (!share) return null;
    return { workflow: workflowRecord, allowEdit: !!share.allow_edit, isOwner: false };
}

// GET /api/workflows/[workflowId]
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ workflowId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { workflowId } = await params;
    const db = createServerSupabase();
    const access = await resolveWorkflowAccess(workflowId, userId, userEmail, db);
    if (!access) return NextResponse.json({ detail: "Workflow not found" }, { status: 404 });
    return NextResponse.json(withWorkflowAccess(access.workflow, { allowEdit: access.allowEdit, isOwner: access.isOwner }));
}

async function handleUpdate(request: NextRequest, workflowId: string) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const body = (await request.json()) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (body.title != null) updates.title = body.title;
    if (body.prompt_md != null) updates.prompt_md = body.prompt_md;
    if (body.columns_config != null) updates.columns_config = body.columns_config;
    if ("practice" in body) updates.practice = body.practice ?? null;
    const db = createServerSupabase();
    const access = await resolveWorkflowAccess(workflowId, userId, userEmail, db);
    if (!access || access.workflow.is_system || !access.allowEdit) return NextResponse.json({ detail: "Workflow not found or not editable" }, { status: 404 });
    const { data, error } = await db.from("workflows").update(updates).eq("id", workflowId).eq("is_system", false).select("*").single();
    if (error || !data) return NextResponse.json({ detail: "Workflow not found or not editable" }, { status: 404 });
    return NextResponse.json(withWorkflowAccess(data, { allowEdit: access.allowEdit, isOwner: access.isOwner }));
}

// PUT /api/workflows/[workflowId]
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ workflowId: string }> },
) {
    const { workflowId } = await params;
    return handleUpdate(request, workflowId);
}

// PATCH /api/workflows/[workflowId]
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ workflowId: string }> },
) {
    const { workflowId } = await params;
    return handleUpdate(request, workflowId);
}

// DELETE /api/workflows/[workflowId]
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ workflowId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    const { workflowId } = await params;
    const db = createServerSupabase();
    const { error } = await db.from("workflows").delete().eq("id", workflowId).eq("user_id", userId).eq("is_system", false);
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
}
