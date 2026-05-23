import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { ensureReviewAccess } from "@/lib/server/access";

// GET /api/tabular-review/[reviewId]/people
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ reviewId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { reviewId } = await params;
    const db = createServerSupabase();

    const { data: review } = await db.from("tabular_reviews").select("id, user_id, project_id, shared_with").eq("id", reviewId).single();
    if (!review) return NextResponse.json({ detail: "Review not found" }, { status: 404 });
    const access = await ensureReviewAccess(review, userId, userEmail, db);
    if (!access.ok) return NextResponse.json({ detail: "Review not found" }, { status: 404 });

    const sharedWith: string[] = (Array.isArray(review.shared_with) ? (review.shared_with as string[]) : []).map((e) => (e ?? "").toLowerCase());

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

    const profileIds = [review.user_id as string, ...memberUserIds].filter((x, i, arr) => arr.indexOf(x) === i);
    const profileByUserId = new Map<string, string | null>();
    if (profileIds.length > 0) {
        const { data: profiles } = await db.from("user_profiles").select("user_id, display_name").in("user_id", profileIds);
        for (const p of profiles ?? []) {
            profileByUserId.set(p.user_id as string, (p.display_name as string | null) ?? null);
        }
    }

    const ownerInfo = userById.get(review.user_id as string);
    return NextResponse.json({
        owner: { user_id: review.user_id, email: ownerInfo?.email ?? null, display_name: profileByUserId.get(review.user_id as string) ?? null },
        members: sharedWith.map((email) => {
            const u = userByEmail.get(email);
            const display_name = u ? (profileByUserId.get(u.id) ?? null) : null;
            return { email, display_name };
        }),
    });
}
