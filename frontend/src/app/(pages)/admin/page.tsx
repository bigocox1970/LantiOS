"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { adminListUsers, adminUpdateUserTier, type AdminUser } from "@/app/lib/mikeApi";
import { Loader2, ChevronDown, Check } from "lucide-react";

const TIERS = ["Free", "Paid", "Admin"];

function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

function TierDropdown({
    userId,
    current,
    onChange,
}: {
    userId: string;
    current: string;
    onChange: (userId: string, tier: string) => Promise<void>;
}) {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
    const btnRef = useRef<HTMLButtonElement>(null);

    const openMenu = () => {
        if (!btnRef.current) return;
        const rect = btnRef.current.getBoundingClientRect();
        setMenuStyle({
            position: "fixed",
            top: rect.bottom + 4,
            left: rect.left,
            zIndex: 99999,
        });
        setOpen(true);
    };

    useEffect(() => {
        if (!open) return;
        const close = () => setOpen(false);
        document.addEventListener("mousedown", close);
        return () => document.removeEventListener("mousedown", close);
    }, [open]);

    const select = async (tier: string) => {
        setOpen(false);
        if (tier === current) return;
        setSaving(true);
        await onChange(userId, tier);
        setSaving(false);
    };

    const menu = open ? createPortal(
        <div
            style={menuStyle}
            className="w-28 rounded-xl border border-border bg-card shadow-xl overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
        >
            {TIERS.map((tier) => (
                <button
                    key={tier}
                    onClick={() => select(tier)}
                    className="flex items-center justify-between w-full px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                >
                    {tier}
                    {tier === current && <Check className="h-3 w-3 text-primary" />}
                </button>
            ))}
        </div>,
        document.body
    ) : null;

    return (
        <div className="inline-flex items-center">
            <button
                ref={btnRef}
                onClick={openMenu}
                disabled={saving}
                className="flex items-center gap-1 text-xs font-medium text-foreground/80 hover:text-foreground transition-colors disabled:opacity-40"
            >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    current === "Admin"
                        ? "bg-primary/15 text-primary"
                        : current === "Paid"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                }`}>
                    {current}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
            {menu}
        </div>
    );
}

export default function AdminPage() {
    const router = useRouter();
    const { profile, loading: profileLoading } = useUserProfile();
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!profileLoading && profile && !profile.isAdmin) {
            router.replace("/");
        }
    }, [profile, profileLoading, router]);

    useEffect(() => {
        if (!profileLoading && profile?.isAdmin) {
            adminListUsers()
                .then(setUsers)
                .finally(() => setLoading(false));
        }
    }, [profile, profileLoading]);

    const handleTierChange = async (userId: string, tier: string) => {
        await adminUpdateUserTier(userId, tier);
        setUsers((prev) =>
            prev.map((u) => (u.userId === userId ? { ...u, tier } : u)),
        );
    };

    if (profileLoading || (!profile?.isAdmin && !profileLoading)) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-background">
            <div className="mb-1 flex items-center justify-between px-4 py-3 md:px-10">
                <h1 className="text-2xl font-medium font-serif text-foreground">
                    User Management
                </h1>
                <span className="text-xs text-muted-foreground">
                    {users.length} user{users.length !== 1 ? "s" : ""}
                </span>
            </div>

            <div className="w-full overflow-x-auto px-4 md:px-10">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : users.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-10">No users found.</p>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-border text-xs text-muted-foreground font-medium h-10">
                                <th className="text-left pb-2 pr-4">Email</th>
                                <th className="text-left pb-2 pr-4 w-32">Tier</th>
                                <th className="text-left pb-2 pr-4 w-28">Credits used</th>
                                <th className="text-left pb-2 pr-4 w-32">Resets</th>
                                <th className="text-left pb-2 w-32">Joined</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr
                                    key={u.userId}
                                    className="border-b border-border/40 h-10 hover:bg-muted/30 transition-colors"
                                >
                                    <td className="pr-4 text-foreground/90 truncate max-w-xs">
                                        {u.email}
                                    </td>
                                    <td className="pr-4">
                                        <TierDropdown
                                            userId={u.userId}
                                            current={u.tier}
                                            onChange={handleTierChange}
                                        />
                                    </td>
                                    <td className="pr-4 text-muted-foreground">
                                        {u.messageCreditsUsed}
                                    </td>
                                    <td className="pr-4 text-muted-foreground">
                                        {formatDate(u.creditsResetDate)}
                                    </td>
                                    <td className="text-muted-foreground">
                                        {formatDate(u.createdAt)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
