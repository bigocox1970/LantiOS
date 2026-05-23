import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { createServerSupabase } from "@/lib/server/supabase";
import { checkProjectAccess } from "@/lib/server/access";

type AccessibleChat = { id: string; title: string | null; user_id: string; project_id: string | null } & Record<string, unknown>;

async function getAccessibleChat(
    chatId: string,
    userId: string,
    userEmail: string | null | undefined,
    db: ReturnType<typeof createServerSupabase>,
): Promise<AccessibleChat | null> {
    const { data: chat, error } = await db.from("chats").select("*").eq("id", chatId).maybeSingle();
    if (error || !chat) return null;
    const row = chat as AccessibleChat;
    if (row.user_id === userId) return row;
    if (row.project_id) {
        const access = await checkProjectAccess(row.project_id, userId, userEmail, db);
        if (access.ok) return row;
    }
    return null;
}

// GET /api/chat/[chatId]
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ chatId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId, userEmail } = auth;
    const { chatId } = await params;
    const db = createServerSupabase();

    const chat = await getAccessibleChat(chatId, userId, userEmail, db);
    if (!chat) return NextResponse.json({ detail: "Chat not found" }, { status: 404 });

    const { data: messages } = await db
        .from("chat_messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

    const hydrated = await hydrateEditStatuses(messages ?? [], db);
    return NextResponse.json({ chat, messages: hydrated });
}

// PATCH /api/chat/[chatId]
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ chatId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    const { chatId } = await params;
    const body = (await request.json()) as { title?: unknown };
    const title = (typeof body.title === "string" ? body.title : "").trim();
    if (!title) return NextResponse.json({ detail: "title is required" }, { status: 400 });

    const db = createServerSupabase();
    const { data, error } = await db
        .from("chats")
        .update({ title })
        .eq("id", chatId)
        .eq("user_id", userId)
        .select("id, title")
        .single();

    if (error || !data) return NextResponse.json({ detail: "Chat not found" }, { status: 404 });
    return NextResponse.json(data);
}

// DELETE /api/chat/[chatId]
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ chatId: string }> },
) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;
    const { userId } = auth;
    const { chatId } = await params;
    const db = createServerSupabase();
    const { error } = await db.from("chats").delete().eq("id", chatId).eq("user_id", userId);
    if (error) return NextResponse.json({ detail: error.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
}

async function hydrateEditStatuses(
    messages: Record<string, unknown>[],
    db: ReturnType<typeof createServerSupabase>,
): Promise<Record<string, unknown>[]> {
    const editIds = new Set<string>();
    const versionIds = new Set<string>();
    const collectFromAnnList = (list: unknown) => {
        if (!Array.isArray(list)) return;
        for (const a of list as Record<string, unknown>[]) {
            if (typeof a?.edit_id === "string") editIds.add(a.edit_id);
            if (typeof a?.version_id === "string") versionIds.add(a.version_id);
        }
    };
    for (const m of messages) {
        collectFromAnnList(m.annotations);
        if (Array.isArray(m.content)) {
            for (const ev of m.content as Record<string, unknown>[]) {
                if (ev?.type === "doc_edited") {
                    collectFromAnnList(ev.annotations);
                    if (typeof ev.version_id === "string") versionIds.add(ev.version_id);
                }
            }
        }
    }
    if (editIds.size === 0 && versionIds.size === 0) return messages;

    const statusById = new Map<string, "pending" | "accepted" | "rejected">();
    if (editIds.size > 0) {
        const { data: rows } = await db
            .from("document_edits")
            .select("id, status")
            .in("id", Array.from(editIds));
        for (const r of (rows ?? []) as { id: string; status: string }[]) {
            if (r.status === "pending" || r.status === "accepted" || r.status === "rejected") {
                statusById.set(r.id, r.status);
            }
        }
    }

    const versionNumberById = new Map<string, number | null>();
    if (versionIds.size > 0) {
        const { data: vrows } = await db
            .from("document_versions")
            .select("id, version_number")
            .in("id", Array.from(versionIds));
        for (const r of (vrows ?? []) as { id: string; version_number: number | null }[]) {
            versionNumberById.set(r.id, r.version_number ?? null);
        }
    }

    const patchAnnList = (list: unknown): unknown => {
        if (!Array.isArray(list)) return list;
        return (list as Record<string, unknown>[]).map((a) => {
            let next = a;
            if (typeof a?.edit_id === "string" && statusById.has(a.edit_id)) {
                next = { ...next, status: statusById.get(a.edit_id) };
            }
            if (typeof a?.version_id === "string" && versionNumberById.has(a.version_id)) {
                next = { ...next, version_number: versionNumberById.get(a.version_id) ?? null };
            }
            return next;
        });
    };

    return messages.map((m) => {
        const next: Record<string, unknown> = { ...m };
        next.annotations = patchAnnList(m.annotations);
        if (Array.isArray(m.content)) {
            next.content = (m.content as Record<string, unknown>[]).map((ev) => {
                if (ev?.type !== "doc_edited") return ev;
                let patched: Record<string, unknown> = { ...ev, annotations: patchAnnList(ev.annotations) };
                if (typeof ev.version_id === "string" && versionNumberById.has(ev.version_id)) {
                    patched = { ...patched, version_number: versionNumberById.get(ev.version_id) ?? null };
                }
                return patched;
            });
        }
        return next;
    });
}
