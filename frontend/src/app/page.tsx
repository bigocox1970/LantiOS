"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, MessageSquare, FolderOpen, Workflow } from "lucide-react";

export default function LandingPage() {
    const router = useRouter();
    const { isAuthenticated, authLoading } = useAuth();

    useEffect(() => {
        if (!authLoading && isAuthenticated) {
            router.replace("/assistant");
        }
    }, [authLoading, isAuthenticated, router]);

    return (
        <div className="min-h-dvh bg-background text-foreground flex flex-col">

            {/* Nav */}
            <header className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-border/50">
                <div className="flex items-center gap-3">
                    <img
                        src="/favicon-96x96.png"
                        alt="Lanti OS"
                        width={32}
                        height={32}
                        className="rounded-sm"
                    />
                    <span className="text-xl font-normal font-fraunces">
                        <span className="italic">Lanti</span> OS
                    </span>
                </div>
                <Link
                    href="/login"
                    className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                    Log in
                </Link>
            </header>

            {/* Hero */}
            <main className="flex-1 flex flex-col items-center justify-center px-6 py-20 md:py-32 text-center">
                <div className="max-w-3xl mx-auto">

                    <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-medium px-3 py-1.5 rounded-full mb-8 border border-primary/20">
                        Private · Secure · AI-powered
                    </div>

                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-normal font-fraunces leading-tight tracking-tight mb-6">
                        Your private<br />
                        <span className="italic text-primary">AI legal</span> assistant
                    </h1>

                    <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-10 font-body leading-relaxed">
                        Upload documents, ask questions, and get accurate legal analysis — all in a secure, private workspace built for legal professionals.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                            href="/login"
                            className="inline-flex items-center justify-center bg-primary text-primary-foreground px-8 py-3 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                        >
                            Log in
                        </Link>
                        <Link
                            href="/signup"
                            className="inline-flex items-center justify-center bg-muted text-foreground px-8 py-3 rounded-xl text-sm font-medium hover:bg-muted/80 transition-colors border border-border"
                        >
                            Get started
                        </Link>
                    </div>
                </div>

                {/* Features */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto mt-24 text-left">
                    {[
                        {
                            icon: FileText,
                            title: "Document Analysis",
                            desc: "Upload contracts, briefs, and case files. Get instant AI-powered analysis and summaries.",
                        },
                        {
                            icon: MessageSquare,
                            title: "Legal Research",
                            desc: "Ask questions in plain English and receive accurate, context-aware legal answers.",
                        },
                        {
                            icon: FolderOpen,
                            title: "Projects",
                            desc: "Organise matters, documents, and conversations into structured project workspaces.",
                        },
                        {
                            icon: Workflow,
                            title: "Workflows",
                            desc: "Automate repetitive review tasks with customisable multi-step AI workflows.",
                        },
                    ].map(({ icon: Icon, title, desc }) => (
                        <div
                            key={title}
                            className="bg-card border border-border rounded-2xl p-5"
                        >
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                                <Icon className="w-4.5 h-4.5 text-primary" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-sm font-semibold text-foreground mb-1.5">{title}</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed font-body">{desc}</p>
                        </div>
                    ))}
                </div>
            </main>

            {/* Footer */}
            <footer className="px-6 md:px-12 py-6 border-t border-border/50 text-center">
                <p className="text-xs text-muted-foreground font-body">
                    Lanti OS is a private instance for legal document analysis. Do not upload sensitive, privileged, or client-identifying documents.
                </p>
            </footer>

        </div>
    );
}
