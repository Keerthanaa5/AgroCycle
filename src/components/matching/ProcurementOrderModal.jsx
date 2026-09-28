import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  CheckCircle2, 
  FileText, 
  Building2, 
  MapPin, 
  Users, 
  ShieldCheck, 
  Calendar, 
  ArrowRight, 
  Printer, 
  Sparkles, 
  Info, 
  Clock, 
  CheckCheck, 
  CreditCard, 
  AlertCircle,
  Truck,
  Check,
  Circle,
  Phone,
  PackageCheck
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ArrangeTransportModal from "./ArrangeTransportModal";

/**
 * Reusable Procurement Order Modal & Summary Card with Smart Logistics (Phase 2)
 */
export default function ProcurementOrderModal({
  open = false,
  onOpenChange = null,
  order = null,
  isFarmerView = false,
  onProceedWithPartial = null,
  onCloseRequirement = null,
  onContinueSourcing = null,
  onOrderUpdated = null
}) {
  const navigate = useNavigate();
  const [arrangeModalOpen, setArrangeModalOpen] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(order);

  // Sync state if prop updates
  React.useEffect(() => {
    setCurrentOrder(order);
  }, [order]);

  if (!currentOrder) return null;

  const {
    orderId,
    demand = {},
    buyer = {},
    allocations = [],
    summary = {},
    status = "CONFIRMED",
    createdAt,
    orderType,
    matchType = "MARKET"
  } = currentOrder;

  const logistics = currentOrder.logistics || summary.logistics || currentOrder.procurement_summary?.logistics || null;
  const logisticsStatus = currentOrder.logistics_status || logistics?.transportStatus || summary.logisticsStatus || null;

  const handlePrint = () => {
    window.print();
  };

  const requestedKg = Number(demand.requestedQuantityKg || summary.requestedQuantityKg || summary.totalQuantityKg || 1000);
  const sourcedKg = Number(summary.sourcedQuantityKg !== undefined ? summary.sourcedQuantityKg : (summary.totalQuantityKg || 0));
  const remainingKg = summary.remainingQuantityKg !== undefined ? Number(summary.remainingQuantityKg) : Math.max(0, requestedKg - sourcedKg);
  const produceVal = summary.totalProduceCost || summary.totalProduceValue || summary.totalEstimatedCost || 0;
  const avgPrice = summary.effectiveCostPerKg || summary.averagePricePerKg || (sourcedKg > 0 ? (produceVal / sourcedKg).toFixed(2) : "0.00");
  const isPartiallySourced = status === "PARTIALLY_SOURCED";
  const isFinalized = status === "FULLY_SOURCED" || status === "CONFIRMED" || status === "PARTIALLY_FULFILLED";
  const isPaid = summary.paymentStatus === "PAID_SIMULATED";
  const isDeadlinePassed = demand.requiredDate && new Date().toISOString().split("T")[0] > demand.requiredDate;

  const handleDone = () => {
    if (isFinalized && !isPaid) {
      if (!logistics && !isFarmerView) {
        setArrangeModalOpen(true);
        return;
      }
      if (onOpenChange) onOpenChange(false);
      navigate(`/payment/${orderId || order.id}`);
      return;
    }
    if (onOpenChange) onOpenChange(false);
  };

  const renderStatusBadge = () => {
    const st = (status || "").toUpperCase();
    if (st === "PARTIALLY_SOURCED") {
      return (
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-bold text-xs gap-1">
          <Clock className="h-3 w-3" />
          PARTIALLY SOURCED
        </Badge>
      );
    }
    if (st === "FULLY_SOURCED" || st === "CONFIRMED") {
      return (
        <Badge className="bg-emerald-600 text-white font-bold text-xs gap-1">
          <CheckCheck className="h-3 w-3" />
          {st === "FULLY_SOURCED" ? "FULLY SOURCED" : "CONFIRMED"}
        </Badge>
      );
    }
    if (st === "PARTIALLY_FULFILLED") {
      return (
        <Badge className="bg-blue-600 text-white font-bold text-xs gap-1">
          <CheckCircle2 className="h-3 w-3" />
          PARTIALLY FULFILLED
        </Badge>
      );
    }
    if (st === "CLOSED") {
      return (
        <Badge className="bg-slate-600 text-white font-bold text-xs">
          CLOSED
        </Badge>
      );
    }
    return (
      <Badge className="bg-slate-200 text-slate-800 font-bold text-xs">
        {st}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl p-6 max-h-[92vh] overflow-y-auto">
        <DialogHeader className="border-b border-border/60 pb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-foreground">
                  Procurement Order Details
                </DialogTitle>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  Order ID: <strong className="text-primary">{orderId}</strong> • {new Date(createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div>
              {renderStatusBadge()}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-2 text-xs">
          {/* Status Pipeline Visualizer */}
          <div className="bg-muted/40 p-4 rounded-2xl border border-border/70">
            <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-2">Order Lifecycle Progression</span>
            <div className="flex items-center justify-between text-[11px] font-semibold">
              <div className="flex items-center gap-1 text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                <span>REQUIREMENT</span>
              </div>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <div className="flex items-center gap-1 text-primary font-bold">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span>{isPartiallySourced ? "PARTIAL SOURCING" : "CONFIRMED"}</span>
              </div>
              <ArrowRight className="h-3 w-3 text-muted-foreground opacity-50" />
              <div className={`flex items-center gap-1 ${isPaid ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-muted-foreground opacity-70"}`}>
                <span className={`h-2 w-2 rounded-full ${isPaid ? "bg-emerald-500" : "bg-slate-300"}`} />
                <span>PAYMENT SETTLEMENT</span>
              </div>
            </div>
          </div>

          {/* Sourcing Quantity Breakdown Card */}
          <div className="p-4 rounded-2xl bg-background border border-border/80 shadow-2xs space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Sourcing Fulfillment Summary
              </span>
              <span className="font-mono font-bold text-primary">
                {sourcedKg} / {requestedKg} kg Sourced ({Math.min(100, Math.round((sourcedKg / requestedKg) * 100))}%)
              </span>
            </div>

            <div className="w-full bg-border/60 rounded-full h-2.5 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${
                  isPartiallySourced ? "bg-amber-500" : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, Math.round((sourcedKg / requestedKg) * 100))}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[10px] text-muted-foreground block">Requested Quantity</span>
                <span className="font-mono font-bold text-foreground text-sm">{requestedKg.toLocaleString()} kg</span>
              </div>
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[10px] text-muted-foreground block">Confirmed Sourced</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">{sourcedKg.toLocaleString()} kg</span>
              </div>
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[10px] text-muted-foreground block">Remaining Quantity</span>
                <span className={`font-mono font-bold text-sm ${remainingKg > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                  {remainingKg.toLocaleString()} kg
                </span>
              </div>
            </div>
          </div>

          {/* Required-by Deadline Action in Modal */}
          {isPartiallySourced && isDeadlinePassed && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>REQUIRED BY REACHED</span>
              </div>
              <p className="text-muted-foreground leading-relaxed text-[11px]">
                {sourcedKg} / {requestedKg} kg sourced. {remainingKg} kg could not be sourced within the required time.
              </p>
              <div className="flex items-center gap-2 pt-1">
                {onProceedWithPartial && (
                  <Button
                    size="sm"
                    onClick={() => {
                      onProceedWithPartial(order);
                      if (onOpenChange) onOpenChange(false);
                    }}
                    className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                  >
                    Proceed with {sourcedKg} kg
                  </Button>
                )}
                {onCloseRequirement && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onCloseRequirement(order);
                      if (onOpenChange) onOpenChange(false);
                    }}
                    className="h-8 text-xs rounded-xl"
                  >
                    Close Requirement
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Buyer & Requirement Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 space-y-1.5">
              <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                <Building2 className="h-3 w-3 text-primary" />
                Procurement Buyer {demand.buyerType ? `• ${demand.buyerType}` : ""}
              </span>
              <p className="font-bold text-sm text-foreground">{buyer.businessName || "ABC Foods"}</p>
              <p className="text-muted-foreground flex items-center gap-1 text-[11px]">
                <MapPin className="h-3 w-3 text-primary shrink-0" />
                {buyer.location?.address || buyer.location?.city || "Madurai"}, {buyer.location?.state || "Tamil Nadu"}
              </p>
              {(buyer.phone || currentOrder.buyer_phone) && (
                <div className="pt-1 flex items-center gap-2">
                  <span className="text-[11px] font-mono text-foreground font-semibold">
                    {buyer.phone || currentOrder.buyer_phone}
                  </span>
                  <a
                    href={`tel:${buyer.phone || currentOrder.buyer_phone}`}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline bg-primary/10 px-2 py-0.5 rounded-lg transition-colors"
                  >
                    <Phone className="h-3 w-3" />
                    <span>Call Buyer</span>
                  </a>
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/60 space-y-1.5">
              <span className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />
                Produce Requirement
              </span>
              <p className="font-bold text-sm text-primary">
                {demand.crop} — {requestedKg.toLocaleString()} kg
              </p>
              <p className="text-muted-foreground text-[11px]">
                {demand.buyerType ? `Buyer: ${demand.buyerType} • ` : ""}{demand.intendedUse ? `Purpose: ${demand.intendedUse} • ` : ""}Grade: {demand.qualityGrade || "Grade A — Fresh / Premium"} • Required by: {demand.requiredDate || "Immediate"}
              </p>
            </div>
          </div>

          {/* Multi-Farmer Allocation Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                Farmer Allocations ({allocations.length})
              </h4>
              <span className="font-mono font-bold text-foreground">
                Sourced: {sourcedKg.toLocaleString()} kg
              </span>
            </div>

            <div className="rounded-2xl border border-border/80 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border/60">
                  <tr>
                    <th className="p-2.5">#</th>
                    <th className="p-2.5">Farmer</th>
                    <th className="p-2.5">Location</th>
                    <th className="p-2.5">Allocated</th>
                    <th className="p-2.5 text-right">Farmer Asking Price</th>
                    <th className="p-2.5 text-right">Subtotal</th>
                    <th className="p-2.5 text-right">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {allocations.map((a, idx) => {
                    const allocKg = a.allocatedQuantityKg || (a.allocatedQuantityTonnes ? Math.round(a.allocatedQuantityTonnes * 1000) : 0);
                    const price = a.pricePerKg || 25;
                    const subtotal = a.farmerSubtotal || Math.round(allocKg * price);
                    const fPhone = a.farmerPhone || a.phone || null;

                    return (
                      <tr key={a.supplierId || a.listingId || idx} className="hover:bg-muted/30">
                        <td className="p-2.5 font-bold text-muted-foreground font-mono">{idx + 1}</td>
                        <td className="p-2.5">
                          <span className="font-bold text-foreground block">{a.farmerName}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{a.variety || a.crop}</span>
                          {fPhone && (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="text-[10px] font-mono text-muted-foreground">{fPhone}</span>
                              <a
                                href={`tel:${fPhone}`}
                                className="inline-flex items-center gap-1 text-[9px] font-bold text-primary hover:underline bg-primary/10 px-1.5 py-0.5 rounded-md transition-colors"
                              >
                                <Phone className="h-2.5 w-2.5" />
                                <span>Call Farmer</span>
                              </a>
                            </div>
                          )}
                        </td>
                        <td className="p-2.5 text-muted-foreground truncate max-w-[110px]">
                          {a.location?.city || "Madurai"}
                        </td>
                        <td className="p-2.5 font-bold font-mono text-primary">
                          {allocKg.toLocaleString()} kg
                        </td>
                        <td className="p-2.5 font-mono text-right text-foreground">
                          ₹{price}/kg
                        </td>
                        <td className="p-2.5 font-mono font-bold text-right text-foreground">
                          ₹{subtotal.toLocaleString()}
                        </td>
                        <td className="p-2.5 text-right">
                          <Badge 
                            variant="outline" 
                            className={`text-[9px] font-bold ${
                              (a.paymentStatus === 'PAID_SIMULATED' || isPaid)
                                ? "border-cyan-500/30 text-cyan-700 dark:text-cyan-400 bg-cyan-500/10"
                                : "border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/10"
                            }`}
                          >
                            {(a.paymentStatus === 'PAID_SIMULATED' || isPaid) ? "SIMULATED PAID" : "PENDING"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pure Produce Procurement Economics */}
          <div className="bg-muted/40 p-4 rounded-2xl border border-border/70 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Total Produce Value (Sourced):</span>
              <span className="font-mono font-bold text-foreground text-sm">₹{produceVal.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Average Produce Price:</span>
              <span className="font-mono font-semibold text-primary">₹{avgPrice}/kg</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Payment Status:</span>
              {isPaid ? (
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5" />
                  PAID (SIMULATED — {summary.paymentReference || "Ref Recorded"})
                </span>
              ) : (
                <span className="font-mono font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <CreditCard className="h-3.5 w-3.5" />
                  PENDING (Applies to {sourcedKg} kg confirmed produce)
                </span>
              )}
            </div>
          </div>

          {/* Smart Logistics Order Tracking & Timeline Section */}
          <div className="bg-card rounded-2xl border border-border/80 p-4 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                <h4 className="font-bold text-xs text-foreground uppercase tracking-wider">
                  Transport Plan & Order Tracking
                </h4>
              </div>
              {logisticsStatus ? (
                <Badge className="bg-emerald-600 text-white font-bold text-[10px] uppercase">
                  {logisticsStatus}
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400 font-semibold text-[10px]">
                  Transport Not Arranged Yet
                </Badge>
              )}
            </div>

            {/* Clean Vertical Status Timeline */}
            <div className="space-y-2.5 pl-1.5">
              {[
                { id: "CONFIRMED", label: "Procurement Confirmed", isDone: true, current: false },
                { id: "ASSIGNED", label: "Transport Arranged by Buyer", isDone: Boolean(logistics), current: !logistics },
                { id: "PAID", label: "Payment Completed", isDone: isPaid, current: Boolean(logistics) && !isPaid },
                { id: "PICKUP", label: "Pickup Scheduled", isDone: ["PICKUP", "COLLECTED", "IN TRANSIT", "DELIVERED"].includes(logisticsStatus), current: logisticsStatus === "PICKUP" },
                { id: "COLLECTED", label: "Produce Collected from Farm", isDone: ["COLLECTED", "IN TRANSIT", "DELIVERED"].includes(logisticsStatus), current: logisticsStatus === "COLLECTED" },
                { id: "IN TRANSIT", label: "In Transit to Destination Hub", isDone: ["IN TRANSIT", "DELIVERED"].includes(logisticsStatus), current: logisticsStatus === "IN TRANSIT" },
                { id: "DELIVERED", label: "Delivered to Buyer", isDone: logisticsStatus === "DELIVERED", current: logisticsStatus === "DELIVERED" }
              ].map((step, idx) => (
                <div key={step.id} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${
                      step.isDone 
                        ? "bg-emerald-600 text-white shadow-2xs" 
                        : (step.current ? "bg-primary text-white ring-2 ring-primary/20 animate-pulse" : "bg-muted text-muted-foreground border border-border/80")
                    }`}>
                      {step.isDone ? <Check className="h-3 w-3" /> : (idx + 1)}
                    </div>
                    {idx < 6 && (
                      <div className={`w-0.5 h-4 my-0.5 ${
                        step.isDone ? "bg-emerald-500/70" : "bg-border/60"
                      }`} />
                    )}
                  </div>
                  <div className="pt-0.5 text-xs">
                    <span className={`font-semibold block leading-tight ${
                      step.isDone ? "text-foreground" : (step.current ? "text-primary font-bold" : "text-muted-foreground")
                    }`}>
                      {step.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Transport Details Card if Arranged */}
            {logistics ? (
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/70 text-xs space-y-2.5">
                <div className="flex items-center justify-between font-bold text-foreground pb-1.5 border-b border-border/50">
                  <span className="flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5 text-primary" />
                    Transport Arranged by Buyer
                  </span>
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                    {logisticsStatus || "ASSIGNED"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-muted-foreground block">Transporter / Company:</span>
                    <strong className="text-foreground">{logistics.transporterName || "Commercial Transport"}</strong>
                    {logistics.transporterPhone && (
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-muted-foreground">{logistics.transporterPhone}</span>
                        <a
                          href={`tel:${logistics.transporterPhone}`}
                          className="inline-flex items-center gap-1 text-[9px] font-bold text-primary hover:underline bg-primary/10 px-1.5 py-0.5 rounded-md transition-colors"
                        >
                          <Phone className="h-2.5 w-2.5" />
                          <span>Call Transporter</span>
                        </a>
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Vehicle Number:</span>
                    <strong className="text-foreground uppercase font-mono">{logistics.vehicleNumber || "N/A"}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Driver Name:</span>
                    <span className="font-semibold text-foreground block">{logistics.driverName || "N/A"}</span>
                    {logistics.driverPhone && (
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="text-[10px] font-mono text-muted-foreground">{logistics.driverPhone}</span>
                        <a
                          href={`tel:${logistics.driverPhone}`}
                          className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline bg-emerald-500/10 px-1.5 py-0.5 rounded-md transition-colors"
                        >
                          <Phone className="h-2.5 w-2.5" />
                          <span>Call Driver</span>
                        </a>
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Pickup Schedule:</span>
                    <span className="text-foreground">{logistics.pickupDate} • {logistics.pickupTime}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Delivery Destination:</span>
                    <span className="text-foreground">{logistics.destination || order.delivery_location || "Madurai"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Transport Cost:</span>
                    <strong className="font-mono text-foreground">₹{Number(logistics.transportCost || 0).toLocaleString()}</strong>
                  </div>
                </div>

                {/* GPS Tracking Section */}
                <div className="pt-2 border-t border-border/50">
                  {logistics.gpsLatitude !== null && logistics.gpsLatitude !== undefined && logistics.gpsLongitude !== null && logistics.gpsLongitude !== undefined ? (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                          Live GPS Coordinates Available
                        </span>
                        <Badge className="bg-emerald-600 text-white text-[9px] font-mono">
                          LIVE
                        </Badge>
                      </div>
                      <p className="text-[11px] font-mono text-muted-foreground">
                        Location: {Number(logistics.gpsLatitude).toFixed(4)}°N, {Number(logistics.gpsLongitude).toFixed(4)}°E • Destination: {logistics.destination || "Madurai"}
                      </p>
                      {logistics.lastGpsUpdate && (
                        <p className="text-[10px] text-muted-foreground">
                          Last GPS Broadcast: {new Date(logistics.lastGpsUpdate).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-muted/60 border border-border/60 text-xs flex items-center justify-between text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground/70" />
                        <span>Live GPS location unavailable</span>
                      </div>
                      <span className="text-[10px] italic">Device Offline / Milestone Tracking Active</span>
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-muted-foreground italic">
                  Transport arranged by buyer. Farmer asking price and payout remain 100% untouched.
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-dashed border-amber-500/30 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <strong className="text-amber-900 dark:text-amber-200 block text-xs">Step 1 Required: Arrange Transport</strong>
                  <p className="text-[11px] mt-0.5">Transport must be arranged before payment can be finalized.</p>
                </div>
                {!isFarmerView && (
                  <Button
                    size="sm"
                    onClick={() => setArrangeModalOpen(true)}
                    className="rounded-xl text-xs font-bold h-8 bg-primary hover:bg-primary/90 text-primary-foreground gap-1 shrink-0"
                  >
                    <Truck className="h-3.5 w-3.5" />
                    <span>Arrange Transport</span>
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border/60">
          <Button
            variant="outline"
            onClick={handlePrint}
            className="rounded-xl text-xs gap-1.5 h-9"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Order Allocation
          </Button>

          <div className="flex items-center gap-2">
            {!isFarmerView && (
              <Button
                variant="outline"
                onClick={() => setArrangeModalOpen(true)}
                className="rounded-xl text-xs font-bold h-9 gap-1.5"
              >
                <Truck className="h-3.5 w-3.5" />
                <span>{logistics ? "Manage Logistics Details" : "Arrange Transport"}</span>
              </Button>
            )}

            {isPartiallySourced && !isDeadlinePassed && onContinueSourcing && (
              <Button
                onClick={() => {
                  onContinueSourcing(order);
                  if (onOpenChange) onOpenChange(false);
                }}
                className="rounded-xl text-xs font-bold h-9 px-4 bg-amber-600 hover:bg-amber-700 text-white"
              >
                Continue Sourcing ({remainingKg} kg)
              </Button>
            )}
            
            <Button
              onClick={handleDone}
              className={`rounded-xl text-xs font-bold h-9 px-6 ${
                isFinalized && !isPaid ? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm" : ""
              }`}
            >
              {isFinalized && !isPaid 
                ? (logistics ? `Done → Proceed to Payment (₹${produceVal.toLocaleString()})` : "Next: Arrange Transport →") 
                : "Done"}
            </Button>
          </div>
        </div>

        {/* Nested Arrange Transport Modal for Buyer */}
        <ArrangeTransportModal
          open={arrangeModalOpen}
          onOpenChange={setArrangeModalOpen}
          order={currentOrder}
          onTransportUpdated={(updated) => {
            setCurrentOrder(updated);
            if (onOrderUpdated) onOrderUpdated(updated);
          }}
          onProceedToPayment={() => {
            if (onOpenChange) onOpenChange(false);
            navigate(`/payment/${orderId || order.id}`);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}


