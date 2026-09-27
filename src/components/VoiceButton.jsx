import React, { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/i18n";
import { voiceService } from "@/services/voiceService";
import { Volume2, VolumeX, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Reusable Offline Voice Assistance Button
 * 
 * Interacts with browser SpeechSynthesis via voiceService.
 * Strictly adheres to AgroCycle visual design tokens and multilingual context.
 */
export default function VoiceButton({
  text,
  variant = "default",
  size = "sm",
  className = "",
  showText = true,
  customLabel = null
}) {
  const { language, t } = useLanguage();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    // Subscribe to central voice service state
    const unsubscribe = voiceService.subscribe((state) => {
      // Check if this specific text is currently playing or if voiceService is active
      if (state.isSpeaking && state.text === voiceService.cleanTextForSpeech(text)) {
        setIsSpeaking(true);
      } else {
        setIsSpeaking(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [text]);

  const handleToggleSpeak = useCallback((e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    setNotice(null);

    if (isSpeaking) {
      voiceService.stop();
      setIsSpeaking(false);
      return;
    }

    if (!text) return;

    if (!voiceService.isSupported()) {
      setNotice(t("voice.notSupported") || "Voice playback is not supported on this device.");
      setTimeout(() => setNotice(null), 4000);
      return;
    }

    const res = voiceService.speak(text, language, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
      onError: (err) => {
        setIsSpeaking(false);
        console.warn("Speech synthesis notice:", err);
      },
      onUnavailableVoice: (reason, langCode) => {
        setIsSpeaking(false);
        const langName = langCode === "ta" ? "தமிழ்" : langCode === "hi" ? "हिन्दी" : "English";
        const msg = t("voice.voiceUnavailable") || `${langName} voice is not available on this device.`;
        setNotice(msg);
        setTimeout(() => setNotice(null), 4500);
      }
    });
  }, [isSpeaking, text, language, t]);

  const listenLabel = customLabel || t("voice.listen") || "Listen";
  const stopLabel = t("voice.stop") || "Stop";
  const ariaLabel = isSpeaking 
    ? (t("voice.ariaStop") || "Stop voice playback")
    : (t("voice.ariaListen") || "Listen aloud");

  if (variant === "icon") {
    return (
      <div className="relative inline-flex items-center">
        <button
          type="button"
          onClick={handleToggleSpeak}
          aria-label={ariaLabel}
          title={isSpeaking ? stopLabel : listenLabel}
          className={`
            p-1.5 rounded-xl transition-all duration-150 inline-flex items-center justify-center
            ${isSpeaking 
              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse" 
              : "text-muted-foreground hover:text-primary hover:bg-secondary/70 border border-transparent"
            }
            ${className}
          `}
        >
          {isSpeaking ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>

        {notice && (
          <div className="absolute z-50 bottom-full mb-1.5 left-1/2 -translate-x-1/2 min-w-[200px] max-w-xs p-2 bg-stone-900 text-white text-[11px] rounded-xl shadow-lg border border-stone-700 leading-tight pointer-events-none text-center">
            {notice}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative inline-flex flex-col items-start">
      <Button
        type="button"
        variant={isSpeaking ? "destructive" : "outline"}
        size={size}
        onClick={handleToggleSpeak}
        aria-label={ariaLabel}
        title={isSpeaking ? stopLabel : listenLabel}
        className={`
          gap-1.5 rounded-xl font-semibold transition-all duration-200 text-xs
          ${isSpeaking 
            ? "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800 hover:bg-rose-100 animate-pulse" 
            : "bg-card border-border/80 text-foreground hover:bg-secondary/80 hover:text-primary hover:border-primary/40 shadow-2xs"
          }
          ${className}
        `}
      >
        {isSpeaking ? (
          <>
            <VolumeX className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
            {showText && <span>{stopLabel}</span>}
          </>
        ) : (
          <>
            <Volume2 className="h-3.5 w-3.5 text-primary shrink-0" />
            {showText && <span>{listenLabel}</span>}
          </>
        )}
      </Button>

      {notice && (
        <div className="absolute z-50 top-full mt-1.5 left-0 min-w-[220px] max-w-xs p-2 bg-stone-900 text-white text-[11px] rounded-xl shadow-lg border border-stone-700 leading-tight pointer-events-none flex items-start gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}
    </div>
  );
}
