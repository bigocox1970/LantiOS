import Link from "next/link";

export const metadata = {
    title: "Privacy Policy — Lanti OS",
};

export default function PrivacyPage() {
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
                <h1 className="text-4xl font-normal font-fraunces mb-2">Privacy Policy</h1>
                <p className="text-sm text-muted-foreground font-body mb-10">Last updated: May 2026</p>

                <div className="prose prose-sm max-w-none font-body text-foreground space-y-8">

                    <section>
                        <h2 className="text-lg font-semibold mb-3">1. Who we are</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Lanti OS is a private AI legal assistant platform operated for authorised users only. The platform is not a public service and access is by invitation. For any privacy-related queries, contact us at <a href="mailto:perimeter.uk@gmail.com" className="text-foreground underline underline-offset-2">perimeter.uk@gmail.com</a>.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold mb-3">2. What data we collect</h2>
                        <ul className="text-muted-foreground leading-relaxed space-y-2 list-disc list-inside">
                            <li><strong className="text-foreground">Account information:</strong> your email address and password (stored securely via Supabase Auth).</li>
                            <li><strong className="text-foreground">Documents:</strong> files you upload for analysis, stored in Cloudflare R2 object storage.</li>
                            <li><strong className="text-foreground">Chat history:</strong> conversations with the AI assistant, stored in our database.</li>
                            <li><strong className="text-foreground">Preferences:</strong> theme and voice settings, stored locally in your browser.</li>
                            <li><strong className="text-foreground">API keys:</strong> any third-party API keys you choose to add are encrypted before storage.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold mb-3">3. How we use your data</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Your data is used solely to provide the Lanti OS service — processing your documents and queries through AI models, maintaining your chat history, and enabling access to your files. We do not sell, share, or transfer your data to any third party for marketing or commercial purposes.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold mb-3">4. AI processing</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Documents and messages may be sent to AI model providers (Google Gemini by default; optionally OpenAI or Anthropic if you provide your own API keys) for processing. Each provider has its own privacy policy and data handling practices. You are responsible for ensuring that any content you submit complies with those providers&apos; terms of service.
                        </p>
                        <p className="text-muted-foreground leading-relaxed mt-3">
                            <strong className="text-foreground">Important:</strong> Do not upload documents that are subject to legal professional privilege, client confidentiality, or that contain personally identifiable information belonging to third parties.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold mb-3">5. Data retention</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Your data is retained for as long as your account is active. You may request deletion of your account and all associated data at any time by contacting us.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold mb-3">6. Your rights</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            Under applicable data protection law you have the right to access, correct, or delete your personal data, and to object to or restrict its processing. To exercise any of these rights, contact us at <a href="mailto:perimeter.uk@gmail.com" className="text-foreground underline underline-offset-2">perimeter.uk@gmail.com</a>.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold mb-3">7. Security</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            We use industry-standard security measures including encrypted connections (TLS), encrypted credential storage, and access-controlled cloud infrastructure. No system is entirely secure, and we cannot guarantee absolute security of data transmitted over the internet.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-semibold mb-3">8. Changes to this policy</h2>
                        <p className="text-muted-foreground leading-relaxed">
                            We may update this policy from time to time. Continued use of the platform constitutes acceptance of the current policy.
                        </p>
                    </section>

                </div>
            </main>

            <footer className="px-6 md:px-12 py-6 border-t border-border/50 text-center">
                <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Use</Link>
                    <Link href="/cookies" className="hover:text-foreground transition-colors">Cookie Policy</Link>
                    <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
                </div>
            </footer>
        </div>
    );
}
