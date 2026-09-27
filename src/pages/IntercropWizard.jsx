import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sprout, Loader2, Lightbulb, Calendar, IndianRupee, Sparkles, Info, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import VoiceButton from "@/components/VoiceButton";
import { useLanguage } from "@/i18n";
import { generateIntercropAdvice, isOnline } from "@/services/geminiService";
import { generateGroqIntercropAdvice } from "@/services/groqService";

const generateIntercropSuggestion = (crop, soil, season) => {
  const c = (crop || "").toLowerCase();
  
  if (c.includes("rice") || c.includes("paddy")) {
    return {
      suggestions: [
        {
          cropKey: "legumes_nitrogen_fixing",
          cropName: "Legumes (Nitrogen fixing)",
          matchPercentage: 92,
          duration: 60,
          expectedProfitPerAcre: 15000,
          methodKey: "paddy_bund_planting",
          method: "Plant along the bunds after primary crop establishment.",
          seedKey: "high_local_stores",
          seedAvailability: "High - Available at local stores",
          benefitKey: "nitrogen_fixation",
          benefits: "Naturally fixes nitrogen in the soil, reducing fertilizer costs."
        }
      ],
      adviceKey: "paddy_legume_advice",
      generalAdvice: "Ensure adequate water spacing. Legumes thrive well in the residual moisture of paddy fields."
    };
  } else if (c.includes("cotton")) {
    return {
      suggestions: [
        {
          cropKey: "groundnut",
          cropName: "Groundnut",
          matchPercentage: 88,
          duration: 100,
          expectedProfitPerAcre: 22000,
          methodKey: "cotton_alternate_rows",
          method: "Sow in alternative rows with cotton to maximize water usage.",
          seedKey: "medium_agroconnect",
          seedAvailability: "Medium - Check nearest AgroConnect block",
          benefitKey: "weed_suppression",
          benefits: "Excellent supplementary ground cover restricting weed growth."
        }
      ],
      adviceKey: "cotton_groundnut_advice",
      generalAdvice: "Cotton demands high nutrients; the groundnut intercrop naturally provides biological pest deterrence."
    };
  } else {
    return {
      suggestions: [
        {
          cropKey: "leafy_vegetables_marigold",
          cropName: "Leafy Vegetables / Marigold",
          matchPercentage: 85,
          duration: 45,
          expectedProfitPerAcre: 12000,
          methodKey: "broadcast_soil_gaps",
          method: "Broadcast seeds uniformly across the intermediate soil gaps.",
          seedKey: "high_abundant",
          seedAvailability: "High - Highly abundant across seasons",
          benefitKey: "nematode_short_cash",
          benefits: "Provides an immediate short-term cash flow and deflects nematode attacks."
        }
      ],
      adviceKey: "short_duration_advice",
      generalAdvice: "Short-duration vegetable intercrops preserve primary crop nutrients while maximizing seasonal land utility."
    };
  }
};

