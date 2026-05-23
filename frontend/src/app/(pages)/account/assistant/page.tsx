"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Play, Square } from "lucide-react";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { supabase } from "@/lib/supabase";

const VOICES = [
    { id: "English_Graceful_Lady", label: "Graceful Lady", description: "Professional female" },
    { id: "English_Trustworthy_Man", label: "Trustworthy Man", description: "Professional male" },
    { id: "English_Insightful_Speaker", label: "Insightful Speaker", description: "Clear and measured" },
    { id: "English_Persuasive_Man", label: "Persuasive Man", description: "Confident male" },
    { id: "English_radiant_girl", label: "Radiant Girl", description: "Bright and warm" },
    { id: "English_Whispering_girl", label: "Whispering Girl", description: "Soft and intimate" },
    { id: "English_Aussie_Bloke", label: "Aussie Bloke", description: "Australian male" },
] as const;

const PREVIEW_TEXT = "Hello, I'm your AI legal assistant. How can I help you today?";

const SPEED_MARKS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

export default function AssistantPage() {
    const { profile, updateAssistantName } = useUserProfile();
    const [assistantName, setAssistantName] = useState("");
    const [isSavingName, setIsSavingName] = useState(false);
    const [nameSaved, setNameSaved] = useState(false);

    const [selectedVoice, setSelectedVoice] = useState("English_Graceful_Lady");
    const [savedVoice, setSavedVoice] = useState("English_Graceful_Lady");
    const [speed, setSpeed] = useState(1.0);
    const [savedSpeed, setSavedSpeed] = useState(1.0);
    const [isSavingVoice, setIsSavingVoice] = useState(false);
    const [voiceSaved, setVoiceSaved] = useState(false);
    const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (profile?.assistantName) setAssistantName(profile.assistantName);
        const storedVoice = localStorage.getItem("lanti-voice-id") ?? "English_Graceful_Lady";
        setSelectedVoice(storedVoice);
        setSavedVoice(storedVoice);
        const storedSpeed = parseFloat(localStorage.getItem("lanti-voice-speed") ?? "1.0");
        const s = isNaN(storedSpeed) ? 1.0 : storedSpeed;
        setSpeed(s);
        setSavedSpeed(s);
    }, [profile]);

    const handleSaveName = async () => {
        setIsSavingName(true);
        const success = await updateAssistantName(assistantName.trim() || null);
        setIsSavingName(false);
        if (success) {
            setNameSaved(true);
            setTimeout(() => setNameSaved(false), 2000);
        } else {
            alert("Failed to save assistant name. Please try again.");
        }
    };

    const handleSelectVoice = (voiceId: string) => {
        setSelectedVoice(voiceId);
    };

    const handleSpeedChange = (value: number) => {
        setSpeed(value);
    };

    const handleSaveVoiceSettings = async () => {
        setIsSavingVoice(true);
        localStorage.setItem("lanti-voice-id", selectedVoice);
        localStorage.setItem("lanti-voice-speed", String(speed));
        setSavedVoice(selectedVoice);
        setSavedSpeed(speed);
        setIsSavingVoice(false);
        setVoiceSaved(true);
        setTimeout(() => setVoiceSaved(false), 2000);
    };

    const stopPreview = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        setPreviewingVoice(null);
    };

    const handlePreview = async (voiceId: string) => {
        if (previewingVoice === voiceId) {
            stopPreview();
            return;
        }
        stopPreview();
        setPreviewingVoice(voiceId);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            const resp = await fetch("/api/tts", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ text: PREVIEW_TEXT, voiceId, speed }),
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audioRef.current = audio;
            audio.onended = () => {
                URL.revokeObjectURL(url);
                audioRef.current = null;
                setPreviewingVoice(null);
            };
            audio.onerror = () => {
                URL.revokeObjectURL(url);
                audioRef.current = null;
                setPreviewingVoice(null);
            };
            audio.play();
        } catch {
            setPreviewingVoice(null);
        }
    };

    const nameChanged = assistantName.trim() !== (profile?.assistantName ?? "");
    const voiceChanged = selectedVoice !== savedVoice || Math.abs(speed - savedSpeed) > 0.001;

    return (
        <div className="space-y-4">
            {/* Assistant Name */}
            <div className="pb-6">
                <h2 className="text-2xl font-medium font-serif mb-1">Assistant Name</h2>
                <p className="text-sm text-muted-foreground mb-4">
                    Give your assistant a name. If left blank, it will introduce itself as the AI Legal Assistant built into Lanti-OS.
                </p>
                <div className="flex gap-2 max-w-sm">
                    <Input
                        type="text"
                        value={assistantName}
                        onChange={(e) => setAssistantName(e.target.value)}
                        placeholder="e.g. Lanti, Aria, Counsel…"
                        className="flex-1"
                        onKeyDown={(e) => { if (e.key === "Enter" && nameChanged) handleSaveName(); }}
                    />
                    <Button
                        onClick={handleSaveName}
                        disabled={isSavingName || !nameChanged || nameSaved}
                        className="min-w-[80px] transition-all bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                        {isSavingName ? "Saving…" : nameSaved ? (
                            <><Check className="h-4 w-4 mr-1" />Saved</>
                        ) : "Save"}
                    </Button>
                </div>
            </div>

            {/* Voice */}
            <div className="py-6">
                <h2 className="text-2xl font-medium font-serif mb-1">Voice</h2>
                <p className="text-sm text-muted-foreground mb-4">
                    Choose the voice used when reading responses aloud. Click the play button to preview.
                </p>
                <div className="space-y-2 max-w-sm">
                    {VOICES.map((voice) => {
                        const isSelected = selectedVoice === voice.id;
                        const isPreviewing = previewingVoice === voice.id;
                        return (
                            <div
                                key={voice.id}
                                onClick={() => handleSelectVoice(voice.id)}
                                className={`flex items-center justify-between rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                                    isSelected
                                        ? "border-primary bg-primary/5"
                                        : "border-border hover:border-primary/40 hover:bg-accent/40"
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                        isSelected ? "border-primary" : "border-muted-foreground/40"
                                    }`}>
                                        {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">{voice.label}</p>
                                        <p className="text-xs text-muted-foreground">{voice.description}</p>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => { e.stopPropagation(); handlePreview(voice.id); }}
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                    title={isPreviewing ? "Stop preview" : "Preview voice"}
                                >
                                    {isPreviewing
                                        ? <Square className="h-3.5 w-3.5 fill-current" />
                                        : <Play className="h-3.5 w-3.5 fill-current" />
                                    }
                                </Button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Speed */}
            <div className="py-6">
                <h2 className="text-2xl font-medium font-serif mb-1">Speaking Speed</h2>
                <p className="text-sm text-muted-foreground mb-4">
                    Adjust how fast the assistant speaks. Changes apply to the next audio response.
                </p>
                <div className="max-w-sm space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Slower</span>
                        <span className="font-medium tabular-nums">{speed.toFixed(2)}×</span>
                        <span className="text-muted-foreground">Faster</span>
                    </div>
                    <input
                        type="range"
                        min={0.5}
                        max={2.0}
                        step={0.05}
                        value={speed}
                        onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                        className="w-full h-2 appearance-none rounded-full cursor-pointer bg-border accent-primary"
                    />
                    <div className="flex justify-between">
                        {SPEED_MARKS.map((mark) => (
                            <button
                                key={mark}
                                type="button"
                                onClick={() => handleSpeedChange(mark)}
                                className={`text-xs transition-colors ${
                                    Math.abs(speed - mark) < 0.01
                                        ? "text-primary font-medium"
                                        : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {mark === 1.0 ? "1×" : `${mark}×`}
                            </button>
                        ))}
                    </div>
                    <div className="pt-2">
                        <Button
                            onClick={handleSaveVoiceSettings}
                            disabled={isSavingVoice || !voiceChanged || voiceSaved}
                            className="min-w-[80px] transition-all bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                            {isSavingVoice ? "Saving…" : voiceSaved ? (
                                <><Check className="h-4 w-4 mr-1" />Saved</>
                            ) : "Save"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
