import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { 
  CreditCard, 
  CheckCircle2, 
  ArrowLeft, 
  Building2, 
  MapPin, 
  Calendar, 
  Users, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle, 
  Clock, 
  FileText, 
  Printer, 
  RefreshCw,
  Wallet,
  Smartphone,
  Landmark,
  Check,
  Info,
  Eye,
  Truck,
  Phone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { 
  getProcurementOrderById, 
  fetchProcurementOrders, 
  simulateOrderPayment,
  calculateProcurementFinancials,
  ORDER_STATUS
} from "@/services/smartMatchService";
import { useAuth } from "@/lib/AuthContext";
import ProcurementOrderModal from "@/components/matching/ProcurementOrderModal";
import ArrangeTransportModal from "@/components/matching/ArrangeTransportModal";

export default function Payment() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [transportModalOpen, setTransportModalOpen] = useState(false);

  useEffect(() => {
    loadOrderData();
  }, [orderId]);

  const loadOrderData = async () => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const orders = await fetchProcurementOrders({ id: orderId });
      const found = (orders || []).find(o => o.orderId === orderId || o.id === orderId) || getProcurementOrderById(orderId);
      if (found) {
        setOrder(found);
        if (found.summary?.paymentStatus === "PAID_SIMULATED" || found.summary?.payment_status === "PAID_SIMULATED") {
          const s = found.summary || {};
          const cVal = Number(s.cropValue || s.totalProduceCost || 0);
          const rRisk = Number(s.rejectionRisk || s.rejection_risk || 0);
          const fin = calculateProcurementFinancials({ cropValue: cVal, rejectionRisk: rRisk });

          setPaymentSuccess(true);
          setPaymentReceipt({
            paymentReference: s.paymentReference || s.payment_reference || `SIM-PAY-${orderId.replace(/[^A-Z0-9]/gi, '').slice(-8).toUpperCase()}`,
            cropValue: fin.cropValue,
            rejectionRisk: fin.rejectionRisk,
            platformFee: fin.platformFee,
            netProcurementValue: fin.netProcurementValue,
            amountPaid: s.amountPaid || fin.netProcurementValue,
            paymentMethod: s.paymentMethod || "UPI",
            paidAt: s.paidAt || found.updatedAt || new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.warn("[Payment Page] Error loading order:", err);
      const fallback = getProcurementOrderById(orderId);
      if (fallback) setOrder(fallback);
    } finally {
      setLoading(false);
    }
  };

  const requestedKg = Number(order?.demand?.requestedQuantityKg || order?.summary?.requestedQuantityKg || order?.summary?.totalQuantityKg || 100);
  const sourcedKg = Number(order?.summary?.sourcedQuantityKg !== undefined ? order?.summary?.sourcedQuantityKg : (order?.summary?.totalQuantityKg || 0));
  const remainingKg = order?.summary?.remainingQuantityKg !== undefined ? Number(order?.summary?.remainingQuantityKg) : Math.max(0, requestedKg - sourcedKg);
  const allocations = Array.isArray(order?.allocations) ? order.allocations : (Array.isArray(order?.farmer_allocations) ? order.farmer_allocations : []);
  const logistics = order?.logistics || order?.summary?.logistics || order?.procurement_summary?.logistics || null;
  const isTransportArranged = Boolean(logistics && logistics.transporterName && logistics.vehicleNumber);
  const transportCost = Number(logistics?.transportCost || 0);

  // Calculate Crop Value strictly on confirmed allocations (Confirmed Quantity × Farmer Asking Price)
  const cropValue = allocations.reduce((sum, a) => {
    const kg = Number(a.allocatedQuantityKg || a.allocated_quantity_kg || 0);
    const price = Number(a.pricePerKg || 0);
    return sum + (a.farmerSubtotal ? Number(a.farmerSubtotal) : Math.round(kg * price));
  }, 0) || Number(order?.summary?.totalProduceCost || order?.summary?.cropValue || 0);

  const rejectionRisk = Number(order?.summary?.rejectionRisk ?? order?.summary?.rejection_risk ?? order?.rejectionRisk ?? 0);

  const financials = calculateProcurementFinancials({
    cropValue,
    rejectionRisk
  });

  const totalBuyerOutlay = financials.netProcurementValue + transportCost;
  const avgPrice = sourcedKg > 0 ? (financials.cropValue / sourcedKg).toFixed(2) : "0.00";
  const isPartiallyFulfilled = order?.status === ORDER_STATUS.PARTIALLY_FULFILLED || order?.status === "PARTIALLY_FULFILLED";

  const handleSimulatePayment = async () => {
    if (!order || isProcessing) return;

    if (!isTransportArranged) {
      setTransportModalOpen(true);
      return;
    }

    setIsProcessing(true);

    try {
      // Simulate processing delay for realistic UX
      await new Promise(resolve => setTimeout(resolve, 1400));

      const updated = await simulateOrderPayment(order.orderId || order.id, paymentMethod, financials.rejectionRisk);
      
      const receiptData = {
        paymentReference: updated?.summary?.paymentReference || `SIM-PAY-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        cropValue: financials.cropValue,
        rejectionRisk: financials.rejectionRisk,
        platformFee: financials.platformFee,
        netProcurementValue: financials.netProcurementValue,
        transportCost: transportCost,
        totalBuyerOutlay: totalBuyerOutlay,
        amountPaid: financials.netProcurementValue,
        paymentMethod: paymentMethod,
        paidAt: new Date().toISOString()
      };

      setOrder(updated || { 
        ...order, 
        summary: { 
          ...order.summary, 
          cropValue: financials.cropValue,
          rejectionRisk: financials.rejectionRisk,
          platformFeeBase: financials.platformFeeBase,
          platformFee: financials.platformFee,
          platformFeeRate: financials.platformFeeRate,
          netProcurementValue: financials.netProcurementValue,
          transportCost: transportCost,
          totalBuyerPayable: totalBuyerOutlay,
          paymentStatus: "PAID_SIMULATED",
          amountPaid: financials.netProcurementValue
        } 
      });
      setPaymentReceipt(receiptData);
      setPaymentSuccess(true);
    } catch (err) {
      console.error("[Payment Page] Payment simulation error:", err);
      alert("Simulated payment error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-sm font-semibold text-muted-foreground">Loading procurement payment details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-4">
        <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 mx-auto flex items-center justify-center">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Procurement Order Not Found</h2>
        <p className="text-xs text-muted-foreground">
          Order "{orderId}" could not be located. Please verify your order ID or return to Market Intelligence.
        </p>
        <Button onClick={() => navigate("/market-intelligence")} className="rounded-xl text-xs font-bold mt-2">
          Back to Market Intelligence
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20 space-y-6 px-3 sm:px-0">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/market-intelligence")}
            className="rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5 h-8 px-2.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Market Intelligence</span>
          </Button>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Order: <strong className="font-mono text-foreground">{order.orderId || order.id}</strong></span>
          <span>•</span>
          <span className="capitalize">{order.demand?.crop}</span>
        </div>
      </div>

      {/* Main Title & Value Proposition Banner */}
      <div className="space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
              Review Final Cost & Complete Payment
            </h1>
            <p className="text-xs text-muted-foreground">
              Transparent procurement settlement with direct farmer-led pricing and buyer-arranged transport.
            </p>
          </div>
        </div>

        {/* Prototype Warning Banner */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs flex items-start gap-2.5 text-amber-800 dark:text-amber-300">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[11px] uppercase tracking-wide">
              Prototype Payment Simulation
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              No real bank accounts, UPI transfers, or credit cards are charged. This simulation records the order payment state for multi-farmer aggregation testing.
            </p>
          </div>
        </div>
      </div>

      {/* Conditional Layout: Pending Payment vs Success Receipt */}
      {!paymentSuccess ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Order Summary & Farmer Breakdown (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Step 1: Transport Arrangement Card (BEFORE Payment) */}
            <div className={`rounded-3xl border p-5 shadow-xs space-y-3.5 transition-all ${
              isTransportArranged ? "bg-card border-border/80" : "bg-amber-500/5 border-amber-500/30"
            }`}>
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className={`h-7 w-7 rounded-xl flex items-center justify-center text-xs font-bold ${
                    isTransportArranged ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                  }`}>
                    {isTransportArranged ? <Check className="h-4 w-4" /> : "1"}
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Transport Arranged by Buyer
                  </span>
                </div>
                {isTransportArranged ? (
                  <Badge className="bg-emerald-600 text-white font-bold text-[10px] gap-1">
                    <Check className="h-3 w-3" />
                    DETAILS READY
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500 text-slate-950 font-bold text-[10px]">
                    REQUIRED BEFORE PAYMENT
                  </Badge>
                )}
              </div>

              {isTransportArranged ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-3.5 rounded-2xl border border-border/60">
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Transporter:</span>
                      <strong className="text-foreground">{logistics.transporterName}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Vehicle Number:</span>
                      <strong className="font-mono uppercase text-foreground">{logistics.vehicleNumber}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Driver:</span>
                      <span className="text-foreground">{logistics.driverName} {logistics.driverPhone ? `(${logistics.driverPhone})` : ""}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Pickup Schedule:</span>
                      <span className="text-foreground">{logistics.pickupDate} • {logistics.pickupTime}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Destination:</span>
                      <span className="text-foreground">{logistics.destination || order.delivery_location || "Madurai"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-[10px] block">Transport Budget:</span>
                      <strong className="font-mono text-foreground">₹{transportCost.toLocaleString()}</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Transport details automatically shared with farmer.
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTransportModalOpen(true)}
                      className="rounded-xl text-xs h-7 gap-1"
                    >
                      <Truck className="h-3 w-3" />
                      <span>Edit Transport</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <p className="text-muted-foreground leading-relaxed text-[11px]">
                    In AgroCycle's transparent procurement flow, the buyer arranges transport before final payment. This ensures transport details are instantly shared with the farmer and full landed costs are clear.
                  </p>
                  <Button
                    onClick={() => setTransportModalOpen(true)}
                    className="w-full sm:w-auto h-9 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-sm"
                  >
                    <Truck className="h-3.5 w-3.5" />
                    <span>Arrange Transport Details Now →</span>
                  </Button>
                </div>
              )}
            </div>

            {/* Order Overview Card */}
            <div className="bg-card rounded-3xl border border-border/80 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  Procurement Summary
                </span>
                <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                  {order.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground text-[11px] block">Produce</span>
                  <span className="font-bold text-sm text-foreground">{order.demand?.crop || "Tomato"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px] block">Confirmed Quantity</span>
                  <span className="font-bold text-sm font-mono text-primary">{sourcedKg.toLocaleString()} kg</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px] block">Delivery Location</span>
                  <span className="font-medium text-foreground truncate block">{order.buyer?.location?.city || order.demand?.destinationLocation?.city || "Madurai"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px] block">Required by</span>
                  <span className="font-medium text-foreground">{order.demand?.requiredDate || "Immediate"}</span>
                </div>
              </div>

              {/* Partial fulfillment notice if applicable */}
              {isPartiallyFulfilled && (
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-800 dark:text-blue-300">
                  <strong>Partially Fulfilled:</strong> Charging strictly for the <strong>{sourcedKg} kg</strong> confirmed produce (excluding {remainingKg} kg unfulfilled quantity).
                </div>
              )}
            </div>

            {/* Farmer Allocations Breakdown Card */}
            <div className="bg-card rounded-3xl border border-border/80 p-5 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  Farmer Allocation Breakdown ({allocations.length})
                </h4>
                <span className="text-xs font-mono font-semibold text-foreground">
                  {sourcedKg} kg total
                </span>
              </div>

              <div className="divide-y divide-border/50 border border-border/70 rounded-2xl overflow-hidden bg-background">
                {allocations.map((alloc, idx) => {
                  const allocKg = Number(alloc.allocatedQuantityKg || alloc.allocated_quantity_kg || 0);
                  const price = Number(alloc.pricePerKg || alloc.farmerAskingPrice || 25);
                  const subtotal = alloc.farmerSubtotal || Math.round(allocKg * price);

                  return (
                    <div key={alloc.farmerId || alloc.listingId || idx} className="p-3.5 flex items-center justify-between text-xs hover:bg-muted/30 transition-colors">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-foreground">{alloc.farmerName || `Farmer ${String.fromCharCode(65 + idx)}`}</span>
                          <Badge variant="outline" className="text-[9px] py-0 px-1.5 bg-muted/40">
                            {alloc.qualityGrade || "Grade A"}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {allocKg.toLocaleString()} kg × ₹{price}/kg <span className="text-[10px] font-normal">(Farmer Asking Price)</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-sm text-foreground block">
                          ₹{subtotal.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold">
                          Pending
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Locked Platform-Fee & Complete Cost Breakdown */}
              <div className="bg-muted/40 p-4 rounded-2xl space-y-2.5 text-xs border border-border/60">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="font-semibold text-foreground">CROP VALUE</span>
                  <span className="font-mono font-bold text-foreground text-sm">₹{financials.cropValue.toLocaleString()}</span>
                </div>
                <p className="text-[10px] text-muted-foreground -mt-1.5">
                  Confirmed quantity ({sourcedKg.toLocaleString()} kg) × Farmer Asking Price
                </p>

                <div className="flex items-center justify-between text-muted-foreground pt-1.5 border-t border-border/40">
                  <span className="font-medium text-foreground">REJECTION RISK</span>
                  <span className="font-mono font-semibold text-amber-700 dark:text-amber-400">
                    - ₹{financials.rejectionRisk.toLocaleString()}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground -mt-1.5">
                  Applicable quality / transit risk deduction
                </p>

                <div className="flex items-center justify-between text-muted-foreground pt-1.5 border-t border-border/40">
                  <span className="font-medium text-foreground">AGROCYCLE PLATFORM FEE (3%)</span>
                  <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                    - ₹{financials.platformFee.toLocaleString()}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground -mt-1.5">
                  3% of platform fee base (₹{financials.platformFeeBase.toLocaleString()})
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-border/70 font-bold text-xs">
                  <span className="text-foreground uppercase">NET PROCUREMENT VALUE (PRODUCE PAYOUT)</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 text-sm font-bold">₹{financials.netProcurementValue.toLocaleString()}</span>
                </div>
                <p className="text-[10px] text-muted-foreground -mt-1.5">
                  Crop Value − Rejection Risk − AgroCycle Platform Fee (3%)
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                  <span className="font-semibold text-foreground">TRANSPORT COST (BUYER-ARRANGED)</span>
                  <span className="font-mono font-bold text-foreground">
                    {isTransportArranged ? `+ ₹${transportCost.toLocaleString()}` : "Pending Setup"}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground -mt-1.5">
                  Separate logistics cost. Does NOT alter farmer asking price or platform fee.
                </p>

                <div className="flex items-center justify-between pt-2.5 border-t border-border/70 font-bold text-sm bg-background/80 p-2.5 rounded-xl">
                  <span className="text-foreground uppercase">TOTAL BUYER OUTLAY</span>
                  <span className="font-mono text-primary text-base font-extrabold">₹{totalBuyerOutlay.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Payment Method & Simulate CTA (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-card rounded-3xl border border-border/80 p-5 shadow-xs space-y-4">
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <Wallet className="h-4 w-4 text-primary" />
                  Select Payment Method (Simulated)
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Choose a simulated payment channel to complete the procurement order.
                </p>
              </div>

              {/* Payment Method Cards */}
              <div className="space-y-2.5">
                {/* 1. UPI */}
                <div
                  onClick={() => setPaymentMethod("UPI")}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    paymentMethod === "UPI"
                      ? "border-primary bg-primary/5 shadow-2xs"
                      : "border-border/80 bg-background hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-foreground block">UPI / Instant QR</span>
                      <span className="text-[10px] text-muted-foreground">Google Pay, PhonePe, Paytm, BHIM</span>
                    </div>
                  </div>
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    paymentMethod === "UPI" ? "border-primary bg-primary text-white" : "border-muted-foreground"
                  }`}>
                    {paymentMethod === "UPI" && <Check className="h-2.5 w-2.5" />}
                  </div>
                </div>

                {/* 2. Cards */}
                <div
                  onClick={() => setPaymentMethod("CARD")}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    paymentMethod === "CARD"
                      ? "border-primary bg-primary/5 shadow-2xs"
                      : "border-border/80 bg-background hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-foreground block">Credit / Debit Card</span>
                      <span className="text-[10px] text-muted-foreground">Visa, Mastercard, RuPay, Corporate</span>
                    </div>
                  </div>
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    paymentMethod === "CARD" ? "border-primary bg-primary text-white" : "border-muted-foreground"
                  }`}>
                    {paymentMethod === "CARD" && <Check className="h-2.5 w-2.5" />}
                  </div>
                </div>

                {/* 3. Net Banking */}
                <div
                  onClick={() => setPaymentMethod("NETBANKING")}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                    paymentMethod === "NETBANKING"
                      ? "border-primary bg-primary/5 shadow-2xs"
                      : "border-border/80 bg-background hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Landmark className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-foreground block">Net Banking</span>
                      <span className="text-[10px] text-muted-foreground">SBI, HDFC, ICICI, Axis, Canara</span>
                    </div>
                  </div>
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                    paymentMethod === "NETBANKING" ? "border-primary bg-primary text-white" : "border-muted-foreground"
                  }`}>
                    {paymentMethod === "NETBANKING" && <Check className="h-2.5 w-2.5" />}
                  </div>
                </div>
              </div>

              {/* Security Badge */}
              <div className="p-3 rounded-2xl bg-muted/30 border border-border/50 text-[11px] text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Simulated escrow protection enabled for confirmed lots.</span>
              </div>

              {/* Primary Action Button: Simulate Payment */}
              {isTransportArranged ? (
                <Button
                  onClick={handleSimulatePayment}
                  disabled={isProcessing}
                  className="w-full h-11 rounded-2xl font-bold text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all gap-2"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Processing simulated payment...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      <span>Simulate Payment — ₹{financials.netProcurementValue.toLocaleString()}</span>
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => setTransportModalOpen(true)}
                  className="w-full h-11 rounded-2xl font-bold text-sm bg-amber-600 hover:bg-amber-700 text-white shadow-md transition-all gap-2"
                >
                  <Truck className="h-4 w-4" />
                  <span>Arrange Transport First (Required)</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Success Receipt View */
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card rounded-3xl border border-emerald-500/30 p-6 sm:p-8 shadow-md space-y-6 text-center max-w-2xl mx-auto"
        >
          <div className="h-16 w-16 rounded-3xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-xs">
            <CheckCircle2 className="h-9 w-9" />
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
              Payment Successful • Order Ready for Pickup
            </h2>
            <p className="text-xs text-muted-foreground">
              Simulated procurement payment confirmed. Transport details shared with farmer.
            </p>
          </div>

          {/* Receipt Details Box */}
          <div className="bg-muted/40 p-5 rounded-2xl border border-border/70 text-left space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <span className="text-muted-foreground">Payment ID:</span>
              <span className="font-mono font-bold text-primary">{paymentReceipt?.paymentReference}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <span className="text-muted-foreground">Procurement Order:</span>
              <span className="font-mono font-bold text-foreground">{order.orderId || order.id}</span>
            </div>
            <div className="flex items-center justify-between pb-1">
              <span className="text-muted-foreground">Crop Value (Farmer Asking Price):</span>
              <span className="font-mono font-bold text-foreground">
                ₹{(paymentReceipt?.cropValue ?? financials.cropValue).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between pb-1">
              <span className="text-muted-foreground">Rejection Risk Deduction:</span>
              <span className="font-mono font-semibold text-amber-700 dark:text-amber-400">
                - ₹{(paymentReceipt?.rejectionRisk ?? financials.rejectionRisk).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <span className="text-muted-foreground">AgroCycle Platform Fee (3%):</span>
              <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                - ₹{(paymentReceipt?.platformFee ?? financials.platformFee).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <span className="text-muted-foreground font-bold text-foreground">NET PROCUREMENT VALUE (PAID):</span>
              <span className="font-mono font-extrabold text-primary text-base">
                ₹{Number(paymentReceipt?.netProcurementValue ?? paymentReceipt?.amountPaid ?? financials.netProcurementValue).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <span className="text-muted-foreground">Buyer Transport Cost:</span>
              <span className="font-mono font-bold text-foreground">₹{transportCost.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <span className="text-muted-foreground">Fulfilled Quantity:</span>
              <span className="font-mono font-semibold text-foreground">{sourcedKg.toLocaleString()} kg {order.demand?.crop}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <span className="text-muted-foreground">Payment Method:</span>
              <span className="font-semibold text-foreground uppercase">{paymentReceipt?.paymentMethod || paymentMethod}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Order Status:</span>
              <Badge className="bg-emerald-600 text-white font-bold text-[10px]">
                READY FOR PICKUP
              </Badge>
            </div>

            {/* Smart Logistics Details */}
            {logistics && (
              <div className="pt-2 border-t border-border/50 text-[11px] space-y-1 bg-background/50 p-2.5 rounded-xl border border-border/40 mt-1">
                <div className="flex items-center justify-between font-bold text-foreground">
                  <span className="flex items-center gap-1 text-primary">
                    <Truck className="h-3.5 w-3.5" />
                    Transport Arranged by Buyer:
                  </span>
                  <Badge className="bg-emerald-600 text-white font-bold text-[9px] uppercase">
                    {order.logistics_status || logistics.transportStatus || "ASSIGNED"}
                  </Badge>
                </div>
                <div className="text-muted-foreground flex items-center justify-between">
                  <span>Transporter: <strong>{logistics.transporterName}</strong></span>
                  <div className="flex items-center gap-1.5">
                    <strong className="font-mono uppercase">{logistics.vehicleNumber}</strong>
                    {logistics.transporterPhone && (
                      <a
                        href={`tel:${logistics.transporterPhone}`}
                        className="inline-flex items-center gap-1 text-[9px] font-bold text-primary hover:underline bg-primary/10 px-1.5 py-0.5 rounded-md"
                      >
                        <Phone className="h-2.5 w-2.5" />
                        <span>Call Transporter</span>
                      </a>
                    )}
                  </div>
                </div>
                <div className="text-muted-foreground flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span>Driver: <strong>{logistics.driverName}</strong></span>
                    {logistics.driverPhone && (
                      <a
                        href={`tel:${logistics.driverPhone}`}
                        className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline bg-emerald-500/10 px-1.5 py-0.5 rounded-md"
                      >
                        <Phone className="h-2.5 w-2.5" />
                        <span>Call Driver</span>
                      </a>
                    )}
                  </div>
                  <span>Pickup: <strong>{logistics.pickupDate} ({logistics.pickupTime})</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Phase 2 Protocol Info */}
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-200 text-xs flex items-start gap-2.5 text-left">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            <div>
              <p className="font-bold text-[11px]">Payment Locked • Pickup Lifecycle Activated</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                Order status is now READY FOR PICKUP. As the buyer, you can manage dispatch status progression (Pickup → Collected → In Transit → Delivered). The farmer receives automatic real-time updates.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              onClick={() => setTransportModalOpen(true)}
              className="rounded-xl text-xs font-bold gap-1.5 h-9 w-full sm:w-auto px-5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <Truck className="h-3.5 w-3.5" />
              <span>Manage Logistics Status</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => setOrderModalOpen(true)}
              className="rounded-xl text-xs font-bold gap-1.5 h-9 w-full sm:w-auto px-4"
            >
              <Eye className="h-3.5 w-3.5 text-primary" />
              <span>Track Order</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => window.print()}
              className="rounded-xl text-xs gap-1.5 h-9 w-full sm:w-auto"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print Receipt</span>
            </Button>

            <Button
              onClick={() => navigate("/market-intelligence")}
              className="rounded-xl text-xs font-bold h-9 px-5 bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto"
            >
              Back to Market
            </Button>
          </div>
        </motion.div>
      )}

      {/* Procurement Order Details Dialog */}
      <ProcurementOrderModal
        open={orderModalOpen}
        onOpenChange={setOrderModalOpen}
        order={order}
        onOrderUpdated={(updated) => setOrder(updated)}
      />

      {/* Arrange Transport Modal */}
      <ArrangeTransportModal
        open={transportModalOpen}
        onOpenChange={setTransportModalOpen}
        order={order}
        onTransportUpdated={(updated) => {
          setOrder(updated);
        }}
      />
    </div>
  );
}
