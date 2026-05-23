import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { isAdminTier } from "@/lib/server/credits";

const VALID_TIERS = ["Free", "Paid", "Admin"];

async function requireAdmin(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return { ok: false as const, response: auth.response };

    const db = createServerSupabase();
    const { data } = await db
        .from("user_profiles")
        .select("tier")
        .eq("user_id", auth.userId)
        .maybeSingle();

    if (!data || !isAdminTier(data.tier)) {
        return {
            ok: false as const,
            response: NextResponse.json({ detail: "Forbidden" }, { status: 403 }),
        };
    }

    return { ok: true as const, db };
}

// PATCH /api/admin/users/[userId]
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> },
) {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;
    const { db } = admin;
    const { userId } = await params;

    const body = await request.json();
    if (!body || typeof body.tier !== "string" || !VALID_TIERS.includes(body.tier)) {
        return NextResponse.json({ detail: "tier must be one of: Free, Paid, Admin" }, { status: 400 });
    }

    const { error } = await db
        .from("user_profiles")
        .update({ tier: body.tier, updated_at: new Date().toISOString() })
        .eq("user_id", userId);

    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
