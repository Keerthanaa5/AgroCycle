import React from "react";
import { useLanguage, SUPPORTED_LANGUAGES } from "@/i18n";
import { Globe } from "lucide-react";

export default function LanguageSelector({ variant = "compact", className = "" }) {
  const { language, setLanguage } = useLanguage();

  if (variant === "compact") {
    return (
      <div className={`inline-flex items-center bg-muted/60 p-1 rounded-2xl border border-border/80 shadow-2xs ${className}`}>
        <Globe className="h-3.5 w-3.5 text-primary ml-1.5 mr-1 shrink-0" />
        <div className="flex items-center gap-1">
          {Object.entries(SUPPORTED_LANGUAGES).map(([code, item]) => {
            const isActive = language === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setLanguage(code)}
                className={`
                  px-2.5 py-1 text-xs font-semibold rounded-xl transition-all duration-150
                  ${isActive 
                    ? "bg-primary text-primary-foreground shadow-2xs" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                  }
                `}
                title={item.label}
              >
                {item.nativeName}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Full dropdown / block style for profile or modal settings
  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {Object.entries(SUPPORTED_LANGUAGES).map(([code, item]) => {
        const isActive = language === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLanguage(code)}
            className={`
              flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all
              ${isActive 
                ? "bg-primary/10 border-primary text-primary font-bold shadow-2xs" 
                : "bg-card border-border/80 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }
            `}
          >
            <span className="text-sm font-bold">{item.nativeName}</span>
            <span className="text-[11px] opacity-75 mt-0.5">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
