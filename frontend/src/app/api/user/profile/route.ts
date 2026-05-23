import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { DEFAULT_TABULAR_MODEL, resolveModel } from "@/lib/server/llm/models";
import { getUserApiKeyStatus } from "@/lib/server/userApiKeys";

const MONTHLY_CREDIT_LIMIT = 999999;

type UserProfileRow = {
    display_name: string | null;
    organisation: string | null;
    assistant_name: string | null;
    message_credits_used: number;
    credits_reset_date: string;
    tier: string;
    tabular_model: string;
};

function serializeProfile(row: UserProfileRow, apiKeyStatus?: unknown) {
    const creditsUsed = row.message_credits_used ?? 0;
    return {
        displayName: row.display_name,
        organisation: row.organisation,
        assistantName: row.assistant_name ?? null,
        messageCreditsUsed: creditsUsed,
        creditsResetDate: row.credits_reset_date,
        creditsRemaining: Math.max(MONTHLY_CREDIT_LIMIT - creditsUsed, 0),
        tier: row.tier || "Free",
        tabularModel: resolveModel(row.tabular_model, DEFAULT_TABULAR_MODEL),
        ...(apiKeyStatus ? { apiKeyStatus } : {}),
    };
}

function validateProfilePayload(body: unknown):
    | { ok: true; update: { display_name?: string | null; organisation?: string | null; assistant_name?: string | null; tabular_model?: string; updated_at: string } }
    | { ok: false; detail: string } {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { ok: false, detail: "Expected a JSON object" };
    }
    const raw = body as Record<string, unknown>;
    const allowedFields = new Set(["displayName", "organisation", "assistantName", "tabularModel"]);
    const invalidField = Object.keys(raw).find((key) => !allowedFields.has(key));
    if (invalidField) return { ok: false, detail: `Unsupported profile field: ${invalidField}` };

    const update: { display_name?: string | null; organisation?: string | null; assistant_name?: string | null; tabular_model?: string; updated_at: string } = {
        updated_at: new Date().toISOString(),
    };

    if ("displayName" in raw) {
        if (raw.displayName !== null && typeof raw.displayName !== "string") {
            return { ok: false, detail: "displayName must be a string or null" };
        }
        update.display_name = raw.displayName?.trim() || null;
    }
    if ("organisation" in raw) {
        if (raw.organisation !== null && typeof raw.organisation !== "string") {
            return { ok: false, detail: "organisation must be a string or null" };
        }
        update.organisation = raw.organisation?.trim() || null;
    }
    if ("assistantName" in raw) {
        if (raw.assistantName !== null && typeof raw.assistantName !== "string") {
            return { ok: false, detail: "assistantName must be a string or null" };
        }
        update.assistant_name = raw.assistantName?.trim() || null;
    }
    if ("tabularModel" in raw) {
        if (typeof raw.tabularModel !== "string") return { ok: false, detail: "tabularModel must be a string" };
        const resolved = resolveModel(raw.tabularModel, "");
        if (!resolved) return { ok: false, detail: "Unsupported tabularModel" };
        update.tabular_model = resolved;
    }
    return { ok: true, update };
}

async function ensureProfileRow(db: ReturnType<typeof createServerSupabase>, userId: string) {
    const { error } = await db
        .from("user_profiles")
        .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
    return error;
}

async function loadProfile(
    db: ReturnType<typeof createServerSupabase>,
    userId: string,
    options: { repairMissing?: boolean } = {},
) {
    let { data, error } = await db
        .from("user_profiles")
        .select("display_name, organisation, assistant_name, message_credits_used, credits_reset_date, tier, tabular_model")
        .eq("user_id", userId)
        .maybeSingle();

    if (error) return { data: null, error };
    if (!data) {
        if (!options.repairMissing) return { data: null, error: new Error("Profile not found") };
        const ensureError = await ensureProfileRow(db, userId);
        if (ensureError) return { data: null, error: ensureError };
        const created = await db
            .from("user_profiles")
            .select("display_name, organisation, assistant_name, message_credits_used, credits_reset_date, tier, tabular_model")
            .eq("user_id", userId)
            .single();
        if (created.error) return { data: null, error: created.error };
        data = created.data;
    }

    let row = data as UserProfileRow;
    if (row.credits_reset_date && new Date() > new Date(row.credits_reset_date)) {
        const creditsResetDate = new Date();
        creditsResetDate.setDate(creditsResetDate.getDate() + 30);
        const { data: resetData, error: resetError } = await db
            .from("user_profiles")
            .update({ message_credits_used: 0, credits_reset_date: creditsResetDate.toISOString(), updated_at: new Date().toISOString() })
            .eq("user_id", userId)
            .select("display_name, organisation, assistant_name, message_credits_used, credits_reset_date, tier, tabular_model")
            .single();
        if (resetError) return { data: null, error: resetError };
        row = resetData as UserProfileRow;
    }

    return { data: serializeProfile(row), error: null };
}

// POST /api/user/profile — ensure profile row exists
export async function POST(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    const db = createServerSupabase();
    const error = await ensureProfileRow(db, userId);
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}

// GET /api/user/profile
export async function GET(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    const db = createServerSupabase();
    const { data, error } = await loadProfile(db, userId, { repairMissing: true });
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    const apiKeyStatus = await getUserApiKeyStatus(userId, db);
    return NextResponse.json({ ...data, apiKeyStatus });
}

// PATCH /api/user/profile
export async function PATCH(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    const body = await request.json();
    const parsed = validateProfilePayload(body);
    if (!parsed.ok) return NextResponse.json({ detail: parsed.detail }, { status: 400 });

    const db = createServerSupabase();
    const ensureError = await ensureProfileRow(db, userId);
    if (ensureError) return NextResponse.json({ detail: ensureError.message }, { status: 500 });

    const { error: updateError } = await db
        .from("user_profiles")
        .update(parsed.update)
        .eq("user_id", userId);
    if (updateError) return NextResponse.json({ detail: updateError.message }, { status: 500 });

    const { data, error } = await loadProfile(db, userId);
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    const apiKeyStatus = await getUserApiKeyStatus(userId, db);
    return NextResponse.json({ ...data, apiKeyStatus });
}
