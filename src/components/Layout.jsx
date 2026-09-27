import { Outlet, Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { 
  LayoutDashboard, Users, ShoppingCart, Leaf, ScanLine, 
  Warehouse, FileCheck, Sprout, Bot, User, Menu, X, LogOut,
  Shield, ArrowLeftRight, CheckCircle2, WifiOff, Wifi, RefreshCw, AlertCircle, TrendingUp, Truck
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useLanguage } from "@/i18n";
import LanguageSelector from "./LanguageSelector";
import { 
  formatRoleName, 
  isFarmer, 
  isBuyer, 
  isDualRole, 
  isActiveFarmer, 
  isActiveBuyer, 
  ROLES 
} from "@/services/roleManager";
import NotificationBell from "./NotificationBell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import VerifiedBadge from "./VerifiedBadge";
import { syncManager } from "@/services/syncManager";
import { getUserQueue, SYNC_STATUS } from "@/services/syncQueue";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { 
    user, 
    roles,
    activeRole, 
    isActiveFarmer, 
    isActiveBuyer, 
    isDualRole, 
    switchRole, 
    logout 
  } = useAuth();
  const { t } = useLanguage();
  const { isOnline, isOffline } = useOnlineStatus();
  const [syncState, setSyncState] = useState({ pendingCount: 0, failedCount: 0, isSyncing: false });

  const currentUserId = user?.userId || user?.id;

  const refreshSyncCounts = async () => {
    if (!currentUserId) return;
    try {
      const queue = await getUserQueue(currentUserId);
      const pending = queue.filter(a => a.status === SYNC_STATUS.PENDING || (a.status === SYNC_STATUS.FAILED && a.retryCount < 3));
      const failed = queue.filter(a => a.status === SYNC_STATUS.FAILED && a.retryCount >= 3);
      setSyncState(prev => ({
        ...prev,
        pendingCount: pending.length,
        failedCount: failed.length
      }));
    } catch (e) {}
  };

  useEffect(() => {
    refreshSyncCounts();
    if (isOnline && currentUserId) {
      syncManager.processQueue(currentUserId).catch(() => {});
    }
    const unsub = syncManager.subscribe(event => {
      if (event.type === "SYNC_START") {
        setSyncState(prev => ({ ...prev, isSyncing: true }));
      } else if (event.type === "SYNC_COMPLETE") {
        setSyncState(prev => ({ ...prev, isSyncing: false }));
        refreshSyncCounts();
      } else {
        refreshSyncCounts();
      }
    });
    return unsub;
  }, [currentUserId, isOnline]);

  const farmerNavItems = [
    { path: "/", label: t("navigation.dashboard"), icon: LayoutDashboard },
    { path: "/viability-scanner", label: t("navigation.viabilityScanner"), icon: ScanLine },
    { path: "/smart-logistics", label: t("navigation.smartLogistics") || "Smart Logistics", icon: Truck },
    { path: "/market-intelligence", label: t("navigation.marketIntelligence") || "Market Intelligence", icon: TrendingUp },
    { path: "/claim-rocket", label: t("navigation.claimRocket"), icon: FileCheck },
    { path: "/agro-connect", label: t("navigation.agroConnect"), icon: Users },
    { path: "/waste-market", label: t("navigation.wasteMarket"), icon: ShoppingCart },
    { path: "/silage-bank", label: t("navigation.silageBank"), icon: Warehouse },
    { path: "/carbon-cash", label: t("navigation.carbonCash"), icon: Leaf },
    { path: "/intercrop-wizard", label: t("navigation.intercropWizard"), icon: Sprout },
    { path: "/ai-assistant", label: t("navigation.aiAssistant"), icon: Bot },
    { path: "/profile", label: t("navigation.profile"), icon: User },
  ];

  const buyerNavItems = [
    { path: "/", label: t("navigation.buyerDashboard"), icon: LayoutDashboard },
    { path: "/smart-logistics", label: t("navigation.smartLogistics") || "Smart Logistics", icon: Truck },
    { path: "/market-intelligence", label: t("navigation.marketIntelligence") || "Market Intelligence", icon: TrendingUp },
    { path: "/waste-market", label: t("navigation.wasteMarket"), icon: ShoppingCart },
    { path: "/silage-bank", label: t("navigation.silageBank"), icon: Warehouse },
    { path: "/carbon-cash", label: t("navigation.carbonCash"), icon: Leaf },
    { path: "/agro-connect", label: t("navigation.agroConnect"), icon: Users },
    { path: "/ai-assistant", label: t("navigation.aiAssistant"), icon: Bot },
    { path: "/profile", label: t("navigation.profile"), icon: User },
  ];

  const navItems = isActiveBuyer ? buyerNavItems : farmerNavItems;
  const currentModeLabel = isActiveBuyer ? t("common.buyerMode") : t("common.farmerMode");

  return (
    <div className="min-h-screen bg-background flex text-foreground">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen w-72 bg-sidebar border-r border-sidebar-border
        flex flex-col transition-transform duration-300 ease-out relative overflow-hidden
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Subtle decorative slow-floating botanical silhouette */}
        <div className="absolute -bottom-10 -right-10 opacity-[0.04] pointer-events-none text-primary animate-float-slow">
          <Leaf className="w-44 h-44" />
        </div>

        {/* Logo & Brand Identity */}
        <div className="p-5 border-b border-sidebar-border space-y-3 bg-card/40 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-xs">
                <Leaf className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-bold text-lg text-foreground tracking-tight flex items-center gap-1">
                  AgroCycle
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                    isActiveBuyer 
                      ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' 
                      : 'bg-primary/10 text-primary border-primary/20 dark:bg-primary/20'
                  }`}>
                    {currentModeLabel}
                  </span>
                </div>
              </div>
            </div>
            <NotificationBell />
          </div>

          {/* Compact Language Selector in Sidebar */}
          <div className="pt-1">
            <LanguageSelector variant="compact" className="w-full justify-between" />
          </div>

          {/* Dual Role Switcher Widget in Sidebar */}
          {isDualRole && (
            <div className="p-3 rounded-2xl border border-border/80 bg-card/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">{t("common.activeMode")}:</span>
                <span className="font-semibold text-foreground">
                  {isActiveFarmer ? `🌾 ${t("common.farmer")}` : `💼 ${t("common.buyer")}`}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => switchRole(isActiveFarmer ? ROLES.BUYER : ROLES.FARMER)}
                className="w-full text-xs font-semibold gap-1.5 h-8 bg-card hover:bg-secondary border-border shadow-xs rounded-xl"
              >
                <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
                <span>{isActiveFarmer ? t("common.switchRoleToBuyer") : t("common.switchRoleToFarmer")}</span>
              </Button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3.5 space-y-1 overflow-y-auto relative z-10">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path + item.label}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                  ${isActive 
                    ? 'bg-primary text-primary-foreground shadow-xs font-semibold' 
                    : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                  }
                `}
              >
                <Icon className={`h-4.5 w-4.5 flex-shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-sidebar-border space-y-2 bg-card/30 relative z-10">
          {user && (
            <div className="px-3.5 py-2.5 bg-card rounded-2xl text-xs space-y-1 border border-border/80 shadow-xs">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground truncate max-w-[130px]">{user.name || user.full_name || "User"}</p>
                <VerifiedBadge status={user.verificationStatus} showIconOnly />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-mono text-[10px]">{user.userId || user.id || "N/A"}</span>
                <span className="font-medium text-foreground">
                  {isDualRole ? `🌾+💼 ${t("common.dualRole")}` : formatRoleName(activeRole)}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={logout}
            className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {t("common.logout")}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen flex flex-col">
        {/* Offline Indicator Banner */}
        {isOffline && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-200 flex items-center justify-between gap-2 shadow-xs transition-all">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span className="font-bold flex items-center gap-1 text-amber-900 dark:text-amber-200">
                <WifiOff className="h-3.5 w-3.5 text-amber-700" /> {t("common.offlineMode")}
              </span>
              <span className="hidden sm:inline text-amber-800/80 dark:text-amber-300/80">
                — {t("common.offlineBannerDesc")}
                {syncState.pendingCount > 0 && ` (${syncState.pendingCount > 1 ? t("common.queuedActionsPlural", { count: syncState.pendingCount }) : t("common.queuedActions", { count: syncState.pendingCount })})`}
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white dark:bg-amber-900 border border-amber-300 font-semibold text-amber-800 dark:text-amber-200">
              {t("common.localEngine")}
            </span>
          </div>
        )}

        {/* Syncing / Retry Banner */}
        {isOnline && syncState.isSyncing && (
          <div className="bg-sky-50 border-b border-sky-200 px-4 py-1.5 text-xs text-sky-900 dark:bg-sky-950/40 dark:border-sky-900 dark:text-sky-200 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-sky-600 dark:text-sky-400" />
              <span className="font-medium">{t("common.syncingBanner")}</span>
            </div>
          </div>
        )}

        {isOnline && !syncState.isSyncing && syncState.failedCount > 0 && (
          <div className="bg-rose-50 border-b border-rose-200 px-4 py-1.5 text-xs text-rose-900 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200 flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
              <span className="font-medium">
                {syncState.failedCount > 1 
                  ? t("common.syncFailedBannerPlural", { count: syncState.failedCount }) 
                  : t("common.syncFailedBanner", { count: syncState.failedCount })
                }
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => syncManager.retryAllFailed(currentUserId)}
              className="h-6 text-[11px] px-2 text-rose-700 border-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded-lg"
            >
              {t("common.retrySync")}
            </Button>
          </div>
        )}

        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-card/90 backdrop-blur-md border-b border-border/80 px-4 py-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="rounded-xl">
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
                  <Leaf className="h-4 w-4" />
                </div>
                <span className="font-bold text-sm tracking-tight">AgroCycle</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <LanguageSelector variant="compact" />
              {isDualRole && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="text-xs h-8 px-2 gap-1 rounded-xl"
                  onClick={() => switchRole(isActiveFarmer ? ROLES.BUYER : ROLES.FARMER)}
                >
                  <ArrowLeftRight className="h-3 w-3" />
                  <span>{isActiveFarmer ? "Buyer" : "Farmer"}</span>
                </Button>
              )}
              <NotificationBell />
            </div>
          </div>
        </header>

        {/* Desktop Top Header Bar for Language Selector */}
        <header className="hidden lg:flex sticky top-0 z-30 bg-card/70 backdrop-blur-md border-b border-border/60 px-8 py-2.5 items-center justify-end gap-3">
          <LanguageSelector variant="compact" />
          {isDualRole && (
            <Button 
              size="sm" 
              variant="outline" 
              className="text-xs h-8 px-3 gap-1.5 rounded-xl border-border/80 font-medium"
              onClick={() => switchRole(isActiveFarmer ? ROLES.BUYER : ROLES.FARMER)}
            >
              <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
              <span>{isActiveFarmer ? t("common.switchRoleToBuyer") : t("common.switchRoleToFarmer")}</span>
            </Button>
          )}
        </header>

        <div className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}