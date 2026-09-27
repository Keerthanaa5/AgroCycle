import React from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/i18n';

export default function VerifiedBadge({ status, className = "", showIconOnly = false }) {
  const { t, language } = useLanguage();
  const isVerified = status === "verified";
  
  if (isVerified) {
    return (
      <Badge 
        variant="outline" 
        className={`bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300/80 rounded-full inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 shadow-xs ${className}`}
        title={language === "ta" ? "சரிபார்க்கப்பட்டது" : language === "hi" ? "सत्यापित" : "AgroCycle profile verified"}
      >
        <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        {!showIconOnly && <span>{language === "ta" ? "சரிபார்க்கப்பட்டது" : language === "hi" ? "सत्यापित" : "AgroCycle Verified"}</span>}
      </Badge>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className={`bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300/80 rounded-full inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 shadow-xs ${className}`}
      title={t("common.pending")}
    >
      <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
      {!showIconOnly && <span>{language === "ta" ? "சரிபார்ப்பு நிலுவையில்" : language === "hi" ? "सत्यापन लंबित" : "Pending Verification"}</span>}
    </Badge>
  );
}

