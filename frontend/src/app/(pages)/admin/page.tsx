"use client";

import { useEffect, useState } from "react";
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

    const select = async (tier: string) => {
        if (tier === current) { setOpen(false); return; }
        setSaving(true);
        setOpen(false);
        await onChange(userId, tier);
        setSaving(false);
    };

    return (
        <div className="relative inline-block" style={{ isolation: "isolate" }}>
            <button
                onClick={() => setOpen((v) => !v)}
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
            {open && (
                <div className="absolute left-0 top-full mt-1 z-[9999] w-28 rounded-xl border border-border/60 bg-card shadow-lg overflow-hidden">
                    {TIERS.map((tier) => (
                        <button
                            key={tier}
                            onClick={() => select(tier)}
                            className="flex items-center justify-between w-full px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                        >
                            {tier}
                            {tier === current && <Check className="h-3 w-3" />}
                        </button>
                    ))}
                </div>
            )}
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
