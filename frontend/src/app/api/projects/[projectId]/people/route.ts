import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";

// GET /api/projects/[projectId]/people
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { projectId } = await params;
    const db = createServerSupabase();

    const { data: project } = await db
        .from("projects")
        .select("id, user_id, shared_with")
        .eq("id", projectId)
        .single();
    if (!project) return NextResponse.json({ detail: "Project not found" }, { status: 404 });

    const isOwner = project.user_id === userId;
    const sharedWith = (Array.isArray(project.shared_with) ? (project.shared_with as string[]) : []).map((e) =>
        e.toLowerCase(),
    );
    const isShared = !!userEmail && sharedWith.includes(userEmail.toLowerCase());
    if (!isOwner && !isShared) return NextResponse.json({ detail: "Project not found" }, { status: 404 });

    const { data: usersData } = await db.auth.admin.listUsers({ perPage: 1000 });
    const allUsers = usersData?.users ?? [];
    const userByEmail = new Map<string, { id: string; email: string }>();
    const userById = new Map<string, { id: string; email: string }>();
    for (const u of allUsers) {
        if (!u.email) continue;
        const lower = u.email.toLowerCase();
        userByEmail.set(lower, { id: u.id, email: u.email });
        userById.set(u.id, { id: u.id, email: u.email });
    }

    const memberUserIds: string[] = [];
    for (const email of sharedWith) {
        const u = userByEmail.get(email);
        if (u) memberUserIds.push(u.id);
    }

    const profileIds = [project.user_id as string, ...memberUserIds].filter((x, i, arr) => arr.indexOf(x) === i);
    const profileByUserId = new Map<string, { display_name: string | null; organisation: string | null }>();
    if (profileIds.length > 0) {
        const { data: profiles } = await db
            .from("user_profiles")
            .select("user_id, display_name, organisation")
            .in("user_id", profileIds);
        for (const p of profiles ?? []) {
            profileByUserId.set(p.user_id as string, {
                display_name: (p.display_name as string | null) ?? null,
                organisation: (p.organisation as string | null) ?? null,
            });
        }
    }

    const ownerInfo = userById.get(project.user_id as string);
    const owner = {
        user_id: project.user_id,
        email: ownerInfo?.email ?? null,
        display_name: profileByUserId.get(project.user_id as string)?.display_name ?? null,
    };
    const members = sharedWith.map((email) => {
        const u = userByEmail.get(email);
        const display_name = u ? profileByUserId.get(u.id)?.display_name ?? null : null;
        return { email, display_name };
    });

    return NextResponse.json({ owner, members });
}
