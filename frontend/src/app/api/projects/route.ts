import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { attachActiveVersionPaths, attachLatestVersionNumbers } from "@/lib/server/documentVersions";

// GET /api/projects
export async function GET(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const db = createServerSupabase();

    const { data: ownProjects, error: ownError } = await db
        .from("projects")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
    if (ownError) return NextResponse.json({ detail: ownError.message }, { status: 500 });

    const { data: sharedProjects, error: sharedError } = userEmail
        ? await db
              .from("projects")
              .select("*")
              .filter("shared_with", "cs", JSON.stringify([userEmail]))
              .neq("user_id", userId)
              .order("created_at", { ascending: false })
        : { data: [], error: null };
    if (sharedError) return NextResponse.json({ detail: sharedError.message }, { status: 500 });

    const projects = [...(ownProjects ?? []), ...(sharedProjects ?? [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const result = await Promise.all(
        projects.map(async (p) => {
            const [docs, chats, reviews] = await Promise.all([
                db.from("documents").select("id", { count: "exact", head: true }).eq("project_id", p.id),
                db.from("chats").select("id", { count: "exact", head: true }).eq("project_id", p.id),
                db.from("tabular_reviews").select("id", { count: "exact", head: true }).eq("project_id", p.id),
            ]);
            return {
                ...p,
                is_owner: p.user_id === userId,
                document_count: docs.count ?? 0,
                chat_count: chats.count ?? 0,
                review_count: reviews.count ?? 0,
            };
        }),
    );
    return NextResponse.json(result);
}

// POST /api/projects
export async function POST(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;

    const { name, cm_number, shared_with } = (await request.json()) as {
        name: string;
        cm_number?: string;
        shared_with?: string[];
    };
    if (!name?.trim()) return NextResponse.json({ detail: "name is required" }, { status: 400 });

    const normalizedUserEmail = userEmail?.trim().toLowerCase();
    const cleanedSharedWith: string[] = [];
    const seenSharedEmails = new Set<string>();
    if (Array.isArray(shared_with)) {
        for (const raw of shared_with) {
            if (typeof raw !== "string") continue;
            const e = raw.trim().toLowerCase();
            if (!e || seenSharedEmails.has(e)) continue;
            if (normalizedUserEmail && e === normalizedUserEmail) {
                return NextResponse.json({ detail: "You cannot share a project with yourself." }, { status: 400 });
            }
            seenSharedEmails.add(e);
            cleanedSharedWith.push(e);
        }
    }

    const db = createServerSupabase();
    const { data, error } = await db
        .from("projects")
        .insert({ user_id: userId, name: name.trim(), cm_number: cm_number ?? null, shared_with: cleanedSharedWith })
        .select("*")
        .single();
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    return NextResponse.json({ ...data, documents: [] }, { status: 201 });
}
