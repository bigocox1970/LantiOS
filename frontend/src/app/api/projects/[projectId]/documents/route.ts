import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { checkProjectAccess } from "@/lib/server/access";
import { attachActiveVersionPaths } from "@/lib/server/documentVersions";
import { handleDocumentUpload } from "@/lib/server/documentUpload";

// GET /api/projects/[projectId]/documents
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

    const { data: docs } = await db
        .from("documents")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
    const docsTyped = (docs ?? []) as unknown as { id: string; current_version_id?: string | null }[];
    await attachActiveVersionPaths(db, docsTyped);
    return NextResponse.json(docsTyped);
}

// POST /api/projects/[projectId]/documents — file upload
export async function POST(
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ detail: "file is required" }, { status: 400 });

    return handleDocumentUpload(file, userId, projectId, db);
}
