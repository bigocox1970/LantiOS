import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { getUserApiKeyStatus, hasEnvApiKey, normalizeApiKeyProvider, saveUserApiKey } from "@/lib/server/userApiKeys";

// PUT /api/user/api-keys/[provider]
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ provider: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    const { provider: rawProvider } = await params;
    const provider = normalizeApiKeyProvider(rawProvider);
    if (!provider) return NextResponse.json({ detail: "Unsupported provider" }, { status: 400 });

    const body = (await request.json()) as { api_key?: unknown };
    const apiKey = typeof body?.api_key === "string" ? body.api_key : null;

    const db = createServerSupabase();
    try {
        if (hasEnvApiKey(provider)) {
            return NextResponse.json(
                { detail: "This provider is configured by the server environment and cannot be changed from the browser." },
                { status: 409 },
            );
        }
        await saveUserApiKey(userId, provider, apiKey, db);
        const status = await getUserApiKeyStatus(userId, db);
        return NextResponse.json(status);
    } catch (err) {
        console.error("[user/api-keys] save failed", { provider, error: err instanceof Error ? err.message : String(err) });
        return NextResponse.json({ detail: "Failed to save API key" }, { status: 500 });
    }
}
