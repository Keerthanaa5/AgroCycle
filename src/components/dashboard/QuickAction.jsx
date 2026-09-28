import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

export default function QuickAction({ icon: Icon, label, description, path = "#", onClick, color = "primary", index = 0 }) {
  const colorMap = {
    primary: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    green: "bg-emerald-700 text-white",
    amber: "bg-amber-600 text-white",
    blue: "bg-sky-700 text-white",
    rose: "bg-rose-600 text-white",
    purple: "bg-purple-700 text-white",
    teal: "bg-teal-700 text-white",
  };

  const innerContent = (
    <div className="flex items-center gap-3.5 p-4 bg-card rounded-2xl border border-border/80 shadow-xs hover:shadow-natural hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-200 group text-left w-full cursor-pointer">
      <div className={`h-11 w-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xs ${colorMap[color] || colorMap.primary}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">{label}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{description}</p>
      </div>
      <div className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-secondary transition-all">
        <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
    >
      {onClick ? (
        <button type="button" onClick={onClick} className="w-full block text-left bg-transparent p-0 border-0">
          {innerContent}
        </button>
      ) : (
        <Link to={path} className="block">
          {innerContent}
        </Link>
      )}
    </motion.div>
  );
}