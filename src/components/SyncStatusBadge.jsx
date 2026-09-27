import React from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, AlertCircle, Loader2, FileText, RefreshCw } from "lucide-react";
import { useLanguage } from "@/i18n";

/**
 * Standard Sync Status Badge for Offline-First Workflows
 * 
 * Displays transparent sync state across cards and detail views.
 * 
 * @param {Object} props
 * @param {string} props.status - 'pending' | 'syncing' | 'synced' | 'failed' | 'draft_offline'
 * @param {Function} [props.onRetry] - Optional retry handler for failed actions
 * @param {string} [props.className] - Additional CSS class names
 */
export default function SyncStatusBadge({ status, onRetry, className = "" }) {
  const { t } = useLanguage();
  if (!status) return null;

  const normalized = String(status).toLowerCase();

  switch (normalized) {
    case "pending":
    case "pending_sync":
      return (
        <Badge
          variant="outline"
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border-amber-300/80 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60 shadow-xs ${className}`}
          title="Action saved locally in IndexedDB. Will sync when internet is connected."
        >
          <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400 animate-pulse" />
          <span>{t("common.pendingSync")}</span>
        </Badge>
      );

    case "syncing":
      return (
        <Badge
          variant="outline"
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border-sky-300/80 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60 shadow-xs ${className}`}
          title="Synchronizing local record..."
        >
          <Loader2 className="w-3 h-3 text-sky-600 dark:text-sky-400 animate-spin" />
          <span>{t("common.syncing")}</span>
        </Badge>
      );

    case "synced":
      return (
        <Badge
          variant="outline"
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border-emerald-300/80 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 shadow-xs ${className}`}
          title="Record synchronized"
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>{t("common.synced")}</span>
        </Badge>
      );

    case "failed":
      return (
        <Badge
          variant="outline"
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border-rose-300/80 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60 shadow-xs ${className}`}
          title="Sync encountered an issue. Local record is preserved."
        >
          <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
          <span>{t("common.syncFailed")}</span>
          {onRetry && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              className="ml-1 hover:underline text-[10px] uppercase font-bold flex items-center gap-0.5 text-rose-700 dark:text-rose-300"
              title="Retry synchronization"
            >
              <RefreshCw className="w-2.5 h-2.5" /> {t("common.retry")}
            </button>
          )}
        </Badge>
      );

    case "draft_offline":
    case "draft":
      return (
        <Badge
          variant="outline"
          className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border-stone-300/80 bg-stone-50 text-stone-700 dark:bg-stone-900/50 dark:text-stone-300 dark:border-stone-700 shadow-xs ${className}`}
          title="Claim dossier draft saved offline in IndexedDB."
        >
          <FileText className="w-3 h-3 text-stone-500 dark:text-stone-400" />
          <span>{t("common.draftOffline")}</span>
        </Badge>
      );

    default:
      return null;
  }
}
