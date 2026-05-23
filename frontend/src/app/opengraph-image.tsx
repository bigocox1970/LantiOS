import { ImageResponse } from "next/og";
import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadFont(): Promise<ArrayBuffer | null> {
    try {
        const css = await fetch(
            "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&display=swap",
            { headers: { "User-Agent": "Mozilla/5.0" } },
        ).then((r) => r.text());
        const match = css.match(/src: url\(([^)]+)\) format\('woff2'\)/);
        if (!match) return null;
        return fetch(match[1]).then((r) => r.arrayBuffer());
    } catch {
        return null;
    }
}

export default async function OGImage() {
    const [iconData, fontData] = await Promise.all([
        readFile(join(process.cwd(), "public/favicon-96x96.png")).catch(() => null),
        loadFont(),
    ]);

    const iconSrc = iconData
        ? `data:image/png;base64,${iconData.toString("base64")}`
        : null;

    const fonts: NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"] = [];
    if (fontData) {
        fonts.push({ name: "Fraunces", data: fontData, style: "normal", weight: 400 });
        fonts.push({ name: "Fraunces", data: fontData, style: "normal", weight: 600 });
    }

    return new ImageResponse(
        (
            <div
                style={{
                    width: 1200,
                    height: 630,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "linear-gradient(135deg, #1e1914 0%, #261f18 50%, #1a150f 100%)",
                    position: "relative",
                    overflow: "hidden",
                    fontFamily: fontData ? "Fraunces, serif" : "serif",
                }}
            >
                {/* Ambient glow behind icon */}
                <div
                    style={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: 500,
                        height: 500,
                        borderRadius: "50%",
                        background: "radial-gradient(circle, rgba(180,90,35,0.12) 0%, transparent 70%)",
                        display: "flex",
                    }}
                />

                {/* Top-left corner accent lines */}
                <div style={{ position: "absolute", top: 0, left: 0, display: "flex" }}>
                    <div style={{ width: 180, height: 3, background: "#b85a23", display: "flex" }} />
                </div>
                <div style={{ position: "absolute", top: 0, left: 0, display: "flex" }}>
                    <div style={{ width: 3, height: 120, background: "#b85a23", display: "flex" }} />
                </div>

                {/* Bottom-right corner accent lines */}
                <div style={{ position: "absolute", bottom: 0, right: 0, display: "flex" }}>
                    <div style={{ width: 180, height: 3, background: "#b85a23", display: "flex" }} />
                </div>
                <div style={{ position: "absolute", bottom: 0, right: 0, display: "flex" }}>
                    <div style={{ width: 3, height: 120, background: "#b85a23", display: "flex" }} />
                </div>

                {/* Icon */}
                {iconSrc && (
                    <div
                        style={{
                            width: 96,
                            height: 96,
                            borderRadius: 20,
                            overflow: "hidden",
                            marginBottom: 28,
                            display: "flex",
                            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                        }}
                    >
                        <img
                            src={iconSrc}
                            width={96}
                            height={96}
                            style={{ display: "flex" }}
                        />
                    </div>
                )}

                {/* Lanti OS */}
                <div
                    style={{
                        fontSize: 88,
                        fontWeight: 600,
                        color: "#ede8e2",
                        letterSpacing: "-2px",
                        lineHeight: 1,
                        marginBottom: 16,
                        display: "flex",
                    }}
                >
                    Lanti OS
                </div>

                {/* Divider */}
                <div
                    style={{
                        width: 56,
                        height: 3,
                        background: "#b85a23",
                        borderRadius: 2,
                        marginBottom: 20,
                        display: "flex",
                    }}
                />

                {/* Subtitle */}
                <div
                    style={{
                        fontSize: 28,
                        fontWeight: 400,
                        color: "#9a8e84",
                        letterSpacing: "0.5px",
                        display: "flex",
                    }}
                >
                    AI Legal Assistant
                </div>
            </div>
        ),
        { ...size, fonts },
    );
}
