"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { PublicLayout } from "@/components/public-layout";
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
        <PublicLayout>
            <div className="relative flex flex-col items-center justify-center px-6 py-12 md:py-20 text-center overflow-hidden">

                {/* Background orbs */}
                <div className="absolute -top-32 -left-24 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" style={{ animation: 'floatOrb 14s ease-in-out infinite' }} />
                <div className="absolute -bottom-24 -right-16 w-80 h-80 rounded-full bg-primary/8 blur-3xl pointer-events-none" style={{ animation: 'floatOrbSlow 18s ease-in-out infinite 2s' }} />
                <div className="absolute top-1/3 right-[8%] w-56 h-56 rounded-full bg-primary/6 blur-2xl pointer-events-none" style={{ animation: 'floatOrb 11s ease-in-out infinite 1s' }} />
                <div className="absolute bottom-1/4 left-[12%] w-40 h-40 rounded-full bg-primary/8 blur-2xl pointer-events-none" style={{ animation: 'floatOrbSlow 16s ease-in-out infinite 3s' }} />

                <div className="max-w-3xl mx-auto relative">
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-normal font-fraunces leading-tight tracking-tight mb-6">
                        Your private<br />
                        <span className="italic text-primary">AI legal</span> assistant
                    </h1>

                    <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-10 font-body leading-relaxed">
                        Upload documents, ask questions, and get accurate legal analysis — all in a secure, private workspace built for legal professionals.
                    </p>

                    <div className="flex justify-center">
                        <Link
                            href="/signup"
                            className="inline-flex items-center justify-center bg-primary text-primary-foreground px-8 py-3 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                        >
                            Get started for free
                        </Link>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto mt-16 text-left">
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
                            className="group bg-card border border-border rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg hover:shadow-primary/10 hover:border-primary/30"
                        >
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-4 transition-colors duration-300 group-hover:bg-primary/20">
                                <Icon className="w-4.5 h-4.5 text-primary" strokeWidth={1.5} />
                            </div>
                            <h3 className="text-sm font-semibold text-foreground mb-1.5">{title}</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed font-body">{desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </PublicLayout>
    );
}
