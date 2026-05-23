import Link from "next/link";

export const metadata = {
    title: "Terms of Use — Lanti OS",
};

export default function TermsPage() {
    return (
        <div className="min-h-dvh bg-background text-foreground">
            <header className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-border/50">
                <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                    <img src="/favicon-96x96.png" alt="Lanti OS" width={28} height={28} className="rounded-sm" />
                    <span className="text-lg font-normal font-fraunces">
                        <span className="italic">Lanti</span> OS
                    </span>
                </Link>
            </header>

            <main className="max-w-2xl mx-auto px-6 py-16">
                <h1 className="text-4xl font-normal font-fraunces mb-2">Terms of Use</h1>
                <p className="text-sm text-muted-foreground font-body mb-10">Last updated: May 2026</p>

                <div className="prose prose-sm max-w-none font-body text-foreground space-y-8">

                    <section>
                        <h2 className="text-lg font-semibold mb-3">1. Access and eligibility</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Lanti OS is a private platform. Access is granted by invitation only. By using this platform you confirm that you have been authorised to do so and that you will use it solely for lawful purposes.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold mb-3">2. Not legal advice</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Lanti OS is a tool to assist legal professionals with research and document analysis. Nothing produced by this platform constitutes legal advice. All output should be reviewed and verified by a qualified legal professional before reliance. The platform operators accept no liability for any action taken or not taken based on the platform&apos;s output.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold mb-3">3. Acceptable use</h2>
                        <p className="text-muted-foreground leading-relaxed mb-3">You agree not to:</p>
                        <ul className="text-muted-foreground leading-relaxed space-y-2 list-disc list-inside">
                            <li>Upload documents subject to legal professional privilege without appropriate authority.</li>
                            <li>Upload, submit, or store sensitive, confidential, or personally identifiable information belonging to clients or third parties.</li>
                            <li>Attempt to circumvent any security measure or access control.</li>
                            <li>Use the platform for any unlawful purpose or in violation of any applicable regulation.</li>
                            <li>Share your account credentials with any other person.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold mb-3">4. Intellectual property</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            You retain ownership of all documents and content you upload. By uploading content you grant the platform a limited licence to process that content solely for the purpose of providing the service to you.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold mb-3">5. Availability and warranty</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            The platform is provided &quot;as is&quot; without warranty of any kind. We do not guarantee uninterrupted availability or that AI-generated output will be accurate, complete, or free from error. Planned or unplanned downtime may occur without notice.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold mb-3">6. Limitation of liability</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            To the fullest extent permitted by law, the platform operators shall not be liable for any direct, indirect, incidental, or consequential loss or damage arising from your use of or reliance on the platform or its output.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold mb-3">7. Termination</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            We reserve the right to suspend or terminate access at any time, without notice, if we reasonably believe these terms have been breached or for any operational reason.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold mb-3">8. Governing law</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            These terms are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.
                        </p>
                    </section>

                </div>
            </main>

            <footer className="px-6 md:px-12 py-6 border-t border-border/50 text-center">
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
                    <Link href="/cookies" className="hover:text-foreground transition-colors">Cookie Policy</Link>
                    <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
                </div>
            </footer>
        </div>
    );
}
