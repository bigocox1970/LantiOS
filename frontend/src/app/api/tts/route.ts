import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";

const MINIMAX_TTS_URL = "https://api.minimax.io/v1/t2a_v2";
const DEFAULT_VOICE_ID = "English_Graceful_Lady";
const TTS_MODEL = "speech-2.8-hd";
const MAX_TEXT_LENGTH = 5000;

export async function POST(request: NextRequest) {
    const auth = await requireAuth(request);
    if (!auth.ok) return auth.response;

    const apiKey = process.env.MINIMAX_API_KEY?.trim();
    if (!apiKey) {
        return NextResponse.json({ detail: "TTS is not configured on this server." }, { status: 503 });
    }

    const body = (await request.json()) as { text?: unknown; voiceId?: unknown; speed?: unknown };
    const rawText = typeof body.text === "string" ? body.text.trim() : "";
    if (!rawText) return NextResponse.json({ detail: "text is required" }, { status: 400 });

    const text = rawText.slice(0, MAX_TEXT_LENGTH);
    const voiceId =
        typeof body.voiceId === "string" && body.voiceId.trim() ? body.voiceId.trim() : DEFAULT_VOICE_ID;
    const rawSpeed = typeof body.speed === "number" ? body.speed : 1.0;
    const speed = Math.min(Math.max(rawSpeed, 0.5), 2.0);

    let upstream: Response;
    try {
        upstream = await fetch(MINIMAX_TTS_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                model: TTS_MODEL,
                text,
                stream: false,
                output_format: "hex",
                voice_setting: { voice_id: voiceId, speed, vol: 1.0, pitch: 0 },
                audio_setting: { sample_rate: 32000, bitrate: 128000, format: "mp3", channel: 1 },
            }),
        });
    } catch {
        return NextResponse.json({ detail: "TTS service unreachable" }, { status: 502 });
    }

    if (!upstream.ok) {
        const errText = await upstream.text().catch(() => "");
        console.error("[tts] MiniMax error", upstream.status, errText);
        return NextResponse.json({ detail: `TTS upstream error ${upstream.status}` }, { status: 502 });
    }

    const data = (await upstream.json()) as {
        data?: { audio?: string };
        base_resp?: { status_code?: number; status_msg?: string };
    };

    const statusCode = data.base_resp?.status_code;
    if (statusCode === 2056) {
        return NextResponse.json({ detail: "quota_exceeded" }, { status: 502 });
    }
    if (statusCode !== undefined && statusCode !== 0) {
        return NextResponse.json({ detail: data.base_resp?.status_msg ?? "TTS error" }, { status: 502 });
    }

    const hexAudio = data.data?.audio;
    if (!hexAudio) return NextResponse.json({ detail: "No audio returned from TTS service" }, { status: 502 });

    const audioBuffer = Buffer.from(hexAudio, "hex");
    return new Response(audioBuffer, {
        headers: {
            "Content-Type": "audio/mpeg",
            "Content-Length": String(audioBuffer.length),
            "Cache-Control": "no-store",
        },
    });
}
