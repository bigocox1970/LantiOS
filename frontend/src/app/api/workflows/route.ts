import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";

type Db = ReturnType<typeof createServerSupabase>;

function withWorkflowAccess<T extends Record<string, unknown>>(
    workflow: T,
    access: { allowEdit: boolean; isOwner: boolean; sharedByName?: string | null },
) {
    return { ...workflow, allow_edit: access.allowEdit, is_owner: access.isOwner, shared_by_name: access.sharedByName ?? null };
}

async function loadSharerNames(db: Db, sharerIds: string[]): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(sharerIds.filter(Boolean))];
    const names = new Map<string, string>();
    if (uniqueIds.length === 0) return names;
    try {
        const { data: profiles, error } = await db.from("user_profiles").select("user_id, display_name").in("user_id", uniqueIds);
        if (error) console.warn("[workflows] failed to load sharer profiles", error);
        else for (const profile of profiles ?? []) if (profile.user_id && profile.display_name) names.set(profile.user_id, profile.display_name);
    } catch (err) { console.warn("[workflows] sharer profile lookup threw", err); }
    const missingIds = uniqueIds.filter((id) => !names.has(id));
    const results = await Promise.allSettled(missingIds.map(async (id) => {
        const { data, error } = await db.auth.admin.getUserById(id);
        if (error) throw error;
        return { id, email: data.user?.email ?? null };
    }));
    for (const result of results) {
        if (result.status === "fulfilled" && result.value.email) names.set(result.value.id, result.value.email);
        else if (result.status === "rejected") console.warn("[workflows] failed to load sharer email", result.reason);
    }
    return names;
}

// GET /api/workflows
export async function GET(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? undefined;
    const db = createServerSupabase();

    let ownQuery = db.from("workflows").select("*").eq("user_id", userId).eq("is_system", false).order("created_at", { ascending: false });
    if (type) ownQuery = ownQuery.eq("type", type) as typeof ownQuery;
    const { data: own, error: ownErr } = await ownQuery;
    if (ownErr) return NextResponse.json({ detail: ownErr.message }, { status: 500 });

    const normalizedUserEmail = (userEmail ?? "").trim().toLowerCase();
    const { data: shares } = await db.from("workflow_shares").select("workflow_id, shared_by_user_id, allow_edit").eq("shared_with_email", normalizedUserEmail);

    let sharedWorkflows: Record<string, unknown>[] = [];
    if (shares && shares.length > 0) {
        const sharedIds = shares.map((s) => s.workflow_id);
        let sharedQuery = db.from("workflows").select("*").in("id", sharedIds);
        if (type) sharedQuery = sharedQuery.eq("type", type) as typeof sharedQuery;
        const { data: wfs } = await sharedQuery;
        if (wfs && wfs.length > 0) {
            const sharerIds = [...new Set(shares.map((s) => s.shared_by_user_id).filter(Boolean))];
            const sharerNames = await loadSharerNames(db, sharerIds);
            sharedWorkflows = wfs.map((wf) => {
                const share = shares.find((s) => s.workflow_id === wf.id);
                const sharerId = share?.shared_by_user_id;
                return withWorkflowAccess(wf, { allowEdit: !!share?.allow_edit, isOwner: false, sharedByName: sharerId ? sharerNames.get(sharerId) ?? null : null });
            });
        }
    }

    const ownWithFlag = (own ?? []).map((wf) => withWorkflowAccess(wf, { allowEdit: true, isOwner: true }));
    return NextResponse.json([...ownWithFlag, ...sharedWorkflows]);
}

// POST /api/workflows
export async function POST(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    const { title, type, prompt_md, columns_config, practice } = (await request.json()) as {
        title: string; type: string; prompt_md?: string; columns_config?: unknown; practice?: string | null;
    };
    if (!title?.trim()) return NextResponse.json({ detail: "title is required" }, { status: 400 });
    if (!["assistant", "tabular"].includes(type)) return NextResponse.json({ detail: "type must be 'assistant' or 'tabular'" }, { status: 400 });
    const db = createServerSupabase();
    const { data, error } = await db.from("workflows").insert({ user_id: userId, title: title.trim(), type, prompt_md: prompt_md ?? null, columns_config: columns_config ?? null, practice: practice ?? null, is_system: false }).select("*").single();
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
}
