import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Mic, MicOff, Volume2, Bot, User, Loader2, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";

const LANGUAGES = {
  english: { label: "English", code: "en", ttsCode: "en-US" },
  telugu: { label: "తెలుగు (Telugu)", code: "te", ttsCode: "te-IN" },
  hindi: { label: "हिन्दी (Hindi)", code: "hi", ttsCode: "hi-IN" },
  marathi: { label: "मराठी (Marathi)", code: "mr", ttsCode: "mr-IN" },
  kannada: { label: "ಕನ್ನಡ (Kannada)", code: "kn", ttsCode: "kn-IN" },
};

export default function AIAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [language, setLanguage] = useState("english");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function startListening() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Voice input not supported in this browser. Use Chrome.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = LANGUAGES[language].ttsCode;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setInput(text);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  function speakText(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LANGUAGES[language].ttsCode;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    const langName = LANGUAGES[language].label.split(" ")[0];
    const response = await base44.integrations.Core.InvokeLLM({
      prompt: `You are Farmer Rescue AI assistant. Help Indian farmers with crop management, waste utilization, market connections, insurance, and sustainable farming. ALWAYS respond in ${langName} language. Be practical and helpful.

User's message: ${text}

Context: This is a smart farming app that helps farmers reduce losses, reuse waste, and earn more income. Features include: AgroConnect Community (waste/fodder exchange), Urban Waste Matcher (sell damaged crops), Carbon Cash (carbon credits), Viability Scanner, Silage Bank, Claim Rocket (insurance), Intercrop Wizard.

Respond in ${langName} language. Be concise and helpful.`,
      add_context_from_internet: true,
    });

    const botMsg = { role: "assistant", content: response };
    setMessages(prev => [...prev, botMsg]);
    setIsLoading(false);
    
    // Auto speak the response
    speakText(response);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">🤖 AI Assistant</h1>
          <p className="text-muted-foreground text-sm">Voice & text help in your language</p>
        </div>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-48">
            <Globe className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(LANGUAGES).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 bg-card rounded-2xl border border-border p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-bold text-lg mb-2">Farmer Rescue AI</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Ask me anything about farming! I can help with crop advice, market connections, insurance, and more. 
              Use voice or text in your preferred language.
            </p>
          </div>
        )}
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="text-sm prose prose-sm max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
                {msg.role === "assistant" && (
                  <button onClick={() => speakText(msg.content)} className="mt-2 text-xs flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                    <Volume2 className="h-3 w-3" /> Listen
                  </button>
                )}
              </div>
              {msg.role === "user" && (
                <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-muted rounded-2xl px-4 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <Button
          variant={isListening ? "destructive" : "outline"}
          size="icon"
          onClick={isListening ? stopListening : startListening}
          className="flex-shrink-0 h-12 w-12 rounded-xl"
        >
          {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </Button>
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSend()}
          placeholder={isListening ? "Listening..." : "Type your message..."}
          className="h-12 rounded-xl"
        />
        <Button onClick={handleSend} disabled={!input.trim() || isLoading} size="icon" className="flex-shrink-0 h-12 w-12 rounded-xl">
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}