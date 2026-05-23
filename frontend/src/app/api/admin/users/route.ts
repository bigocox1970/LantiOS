import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { isAdminTier } from "@/lib/server/credits";

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

    return { ok: true as const, userId: auth.userId, db };
}

// GET /api/admin/users
export async function GET(request: NextRequest) {
    const admin = await requireAdmin(request);
    if (!admin.ok) return admin.response;
    const { db } = admin;

    const { data: profiles, error } = await db
        .from("user_profiles")
        .select("user_id, tier, message_credits_used, credits_reset_date, updated_at")
        .order("updated_at", { ascending: false });

    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });

    const { data: authUsers } = await db.auth.admin.listUsers({ perPage: 1000 });

    const emailMap = new Map<string, { email: string; createdAt: string }>();
    for (const u of authUsers?.users ?? []) {
        emailMap.set(u.id, { email: u.email ?? "", createdAt: u.created_at });
    }

    const rows = (profiles ?? []).map((p) => {
        const auth = emailMap.get(p.user_id) ?? { email: "unknown", createdAt: "" };
        return {
            userId: p.user_id,
            email: auth.email,
            tier: p.tier ?? "Free",
            messageCreditsUsed: p.message_credits_used ?? 0,
            creditsResetDate: p.credits_reset_date ?? null,
            createdAt: auth.createdAt,
        };
    });

    return NextResponse.json(rows);
}
