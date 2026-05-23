"use client";

import Link from "next/link";
import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon } from "lucide-react";

export function PublicLayout({ children }: { children: React.ReactNode }) {
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="min-h-dvh bg-background text-foreground flex flex-col">
            <header className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-border/50">
                <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <img src="/favicon-96x96.png" alt="Lanti OS" width={32} height={32} className="rounded-sm" />
                    <span className="text-xl font-normal font-fraunces">
                        <span className="italic">Lanti</span> OS
                    </span>
                </Link>
                <div className="flex items-center gap-4">
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        aria-label="Toggle theme"
                    >
                        {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    </button>
                    <Link
                        href="/login"
                        className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Log in
                    </Link>
                </div>
            </header>

            <main className="flex-1">
                {children}
            </main>

            <footer className="px-6 md:px-12 py-6 border-t border-border/50">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground font-body text-center sm:text-left">
                        Lanti OS is a private instance. Do not upload privileged or client-identifying documents.
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Use</Link>
                        <Link href="/cookies" className="hover:text-foreground transition-colors">Cookie Policy</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
