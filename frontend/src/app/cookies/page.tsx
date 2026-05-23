import { PublicLayout } from "@/components/public-layout";

export const metadata = {
    title: "Cookie Policy — Lanti OS",
};

export default function CookiesPage() {
    return (
        <PublicLayout>
            <div className="max-w-2xl mx-auto px-6 py-16">
                <h1 className="text-4xl font-normal font-fraunces mb-2">Cookie Policy</h1>
                <p className="text-sm text-muted-foreground font-body mb-10">Last updated: May 2026</p>

                <div className="font-body text-foreground space-y-8">

                    <section>
                        <h2 className="text-lg font-semibold mb-3">What are cookies?</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Cookies are small files stored in your browser. This platform uses a combination of browser cookies and <em>localStorage</em> (a similar local storage mechanism) to function correctly.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold mb-3">What we use and why</h2>
                        <div className="space-y-4">

                            <div className="border border-border rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-semibold">Authentication session</h3>
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Essential</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Set by Supabase to keep you logged in. Without this cookie the platform cannot verify your identity and you would be signed out on every page load.
                                </p>
                            </div>

                            <div className="border border-border rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-semibold">Theme preference</h3>
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Essential</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Stored as <code className="text-foreground">lanti-theme</code> in localStorage. Remembers whether you prefer light or dark mode.
                                </p>
                            </div>

                            <div className="border border-border rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-semibold">Voice preferences</h3>
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Essential</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Stored as <code className="text-foreground">lanti-voice-id</code> and <code className="text-foreground">lanti-voice-speed</code> in localStorage. Remembers your text-to-speech voice and speed selections.
                                </p>
                            </div>

                            <div className="border border-border rounded-xl p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-semibold">Cookie consent</h3>
                                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Essential</span>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Stored as <code className="text-foreground">lanti-cookie-consent</code> in localStorage. Records that you have acknowledged this policy so the banner is not shown on every visit.
                                </p>
                            </div>

                        </div>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold mb-3">What we do not use</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            We do not use any tracking, analytics, advertising, or third-party marketing cookies. No data from your use of this platform is shared with advertising networks or used to build any profile of you for commercial purposes.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold mb-3">Managing cookies</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            You can clear cookies and localStorage at any time through your browser settings. Note that clearing authentication cookies will sign you out, and clearing other stored values will reset your preferences to defaults.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold mb-3">Contact</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            If you have any questions about how we use cookies, contact us at <a href="mailto:perimeter.uk@gmail.com" className="text-foreground underline underline-offset-2">perimeter.uk@gmail.com</a>.
                        </p>
                    </section>

                </div>
            </div>
        </PublicLayout>
    );
}
