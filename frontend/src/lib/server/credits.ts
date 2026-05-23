import type { createServerSupabase } from "./supabase";

const TIER_LIMITS: Record<string, number> = {
    Free: 50,
};

function tierLimit(tier: string): number {
    return TIER_LIMITS[tier] ?? Infinity;
}

export async function checkAndConsumeCredit(
    userId: string,
    db: ReturnType<typeof createServerSupabase>,
): Promise<{ ok: true } | { ok: false; detail: string; status: 402 }> {
    const { data, error } = await db
        .from("user_profiles")
        .select("message_credits_used, tier, credits_reset_date")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) {
        return { ok: false, detail: "Could not load user profile", status: 402 };
    }

    const tier = (data?.tier as string) ?? "Free";
    const limit = tierLimit(tier);
    const used = (data?.message_credits_used as number) ?? 0;

    if (used >= limit) {
        const resetDate = data?.credits_reset_date as string | null;
        const daysLeft = resetDate
            ? Math.max(1, Math.ceil((new Date(resetDate).getTime() - Date.now()) / 86_400_000))
            : 30;
        return {
            ok: false,
            detail: `Monthly credit limit reached (${limit} messages). Credits reset in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`,
            status: 402,
        };
    }

    await db
        .from("user_profiles")
        .update({
            message_credits_used: used + 1,
            updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

    return { ok: true };
}

export function isAdminTier(tier: string): boolean {
    return tier === "Admin";
}
