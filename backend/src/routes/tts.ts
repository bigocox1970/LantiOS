import { Router } from "express";
import { requireAuth } from "../middleware/auth";

export const ttsRouter = Router();

const MINIMAX_TTS_URL = "https://api.minimax.io/v1/t2a_v2";
const DEFAULT_VOICE_ID = "English_Graceful_Lady";
const TTS_MODEL = "speech-2.8-hd";
const MAX_TEXT_LENGTH = 5000;

ttsRouter.post("/", requireAuth, async (req, res) => {
    const apiKey = process.env.MINIMAX_API_KEY?.trim();
    if (!apiKey) {
        res.status(503).json({ detail: "TTS is not configured on this server." });
        return;
    }

    const body = req.body as { text?: unknown; voiceId?: unknown };
    const rawText = typeof body.text === "string" ? body.text.trim() : "";
    if (!rawText) {
        res.status(400).json({ detail: "text is required" });
        return;
    }

    const text = rawText.slice(0, MAX_TEXT_LENGTH);
    const voiceId =
        typeof body.voiceId === "string" && body.voiceId.trim()
            ? body.voiceId.trim()
            : DEFAULT_VOICE_ID;

    let upstream: Response;
    try {
        upstream = await fetch(MINIMAX_TTS_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: TTS_MODEL,
                text,
                stream: false,
                output_format: "hex",
                voice_setting: { voice_id: voiceId, speed: 1.0, vol: 1.0, pitch: 0 },
                audio_setting: {
                    sample_rate: 32000,
                    bitrate: 128000,
                    format: "mp3",
                    channel: 1,
                },
            }),
        });
    } catch (err) {
        console.error("[tts] MiniMax fetch failed", err);
        res.status(502).json({ detail: "TTS service unreachable" });
        return;
    }

    if (!upstream.ok) {
        const errText = await upstream.text().catch(() => "");
        console.error("[tts] MiniMax error", upstream.status, errText);
        res.status(502).json({ detail: `TTS upstream error ${upstream.status}` });
        return;
    }

    const data = (await upstream.json()) as {
        data?: { audio?: string };
        base_resp?: { status_code?: number; status_msg?: string };
    };

    const statusCode = data.base_resp?.status_code;
    if (statusCode !== undefined && statusCode !== 0) {
        console.error("[tts] MiniMax base_resp error", data.base_resp);
        res.status(502).json({ detail: data.base_resp?.status_msg ?? "TTS error" });
        return;
    }

    const hexAudio = data.data?.audio;
    if (!hexAudio) {
        res.status(502).json({ detail: "No audio returned from TTS service" });
        return;
    }

    const audioBuffer = Buffer.from(hexAudio, "hex");
    res.set("Content-Type", "audio/mpeg");
    res.set("Content-Length", String(audioBuffer.length));
    res.set("Cache-Control", "no-store");
    res.send(audioBuffer);
});
