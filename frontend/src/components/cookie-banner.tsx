"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export function CookieBanner() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const consent = localStorage.getItem("lanti-cookie-consent");
        if (!consent) setVisible(true);
    }, []);

    const accept = () => {
        localStorage.setItem("lanti-cookie-consent", "accepted");
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
            <div className="max-w-3xl mx-auto bg-card border border-border rounded-2xl shadow-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <p className="text-sm text-muted-foreground font-body flex-1 leading-relaxed">
                    This site uses essential cookies for authentication and stores your preferences locally.
                    No tracking or advertising cookies are used.{" "}
                    <Link href="/cookies" className="text-foreground underline underline-offset-2 hover:text-primary transition-colors">
                        Cookie policy
                    </Link>
                </p>
                <button
                    onClick={accept}
                    className="shrink-0 bg-primary text-primary-foreground px-5 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                >
                    Accept
                </button>
            </div>
        </div>
    );
}
