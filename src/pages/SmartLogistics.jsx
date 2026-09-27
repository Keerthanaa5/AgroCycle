import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/i18n";
import { 
  Truck, 
  MapPin, 
  Users, 
  Layers, 
  Route as RouteIcon, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Navigation, 
  TrendingUp, 
  ArrowRight, 
  Plus, 
  RefreshCw, 
  ShieldCheck, 
  Package, 
  Play, 
  Square, 
  Clock, 
  Sparkles,
  Info,
  Calendar,
  Phone,
  Store,
  ChevronRight,
  Eye,
  Radio,
  Wifi,
  WifiOff,
  Crosshair,
  Building2,
  Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  consolidateSmartShipment,
  transitionShipmentStatus,
  getShipments,
  saveShipment,
  calculateHaversineDistanceKm,
  SHIPMENT_STATUS,
  DRIVER_STATUS,
  VEHICLE_TYPES,
  MAX_PICKUP_CLUSTER_DISTANCE_KM,
  DEFAULT_TRANSPORT_RATE_PER_KM,
  DEMO_FARMERS,
  DEMO_BUYER,
  DEMO_DRIVERS_AND_VEHICLES,
  initializeLogisticsSeedData,
  syncShipmentToBackend,
  updateShipmentStatusWithBackend,
  updateStopStatusWithBackend,
  fetchRemoteTracking
} from "@/services/logisticsService";
import { gpsTrackingService } from "@/services/gpsTrackingService";
import { realtimeSocketClient } from "@/services/realtimeSocketClient";

