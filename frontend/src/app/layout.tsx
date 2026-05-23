import type { Metadata } from "next";
import { Inter, EB_Garamond, Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { CookieBanner } from "@/components/cookie-banner";

const inter = Inter({
    variable: "--font-inter",
    subsets: ["latin"],
});

const ebGaramond = EB_Garamond({
    variable: "--font-eb-garamond",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
});

const fraunces = Fraunces({
    variable: "--font-fraunces-font",
    subsets: ["latin"],
    weight: ["300", "400", "500", "600", "700"],
    style: ["normal", "italic"],
});

export const metadata: Metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://lantios.netlify.app"),
    title: "Lanti OS - AI Legal Platform",
    description:
        "AI-powered legal document analysis and contract review platform.",
    icons: {
        icon: [
            { url: "/favicon-96x96.png", type: "image/png", sizes: "96x96" },
            { url: "/favicon.ico" },
        ],
        apple: "/apple-touch-icon.png",
    },
    openGraph: {
        type: "website",
        siteName: "Lanti OS",
        title: "Lanti OS - AI Legal Platform",
        description: "AI-powered legal document analysis and contract review platform.",
        url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://lantios.netlify.app",
        images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
    twitter: {
        card: "summary_large_image",
        title: "Lanti OS - AI Legal Platform",
        description: "AI-powered legal document analysis and contract review platform.",
        images: ["/og-image.png"],
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body
                className={`${inter.variable} ${ebGaramond.variable} ${fraunces.variable} font-sans antialiased`}
            >
                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(){var t=localStorage.getItem('lanti-theme');if(t==='dark'||(t===null&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}})();`,
                    }}
                />
                <Providers>
                    {children}
                    <CookieBanner />
                </Providers>
            </body>
        </html>
    );
}
