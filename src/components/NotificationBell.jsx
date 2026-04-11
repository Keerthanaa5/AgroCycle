import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";

const typeIcons = {
  buyer_match: "🛒",
  fodder_request: "🐄",
  claim_update: "📄",
  community_post: "🌾",
  silage_confirmed: "🏭",
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    loadNotifications();

    // Real-time subscription
    const unsub = base44.entities.Notification.subscribe((event) => {
      if (event.type === "create") {
        setNotifications((prev) => [event.data, ...prev]);
      } else if (event.type === "update") {
        setNotifications((prev) =>
          prev.map((n) => (n.id === event.id ? event.data : n))
        );
      } else if (event.type === "delete") {
        setNotifications((prev) => prev.filter((n) => n.id !== event.id));
      }
    });

    return unsub;
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function loadNotifications() {
    const me = await base44.auth.me().catch(() => null);
    if (!me) return;
    const data = await base44.entities.Notification.filter(
      { recipient_email: me.email },
      "-created_date",
      30
    );
    setNotifications(data);
  }

  async function markAllRead() {
    const unread = notifications.filter((n) => !n.is_read);
    await Promise.all(
      unread.map((n) => base44.entities.Notification.update(n.id, { is_read: true }))
    );
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function markRead(id) {
    await base44.entities.Notification.update(id, { is_read: true });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative h-10 w-10 rounded-xl bg-accent flex items-center justify-center hover:bg-accent/80 transition-colors"
      >
        <Bell className="h-5 w-5 text-foreground" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-80 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-bold text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-primary hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => (
                  <Link
                    key={n.id}
                    to={n.link || "/"}
                    onClick={() => { markRead(n.id); setOpen(false); }}
                    className={`flex gap-3 px-4 py-3 hover:bg-accent transition-colors border-b border-border/50 last:border-0 ${
                      !n.is_read ? "bg-primary/5" : ""
                    }`}
                  >
                    <span className="text-xl flex-shrink-0 mt-0.5">
                      {typeIcons[n.type] || "🔔"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${!n.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
                        {n.message}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                    )}
                  </Link>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}