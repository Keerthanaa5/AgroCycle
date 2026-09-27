/**
 * Centralized Offline Voice Assistance Service for AgroCycle
 * 
 * Uses browser/device built-in SpeechSynthesis ONLY.
 * Zero cloud dependencies, zero network requests, 100% offline capable.
 */

class VoiceService {
  constructor() {
    this._listeners = new Set();
    this._isSpeaking = false;
    this._currentLang = null;
    this._currentText = null;
    this._voices = [];
    this._initialized = false;

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this._initVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => {
          this._initVoices();
        };
      }
    }
  }

  _initVoices() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        this._voices = v;
        this._initialized = true;
      }
    } catch (e) {
      this._voices = [];
    }
  }

  /**
   * Check if Speech Synthesis is supported by the device/browser
   * @returns {boolean}
   */
  isSupported() {
    return (
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      "SpeechSynthesisUtterance" in window
    );
  }

  /**
   * Get list of currently installed system/browser voices
   * @returns {SpeechSynthesisVoice[]}
   */
  getAvailableVoices() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        const liveVoices = window.speechSynthesis.getVoices();
        if (liveVoices && liveVoices.length > 0) {
          this._voices = liveVoices;
          this._initialized = true;
        }
      } catch (e) {}
    }
    return this._voices;
  }

  /**
   * Safe language-to-voice resolver
   * BCP-47 mapping with Indian dialect preference and flexible voice name matching
   * 
   * @param {string} langCode - 'en', 'ta', or 'hi'
   * @returns {SpeechSynthesisVoice|null} Matching voice object or null
   */
  getVoiceForLanguage(langCode) {
    if (!this.isSupported()) return null;

    const voices = this.getAvailableVoices();
    if (!voices || voices.length === 0) return null;

    const normalizedLang = String(langCode || "en").toLowerCase().trim();

    // ==========================================
    // TAMIL VOICE SELECTION (ta-IN, ta-LK, ta-SG, ta-MY, ta)
    // ==========================================
    if (normalizedLang === "ta" || normalizedLang.startsWith("ta")) {
      // 1. Exact ta-IN / ta_IN
      let match = voices.find(v => v.lang && (v.lang.toLowerCase() === "ta-in" || v.lang.toLowerCase() === "ta_in"));
      if (match) return match;

      // 2. Any Tamil regional BCP-47 variant (ta-LK, ta-SG, ta-MY, ta, tam)
      match = voices.find(v => v.lang && (
        v.lang.toLowerCase().startsWith("ta-") || 
        v.lang.toLowerCase().startsWith("ta_") || 
        v.lang.toLowerCase() === "ta" || 
        v.lang.toLowerCase() === "tam"
      ));
      if (match) return match;

      // 3. Name matching for known Tamil voices & scripts
      match = voices.find(v => v.name && (
        v.name.toLowerCase().includes("tamil") || 
        v.name.includes("தமிழ்") || 
        v.name.toLowerCase().includes("valluvar") ||
        v.name.toLowerCase().includes("pallavi") ||
        v.name.toLowerCase().includes("pallava") ||
        v.name.toLowerCase().includes("saranya") ||
        v.name.toLowerCase().includes("kumar") ||
        v.name.toLowerCase().includes("kani") ||
        v.name.toLowerCase().includes("surya") ||
        v.name.toLowerCase().includes("venba") ||
        v.name.toLowerCase().includes("anbu")
      ));
      if (match) return match;

      return null;
    }

    // ==========================================
    // HINDI VOICE SELECTION (hi-IN, hi)
    // ==========================================
    if (normalizedLang === "hi" || normalizedLang.startsWith("hi")) {
      // 1. Exact hi-IN / hi_IN
      let match = voices.find(v => v.lang && (v.lang.toLowerCase() === "hi-in" || v.lang.toLowerCase() === "hi_in"));
      if (match) return match;

      // 2. Any Hindi BCP-47 variant
      match = voices.find(v => v.lang && (
        v.lang.toLowerCase().startsWith("hi-") || 
        v.lang.toLowerCase().startsWith("hi_") || 
        v.lang.toLowerCase() === "hi" || 
        v.lang.toLowerCase() === "hin"
      ));
      if (match) return match;

      // 3. Name matching for known Hindi voices & scripts
      match = voices.find(v => v.name && (
        v.name.toLowerCase().includes("hindi") || 
        v.name.includes("हिन्दी") || 
        v.name.toLowerCase().includes("madhur") ||
        v.name.toLowerCase().includes("swara") ||
        v.name.toLowerCase().includes("kalpana") ||
        v.name.toLowerCase().includes("hemant")
      ));
      if (match) return match;

      return null;
    }

    // ==========================================
    // ENGLISH VOICE SELECTION (en-IN preferred, then en-*)
    // ==========================================
    let enIn = voices.find(v => v.lang && (v.lang.toLowerCase() === "en-in" || v.lang.toLowerCase() === "en_in"));
    if (enIn) return enIn;

    let enIndiaName = voices.find(v => v.name && v.name.toLowerCase().includes("india") && v.lang && v.lang.toLowerCase().startsWith("en"));
    if (enIndiaName) return enIndiaName;

    let enGeneral = voices.find(v => v.lang && v.lang.toLowerCase().startsWith("en"));
    if (enGeneral) return enGeneral;

    let enName = voices.find(v => v.name && v.name.toLowerCase().includes("english"));
    if (enName) return enName;

    if (voices.length > 0) {
      return voices[0];
    }

    return null;
  }

  /**
   * Check if a voice exists for the given language
   * @param {string} langCode - 'en', 'ta', or 'hi'
   * @returns {boolean}
   */
  hasVoiceForLanguage(langCode) {
    return this.getVoiceForLanguage(langCode) !== null;
  }

  /**
   * Cleans text for natural audio synthesis
   * Strips HTML, markdown, emojis, and symbols that cause synthesizer glitches
   * 
   * @param {string} text - Raw input string
   * @returns {string} Cleaned spoken text
   */
  cleanTextForSpeech(text) {
    if (!text || typeof text !== "string") return "";

    return text
      // Remove HTML tags
      .replace(/<[^>]*>/g, " ")
      // Remove markdown bold/italics/code/bullets
      .replace(/[*_~`#]/g, "")
      // Convert common symbols to readable equivalents
      .replace(/•/g, ", ")
      .replace(/₹/g, " Rupees ")
      .replace(/%/g, " percent ")
      .replace(/&/g, " and ")
      // Remove URLs
      .replace(/https?:\/\/\S+/gi, "")
      // Normalize whitespace and newlines
      .replace(/[\r\n\t]+/g, ". ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Speak text in the specified application language
   * 
   * @param {string} rawText - Localized UI text to speak
   * @param {string} lang - 'en', 'ta', or 'hi'
   * @param {Object} [options] - Callbacks & configuration
   * @returns {Object} Result { success: boolean, reason?: string }
   */
  speak(rawText, lang = "en", options = {}) {
    const {
      onStart,
      onEnd,
      onError,
      onUnavailableVoice,
      rate = 0.9,
      pitch = 1.0
    } = options;

    // Always stop any running speech first (one utterance at a time)
    this.stop();

    if (!this.isSupported()) {
      if (onUnavailableVoice) onUnavailableVoice("unsupported_browser", lang);
      return { success: false, reason: "unsupported_browser" };
    }

    const cleanText = this.cleanTextForSpeech(rawText);
    if (!cleanText) {
      return { success: false, reason: "empty_text" };
    }

    const targetLang = ["en", "ta", "hi"].includes(lang) ? lang : (String(lang).startsWith("ta") ? "ta" : String(lang).startsWith("hi") ? "hi" : "en");
    const voice = this.getVoiceForLanguage(targetLang);

    if (typeof window !== "undefined" && window.console) {
      console.log(`[AgroCycle Voice] Request speak in '${targetLang}' (raw lang: '${lang}') | Available voices: ${this.getAvailableVoices().length} | Matched voice:`, voice ? `${voice.name} (${voice.lang}, local=${voice.localService})` : "NONE");
    }

    // CRITICAL: A Tamil or Hindi text must NEVER be spoken by an English or wrong voice.
    // If no matching voice is installed for the target language, report clearly.
    if (!voice) {
      this._isSpeaking = false;
      this._notify({ isSpeaking: false });
      if (onUnavailableVoice) {
        onUnavailableVoice("missing_voice", targetLang);
      }
      return { success: false, reason: "missing_voice", lang: targetLang };
    }

    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.voice = voice;
      utterance.lang = voice.lang || (targetLang === "ta" ? "ta-IN" : targetLang === "hi" ? "hi-IN" : "en-IN");
      utterance.rate = rate;
      utterance.pitch = pitch;

      // Retain utterance reference to prevent Chromium garbage collection during playback
      this._activeUtterance = utterance;

      utterance.onstart = () => {
        this._isSpeaking = true;
        this._currentLang = targetLang;
        this._currentText = cleanText;
        if (onStart) onStart();
        this._notify({ isSpeaking: true, lang: targetLang, text: cleanText });
      };

      utterance.onend = () => {
        this._isSpeaking = false;
        this._currentLang = null;
        this._currentText = null;
        this._activeUtterance = null;
        if (onEnd) onEnd();
        this._notify({ isSpeaking: false });
      };

      utterance.onerror = (event) => {
        this._isSpeaking = false;
        this._currentLang = null;
        this._currentText = null;
        this._activeUtterance = null;
        
        if (event.error === "language-unavailable" || event.error === "voice-unavailable") {
          if (onUnavailableVoice) onUnavailableVoice("missing_voice", targetLang);
        } else if (event.error !== "canceled" && event.error !== "interrupted") {
          if (onError) onError(event);
        }
        this._notify({ isSpeaking: false });
      };

      // Clear any hung queue in Chromium and resume
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      
      window.speechSynthesis.speak(utterance);
      return { success: true, voice: voice.name, lang: voice.lang };
    } catch (err) {
      this._isSpeaking = false;
      this._activeUtterance = null;
      this._notify({ isSpeaking: false });
      if (onError) onError(err);
      return { success: false, reason: "synthesis_failed", error: err };
    }
  }

  /**
   * Stop current speech playback immediately
   */
  stop() {
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }
    this._isSpeaking = false;
    this._currentLang = null;
    this._currentText = null;
    this._notify({ isSpeaking: false });
  }

  /**
   * Check if speech is currently active
   * @returns {boolean}
   */
  isSpeaking() {
    if (this._isSpeaking) return true;
    if (this.isSupported()) {
      return window.speechSynthesis.speaking;
    }
    return false;
  }

  /**
   * Get current language being spoken
   */
  getCurrentLanguage() {
    return this._currentLang;
  }

  /**
   * Subscribe to speech state changes
   * @param {Function} listener
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    if (typeof listener === "function") {
      this._listeners.add(listener);
      // Immediately notify listener of current state
      listener({ isSpeaking: this.isSpeaking(), lang: this._currentLang, text: this._currentText });
    }
    return () => {
      this._listeners.delete(listener);
    };
  }

  _notify(state) {
    this._listeners.forEach(listener => {
      try {
        listener(state);
      } catch (e) {
        console.error("Voice listener error:", e);
      }
    });
  }
}

export const voiceService = new VoiceService();
