import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { 
  canAddSilageCenter, 
  canBookSilage, 
  isActiveFarmer, 
  isActiveBuyer, 
  isRecordOwner 
} from "@/services/roleManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Plus, Warehouse, MapPin, Truck, Calendar, Loader2, 
  Phone, MessageSquare, Trash2, CheckCircle2, Clock, 
  AlertCircle, ChevronRight, Package, Info, ShieldAlert
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import VerifiedBadge from "@/components/VerifiedBadge";
import SyncStatusBadge from "@/components/SyncStatusBadge";
import { storageService } from "@/services/storageService";
import { enqueueAction, ACTION_TYPES } from "@/services/syncQueue";
import { syncManager } from "@/services/syncManager";
import { useLanguage } from "@/i18n";

// Sample prototype listings clearly marked as demonstration records
const DEFAULT_CENTERS = [
  { 
    id: "sample_center_1", 
    name: "GreenFeed Silage Center", 
    location: "Hyderabad, Telangana", 
    price_per_kg: 3, 
    distance: "15 km", 
    phone: "9876543210", 
    owner: "GreenFeed Agro Services", 
    creatorId: "sys_sample_1", 
    creatorVerificationStatus: "verified",
    isSample: true 
  },
  { 
    id: "sample_center_2", 
    name: "AgroSilage Processing Hub", 
    location: "Warangal, Telangana", 
    price_per_kg: 2.5, 
    distance: "25 km", 
    phone: "9876543211", 
    owner: "AgroSilage Co.", 
    creatorId: "sys_sample_2", 
    creatorVerificationStatus: "verified",
    isSample: true 
  },
];

function getStoredCenters() {
  try {
    const raw = localStorage.getItem("silageCenters");
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Failed to parse silageCenters from localStorage:", err);
    return [];
  }
}

function saveStoredCenters(centers) {
  try {
    localStorage.setItem("silageCenters", JSON.stringify(centers));
  } catch (e) {}
  storageService.bulkPut(storageService.STORES.SILAGE_CENTERS, centers).catch(() => {});
}

function getStoredBookings() {
  try {
    const raw = localStorage.getItem("silageBookings");
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Failed to parse silageBookings from localStorage:", err);
    return [];
  }
}

function saveStoredBookings(bookings) {
  try {
    localStorage.setItem("silageBookings", JSON.stringify(bookings));
  } catch (e) {}
  storageService.bulkPut(storageService.STORES.SILAGE_BOOKINGS, bookings).catch(() => {});
}

