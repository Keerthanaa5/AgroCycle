import { useState, useEffect } from "react";
import { mockApi } from "@/api/mockApi";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/i18n";
import { 
  getProfileCompleteness, 
  isActiveFarmer, 
  isActiveBuyer, 
  isDualRole, 
  ROLES 
} from "@/services/roleManager";
import { 
  Users, ShoppingCart, Leaf, ScanLine, Warehouse, 
  FileCheck, Sprout, Bot, TrendingUp, Recycle, CircleDollarSign, Award,
  Building2, Briefcase, ArrowRight, UserCheck, ArrowLeftRight, CheckCircle2, Sparkles
} from "lucide-react";
import StatCard from "../components/dashboard/StatCard";
import QuickAction from "../components/dashboard/QuickAction";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import VerifiedBadge from "@/components/VerifiedBadge";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const { 
    user, 
    activeRole, 
    isActiveFarmer, 
    isActiveBuyer, 
    isDualRole, 
    switchRole 
  } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState({ posts: 0, matches: 0, carbon: 0, claims: 0 });

  const roleTitle = isActiveBuyer ? t("common.buyerMode") : t("common.farmerMode");
  const userName = user?.name || user?.full_name || (isActiveBuyer ? t("common.buyer") : t("common.farmer"));
  const completeness = getProfileCompleteness(user);

  const farmerQuickActions = [
    { icon: ScanLine, label: t("navigation.viabilityScanner"), description: t("dashboard.quickActions.scanCropDesc"), path: "/viability-scanner", color: "blue" },
    { icon: ShoppingCart, label: t("navigation.wasteMarket"), description: t("dashboard.quickActions.marketWasteDesc"), path: "/waste-market", color: "amber" },
    { icon: FileCheck, label: t("navigation.claimRocket"), description: t("dashboard.quickActions.prepareClaimDesc"), path: "/claim-rocket", color: "rose" },
    { icon: Users, label: t("navigation.agroConnect"), description: t("dashboard.quickActions.intercropDesc"), path: "/agro-connect", color: "primary" },
    { icon: Warehouse, label: t("navigation.silageBank"), description: t("dashboard.quickActions.bookSilageDesc"), path: "/silage-bank", color: "purple" },
    { icon: Leaf, label: t("navigation.carbonCash"), description: t("dashboard.quickActions.earnCarbonDesc"), path: "/carbon-cash", color: "green" },
    { icon: Sprout, label: t("navigation.intercropWizard"), description: t("dashboard.quickActions.intercropDesc"), path: "/intercrop-wizard", color: "teal" },
    { icon: Bot, label: t("navigation.aiAssistant"), description: t("aiAssistant.subtitle"), path: "/ai-assistant", color: "secondary" },
  ];

  const buyerQuickActions = [
    { icon: ShoppingCart, label: t("navigation.wasteMarket"), description: t("wasteMarket.subtitle"), path: "/waste-market", color: "amber" },
    { icon: Warehouse, label: t("navigation.silageBank"), description: t("silageBank.subtitle"), path: "/silage-bank", color: "purple" },
    { icon: Leaf, label: t("navigation.carbonCash"), description: t("carbonCash.subtitle"), path: "/carbon-cash", color: "green" },
    { icon: Users, label: t("navigation.agroConnect"), description: t("agroConnect.subtitle"), path: "/agro-connect", color: "primary" },
    { icon: Bot, label: t("navigation.aiAssistant"), description: t("aiAssistant.subtitle"), path: "/ai-assistant", color: "secondary" },
  ];

  const quickActions = isActiveBuyer ? buyerQuickActions : farmerQuickActions;

  useEffect(() => {
    async function load() {
      const [posts, matches, carbon, claims] = await Promise.all([
        mockApi.entities.CropPost.list().catch(() => []),
        mockApi.entities.WasteMatch.list().catch(() => []),
        mockApi.entities.CarbonActivity.list().catch(() => []),
        mockApi.entities.InsuranceClaim.list().catch(() => []),
      ]);
      setStats({
        posts: posts.length,
        matches: matches.length,
        carbon: carbon.reduce((s, c) => s + (c.co2_saved_kg || 0), 0),
        claims: claims.length,
      });
    }
    load();
  }, []);

  return (
    <div className="space-y-8 pb-8">
      {/* Deep Forest Green Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="agro-hero-deep p-6 sm:p-8 shadow-natural relative overflow-hidden"
      >
        {/* Subtle decorative slow-floating botanical silhouette in corner */}
        <div className="absolute right-3 -bottom-8 opacity-10 pointer-events-none text-emerald-300 animate-float-slow">
          <Leaf className="w-56 h-56" />
        </div>

        <div className="relative z-10 space-y-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-200/90 flex items-center gap-1.5 bg-black/20 px-3 py-1 rounded-full backdrop-blur-xs border border-white/10">
                <Leaf className="w-3.5 h-3.5 text-emerald-400" />
                <span>AgroCycle • {roleTitle}</span>
              </span>
              
              {isDualRole ? (
                <span className="text-[11px] px-3 py-1 rounded-full font-semibold bg-purple-900/60 text-purple-200 border border-purple-400/30">
                  🌾+💼 {t("common.dualRole")}
                </span>
              ) : (
                <span className={`text-[11px] px-3 py-1 rounded-full font-semibold border ${
                  isActiveBuyer 
                    ? 'bg-amber-900/60 text-amber-200 border-amber-400/30' 
                    : 'bg-emerald-900/60 text-emerald-200 border-emerald-400/30'
                }`}>
                  {isActiveBuyer ? t("common.buyer") : t("common.farmer")}
                </span>
              )}

              <VerifiedBadge status={user?.verificationStatus} />
            </div>

            {/* Quick Switch Button for Dual-Role accounts */}
            {isDualRole && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => switchRole(isActiveFarmer ? ROLES.BUYER : ROLES.FARMER)}
                className="gap-2 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/20 text-white border-white/20 shadow-xs h-8 backdrop-blur-xs"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-emerald-300" />
                <span>{isActiveFarmer ? t("common.switchRoleToBuyer") : t("common.switchRoleToFarmer")}</span>
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight">
              {t("dashboard.greetingDefault", { name: userName })} 🌾
            </h1>
            <p className="text-emerald-100/80 text-xs sm:text-sm max-w-2xl leading-relaxed">
              {isActiveBuyer 
                ? t("dashboard.welcomeBuyerSubtitle")
                : t("dashboard.welcomeFarmerSubtitle")
              }
            </p>
          </div>

          {/* Profile Completeness Banner */}
          {completeness.overall < 100 && (
            <div className="bg-white/10 border border-white/15 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs backdrop-blur-xs">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{t("dashboard.profileCompleteness")}: {completeness.overall}%</span>
                  {isDualRole && (
                    <span className="text-emerald-200/70 text-[11px]">
                      ({t("common.farmer")}: {completeness.farmer}% • {t("common.buyer")}: {completeness.buyer}%)
                    </span>
                  )}
                </div>
                <div className="w-48 sm:w-72 h-2 bg-black/30 rounded-full overflow-hidden border border-white/10">
                  <div 
                    className="h-full bg-emerald-400 transition-all duration-500 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)]" 
                    style={{ width: `${completeness.overall}%` }} 
                  />
                </div>
              </div>
              <Link to="/profile" className="text-emerald-300 hover:text-white font-semibold text-xs inline-flex items-center gap-1 transition-colors">
                {t("dashboard.completeProfileCTA")} <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </div>
          )}
        </div>
      </motion.div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {isActiveBuyer ? (
          <>
            <StatCard icon={CircleDollarSign} label={t("dashboard.kpis.activeWaste")} value={stats.matches || 6} subtitle={t("wasteMarket.filters.cropResidue")} color="amber" />
            <StatCard icon={Warehouse} label={t("dashboard.kpis.silageFacilities")} value="2 Active" subtitle={t("silageBank.availableHubs")} color="purple" />
            <StatCard icon={Leaf} label={t("dashboard.kpis.carbonCredits")} value={`${stats.carbon} kg`} subtitle={t("carbonCash.treasuryHero.title")} color="green" />
            <StatCard icon={Recycle} label={t("dashboard.kpis.procurementRequests")} value={stats.posts} subtitle={t("agroConnect.title")} color="primary" />
          </>
        ) : (
          <>
            <StatCard icon={Recycle} label={t("dashboard.kpis.activeWaste")} value={stats.posts} subtitle={t("agroConnect.title")} color="primary" />
            <StatCard icon={CircleDollarSign} label={t("wasteMarket.title")} value={stats.matches} subtitle={t("wasteMarket.filters.all")} color="amber" />
            <StatCard icon={Leaf} label={t("dashboard.kpis.carbonCredits")} value={`${stats.carbon} kg`} subtitle={t("carbonCash.title")} color="green" />
            <StatCard icon={Award} label={t("claimRocket.title")} value={stats.claims} subtitle={t("claimRocket.badge")} color="blue" />
          </>
        )}
      </div>

      {/* Quick Actions & Daily Operations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground tracking-tight">
              {t("dashboard.quickActionsTitle")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">{isActiveBuyer ? t("dashboard.welcomeBuyerSubtitle") : t("dashboard.welcomeFarmerSubtitle")}</p>
          </div>
        </div>
        <div className={`grid sm:grid-cols-2 ${isActiveBuyer ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-3 sm:gap-3.5`}>
          {quickActions.map((action, i) => (
            <QuickAction key={action.path + action.label} {...action} index={i} />
          ))}
        </div>
      </div>

      {/* Step-by-Step Agricultural Guide Section */}
      <div className="agro-section-sage p-6 sm:p-8 shadow-xs space-y-4">
        <div>
          <h3 className="font-bold text-base sm:text-lg text-foreground tracking-tight">
            {t("dashboard.howItWorksTitle")}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t("dashboard.welcomeFarmerSubtitle")}</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 pt-1">
          {[
            { step: "1", title: t("dashboard.steps.step1Title"), desc: t("dashboard.steps.step1Desc") },
            { step: "2", title: t("dashboard.steps.step2Title"), desc: t("dashboard.steps.step2Desc") },
            { step: "3", title: t("dashboard.steps.step3Title"), desc: t("dashboard.steps.step3Desc") },
          ].map((s) => (
            <div key={s.step} className="p-4 rounded-2xl bg-white/70 dark:bg-card/70 border border-primary/15 flex gap-3.5 items-start shadow-xs">
              <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0 border border-primary/25">
                {s.step}
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}