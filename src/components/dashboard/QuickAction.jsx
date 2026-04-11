import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

export default function QuickAction({ icon: Icon, label, description, path, color = "primary", index = 0 }) {
  const colorMap = {
    primary: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    green: "bg-emerald-500 text-white",
    amber: "bg-amber-500 text-white",
    blue: "bg-blue-500 text-white",
    rose: "bg-rose-500 text-white",
    purple: "bg-purple-500 text-white",
    teal: "bg-teal-500 text-white",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Link
        to={path}
        className="flex items-center gap-4 p-4 bg-card rounded-2xl border border-border hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group"
      >
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground truncate">{description}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
      </Link>
    </motion.div>
  );
}