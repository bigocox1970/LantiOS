import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { attachActiveVersionPaths, attachLatestVersionNumbers } from "@/lib/server/documentVersions";
import { handleDocumentUpload } from "@/lib/server/documentUpload";

// GET /api/single-documents
export async function GET(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    const db = createServerSupabase();

    const { data, error } = await db
        .from("documents")
        .select("*")
        .eq("user_id", userId)
        .is("project_id", null)
        .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    const docs = (data ?? []) as unknown as { id: string; current_version_id?: string | null }[];
    await attachLatestVersionNumbers(db, docs);
    await attachActiveVersionPaths(db, docs);
    return NextResponse.json(docs);
}

// POST /api/single-documents — file upload
export async function POST(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    const db = createServerSupabase();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ detail: "file is required" }, { status: 400 });

    return handleDocumentUpload(file, userId, null, db);
}
