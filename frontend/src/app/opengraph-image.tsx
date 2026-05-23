import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const dynamic = "force-static";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ICON_B64 =
    "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";

export default function OGImage() {
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
                    fontFamily: "serif",
                }}
            >
                {/* Ambient glow */}
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

                {/* Top-left accent */}
                <div style={{ position: "absolute", top: 0, left: 0, display: "flex" }}>
                    <div style={{ width: 180, height: 3, background: "#b85a23", display: "flex" }} />
                </div>
                <div style={{ position: "absolute", top: 0, left: 0, display: "flex" }}>
                    <div style={{ width: 3, height: 120, background: "#b85a23", display: "flex" }} />
                </div>

                {/* Bottom-right accent */}
                <div style={{ position: "absolute", bottom: 0, right: 0, display: "flex" }}>
                    <div style={{ width: 180, height: 3, background: "#b85a23", display: "flex" }} />
                </div>
                <div style={{ position: "absolute", bottom: 0, right: 0, display: "flex" }}>
                    <div style={{ width: 3, height: 120, background: "#b85a23", display: "flex" }} />
                </div>

                {/* Icon */}
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
                        src={`data:image/png;base64,${ICON_B64}`}
                        width={96}
                        height={96}
                        style={{ display: "flex" }}
                    />
                </div>

                {/* Title */}
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
        size,
    );
}
