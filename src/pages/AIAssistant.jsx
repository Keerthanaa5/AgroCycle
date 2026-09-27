import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Mic, MicOff, Bot, User, Loader2, Globe, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import VoiceButton from "@/components/VoiceButton";
import { useLanguage } from "@/i18n";
import { sendAssistantMessage, isOnline } from "@/services/geminiService";
import { sendGroqAssistantMessage } from "@/services/groqService";

const LANGUAGES = {
  en: { label: "English", code: "en", ttsCode: "en-IN" },
  ta: { label: "தமிழ் (Tamil)", code: "ta", ttsCode: "ta-IN" },
  hi: { label: "हिन्दी (Hindi)", code: "hi", ttsCode: "hi-IN" }
};

export default function AIAssistant() {
  const { t, language: appLanguage, setLanguage: setAppLanguage } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech Recognition not supported in this browser");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = LANGUAGES[appLanguage]?.ttsCode || "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech error:", event.error);
      setIsListening(false);
    };

    recognition.onstart = () => console.log("Mic started");
    
    recognition.onend = () => {
      console.log("Mic ended");
      setIsListening(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  };

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  async function handleSendWithText(textToSend) {
    const text = textToSend.trim();
    if (!text || isLoading) return;

    const userMsg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // 1. Offline check
    if (!isOnline()) {
      setTimeout(() => {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `⚠️ ${t("aiAssistant.offlineError")}`
        }]);
        setIsLoading(false);
      }, 400);
      return;
    }

    try {
      // Step A: Try Gemini primary
      let response = await sendAssistantMessage({
        message: text,
        history: messages,
        language: appLanguage || "en"
      });

      // Step B: Secondary fallback to Groq if Gemini fails
      if (!response.success || !response.text) {
        console.warn("Primary Gemini Assistant unavailable, falling back to Groq:", response.error);
        const groqResponse = await sendGroqAssistantMessage({
          message: text,
          history: messages,
          language: appLanguage || "en"
        });
        if (groqResponse.success && groqResponse.text) {
          response = groqResponse;
        }
      }

      if (response.success && response.text) {
        setMessages(prev => [...prev, { role: "assistant", content: response.text }]);
      } else {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: `⚠️ ${t("aiAssistant.serviceError")}`
        }]);
      }
    } catch (err) {
      console.error("Assistant send error:", err);
      // Last-ditch Groq fallback
      try {
        const fallback = await sendGroqAssistantMessage({
          message: text,
          history: messages,
          language: appLanguage || "en"
        });
        if (fallback.success && fallback.text) {
          setMessages(prev => [...prev, { role: "assistant", content: fallback.text }]);
          return;
        }
      } catch (gErr) {
        console.error("Groq fallback failed:", gErr);
      }

      setMessages(prev => [...prev, {
        role: "assistant",
        content: `⚠️ ${t("aiAssistant.serviceError")}`
      }]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSend() {
    handleSendWithText(input);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-3xl mx-auto space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">🤖 {t("aiAssistant.title")}</h1>
            <span className="text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full border border-primary/20">
              Online AI
            </span>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">{t("aiAssistant.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setMessages([])} className="text-xs text-muted-foreground hover:text-foreground rounded-xl">
              {t("aiAssistant.clearChat")}
            </Button>
          )}
          <Select value={appLanguage} onValueChange={setAppLanguage}>
            <SelectTrigger className="w-36 rounded-xl border-border/80 h-9 text-xs">
              <Globe className="h-3.5 w-3.5 mr-2 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              {Object.entries(LANGUAGES).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Messages Window */}
      <div className="flex-1 overflow-y-auto space-y-3.5 bg-card rounded-3xl border border-border/80 p-5 shadow-natural">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="h-16 w-16 rounded-3xl bg-secondary flex items-center justify-center mb-4 text-primary border border-primary/15 shadow-xs">
              <Bot className="h-8 w-8" />
            </div>
            <h3 className="font-bold text-lg text-foreground mb-1.5">{t("aiAssistant.quickPromptsTitle")}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md leading-relaxed mb-6">
              {t("aiAssistant.quickPromptsSubtitle")}
            </p>

            {/* Quick Prompt Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg text-left">
              {[
                { title: t("aiAssistant.chips.paddyYellowing"), desc: t("aiAssistant.chips.paddyYellowingDesc") },
                { title: t("aiAssistant.chips.cropWastePricing"), desc: t("aiAssistant.chips.cropWastePricingDesc") },
                { title: t("aiAssistant.chips.pmfbyInsurance"), desc: t("aiAssistant.chips.pmfbyInsuranceDesc") },
                { title: t("aiAssistant.chips.silageFermentation"), desc: t("aiAssistant.chips.silageFermentationDesc") }
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendWithText(chip.desc)}
                  className="p-3 rounded-2xl bg-muted/50 hover:bg-secondary/60 border border-border/60 hover:border-primary/30 transition-all text-left group"
                >
                  <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{chip.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{chip.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="h-8 w-8 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0 text-primary border border-primary/15 mt-0.5">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div className={`max-w-[85%] sm:max-w-[80%] rounded-3xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                msg.role === "user" 
                  ? "bg-primary text-primary-foreground font-medium shadow-xs" 
                  : "bg-secondary/70 border border-border/60 text-foreground space-y-2"
              }`}>
                {msg.role === "assistant" ? (
                  <>
                    <div className="prose prose-sm max-w-none text-foreground">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    {!msg.content.startsWith("⚠️") && (
                      <div className="pt-1.5 border-t border-border/40 flex justify-end">
                        <VoiceButton text={msg.content} variant="icon" />
                      </div>
                    )}
                  </>
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="h-8 w-8 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0 text-primary mt-0.5">
                  <User className="h-4 w-4" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <div className="flex gap-3 items-center">
            <div className="h-8 w-8 rounded-2xl bg-secondary flex items-center justify-center text-primary border border-primary/15">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-secondary/70 border border-border/60 rounded-2xl px-4 py-2.5 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Generating AI response...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <Button
            variant={isListening ? "destructive" : "outline"}
            size="icon"
            onClick={isListening ? stopListening : startListening}
            className={`flex-shrink-0 h-12 w-12 rounded-2xl transition-all border-border/80 ${isListening ? "animate-pulse ring-4 ring-destructive/30" : "hover:bg-secondary"}`}
          >
            {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5 text-primary" />}
          </Button>
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder={isListening ? t("aiAssistant.listening") : t("aiAssistant.placeholder")}
            className="h-12 rounded-2xl text-xs sm:text-sm border-border/80 shadow-xs"
          />
          <Button onClick={handleSend} disabled={!input.trim() || isLoading} size="icon" className="flex-shrink-0 h-12 w-12 rounded-2xl shadow-xs">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[11px] text-center text-muted-foreground px-2">
          * {t("aiAssistant.disclaimer")}
        </p>
      </div>
    </div>
  );
}