function BuyerAddCenter({ loadCenters }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  if (!canAddSilageCenter(user)) return null;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", location: "", distance: "", price: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const priceNum = Number(form.price);
    if (!form.name.trim() || !form.location.trim() || isNaN(priceNum) || priceNum <= 0) {
      alert("Please provide a valid center name, operating location, and positive price per kg.");
      return;
    }

    setSubmitting(true);
    try {
      const currentUserId = user?.userId || user?.id;
      const newCenter = {
        id: "cnt_" + Date.now(),
        creatorId: currentUserId,
        creatorRole: "buyer",
        creatorName: user?.name || user?.full_name || "Facility Operator",
        creatorPhone: user?.phone || "",
        creatorVerificationStatus: user?.verificationStatus || "pending",
        name: form.name.trim(),
        location: form.location.trim(),
        distance: form.distance.trim() || "Local Facility",
        price_per_kg: priceNum,
        phone: form.phone ? form.phone.trim() : (user?.phone || ""),
        owner: user?.name || user?.full_name || "Facility Operator",
        isSample: false,
        created_at: new Date().toISOString()
      };

      const existing = getStoredCenters();
      saveStoredCenters([newCenter, ...existing]);

      // Enqueue in offline sync queue
      enqueueAction({
        userId: currentUserId,
        actionType: ACTION_TYPES.SAVE_SILAGE_CENTER,
        entityType: "silageCenter",
        entityId: newCenter.id,
        payload: newCenter
      }).then(() => {
        if (syncManager.isOnline()) {
          syncManager.processQueue(currentUserId).catch(() => {});
        }
      }).catch(err => {
        console.warn("[SilageBank] Enqueue center sync error:", err);
      });
      
      setOpen(false);
      setForm({ name: "", location: "", distance: "", price: "", phone: "" });
      loadCenters();
    } catch (err) {
      console.error("Center Creation Error:", err);
      alert("Failed to save silage center. Please check storage.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 shadow-xs rounded-xl"><Plus className="h-4 w-4" /> {t("silageBank.addCenter")}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-3xl p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{t("silageBank.addCenter")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="bg-muted/40 p-3.5 rounded-2xl border border-border/80 text-xs flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">{t("silageBank.operatorLabel", { name: user?.name || user?.full_name || "Buyer" })}</p>
              <p className="text-muted-foreground font-mono text-[11px] mt-0.5">ID: {user?.userId || "N/A"}</p>
            </div>
            <VerifiedBadge status={user?.verificationStatus} />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">Center / Facility Name *</label>
            <Input 
              placeholder="e.g. Krishna Silage Processing Hub" 
              value={form.name} 
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
              required 
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Operating Location *</label>
              <Input 
                placeholder="District, State" 
                value={form.location} 
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))} 
                required 
                className="rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Service Coverage Radius *</label>
              <Input 
                placeholder="e.g. 20 km" 
                value={form.distance} 
                onChange={e => setForm(f => ({ ...f, distance: e.target.value }))} 
                required 
                className="rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">{t("silageBank.processingRate")} (₹ per kg) *</label>
            <Input 
              type="number" 
              step="0.1" 
              min="0.1" 
              placeholder="e.g. 2.50" 
              value={form.price} 
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))} 
              required 
              className="rounded-xl"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-foreground block mb-1">
              Facility Direct Contact Number
            </label>
            <Input
              placeholder={user?.phone || "10-digit Mobile"}
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="rounded-xl"
            />
          </div>

          <Button type="submit" className="w-full rounded-2xl py-5" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & List Facility"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SilageBank() {
  const { user, activeRole } = useAuth();
  const { t } = useLanguage();
  const [centers, setCenters] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [incomingOrders, setIncomingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Farmer Booking Modal State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState(null);
  
  const todayStr = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ 
    crop_type: "", 
    quantity_kg: "", 
    pickup_date: todayStr, 
    location: user?.farmerProfile?.farmLocation || "" 
  });

  useEffect(() => {
    loadCenters();
    loadBookings();

    const unsub = syncManager.subscribe((event) => {
      if (event.type === "ACTION_SYNCED" || event.type === "SYNC_COMPLETE") {
        loadBookings();
      }
    });

    return () => unsub();
  }, [user, activeRole]);

  async function loadCenters() {
    let localCenters = [];
    try {
      localCenters = await storageService.silageCenters.getAll();
    } catch (e) {}
    if (!localCenters || localCenters.length === 0) {
      localCenters = getStoredCenters();
    }
    setCenters([...DEFAULT_CENTERS, ...localCenters]);
  }

  async function loadBookings() {
    setLoading(true);
    let allBookings = [];
    try {
      allBookings = await storageService.silageBookings.getAll();
    } catch (e) {}
    if (!allBookings || allBookings.length === 0) {
      allBookings = getStoredBookings();
    }
    const currentUserId = user?.userId || user?.id;

    // 1. Farmer Bookings: strictly where current user is creator
    const myFarmerBookings = allBookings.filter(b => isRecordOwner(b, user));
    setBookings(myFarmerBookings);

    // 2. Buyer Incoming Orders: bookings for centers created by this buyer
    const localCenters = getStoredCenters();
    const myCenterIds = localCenters
      .filter(c => isRecordOwner(c, user))
      .map(c => c.id);

    const myIncoming = allBookings.filter(b => {
      if (b.center_creatorId && currentUserId && b.center_creatorId === currentUserId) {
        return true;
      }
      return myCenterIds.includes(b.center_id);
    });
    setIncomingOrders(myIncoming);

    setLoading(false);
  }

  function handleBook(center) {
    const qty = Number(form.quantity_kg);
    if (!form.crop_type.trim() || isNaN(qty) || qty <= 0) {
      alert("Please provide a valid crop type and positive quantity in kg.");
      return;
    }

    if (form.pickup_date && form.pickup_date < todayStr) {
      alert("Pickup date cannot be in the past. Please select a valid future date.");
      return;
    }

    if (!canBookSilage(user)) {
      alert("Only registered Farmers can book feed pickups.");
      return;
    }

    const currentUserId = user?.userId || user?.id;
    const pricePerKg = Number(String(center.price_per_kg).replace(/[^\d.]/g, "")) || 0;
    const totalPrice = Math.round(qty * pricePerKg);

    const newBooking = {
      id: "sbk_" + Date.now(),
      creatorId: currentUserId,
      creatorRole: "farmer",
      creatorName: user?.name || user?.full_name || "Farmer",
      creatorPhone: user?.phone || "",
      creatorVerificationStatus: user?.verificationStatus || "pending",
      crop_type: form.crop_type.trim(),
      quantity_kg: qty,
      pickup_date: form.pickup_date || todayStr,
      location: form.location.trim() || "Farm Location",
      farmer_phone: user?.phone || "",
      farmer_name: user?.name || user?.full_name || "Farmer",
      
      // Center reference
      center_id: center.id,
      center_name: center.name,
      center_location: center.location,
      center_phone: center.phone || center.creatorPhone || "",
      center_creatorId: center.creatorId || null,
      price_per_kg: pricePerKg,
      total_price: totalPrice,
      
      status: "requested",
      sync_status: "pending",
      created_date: new Date().toISOString()
    };

    const existing = getStoredBookings();
    saveStoredBookings([newBooking, ...existing]);

    // Enqueue action in offline sync queue
    enqueueAction({
      userId: currentUserId,
      actionType: ACTION_TYPES.CREATE_SILAGE_BOOKING,
      entityType: "silageBooking",
      entityId: newBooking.id,
      payload: newBooking
    }).then(() => {
      // Trigger sync if online
      if (syncManager.isOnline()) {
        syncManager.processQueue(currentUserId).catch(() => {});
      }
    }).catch(err => {
      console.warn("[SilageBank] Failed to enqueue sync action:", err);
    });

    setDialogOpen(false);
    setSelectedCenter(null);
    setForm({ 
      crop_type: "", 
      quantity_kg: "", 
      pickup_date: todayStr, 
      location: user?.farmerProfile?.farmLocation || "" 
    });
    loadBookings();
  }

  function handleUpdateOrderStatus(bookingId, newStatus) {
    const allBookings = getStoredBookings();
    const updated = allBookings.map(b => {
      if (b.id === bookingId) {
        return { ...b, status: newStatus, updated_date: new Date().toISOString() };
      }
      return b;
    });
    saveStoredBookings(updated);
    loadBookings();
  }

  function handleDeleteCenter(centerId) {
    if (!confirm("Are you sure you want to delete this processing facility?")) return;
    const localCenters = getStoredCenters();
    const updated = localCenters.filter(c => c.id !== centerId);
    saveStoredCenters(updated);
    loadCenters();
  }

  const statusColors = {
    requested: { label: t("silageBank.orderStatus.requested") || "Requested", color: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300", icon: Clock },
    confirmed: { label: t("silageBank.orderStatus.confirmed") || "Confirmed", color: "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300", icon: CheckCircle2 },
    picked_up: { label: t("silageBank.orderStatus.picked_up") || "In Transit", color: "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300", icon: Truck },
    processed: { label: t("silageBank.orderStatus.processed") || "Processed", color: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300", icon: Package },
    cancelled: { label: t("silageBank.orderStatus.cancelled") || "Cancelled", color: "bg-stone-100 text-stone-700 border-stone-200 dark:bg-stone-900/40 dark:text-stone-300", icon: AlertCircle }
  };

  const isCurrentBuyer = isActiveBuyer(user);
  const isCurrentFarmer = isActiveFarmer(user);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Warehouse className="h-5 w-5 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">{t("silageBank.title")}</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-primary/10 text-primary border border-primary/20">
              {isCurrentBuyer ? `💼 ${t("silageBank.operatorMode")}` : `🌾 ${t("silageBank.farmerMode")}`}
            </span>
          </div>
          <p className="text-muted-foreground text-sm">
            {t("silageBank.subtitle")}
          </p>
        </div>

        {isCurrentBuyer && <BuyerAddCenter loadCenters={loadCenters} />}
      </div>

      {/* BUYER INCOMING ORDERS (If operating as Buyer) */}
      {isCurrentBuyer && (
        <div className="bg-card rounded-3xl border border-border/80 p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                {t("silageBank.incomingOrders", { count: incomingOrders.length })}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Bookings submitted by farmers for your listed feed processing centers.
              </p>
            </div>
          </div>

          {incomingOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border border-dashed border-border/80 rounded-2xl bg-muted/20">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-40 text-primary" />
              <p className="text-xs">{t("silageBank.noOrders")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incomingOrders.map((order) => {
                const sc = statusColors[order.status] || statusColors.requested;
                const Icon = sc.icon;
                const cleanPhone = (order.farmer_phone || order.creatorPhone || "").replace(/[^0-9]/g, "");

                return (
                  <div key={order.id} className="bg-muted/30 border border-border/80 rounded-2xl p-4 sm:p-5 space-y-3 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">{order.farmer_name}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${sc.color}`}>
                          <Icon className="h-3 w-3" /> {sc.label}
                        </span>
                        {order.creatorVerificationStatus && (
                          <VerifiedBadge status={order.creatorVerificationStatus} />
                        )}
                        <span className="text-[11px] text-muted-foreground bg-card border border-border px-2 py-0.5 rounded-full font-mono">
                          Facility: {order.center_name}
                        </span>
                      </div>

                      {/* Status Lifecycle Dropdown */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground font-medium">{t("common.status") || "Status"}:</span>
                        <select 
                          value={order.status}
                          onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                          className="text-xs border border-border rounded-xl px-2.5 py-1 bg-card font-medium focus:ring-1 focus:ring-primary shadow-xs"
                        >
                          <option value="requested">{t("silageBank.orderStatus.requested") || "Requested"}</option>
                          <option value="confirmed">{t("silageBank.orderStatus.confirmed") || "Confirmed"}</option>
                          <option value="picked_up">{t("silageBank.orderStatus.picked_up") || "In Transit"}</option>
                          <option value="processed">{t("silageBank.orderStatus.processed") || "Processed"}</option>
                          <option value="cancelled">{t("silageBank.orderStatus.cancelled") || "Cancelled"}</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground pt-1">
                      <div>
                        <span className="block text-[10px] uppercase">{t("silageBank.biomassTypeLabel") || "Crop Material"}</span>
                        <span className="font-semibold text-foreground">{order.crop_type}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase">{t("silageBank.quantityKgLabel") || "Batch Quantity"}</span>
                        <span className="font-semibold text-foreground">{order.quantity_kg} kg</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase">{t("silageBank.pickupDateLabel") || "Pickup Date"}</span>
                        <span className="font-semibold text-foreground">{order.pickup_date}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase">{t("silageBank.processingRate") || "Processing Fee"}</span>
                        <span className="font-semibold text-primary font-bold">₹{order.total_price?.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs flex-wrap">
                      <span className="text-muted-foreground">
                        📍 {t("silageBank.farmLocationLabel") || "Farm Location"}: <span className="text-foreground font-medium">{order.location || "Local Farm"}</span>
                      </span>

                      {cleanPhone && (
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs rounded-xl"
                            onClick={() => window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hi ${order.farmer_name}, contacting regarding your silage booking for ${order.crop_type} (${order.quantity_kg}kg) at ${order.center_name}.`)}`, "_blank")}
                          >
                            <MessageSquare className="h-3 w-3 mr-1" /> WhatsApp
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-xs rounded-xl"
                            onClick={() => window.open(`tel:${cleanPhone}`)}
                          >
                            <Phone className="h-3 w-3 mr-1" /> Call
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Available Processing Centers */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg text-foreground">{t("silageBank.availableHubs")}</h2>
            <p className="text-xs text-muted-foreground">{t("silageBank.hubsSubtitle")}</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {centers.map((center, i) => {
            const isOwner = isRecordOwner(center, user);
            const isSample = Boolean(center.isSample);
            const price = Number(String(center.price_per_kg).replace(/[^\d.]/g, "")) || 0;
            const cleanPhone = (center.phone || center.creatorPhone || "").replace(/[^0-9]/g, "");
            const currentUserId = user?.userId || user?.id;
            const isSelfCenter = Boolean(center.creatorId && currentUserId && center.creatorId === currentUserId);

            return (
              <motion.div 
                key={center.id || i} 
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ delay: i * 0.04 }}
                className="bg-card rounded-3xl border border-border/80 p-5 flex flex-col justify-between hover:shadow-natural hover:border-primary/30 transition-all shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <h3 className="font-bold text-base text-foreground">{center.name}</h3>
                        {isSample ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700 dark:bg-stone-900 dark:text-stone-300 border border-stone-200">
                            {t("silageBank.sampleHubBadge") || "Sample Hub"}
                          </span>
                        ) : isOwner ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200">
                            {t("silageBank.myHubBadge") || "My Hub"}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200">
                            {t("silageBank.verifiedHubBadge") || "Verified Facility"}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-primary" /> {center.location} • {center.distance}
                      </p>
                    </div>

                    <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                      <Warehouse className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="bg-muted/40 rounded-2xl p-3 mb-3 text-xs flex items-center justify-between border border-border/60">
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground block">{t("silageBank.processingRate")}</span>
                      <span className="font-bold text-sm text-foreground">₹{price.toFixed(2)} / kg</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground block text-right">{t("common.verified") || "Verification"}</span>
                      <VerifiedBadge status={center.creatorVerificationStatus || "verified"} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("silageBank.operatorLabel", { name: center.owner || center.creatorName || "Standard" })}</span>
                    
                    {/* Owner delete button */}
                    {isOwner && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => handleDeleteCenter(center.id)}
                        className="h-6 px-2 text-[11px] text-destructive hover:bg-destructive/10 rounded-lg"
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> {t("common.delete")}
                      </Button>
                    )}
                  </div>

                  {/* Booking Modal (Available to Farmers) */}
                  {isCurrentFarmer && (
                    <Dialog 
                      open={dialogOpen && selectedCenter === center.id} 
                      onOpenChange={(open) => { 
                        setDialogOpen(open); 
                        if (!open) setSelectedCenter(null); 
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button 
                          size="sm" 
                          className="w-full gap-2 font-medium rounded-xl" 
                          onClick={() => {
                            setSelectedCenter(center.id);
                            setForm(f => ({ ...f, pickup_date: todayStr }));
                          }}
                        >
                          <Truck className="h-4 w-4" /> {t("silageBank.bookPickup")}
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md rounded-3xl p-6">
                        <DialogHeader>
                          <DialogTitle className="text-xl font-bold">{t("silageBank.modalBookTitle")}</DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4 pt-2">
                          <div className="bg-muted/40 p-3.5 rounded-2xl border border-border/80 text-xs flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-foreground">Facility: {center.name}</p>
                              <p className="text-muted-foreground text-[11px] mt-0.5">Rate: ₹{price.toFixed(2)}/kg • {center.location}</p>
                            </div>
                            <VerifiedBadge status={center.creatorVerificationStatus || "verified"} />
                          </div>

                          <div>
                            <label className="text-xs font-medium text-foreground block mb-1">{t("silageBank.biomassTypeLabel")}</label>
                            <Input 
                              placeholder="e.g. Maize stalks, Paddy straw, Sugarcane tops" 
                              value={form.crop_type} 
                              onChange={e => setForm(f => ({ ...f, crop_type: e.target.value }))} 
                              required 
                              className="rounded-xl"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs font-medium text-foreground block mb-1">{t("silageBank.quantityKgLabel")}</label>
                              <Input 
                                type="number" 
                                min="1" 
                                placeholder="e.g. 500" 
                                value={form.quantity_kg} 
                                onChange={e => setForm(f => ({ ...f, quantity_kg: e.target.value }))} 
                                required 
                                className="rounded-xl"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-foreground block mb-1">{t("silageBank.pickupDateLabel")}</label>
                              <Input 
                                type="date" 
                                min={todayStr}
                                value={form.pickup_date} 
                                onChange={e => setForm(f => ({ ...f, pickup_date: e.target.value }))} 
                                required 
                                className="rounded-xl"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-foreground block mb-1">{t("silageBank.farmLocationLabel")}</label>
                            <Input 
                              placeholder="Village, Landmark" 
                              value={form.location} 
                              onChange={e => setForm(f => ({ ...f, location: e.target.value }))} 
                              className="rounded-xl"
                            />
                          </div>

                          {/* Live Cost Calculation breakdown */}
                          {Number(form.quantity_kg) > 0 && (
                            <div className="bg-secondary/60 border border-border/80 rounded-2xl p-3.5 text-xs space-y-1">
                              <div className="flex justify-between text-muted-foreground">
                                <span>Batch Calculation:</span>
                                <span>{form.quantity_kg} kg × ₹{price.toFixed(2)}/kg</span>
                              </div>
                              <div className="flex justify-between font-bold text-sm text-foreground pt-1.5 border-t border-border/60">
                                <span>{t("silageBank.estimatedCost", { total: "" }).replace(":", "").trim()}:</span>
                                <span className="text-primary font-mono font-bold">
                                  ₹{Math.round(Number(form.quantity_kg) * price).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          )}

                          <Button onClick={() => handleBook(center)} className="w-full gap-2 rounded-2xl py-5">
                            <CheckCircle2 className="h-4 w-4" /> {t("silageBank.confirmBooking")}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}

                  {/* Direct Contact Options */}
                  {cleanPhone && !isSelfCenter && (
                    <div className="flex gap-2 pt-1">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 text-xs rounded-xl h-8"
                        onClick={() => window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hi, I am inquiring about silage processing at ${center.name} via AgroCycle.`)}`, "_blank")}
                      >
                        <MessageSquare className="h-3.5 w-3.5 mr-1" /> WhatsApp
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 text-xs rounded-xl h-8"
                        onClick={() => window.open(`tel:${cleanPhone}`)}
                      >
                        <Phone className="h-3.5 w-3.5 mr-1" /> Call
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* FARMER: MY FEED PROCESSING BOOKINGS */}
      {isCurrentFarmer && (
        <div className="space-y-3 pt-4 border-t border-border/80">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg text-foreground">My Feed Processing Bookings ({bookings.length})</h2>
            <span className="text-xs text-muted-foreground">Private to your account</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center py-10 bg-card border border-border/80 rounded-3xl text-muted-foreground space-y-2 p-6 shadow-xs">
              <Warehouse className="h-10 w-10 mx-auto opacity-40 text-primary" />
              <p className="font-semibold text-foreground text-sm">No Processing Bookings Requested Yet</p>
              <p className="text-xs text-muted-foreground">Select a nearby center above to schedule biomass pickup and feed conversion.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => {
                const sc = statusColors[b.status] || statusColors.requested;
                const Icon = sc.icon;
                const cleanPhone = (b.center_phone || "").replace(/[^0-9]/g, "");

                return (
                  <div key={b.id} className="bg-card rounded-2xl border border-border/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">{b.center_name}</span>
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${sc.color}`}>
                          <Icon className="h-3 w-3" /> {sc.label}
                        </span>
                        <SyncStatusBadge 
                          status={b.sync_status || "pending"} 
                          onRetry={() => {
                            if (user?.userId) {
                              syncManager.processQueue(user.userId).catch(() => {});
                            }
                          }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {b.center_location}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground pt-1">
                        <div>
                          <span className="block text-[10px] uppercase">{t("silageBank.biomassTypeLabel") || "Crop"}</span>
                          <span className="font-semibold text-foreground">{b.crop_type}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase">{t("silageBank.quantityKgLabel") || "Quantity"}</span>
                          <span className="font-semibold text-foreground">{b.quantity_kg} kg</span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase">{t("silageBank.pickupDateLabel") || "Scheduled Date"}</span>
                          <span className="font-semibold text-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-primary" /> {b.pickup_date}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase">{t("silageBank.processingRate") || "Total Cost"}</span>
                          <span className="font-semibold text-primary font-bold">
                            ₹{Number(b.total_price || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {cleanPhone && (
                      <div className="flex gap-2 shrink-0">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-xs rounded-xl h-8" 
                          onClick={() => window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hi, inquiring about my silage processing booking (${b.crop_type}, ${b.quantity_kg}kg) at ${b.center_name}.`)}`, "_blank")}
                        >
                          <MessageSquare className="h-3.5 w-3.5 mr-1" /> WhatsApp
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="text-xs rounded-xl h-8"
                          onClick={() => window.open(`tel:${cleanPhone}`)}
                        >
                          <Phone className="h-3.5 w-3.5 mr-1" /> Call
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}