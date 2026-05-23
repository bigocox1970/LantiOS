import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "./supabase";

export type AuthResult =
    | { ok: true; userId: string; userEmail: string; token: string }
    | { ok: false; response: NextResponse };

export async function requireAuth(request: NextRequest): Promise<AuthResult> {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : "";
    if (!token) {
        return {
            ok: false,
            response: NextResponse.json({ detail: "Unauthorized" }, { status: 401 }),
        };
    }
    const db = createServerSupabase();
    const { data } = await db.auth.getUser(token);
    if (!data.user) {
        return {
            ok: false,
            response: NextResponse.json({ detail: "Unauthorized" }, { status: 401 }),
        };
    }
    return {
        ok: true,
        userId: data.user.id,
        userEmail: data.user.email ?? "",
        token,
    };
}
