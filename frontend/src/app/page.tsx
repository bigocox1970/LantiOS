"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { PublicLayout } from "@/components/public-layout";
import { FileText, MessageSquare, FolderOpen, Workflow, Quote, FileOutput, ListChecks } from "lucide-react";

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
                        <span className="italic text-primary">legal</span> workspace
                    </h1>

                    <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-10 font-body leading-relaxed">
                        AI-powered research, document analysis, and case organisation — built for legal professionals.
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

                {/* How it Works */}
                <div className="w-full max-w-4xl mx-auto mt-24 mb-4 text-left">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-normal font-fraunces tracking-tight mb-4">
                            Built for legal work,<br className="hidden sm:block" /> not general chat
                        </h2>
                        <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto font-body leading-relaxed">
                            While Lanti OS may feel like a familiar AI chat interface, it operates very differently under the hood.
                            Every response is grounded in your uploaded documents, and every document it produces meets professional legal standards.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
                        {[
                            {
                                icon: Quote,
                                title: "Precision Citations",
                                body: "Every claim Lanti OS makes about your documents is backed by a verbatim quote and a specific page number — so you can verify its work instantly. It cannot paraphrase or invent content from a document you've uploaded.",
                            },
                            {
                                icon: FileOutput,
                                title: "Professional Document Output",
                                body: "Rather than pasting text into the chat window, Lanti OS generates properly formatted Word (.docx) files — with legal clause numbering, heading hierarchies, signature blocks on new pages, and tracked changes for redlines.",
                            },
                            {
                                icon: ListChecks,
                                title: "Structured Workflows",
                                body: "Workflows are pre-built instruction sets for repeatable legal tasks: reviewing an MSA, drafting a memo, running a compliance check. Select one and the system follows a defined procedure — not a freeform guess.",
                            },
                        ].map(({ icon: Icon, title, body }) => (
                            <div key={title} className="bg-card border border-border rounded-2xl p-6">
                                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                                    <Icon className="w-4.5 h-4.5 text-primary" strokeWidth={1.5} />
                                </div>
                                <h3 className="text-sm font-semibold text-foreground mb-2">{title}</h3>
                                <p className="text-xs text-muted-foreground leading-relaxed font-body">{body}</p>
                            </div>
                        ))}
                    </div>

                    {/* Comparison callout */}
                    <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
                        <h3 className="text-lg font-semibold font-fraunces text-foreground mb-4">
                            How it differs from Claude or ChatGPT
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-3">
                            {[
                                ["General AI", "Lanti OS"],
                                ["Summarises documents from memory or uploaded text", "Reads your document with specialised tools and cites exact page references"],
                                ["Generates text in the chat window", "Produces formatted Word files with legal numbering and signature blocks"],
                                ["Freeform instructions each time", "Structured Workflows guide complex, repeatable tasks step by step"],
                                ["No document cross-reference awareness", "Automatically renumbers clauses and updates cross-references when a section changes"],
                            ].map(([general, lanti], i) =>
                                i === 0 ? (
                                    <div key="header" className="contents">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-1 border-b border-border">General AI</p>
                                        <p className="text-xs font-semibold text-primary uppercase tracking-wide pb-1 border-b border-border">Lanti OS</p>
                                    </div>
                                ) : (
                                    <div key={general} className="contents">
                                        <p className="text-xs text-muted-foreground font-body py-2 border-b border-border/50">{general}</p>
                                        <p className="text-xs text-foreground/80 font-body py-2 border-b border-border/50">{lanti}</p>
                                    </div>
                                )
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </PublicLayout>
    );
}
