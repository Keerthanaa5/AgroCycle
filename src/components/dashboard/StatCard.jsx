import { motion } from "framer-motion";

export default function StatCard({ icon: Icon, label, value, subtitle, color = "primary" }) {
  const colorMap = {
    primary: "bg-primary/10 text-primary border border-primary/20",
    secondary: "bg-secondary text-secondary-foreground border border-border",
    green: "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    amber: "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    blue: "bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
    rose: "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
    purple: "bg-purple-50 text-purple-800 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="bg-card rounded-2xl border border-border/80 p-5 shadow-xs hover:shadow-natural hover:border-primary/20 transition-all duration-200 flex flex-col justify-between"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{value}</p>
        </div>
        <div className={`h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xs ${colorMap[color] || colorMap.primary}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-3 pt-2 border-t border-border/60">{subtitle}</p>
      )}
    </motion.div>
  );
}