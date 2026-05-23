import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { getUserApiKeyStatus } from "@/lib/server/userApiKeys";

// GET /api/user/api-keys
export async function GET(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    const db = createServerSupabase();
    const status = await getUserApiKeyStatus(userId, db);
    return NextResponse.json(status);
}
