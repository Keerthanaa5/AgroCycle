import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Warehouse, MapPin, Truck, Calendar, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

const SILAGE_CENTERS = [
  { name: "GreenFeed Silage Center", location: "Hyderabad", price_per_kg: 3, distance: "15 km" },
  { name: "AgroSilage Hub", location: "Warangal", price_per_kg: 2.5, distance: "25 km" },
  { name: "FarmFresh Processing", location: "Karimnagar", price_per_kg: 4, distance: "10 km" },
  { name: "Rural Silage Works", location: "Nizamabad", price_per_kg: 3.5, distance: "30 km" },
];

export default function SilageBank() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCenter, setSelectedCenter] = useState(null);
  const [form, setForm] = useState({ crop_type: "", quantity_kg: "", pickup_date: "", location: "", contact_phone: "" });

  useEffect(() => { loadBookings(); }, []);

  async function loadBookings() {
    setLoading(true);
    const data = await base44.entities.SilageBooking.list("-created_date", 50);
    setBookings(data);
    setLoading(false);
  }

  async function handleBook(center) {
    if (!form.crop_type || !form.quantity_kg) return;
    const user = await base44.auth.me();
    await base44.entities.SilageBooking.create({
      ...form,
      quantity_kg: Number(form.quantity_kg),
      center_name: center.name,
      center_location: center.location,
      price_per_kg: center.price_per_kg,
      total_price: Number(form.quantity_kg) * center.price_per_kg,
      farmer_name: user.full_name,
    });
    setDialogOpen(false);
    setSelectedCenter(null);
    setForm({ crop_type: "", quantity_kg: "", pickup_date: "", location: "", contact_phone: "" });
    loadBookings();
  }

  const statusColors = {
    requested: "bg-amber-100 text-amber-700",
    confirmed: "bg-blue-100 text-blue-700",
    picked_up: "bg-purple-100 text-purple-700",
    processed: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">🚜 Silage Bank Network</h1>
        <p className="text-muted-foreground text-sm mt-1">Convert waste crops into animal feed at nearby centers</p>
      </div>

      {/* Available Centers */}
      <div>
        <h2 className="font-bold text-lg mb-3">Nearby Centers</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {SILAGE_CENTERS.map((center, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-card rounded-2xl border border-border p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold">{center.name}</h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {center.location} • {center.distance}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Warehouse className="h-5 w-5 text-primary" />
                </div>
              </div>
              <p className="text-sm mb-3">₹{center.price_per_kg}/kg</p>
              <Dialog open={dialogOpen && selectedCenter === i} onOpenChange={(open) => { setDialogOpen(open); if (!open) setSelectedCenter(null); }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="w-full gap-2" onClick={() => setSelectedCenter(i)}>
                    <Truck className="h-4 w-4" /> Book Pickup
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>Book Pickup - {center.name}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <Input placeholder="Crop Type" value={form.crop_type} onChange={e => setForm(f => ({ ...f, crop_type: e.target.value }))} />
                    <Input type="number" placeholder="Quantity (kg)" value={form.quantity_kg} onChange={e => setForm(f => ({ ...f, quantity_kg: e.target.value }))} />
                    <Input type="date" placeholder="Pickup Date" value={form.pickup_date} onChange={e => setForm(f => ({ ...f, pickup_date: e.target.value }))} />
                    <Input placeholder="Your Location" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
                    <Input placeholder="Contact Phone" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
                    {form.quantity_kg && (
                      <div className="bg-accent rounded-xl p-3 text-sm">
                        <p>Estimated Cost: <span className="font-bold">₹{(Number(form.quantity_kg) * center.price_per_kg).toFixed(0)}</span></p>
                      </div>
                    )}
                    <Button onClick={() => handleBook(center)} className="w-full">Confirm Booking</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </motion.div>
          ))}
        </div>
      </div>

      {/* My Bookings */}
      <div>
        <h2 className="font-bold text-lg mb-3">My Bookings</h2>
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Warehouse className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No bookings yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings.map((b, i) => (
              <div key={b.id} className="bg-card rounded-xl border border-border p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{b.center_name}</span>
                    <Badge className={statusColors[b.status]}>{b.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{b.crop_type} • {b.quantity_kg}kg • ₹{b.total_price}</p>
                </div>
                {b.pickup_date && <p className="text-sm text-muted-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {b.pickup_date}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}