export default function SmartLogistics() {
  const { user, isActiveDriver, isActiveBuyer, isActiveFarmer } = useAuth();
  const { t } = useLanguage();

  // Active Tab
  const [activeTab, setActiveTab] = useState(isActiveDriver ? "driver" : "planner");

  // Planner Form State
  const [crop, setCrop] = useState("Tomato");
  const [multiBuyerMode, setMultiBuyerMode] = useState(false);
  const [singleBuyerDemand, setSingleBuyerDemand] = useState({
    businessName: "Vaigai Agro Food Processors Ltd.",
    quantityKg: "10000",
    targetPrice: "28",
    deliveryLocation: "Madurai Central Food Hub",
    coordinates: { lat: 9.9195, lng: 78.1217 }
  });

  const [multiBuyers, setMultiBuyers] = useState([
    {
      id: "buyer_a",
      buyerName: "Wholesale Processing Unit A",
      quantityKg: "7000",
      targetPrice: "28",
      deliveryLocation: "Madurai Central Cold Hub",
      coordinates: { lat: 9.9390, lng: 78.1380 }
    },
    {
      id: "buyer_b",
      buyerName: "Agro Feed Processing Hub B",
      quantityKg: "3000",
      targetPrice: "29",
      deliveryLocation: "Dindigul Processing Plant",
      coordinates: { lat: 10.3670, lng: 77.9800 }
    }
  ]);

  const [clusteringRadiusKm, setClusteringRadiusKm] = useState(String(MAX_PICKUP_CLUSTER_DISTANCE_KM));
  const [transportRatePerKm, setTransportRatePerKm] = useState(String(DEFAULT_TRANSPORT_RATE_PER_KM));

  // Current Farmer Pool
  const [farmerPool, setFarmerPool] = useState(DEMO_FARMERS);

  // Consolidation Result
  const [consolidationResult, setConsolidationResult] = useState(null);
  const [isConsolidating, setIsConsolidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Shipments List
  const [shipments, setShipments] = useState([]);
  const [activeShipmentId, setActiveShipmentId] = useState(null);

  // Real GPS & Driver Tracking State
  const [gpsTelemetry, setGpsTelemetry] = useState({
    isTracking: false,
    status: "IDLE", // IDLE, ACQUIRING, ACTIVE, OFFLINE_QUEUED
    latitude: null,
    longitude: null,
    accuracy: null,
    speedKmh: null,
    heading: null,
    timestamp: null
  });

  // Live Tracking Modal State for Farmer & Buyer
  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [liveTrackingData, setLiveTrackingData] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  // Stop Progress State
  const [activeStopIndex, setActiveStopIndex] = useState(0);

  // Load shipments and setup Socket.IO connection
  useEffect(() => {
    initializeLogisticsSeedData();
    const stored = getShipments();
    setShipments(stored);
    if (stored.length > 0) {
      setActiveShipmentId(stored[0].shipmentId);
      setActiveStopIndex(stored[0].currentStopIndex || 0);
    }

    // Connect real-time socket
    realtimeSocketClient.connect();

    // Subscribe to GPS tracking service events
    const unsubGps = gpsTrackingService.subscribe((event) => {
      setGpsTelemetry((prev) => ({
        ...prev,
        isTracking: gpsTrackingService.isTracking,
        status: event.status || prev.status,
        ...(event.location
          ? {
              latitude: event.location.latitude,
              longitude: event.location.longitude,
              accuracy: event.location.accuracy,
              speedKmh: event.location.speed,
              heading: event.location.heading,
              timestamp: event.location.timestamp
            }
          : {})
      }));
    });

    return () => {
      unsubGps();
      gpsTrackingService.stopTracking();
      realtimeSocketClient.disconnect();
    };
  }, []);

  // Listen to active shipment Socket.IO room
  useEffect(() => {
    if (!activeShipmentId) return;

    const currentUserId = user?.userId || user?.id || "usr_anonymous";

    const unsubSocket = realtimeSocketClient.subscribeShipment(activeShipmentId, currentUserId, {
      "shipment:location_update": (data) => {
        setLiveTrackingData(data);
      },
      "shipment:status_changed": (statusEvent) => {
        setShipments((prev) =>
          prev.map((s) =>
            s.shipmentId === statusEvent.shipmentId
              ? { ...s, status: statusEvent.status, updatedAt: statusEvent.timestamp }
              : s
          )
        );
      },
      "shipment:stop_progress": (stopEvent) => {
        setActiveStopIndex(stopEvent.stopIndex + 1);
      }
    });

    return () => {
      unsubSocket();
    };
  }, [activeShipmentId, user]);

  const activeShipment = shipments.find((s) => s.shipmentId === activeShipmentId) || shipments[0];

  // Run Load Consolidation Planner
  const handleRunConsolidation = () => {
    setIsConsolidating(true);
    setErrorMessage(null);
    setConsolidationResult(null);

    setTimeout(() => {
      const totalDemandKg = multiBuyerMode
        ? multiBuyers.reduce((sum, b) => sum + (Number(b.quantityKg) || 0), 0)
        : Number(singleBuyerDemand.quantityKg);

      const buyerDemand = {
        buyerId: user?.userId || "usr_buyer_primary",
        businessName: multiBuyerMode ? "Consolidated Wholesale Buyers" : singleBuyerDemand.businessName,
        crop,
        quantityRequiredKg: totalDemandKg,
        targetPrice: Number(multiBuyerMode ? multiBuyers[0].targetPrice : singleBuyerDemand.targetPrice),
        deliveryLocation: multiBuyerMode
          ? multiBuyers.map((b) => ({
              buyerId: b.id,
              buyerName: b.buyerName,
              quantityKg: Number(b.quantityKg),
              targetPrice: Number(b.targetPrice),
              lat: b.coordinates.lat,
              lng: b.coordinates.lng,
              address: b.deliveryLocation
            }))
          : {
              lat: singleBuyerDemand.coordinates.lat,
              lng: singleBuyerDemand.coordinates.lng,
              city: "Madurai",
              district: "Madurai",
              state: "Tamil Nadu",
              businessName: singleBuyerDemand.businessName,
              address: singleBuyerDemand.deliveryLocation
            }
      };

      const result = consolidateSmartShipment({
        buyerDemand,
        farmers: farmerPool,
        drivers: DEMO_DRIVERS_AND_VEHICLES.drivers,
        vehicles: DEMO_DRIVERS_AND_VEHICLES.vehicles,
        config: {
          maxClusterDistanceKm: Number(clusteringRadiusKm),
          transportRatePerKm: Number(transportRatePerKm)
        }
      });

      setIsConsolidating(false);

      if (result.success) {
        setConsolidationResult(result);
        setErrorMessage(null);
      } else {
        setErrorMessage(result.errorReason || "Failed to consolidate shipment.");
        setConsolidationResult(null);
      }
    }, 400);
  };

  // Save & Dispatch Shipment
  const handleSaveAndDispatchShipment = async (shipment) => {
    saveShipment(shipment);
    const updated = getShipments();
    setShipments(updated);
    setActiveShipmentId(shipment.shipmentId);

    // Sync to backend
    await syncShipmentToBackend(shipment, user);

    setActiveTab("active");
  };

  // Driver GPS Actions: Start Trip
  const handleDriverStartTrip = async (shipment) => {
    if (!shipment) return;
    try {
      // 1. Start device GPS watchPosition
      gpsTrackingService.startTracking(shipment.shipmentId, user, (event) => {
        if (event.location) {
          setGpsTelemetry((prev) => ({
            ...prev,
            isTracking: true,
            status: event.status,
            latitude: event.location.latitude,
            longitude: event.location.longitude,
            accuracy: event.location.accuracy,
            speedKmh: event.location.speed,
            heading: event.location.heading,
            timestamp: event.location.timestamp
          }));
        }
      });

      // 2. Transition status: DRIVER_ASSIGNED -> READY_FOR_PICKUP -> IN_TRANSIT
      let nextStatus = SHIPMENT_STATUS.READY_FOR_PICKUP;
      if (shipment.status === SHIPMENT_STATUS.MATCHED) {
        shipment = transitionShipmentStatus(shipment, SHIPMENT_STATUS.DRIVER_ASSIGNED);
        await updateShipmentStatusWithBackend(shipment.shipmentId, SHIPMENT_STATUS.DRIVER_ASSIGNED, user);
      }
      if (shipment.status === SHIPMENT_STATUS.DRIVER_ASSIGNED) {
        shipment = transitionShipmentStatus(shipment, SHIPMENT_STATUS.READY_FOR_PICKUP);
        await updateShipmentStatusWithBackend(shipment.shipmentId, SHIPMENT_STATUS.READY_FOR_PICKUP, user);
      }
      const inTransitShipment = transitionShipmentStatus(shipment, SHIPMENT_STATUS.IN_TRANSIT);
      await updateShipmentStatusWithBackend(shipment.shipmentId, SHIPMENT_STATUS.IN_TRANSIT, user);

      setShipments(getShipments());
    } catch (e) {
      console.error("[Start Trip Error]", e);
    }
  };

  // Driver GPS Actions: Stop Trip
  const handleDriverEndTrip = async (shipment) => {
    if (!shipment) return;
    gpsTrackingService.stopTracking();
    try {
      const deliveredShipment = transitionShipmentStatus(shipment, SHIPMENT_STATUS.DELIVERED);
      await updateShipmentStatusWithBackend(shipment.shipmentId, SHIPMENT_STATUS.DELIVERED, user);
      setShipments(getShipments());
    } catch (e) {
      console.error("[End Trip Error]", e);
    }
  };

  // Driver Stop Progress: Arrived / Completed
  const handleProgressStop = async (shipment, stopIdx, action) => {
    if (!shipment) return;
    try {
      const newStatus = action === "ARRIVED" ? "ARRIVED" : "COMPLETED";
      await updateStopStatusWithBackend(shipment.shipmentId, stopIdx, newStatus, user);
      if (action === "COMPLETED") {
        setActiveStopIndex(stopIdx + 1);
      }
    } catch (e) {
      console.error("[Progress Stop Error]", e);
    }
  };

  // Open Live Tracking View for Farmer or Buyer
  const handleOpenLiveTracking = async (shipment) => {
    if (!shipment) return;
    setTrackingModalOpen(true);
    setTrackingLoading(true);

    const remoteData = await fetchRemoteTracking(shipment.shipmentId, user);
    if (remoteData) {
      setLiveTrackingData(remoteData);
    } else {
      // Fallback local tracking preview
      setLiveTrackingData({
        shipmentId: shipment.shipmentId,
        status: shipment.status,
        driverName: shipment.driverName || "Ravi Transport",
        vehicleType: shipment.vehicleType || "12-ton Heavy Truck",
        hasGpsFix: gpsTelemetry.isTracking,
        estimatedRemainingDistanceKm: shipment.estimatedDistanceKm,
        estimatedEtaMinutes: Math.round((shipment.estimatedDistanceKm / 35) * 60),
        currentStopIndex: activeStopIndex,
        totalStops: shipment.route?.stops?.length || 5,
        currentStopName: shipment.route?.stops?.[activeStopIndex]?.name || "In Transit",
        speedKmh: gpsTelemetry.speedKmh || 38,
        privacyNotice: "Live vehicle location is approximate. Exact GPS coordinates are not displayed.",
        lastUpdated: new Date().toISOString()
      });
    }
    setTrackingLoading(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="agro-section-sage p-6 sm:p-8 shadow-xs relative overflow-hidden space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1.5 px-3 py-1 font-semibold text-xs">
                <Truck className="h-3.5 w-3.5" />
                Real-Time Smart Logistics Engine
              </Badge>
              {gpsTelemetry.isTracking ? (
                <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5 animate-pulse font-semibold text-xs">
                  <Radio className="h-3 w-3" />
                  Live Device GPS Active
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground border-border gap-1.5 text-xs">
                  <Crosshair className="h-3 w-3" />
                  GPS Standby
                </Badge>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Smart Logistics & Load Consolidation
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl mt-1 leading-relaxed">
              Consolidate multi-farmer harvests, optimize vehicle capacity utilization, compute fair proportional transport cost shares, and track deliveries in real time with driver device GPS.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setActiveTab("planner")}
              variant={activeTab === "planner" ? "default" : "outline"}
              className="gap-2 rounded-xl text-xs font-semibold h-9 shadow-xs"
            >
              <RouteIcon className="h-4 w-4" />
              Load Planner
            </Button>
            <Button
              onClick={() => setActiveTab("driver")}
              variant={activeTab === "driver" ? "default" : "outline"}
              className="gap-2 rounded-xl text-xs font-semibold h-9 shadow-xs bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Navigation className="h-4 w-4" />
              Driver GPS Dashboard
            </Button>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/80 p-1 rounded-2xl border border-border/80 flex flex-wrap max-w-2xl">
          <TabsTrigger value="planner" className="rounded-xl text-xs font-semibold flex-1 gap-1.5 py-2">
            <RouteIcon className="h-3.5 w-3.5" />
            Consolidated Load Planner
          </TabsTrigger>
          <TabsTrigger value="active" className="rounded-xl text-xs font-semibold flex-1 gap-1.5 py-2">
            <Package className="h-3.5 w-3.5" />
            Active Shipments ({shipments.length})
          </TabsTrigger>
          <TabsTrigger value="driver" className="rounded-xl text-xs font-semibold flex-1 gap-1.5 py-2">
            <Truck className="h-3.5 w-3.5" />
            Driver Workflow & GPS
          </TabsTrigger>
          <TabsTrigger value="lab" className="rounded-xl text-xs font-semibold flex-1 gap-1.5 py-2">
            <Sparkles className="h-3.5 w-3.5" />
            Demo Simulation Lab
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CONSOLIDATED LOAD PLANNER */}
        <TabsContent value="planner" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left: Input Specifications */}
            <Card className="lg:col-span-1 rounded-3xl border-border/80 shadow-xs">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Store className="h-4 w-4 text-primary" />
                  Wholesale Procurement Demand
                </CardTitle>
                <CardDescription className="text-xs">
                  Configure buyer requirements and geographic clustering constraints.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Single / Multi Buyer Mode Toggle */}
                <div className="flex items-center justify-between p-2.5 rounded-2xl bg-muted/50 border border-border/60 text-xs">
                  <span className="font-semibold text-foreground">Multi-Buyer Delivery Drops:</span>
                  <Button
                    size="sm"
                    variant={multiBuyerMode ? "default" : "outline"}
                    onClick={() => setMultiBuyerMode(!multiBuyerMode)}
                    className="h-7 text-xs rounded-xl"
                  >
                    {multiBuyerMode ? "Enabled (2 Buyers)" : "Single Buyer"}
                  </Button>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Commodity / Crop</label>
                  <Input
                    value={crop}
                    onChange={(e) => setCrop(e.target.value)}
                    placeholder="e.g. Tomato, Potato, Chilli"
                    className="rounded-xl"
                  />
                </div>

                {!multiBuyerMode ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground">Buyer Facility Name</label>
                      <Input
                        value={singleBuyerDemand.businessName}
                        onChange={(e) => setSingleBuyerDemand({ ...singleBuyerDemand, businessName: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-foreground">Quantity (kg)</label>
                        <Input
                          type="number"
                          value={singleBuyerDemand.quantityKg}
                          onChange={(e) => setSingleBuyerDemand({ ...singleBuyerDemand, quantityKg: e.target.value })}
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-foreground">Target Price (₹/kg)</label>
                        <Input
                          type="number"
                          value={singleBuyerDemand.targetPrice}
                          onChange={(e) => setSingleBuyerDemand({ ...singleBuyerDemand, targetPrice: e.target.value })}
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Multi-Buyer Distribution Drops:</p>
                    {multiBuyers.map((b, idx) => (
                      <div key={b.id} className="p-3 rounded-2xl border border-primary/20 bg-primary/5 text-xs space-y-1.5">
                        <p className="font-bold text-foreground">Drop #{idx + 1}: {b.buyerName}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="number"
                            value={b.quantityKg}
                            onChange={(e) => {
                              const copy = [...multiBuyers];
                              copy[idx].quantityKg = e.target.value;
                              setMultiBuyers(copy);
                            }}
                            className="h-8 text-xs rounded-xl"
                            placeholder="Qty kg"
                          />
                          <Input
                            type="number"
                            value={b.targetPrice}
                            onChange={(e) => {
                              const copy = [...multiBuyers];
                              copy[idx].targetPrice = e.target.value;
                              setMultiBuyers(copy);
                            }}
                            className="h-8 text-xs rounded-xl"
                            placeholder="Price ₹/kg"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Max Cluster Radius</label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={clusteringRadiusKm}
                        onChange={(e) => setClusteringRadiusKm(e.target.value)}
                        className="rounded-xl"
                      />
                      <span className="text-xs text-muted-foreground font-semibold">km</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Transport Rate</label>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={transportRatePerKm}
                        onChange={(e) => setTransportRatePerKm(e.target.value)}
                        className="rounded-xl"
                      />
                      <span className="text-xs text-muted-foreground font-semibold">₹/km</span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleRunConsolidation}
                  disabled={isConsolidating}
                  className="w-full py-5 rounded-xl font-bold text-xs sm:text-sm gap-2 mt-4 shadow-xs"
                >
                  {isConsolidating ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Computing Logistics Fit...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Run Load Consolidation
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Right: Farmer Supply Pool & Matching Result */}
            <div className="lg:col-span-2 space-y-6">
              {/* Farmer Pool Table */}
              <Card className="rounded-3xl border-border/80 shadow-xs">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      Candidate Farmer Supply Pool ({farmerPool.length})
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Available local farmer listings ready for proximity pooling.
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFarmerPool(DEMO_FARMERS)}
                    className="h-8 text-xs rounded-xl"
                  >
                    Reset Pool
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border/60">
                        <tr>
                          <th className="p-2.5 rounded-l-xl">Farmer</th>
                          <th className="p-2.5">Crop</th>
                          <th className="p-2.5">Available (kg)</th>
                          <th className="p-2.5">Price (₹/kg)</th>
                          <th className="p-2.5 rounded-r-xl">Pickup Location</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {farmerPool.map((f) => (
                          <tr key={f.id} className="hover:bg-muted/30">
                            <td className="p-2.5 font-bold text-foreground">{f.name}</td>
                            <td className="p-2.5">
                              <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                                {f.crop}
                              </Badge>
                            </td>
                            <td className="p-2.5 font-mono font-bold text-foreground">{f.quantityKg.toLocaleString()} kg</td>
                            <td className="p-2.5 font-mono text-foreground">₹{f.pricePerKg}</td>
                            <td className="p-2.5 text-muted-foreground truncate max-w-[140px]">{f.location.address}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2.5">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="font-bold">Consolidation Rejected</p>
                    <p className="text-destructive/90">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Consolidation Result Cards */}
              {consolidationResult && consolidationResult.shipment && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Summary Metric Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-center">
                      <p className="text-[10px] uppercase font-bold text-primary">Consolidated Load</p>
                      <p className="text-xl font-bold font-mono text-foreground mt-0.5">
                        {consolidationResult.shipment.totalQuantityKg.toLocaleString()} kg
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {consolidationResult.shipment.farmerAllocations.length} Farmers Pooled
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-center">
                      <p className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400">Assigned Vehicle</p>
                      <p className="text-sm font-bold text-foreground mt-1 truncate">
                        {consolidationResult.shipment.vehicleType}
                      </p>
                      <p className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold font-mono">
                        {consolidationResult.shipment.vehicleUtilizationPercent}% Utilization
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-center">
                      <p className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">Estimated Route</p>
                      <p className="text-xl font-bold font-mono text-foreground mt-0.5">
                        {consolidationResult.shipment.estimatedDistanceKm} km
                      </p>
                      <p className="text-[10px] text-muted-foreground">{consolidationResult.shipment.route.totalStops} Total Stops</p>
                    </div>

                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                      <p className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Estimated Transport</p>
                      <p className="text-xl font-bold font-mono text-foreground mt-0.5">
                        ₹{consolidationResult.shipment.estimatedTransportCost.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                        ₹{consolidationResult.shipment.transportCostPerKg}/kg
                      </p>
                    </div>
                  </div>

                  {/* Route Timeline Card */}
                  <Card className="rounded-3xl border-border/80 shadow-xs">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <RouteIcon className="h-4 w-4 text-primary" />
                        Deterministic Multi-Stop Route Plan
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Nearest-neighbour sequence from driver depot to all farmer pickups and wholesale delivery drop-offs.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 relative pl-6 border-l-2 border-primary/30 my-2">
                        {consolidationResult.shipment.route.stops.map((stop, idx) => (
                          <div key={stop.stopIndex} className="relative group">
                            <div className={`absolute -left-[31px] top-1.5 h-4 w-4 rounded-full border-2 ${
                              stop.stopType === "DRIVER_START" ? "bg-purple-500 border-purple-300" :
                              stop.stopType === "DELIVERY" ? "bg-emerald-500 border-emerald-300" :
                              "bg-primary border-primary-foreground"
                            }`} />
                            <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 hover:bg-muted/70 transition-colors flex items-center justify-between gap-3 text-xs">
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 uppercase">
                                    Stop #{idx} • {stop.stopType}
                                  </Badge>
                                  <span className="font-bold text-foreground">{stop.name}</span>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {stop.stopType === "PICKUP" && `Loading: +${stop.quantityKg?.toLocaleString()} kg`}
                                  {stop.stopType === "DELIVERY" && `Delivering: -${stop.quantityKg?.toLocaleString()} kg`}
                                  {stop.stopType === "DRIVER_START" && "Starting Driver Depot"}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="font-mono font-bold text-foreground">
                                  Cargo: {stop.cumulativeLoadKg?.toLocaleString()} kg
                                </span>
                                {stop.estimatedDistanceToNextKm > 0 && (
                                  <p className="text-[10px] text-muted-foreground">
                                    ↓ {stop.estimatedDistanceToNextKm} km to next
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Farmer Net Value Table */}
                  <Card className="rounded-3xl border-border/80 shadow-xs">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                        Farmer Allocations & Net Expected Value Realization
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Proportional transportation cost share and net value realization after estimated shrinkage and rejection risk.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider border-b border-border/60">
                            <tr>
                              <th className="p-2.5 rounded-l-xl">Farmer</th>
                              <th className="p-2.5">Allocated (kg)</th>
                              <th className="p-2.5">Gross Revenue</th>
                              <th className="p-2.5">Transport Share</th>
                              <th className="p-2.5">Expected Losses</th>
                              <th className="p-2.5">Net Expected Value</th>
                              <th className="p-2.5 rounded-r-xl">Net Realization</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {consolidationResult.shipment.netValueBreakdowns.map((nv) => (
                              <tr key={nv.farmerId} className="hover:bg-muted/30">
                                <td className="p-2.5 font-bold text-foreground">{nv.farmerName}</td>
                                <td className="p-2.5 font-mono font-bold text-foreground">{nv.allocatedQuantityKg.toLocaleString()} kg</td>
                                <td className="p-2.5 font-mono text-foreground">₹{nv.grossRevenue.toLocaleString()}</td>
                                <td className="p-2.5 font-mono text-purple-600 dark:text-purple-400">₹{nv.transportShare.toLocaleString()}</td>
                                <td className="p-2.5 font-mono text-amber-600 dark:text-amber-400">₹{nv.totalExpectedLosses.toLocaleString()}</td>
                                <td className="p-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  ₹{nv.netExpectedValue.toLocaleString()}
                                </td>
                                <td className="p-2.5 font-mono font-bold text-foreground">₹{nv.netRealizedPerKg}/kg</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-4 flex items-center justify-end">
                        <Button
                          onClick={() => handleSaveAndDispatchShipment(consolidationResult.shipment)}
                          className="py-5 px-6 rounded-xl font-bold text-xs sm:text-sm gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Save & Dispatch Shipment to Live Fleet
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: ACTIVE CONSOLIDATED SHIPMENTS */}
        <TabsContent value="active" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            {shipments.map((s) => (
              <Card key={s.shipmentId} className="rounded-3xl border-border/80 shadow-xs hover:border-primary/50 transition-all">
                <CardHeader className="pb-3 flex flex-row items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`text-[10px] font-bold uppercase ${
                        s.status === "IN_TRANSIT" ? "bg-purple-600 text-white animate-pulse" :
                        s.status === "DELIVERED" ? "bg-emerald-600 text-white" :
                        "bg-primary/10 text-primary border-primary/20"
                      }`}>
                        {s.status}
                      </Badge>
                      <span className="font-mono text-[11px] text-muted-foreground">{s.shipmentId}</span>
                    </div>
                    <CardTitle className="text-base font-bold text-foreground">
                      {s.crop} — {s.totalQuantityKg.toLocaleString()} kg
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Buyer: {s.buyerName || "Wholesale Processing"} • Driver: {s.driverName || "Ravi"}
                    </CardDescription>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenLiveTracking(s)}
                    className="h-8 rounded-xl text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Live Tracking
                  </Button>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-2xl bg-muted/40 border border-border/60 text-center">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Vehicle</p>
                      <p className="font-semibold text-foreground truncate">{s.vehicleType}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Est. Distance</p>
                      <p className="font-mono font-bold text-foreground">{s.estimatedDistanceKm} km</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Est. Cost</p>
                      <p className="font-mono font-bold text-emerald-600">₹{s.estimatedTransportCost.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span>Pooled Farmers: {s.farmerAllocations?.length || 0}</span>
                    <span>Rate: ₹{s.transportCostPerKg || 0.29}/kg</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TAB 3: DRIVER WORKFLOW & DEVICE GPS DASHBOARD */}
        <TabsContent value="driver" className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Driver Control Station */}
            <Card className="lg:col-span-1 rounded-3xl border-border/80 shadow-xs bg-purple-500/5 border-purple-500/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge className="bg-purple-600 text-white gap-1 text-[11px]">
                    <Truck className="h-3 w-3" /> Driver Telemetry Hub
                  </Badge>
                  {gpsTelemetry.isTracking && (
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                  )}
                </div>
                <CardTitle className="text-lg font-bold text-foreground mt-2">
                  Driver: Ravi Transport
                </CardTitle>
                <CardDescription className="text-xs">
                  Vehicle: 12-ton Heavy Truck (TN-58-AG-1234)
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 text-xs">
                {/* Real GPS Coordinates Display (Visible to Driver ONLY) */}
                <div className="p-3 rounded-2xl bg-card border border-border/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <Crosshair className="h-4 w-4 text-purple-600" />
                      Real Device GPS:
                    </span>
                    <span className={`font-semibold ${
                      gpsTelemetry.status === "ACTIVE" ? "text-emerald-600" : "text-muted-foreground"
                    }`}>
                      {gpsTelemetry.status}
                    </span>
                  </div>

                  {gpsTelemetry.latitude ? (
                    <div className="font-mono text-[11px] space-y-1 text-muted-foreground bg-muted/50 p-2 rounded-xl">
                      <p>Latitude: <span className="text-foreground font-bold">{gpsTelemetry.latitude.toFixed(5)}°N</span></p>
                      <p>Longitude: <span className="text-foreground font-bold">{gpsTelemetry.longitude.toFixed(5)}°E</span></p>
                      <p>Accuracy: <span className="text-foreground">±{gpsTelemetry.accuracy}m</span> • Speed: <span className="text-foreground">{gpsTelemetry.speedKmh || 0} km/h</span></p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground italic">
                      Click "Start Trip" to enable device GPS permission and stream live coordinates.
                    </p>
                  )}
                </div>

                {/* Driver Action Buttons */}
                <div className="space-y-2 pt-2">
                  {!gpsTelemetry.isTracking ? (
                    <Button
                      onClick={() => handleDriverStartTrip(activeShipment)}
                      className="w-full py-5 rounded-xl font-bold text-xs sm:text-sm gap-2 bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
                    >
                      <Play className="h-4 w-4" />
                      Start Trip (Enable Real GPS)
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleDriverEndTrip(activeShipment)}
                      variant="destructive"
                      className="w-full py-5 rounded-xl font-bold text-xs sm:text-sm gap-2 shadow-xs"
                    >
                      <Square className="h-4 w-4" />
                      End Trip & Mark Delivered
                    </Button>
                  )}
                </div>

                <div className="p-3 rounded-2xl bg-muted/60 text-[11px] text-muted-foreground space-y-1 border border-border/60">
                  <p className="font-bold text-foreground flex items-center gap-1">
                    <Lock className="h-3.5 w-3.5 text-primary" /> Privacy Notice
                  </p>
                  <p>Your live location is shared only while you are on an active shipment and is visible only to authorized participants of that shipment.</p>
                </div>
              </CardContent>
            </Card>

            {/* Active Driver Stop Progression Card */}
            <Card className="lg:col-span-2 rounded-3xl border-border/80 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <RouteIcon className="h-4 w-4 text-purple-600" />
                  Assigned Route & Stop Progression: {activeShipment?.crop} ({activeShipment?.totalQuantityKg?.toLocaleString()} kg)
                </CardTitle>
                <CardDescription className="text-xs">
                  Progress through pickup and delivery stops to update shipment status and notify farmers/buyers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {activeShipment?.route?.stops?.map((stop, idx) => {
                    const isCurrent = idx === activeStopIndex;
                    const isDone = idx < activeStopIndex;

                    return (
                      <div
                        key={stop.stopIndex}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                          isCurrent
                            ? "bg-purple-500/10 border-purple-500/40 shadow-xs"
                            : isDone
                            ? "bg-emerald-500/5 border-emerald-500/20 text-muted-foreground"
                            : "bg-muted/30 border-border/60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isDone ? "bg-emerald-500 text-white" : isCurrent ? "bg-purple-600 text-white" : "bg-muted text-muted-foreground"
                          }`}>
                            {isDone ? <CheckCircle2 className="h-4 w-4" /> : idx}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] uppercase px-1.5 py-0">
                                {stop.stopType}
                              </Badge>
                              <span className="font-bold text-foreground text-sm">{stop.name}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              {stop.stopType === "PICKUP" && `Load: ${stop.quantityKg?.toLocaleString()} kg`}
                              {stop.stopType === "DELIVERY" && `Unload: ${stop.quantityKg?.toLocaleString()} kg`}
                              {stop.stopType === "DRIVER_START" && "Depot Departure Point"}
                            </p>
                          </div>
                        </div>

                        {/* Driver Interactive Stop Controls */}
                        {isCurrent && (
                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleProgressStop(activeShipment, idx, "ARRIVED")}
                              className="h-8 text-xs rounded-xl"
                            >
                              Arrived at Stop
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleProgressStop(activeShipment, idx, "COMPLETED")}
                              className="h-8 text-xs rounded-xl bg-purple-600 hover:bg-purple-700 text-white"
                            >
                              Confirm {stop.stopType === "PICKUP" ? "Pickup" : "Delivery"}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 4: DEMO SIMULATION LAB */}
        <TabsContent value="lab" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            {/* Preset 1 */}
            <Card className="rounded-3xl border-border/80 shadow-xs hover:border-primary/50 transition-all flex flex-col justify-between">
              <CardHeader>
                <Badge className="w-fit bg-primary/10 text-primary border-primary/20 mb-1">Scenario 1 (Positive)</Badge>
                <CardTitle className="text-base font-bold">Standard 10-Ton Tomato Demand</CardTitle>
                <CardDescription className="text-xs">
                  5 Farmers (1t + 1t + 2t + 3t + 3t) fulfilling a 10,000 kg order with a 12-ton heavy truck at 83.33% utilization.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => {
                    setCrop("Tomato");
                    setMultiBuyerMode(false);
                    setSingleBuyerDemand({ ...singleBuyerDemand, quantityKg: "10000" });
                    setFarmerPool(DEMO_FARMERS);
                    setActiveTab("planner");
                  }}
                  className="w-full rounded-xl text-xs font-bold gap-1.5"
                >
                  Load Scenario 1
                </Button>
              </CardContent>
            </Card>

            {/* Preset 2 */}
            <Card className="rounded-3xl border-border/80 shadow-xs hover:border-purple-500/50 transition-all flex flex-col justify-between">
              <CardHeader>
                <Badge className="w-fit bg-purple-500/10 text-purple-600 border-purple-500/20 mb-1">Scenario 2 (Multi-Buyer)</Badge>
                <CardTitle className="text-base font-bold">Multi-Buyer Distribution Drop</CardTitle>
                <CardDescription className="text-xs">
                  Buyer A (7,000 kg) + Buyer B (3,000 kg) consolidated onto a single 12-ton truck with multi-drop deliveries.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => {
                    setCrop("Tomato");
                    setMultiBuyerMode(true);
                    setFarmerPool(DEMO_FARMERS);
                    setActiveTab("planner");
                  }}
                  className="w-full rounded-xl text-xs font-bold gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Load Scenario 2
                </Button>
              </CardContent>
            </Card>

            {/* Preset 3 */}
            <Card className="rounded-3xl border-border/80 shadow-xs hover:border-destructive/50 transition-all flex flex-col justify-between">
              <CardHeader>
                <Badge variant="destructive" className="w-fit mb-1">Scenario 3 (Negative Test)</Badge>
                <CardTitle className="text-base font-bold">Over-Capacity Rejection</CardTitle>
                <CardDescription className="text-xs">
                  15,000 kg demand vs 12,000 kg max fleet capacity. Rejects without creating an invalid shipment.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCrop("Tomato");
                    setMultiBuyerMode(false);
                    setSingleBuyerDemand({ ...singleBuyerDemand, quantityKg: "15000" });
                    setFarmerPool(DEMO_FARMERS);
                    setActiveTab("planner");
                  }}
                  className="w-full rounded-xl text-xs font-bold gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  Test Negative Scenario
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* PRIVACY-SANITIZED LIVE TRACKING DIALOG FOR FARMERS & BUYERS */}
      <Dialog open={trackingModalOpen} onOpenChange={setTrackingModalOpen}>
        <DialogContent className="sm:max-w-xl rounded-3xl p-6 space-y-4">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <Badge className="bg-primary/10 text-primary border-primary/20 gap-1 text-xs">
                <Radio className="h-3 w-3 animate-pulse" /> Live Telemetry Broadcast
              </Badge>
              <span className="text-[11px] text-muted-foreground font-mono">
                {liveTrackingData?.shipmentId || activeShipmentId}
              </span>
            </div>
            <DialogTitle className="text-lg font-bold text-foreground">
              Live Shipment Tracking
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Real-time progress updates directly from the driver device.
            </DialogDescription>
          </DialogHeader>

          {trackingLoading ? (
            <div className="p-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" /> Fetching live tracking data...
            </div>
          ) : liveTrackingData ? (
            <div className="space-y-4 text-xs">
              {/* ETA & Remaining Distance Strip */}
              <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-primary/10 border border-primary/20 text-center">
                <div>
                  <p className="text-[10px] uppercase font-bold text-primary">Estimated ETA</p>
                  <p className="text-2xl font-bold font-mono text-foreground mt-0.5">
                    {liveTrackingData.estimatedEtaMinutes ? `${liveTrackingData.estimatedEtaMinutes} min` : "Calculating..."}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Approximate arrival</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-primary">Estimated Distance</p>
                  <p className="text-2xl font-bold font-mono text-foreground mt-0.5">
                    {liveTrackingData.estimatedRemainingDistanceKm ? `${liveTrackingData.estimatedRemainingDistanceKm} km` : "In Transit"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Straight-line estimate</p>
                </div>
              </div>

              {/* Progress Summary */}
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">Driver: {liveTrackingData.driverName}</span>
                  <Badge variant="outline" className="text-[10px] uppercase">{liveTrackingData.status}</Badge>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Current Stop: <strong className="text-foreground">{liveTrackingData.currentStopName}</strong></span>
                  <span>Vehicle: {liveTrackingData.vehicleType}</span>
                </div>
              </div>

              {/* Strict Privacy Badge (Zero Coordinates Guarantee) */}
              <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                <span>{liveTrackingData.privacyNotice || "Live vehicle location is approximate. Exact GPS coordinates are not displayed."}</span>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