export default function IntercropWizard() {
  const { language, t } = useLanguage();
  const [form, setForm] = useState({ current_crop: "", soil_type: "red_soil", location: "", season: "kharif", area_acres: "" });
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);

  async function handleAnalyze() {
    if (!form.current_crop || !form.location) return;
    setLoading(true);
    try {
      // 1. Baseline local offline recommendation
      const baseResult = generateIntercropSuggestion(form.current_crop, form.soil_type, form.season);

      // 2. Sequential AI enhancement attempts (Online only)
      if (isOnline()) {
        // Step A: Primary attempt with Gemini
        try {
          const geminiResponse = await generateIntercropAdvice({
            crop: form.current_crop,
            soil: form.soil_type,
            season: form.season,
            location: form.location,
            acres: form.area_acres || 2,
            baseRecommendation: baseResult,
            language: language || "en"
          });

          if (geminiResponse.success && geminiResponse.data) {
            setSuggestions({
              ...baseResult,
              isAiEnhanced: true,
              provider: "gemini",
              aiAdvisory: geminiResponse.data
            });
            return;
          }
        } catch (geminiErr) {
          console.warn("Primary Gemini attempt failed, proceeding to Groq fallback:", geminiErr);
        }

        // Step B: Secondary fallback attempt with Groq (only if Gemini failed/unavailable)
        try {
          const groqResponse = await generateGroqIntercropAdvice({
            crop: form.current_crop,
            soil: form.soil_type,
            season: form.season,
            location: form.location,
            acres: form.area_acres || 2,
            baseRecommendation: baseResult,
            language: language || "en"
          });

          if (groqResponse.success && groqResponse.data) {
            setSuggestions({
              ...baseResult,
              isAiEnhanced: true,
              provider: "groq",
              aiAdvisory: groqResponse.data
            });
            return;
          }
        } catch (groqErr) {
          console.warn("Secondary Groq fallback attempt failed:", groqErr);
        }
      }

      // 3. Fallback to local recommendation (when offline or both AI providers fail)
      setSuggestions({
        ...baseResult,
        isAiEnhanced: false,
        aiUnavailable: isOnline(),
        provider: "local"
      });
    } catch (error) {
      console.error("Intercrop recommendation error:", error);
      const baseResult = generateIntercropSuggestion(form.current_crop, form.soil_type, form.season);
      setSuggestions({
        ...baseResult,
        isAiEnhanced: false,
        aiUnavailable: isOnline(),
        provider: "local"
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">🌱 {t("intercrop.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("intercrop.subtitle")}</p>
      </div>

      <div className="bg-card rounded-3xl border border-border/80 p-6 sm:p-8 space-y-4 shadow-natural">
        <div>
          <label className="text-xs font-medium text-foreground block mb-1.5">{t("intercrop.primaryCrop")}</label>
          <Input 
            placeholder={t("intercrop.primaryCropPlaceholder")} 
            value={form.current_crop} 
            onChange={e => setForm(f => ({ ...f, current_crop: e.target.value }))} 
            className="rounded-xl"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">{t("intercrop.soilType")}</label>
            <Select value={form.soil_type} onValueChange={v => setForm(f => ({ ...f, soil_type: v }))}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="red_soil">{t("intercrop.soilTypes.red_soil") || "Red Soil"}</SelectItem>
                <SelectItem value="black_soil">{t("intercrop.soilTypes.black_soil") || "Black Soil"}</SelectItem>
                <SelectItem value="alluvial">{t("intercrop.soilTypes.alluvial") || "Alluvial Soil"}</SelectItem>
                <SelectItem value="laterite">{t("intercrop.soilTypes.laterite") || "Laterite Soil"}</SelectItem>
                <SelectItem value="sandy">{t("intercrop.soilTypes.sandy") || "Sandy Soil"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">{t("intercrop.season")}</label>
            <Select value={form.season} onValueChange={v => setForm(f => ({ ...f, season: v }))}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="kharif">{t("intercrop.seasons.kharif") || "Kharif (Monsoon)"}</SelectItem>
                <SelectItem value="rabi">{t("intercrop.seasons.rabi") || "Rabi (Winter)"}</SelectItem>
                <SelectItem value="zaid">{t("intercrop.seasons.zaid") || "Zaid (Summer)"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">{t("intercrop.location")}</label>
            <Input 
              placeholder={t("intercrop.locationPlaceholder")} 
              value={form.location} 
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))} 
              className="rounded-xl"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-foreground block mb-1.5">{t("intercrop.area")}</label>
            <Input 
              type="number" 
              step="0.1" 
              placeholder={t("intercrop.areaPlaceholder")} 
              value={form.area_acres} 
              onChange={e => setForm(f => ({ ...f, area_acres: e.target.value }))} 
              className="rounded-xl"
            />
          </div>
        </div>

        <Button 
          onClick={handleAnalyze} 
          disabled={loading || !form.current_crop || !form.location} 
          className="w-full gap-2 rounded-xl mt-2 shadow-xs"
        >
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("intercrop.analyzing")}</> : <><Sprout className="h-4 w-4" /> {t("intercrop.getRecommendations")}</>}
        </Button>
      </div>

      <AnimatePresence>
        {suggestions && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            
            {/* Status notification banner if AI enhancement is unavailable while online */}
            {suggestions.aiUnavailable && (
              <div className="text-xs bg-amber-500/10 text-amber-900 dark:text-amber-200 border border-amber-500/20 px-4 py-2.5 rounded-2xl flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0 text-amber-600" />
                <span>{t("intercrop.aiUnavailableNotice")}</span>
              </div>
            )}

            {suggestions.suggestions?.map((crop, i) => {
              const localizedCropName = crop.cropKey ? t(`intercrop.crops.${crop.cropKey}`) : crop.cropName;
              const localizedMethod = crop.methodKey ? t(`intercrop.methods.${crop.methodKey}`) : crop.method;
              const localizedSeed = crop.seedKey ? t(`intercrop.seedAvailabilities.${crop.seedKey}`) : crop.seedAvailability;
              const localizedBenefit = crop.benefitKey ? t(`intercrop.benefits.${crop.benefitKey}`) : crop.benefits;

              const spokenCropText = `${localizedCropName}. ${crop.matchPercentage ? t("intercrop.matchScore", { percent: crop.matchPercentage }) : ""}. ${t("intercrop.cycleDays", { days: crop.duration })}. ${t("intercrop.profitPerAcre", { profit: String(crop.expectedProfitPerAcre?.toLocaleString() || crop.expectedProfitPerAcre || "").replace("₹", "").trim() })}. ${t("intercrop.sowingMethod")}: ${localizedMethod}. ${localizedSeed ? `${t("intercrop.seedAvailability")}: ${localizedSeed}.` : ""} ${localizedBenefit ? `${t("intercrop.agroBenefit")}: ${localizedBenefit}` : ""}`.trim();

              return (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, x: -20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  transition={{ delay: i * 0.1 }}
                  className="bg-card rounded-3xl border border-border/80 p-6 shadow-natural hover:shadow-natural-lg transition-all space-y-4"
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                          🌿 {localizedCropName}
                        </h3>
                        <Badge 
                          variant="outline" 
                          data-provider={suggestions.provider || (suggestions.isAiEnhanced ? "gemini" : "local")}
                          className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${
                            suggestions.isAiEnhanced 
                              ? "bg-primary/10 text-primary border-primary/20" 
                              : "bg-muted text-muted-foreground border-border/60"
                          }`}
                        >
                          {suggestions.isAiEnhanced ? `✨ ${t("intercrop.aiEnhanced")}` : `📦 ${t("intercrop.offlineRecommendation")}`}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <VoiceButton
                        text={spokenCropText}
                        variant="icon"
                      />
                      {crop.matchPercentage && (
                        <div className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-semibold border border-primary/20 shrink-0">
                          {t("intercrop.matchScore", { percent: crop.matchPercentage })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="flex items-center gap-2 bg-muted/40 p-2.5 rounded-2xl border border-border/40 text-foreground font-medium">
                      <Calendar className="h-4 w-4 text-primary" /> 
                      <span>{t("intercrop.cycleDays", { days: crop.duration })}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-muted/40 p-2.5 rounded-2xl border border-border/40 text-foreground font-medium">
                      <IndianRupee className="h-4 w-4 text-primary" /> 
                      <span>{t("intercrop.profitPerAcre", { profit: String(crop.expectedProfitPerAcre?.toLocaleString() || crop.expectedProfitPerAcre || "").replace("₹", "").trim() })}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground italic px-1">
                    * {t("intercrop.incomeDisclaimer")}
                  </p>

                  <div className="bg-muted/20 p-3.5 rounded-2xl border border-border/40 text-xs space-y-2">
                    <p className="text-foreground leading-relaxed">
                      <span className="font-semibold text-foreground">{t("intercrop.sowingMethod")}: </span>
                      {localizedMethod}
                    </p>
                    {localizedSeed && (
                      <p className="text-primary font-medium">
                        🌱 {t("intercrop.seedAvailability")}: <span className="text-muted-foreground">{localizedSeed}</span>
                      </p>
                    )}
                    {localizedBenefit && (
                      <p className="text-emerald-800 dark:text-emerald-300 font-medium">
                        🌿 {t("intercrop.agroBenefit")}: <span className="text-muted-foreground">{localizedBenefit}</span>
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {/* AI-Enhanced Contextual Advisory Section */}
            {suggestions.aiAdvisory && (
              <div className="bg-primary/5 border border-primary/15 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> {t("intercrop.whyItFits")}
                  </h3>
                  <VoiceButton
                    text={`${suggestions.aiAdvisory.why_it_may_fit || ""}. ${suggestions.aiAdvisory.practical_advice || ""}`}
                    variant="icon"
                  />
                </div>

                {suggestions.aiAdvisory.why_it_may_fit && (
                  <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed bg-card/60 p-3.5 rounded-2xl border border-border/60">
                    {suggestions.aiAdvisory.why_it_may_fit}
                  </p>
                )}

                {suggestions.aiAdvisory.key_benefits && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                      🌿 {t("intercrop.agroBenefit")}
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1 pl-4 list-disc">
                      {Array.isArray(suggestions.aiAdvisory.key_benefits)
                        ? suggestions.aiAdvisory.key_benefits.map((b, idx) => <li key={idx}>{b}</li>)
                        : <li>{suggestions.aiAdvisory.key_benefits}</li>}
                    </ul>
                  </div>
                )}

                {suggestions.aiAdvisory.risks_or_considerations && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                      ⚠️ {t("intercrop.risksConsiderations")}
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1 pl-4 list-disc">
                      {Array.isArray(suggestions.aiAdvisory.risks_or_considerations)
                        ? suggestions.aiAdvisory.risks_or_considerations.map((r, idx) => <li key={idx}>{r}</li>)
                        : <li>{suggestions.aiAdvisory.risks_or_considerations}</li>}
                    </ul>
                  </div>
                )}

                {suggestions.aiAdvisory.practical_advice && (
                  <div className="text-xs bg-card p-3 rounded-2xl border border-border/60">
                    <p className="font-semibold text-foreground mb-0.5">💡 {t("intercrop.practicalAdvice")}</p>
                    <p className="text-muted-foreground">{suggestions.aiAdvisory.practical_advice}</p>
                  </div>
                )}

                {suggestions.aiAdvisory.when_to_consult_expert && (
                  <div className="text-[11px] text-muted-foreground border-t border-border/60 pt-2 flex items-start gap-1.5">
                    <Info className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{suggestions.aiAdvisory.when_to_consult_expert}</span>
                  </div>
                )}
              </div>
            )}

            {/* Offline General Agronomist Advisory Fallback */}
            {!suggestions.aiAdvisory && suggestions.generalAdvice && (() => {
              const localizedAdvice = suggestions.adviceKey ? t(`intercrop.generalAdvices.${suggestions.adviceKey}`) : suggestions.generalAdvice;
              const spokenAdviceText = `${t("intercrop.agronomistAdvice")}. ${localizedAdvice}`;

              return (
                <div className="bg-primary/5 border border-primary/15 rounded-3xl p-5 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-semibold text-sm mb-1 text-foreground">{t("intercrop.agronomistAdvice")}</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">{localizedAdvice}</p>
                      </div>
                    </div>
                    <VoiceButton
                      text={spokenAdviceText}
                      variant="icon"
                    />
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}