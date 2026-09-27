import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/i18n";
import { canCreateListing, isRecordOwner } from "@/services/roleManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, MapPin, Package, Upload, Loader2, Users, Search, HelpCircle, Lightbulb, Sparkles, Filter } from "lucide-react";
import CropPostCard from "../components/agro/CropPostCard";
import { localDB, KEYS } from "@/services/localDB";
import VerifiedBadge from "@/components/VerifiedBadge";
import { enqueueAction, ACTION_TYPES } from "@/services/syncQueue";
import { syncManager } from "@/services/syncManager";
import { getAssessmentHandoff, clearAssessmentHandoff } from "@/services/assessmentHandoffService";
import { storageService } from "@/services/storageService";

function FarmerPostCreation({
  dialogOpen,
  setDialogOpen,
  handleSubmit,
  form,
  setForm,
  imageFile,
  setImageFile,
  uploadingImage
}) {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  if (!canCreateListing(user)) return null;

  const postType = form.post_type || "offering_waste";

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 rounded-xl shadow-xs">
          <Plus className="h-4 w-4" /> {t("agroConnect.newPost", {}, "New Crop Community Post")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {t("agroConnect.modalTitle", {}, "Create Crop Community Post")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* User badge */}
          <div className="bg-muted/40 p-3.5 rounded-2xl border border-border/80 text-xs flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">
                {language === "ta" ? "பதிவு செய்பவர்: " : language === "hi" ? "पोस्टकर्ता: " : "Posting as: "} 
                {user?.name || user?.full_name}
              </p>
              <p className="text-muted-foreground text-[11px] mt-0.5">
                {t("common.phone", {}, "Phone")}: {user?.phone || "N/A"}
              </p>
            </div>
            <VerifiedBadge status={user?.verificationStatus} />
          </div>

          {/* 1. Post Type Dropdown (4 Crop Post Types) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Post Category</label>
            <Select value={form.post_type} onValueChange={v => setForm(f => ({ ...f, post_type: v }))}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="offering_waste">{t("agroConnect.postTypeOffering", {}, "🌾 Offering Crop Waste")}</SelectItem>
                <SelectItem value="requesting_resource">{t("agroConnect.postTypeRequesting", {}, "🌱 Requesting Crop Resource")}</SelectItem>
                <SelectItem value="seeking_advice">{t("agroConnect.postTypeAdvice", {}, "❓ Seeking Crop Advice")}</SelectItem>
                <SelectItem value="sharing_knowledge">{t("agroConnect.postTypeKnowledge", {}, "💡 Sharing Crop Knowledge")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 2. Crop Name (Required for all types) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">{t("agroConnect.cropLabel", {}, "Crop *")}</label>
            <Input
              placeholder="e.g. Paddy, Corn, Tomato, Sugarcane, Cotton"
              value={form.crop_type}
              onChange={e => setForm(f => ({ ...f, crop_type: e.target.value }))}
              required
              className="rounded-xl"
            />
          </div>

          {/* Dynamic Fields for: Offering Crop Waste */}
          {postType === "offering_waste" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">{t("agroConnect.quantityLabel", {}, "Quantity (kg) *")}</label>
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
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">{t("agroConnect.conditionLabel", {}, "Condition")}</label>
                  <Select value={form.condition} onValueChange={v => setForm(f => ({ ...f, condition: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="fresh">{t("agroConnect.conditions.fresh", {}, "Fresh Harvest Residue")}</SelectItem>
                      <SelectItem value="slightly_damaged">{t("agroConnect.conditions.slightly_damaged", {}, "Slightly Damaged")}</SelectItem>
                      <SelectItem value="damaged">{t("agroConnect.conditions.damaged", {}, "Damaged / Weathered")}</SelectItem>
                      <SelectItem value="weeds">{t("agroConnect.conditions.weeds", {}, "Field Weeds / Green Cover")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{t("agroConnect.locationLabel", {}, "Village / Location *")}</label>
                <Input
                  placeholder={t("agroConnect.locationPlaceholder", {}, "e.g. Alanganallur, Madurai")}
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  required
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{t("agroConnect.descriptionOptionalLabel", {}, "Description / Title")}</label>
                <Input
                  placeholder={t("agroConnect.titlePlaceholder", {}, "e.g. 500kg Green Corn Stalks Available")}
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
            </>
          )}

          {/* Dynamic Fields for: Requesting Crop Resource */}
          {postType === "requesting_resource" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{t("agroConnect.resourceNeededLabel", {}, "Resource Needed *")}</label>
                <Input
                  placeholder={t("agroConnect.resourceNeededPlaceholder", {}, "e.g. Seeds, Saplings, Organic Manure, Crop Residue")}
                  value={form.resource_needed}
                  onChange={e => setForm(f => ({ ...f, resource_needed: e.target.value }))}
                  required
                  className="rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">{t("agroConnect.quantityOptionalLabel", {}, "Quantity Needed (Optional)")}</label>
                  <Input
                    type="number"
                    placeholder="e.g. 100"
                    value={form.quantity_kg}
                    onChange={e => setForm(f => ({ ...f, quantity_kg: e.target.value }))}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">{t("agroConnect.locationLabel", {}, "Village / Location *")}</label>
                  <Input
                    placeholder="Village / Area"
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    required
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{t("agroConnect.descriptionOptionalLabel", {}, "Description")}</label>
                <Textarea
                  placeholder="Explain what specific crop resource you are seeking..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="rounded-xl text-xs"
                />
              </div>
            </>
          )}

          {/* Dynamic Fields for: Seeking Crop Advice */}
          {postType === "seeking_advice" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{t("agroConnect.problemTopicLabel", {}, "Problem / Topic *")}</label>
                <Input
                  placeholder={t("agroConnect.problemTopicPlaceholder", {}, "e.g. Yellowing leaves, Pest symptoms, Soil issue")}
                  value={form.topic}
                  onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                  required
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{t("agroConnect.locationOptionalLabel", {}, "Village / Location (Optional)")}</label>
                <Input
                  placeholder="Your Village / District"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{t("agroConnect.descriptionLabel", {}, "Description *")}</label>
                <Textarea
                  placeholder="Describe the crop problem, symptoms, and how long you've observed it..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  required
                  rows={3}
                  className="rounded-xl text-xs"
                />
              </div>
            </>
          )}

          {/* Dynamic Fields for: Sharing Crop Knowledge */}
          {postType === "sharing_knowledge" && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{t("agroConnect.knowledgeTopicLabel", {}, "Topic / Technique *")}</label>
                <Input
                  placeholder={t("agroConnect.knowledgeTopicPlaceholder", {}, "e.g. In-situ mulching practice, Local pest management technique")}
                  value={form.topic}
                  onChange={e => setForm(f => ({ ...f, topic: e.target.value }))}
                  required
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{t("agroConnect.locationOptionalLabel", {}, "Village / Location (Optional)")}</label>
                <Input
                  placeholder="Your Village / District"
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">{t("agroConnect.descriptionLabel", {}, "Description *")}</label>
                <Textarea
                  placeholder="Share your practical farming technique, observations, and advice for other farmers..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  required
                  rows={3}
                  className="rounded-xl text-xs"
                />
              </div>
            </>
          )}

          {/* Photo upload (Optional for all crop post types) */}
          <label className="flex flex-col items-center border-2 border-dashed border-border/90 rounded-2xl p-4 cursor-pointer hover:border-primary/50 transition-all overflow-hidden h-28 relative bg-muted/20">
            {imageFile ? (
              <img src={imageFile} alt="Preview" className="w-full h-full object-cover absolute inset-0" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full">
                <Upload className="h-5 w-5 text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">{t("agroConnect.fields.photoOptional", {}, "Upload crop photo (optional)")}</p>
              </div>
            )}
            <input type="file" accept="image/*" onChange={e => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = () => setImageFile(reader.result);
                reader.readAsDataURL(file);
              }
            }} className="hidden" />
          </label>

          <Button
            type="submit"
            className="w-full gap-2 rounded-2xl py-5 font-semibold"
            disabled={uploadingImage || !form.crop_type}
          >
            {uploadingImage ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading", {}, "Loading...")}</>
            ) : (
              t("agroConnect.publishButton", {}, "Publish Crop Community Post")
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CommunityListings({ loading, filtered, loadPosts, handleDelete, handleInteract, handleAcceptConnection }) {
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground bg-card rounded-3xl border border-border/80 p-8 shadow-xs">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-40 text-primary" />
        <p className="font-medium text-foreground">{t("agroConnect.emptyPosts", {}, "No crop community posts found")}</p>
        <p className="text-xs text-muted-foreground mt-1">{t("agroConnect.emptyPostsSubtitle", {}, "Be the first to share crop waste, request crop resources, or seek advice.")}</p>
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered.map((post, i) => (
        <CropPostCard
          key={post.id || i}
          post={post}
          index={i}
          onRefresh={loadPosts}
          onDelete={handleDelete}
          onInteract={handleInteract}
          onAcceptConnection={handleAcceptConnection}
        />
      ))}
    </div>
  );
}

export default function AgroConnect() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState({
    title: "",
    crop_type: "",
    quantity_kg: "",
    condition: "fresh",
    location: "",
    post_type: "offering_waste",
    topic: "",
    resource_needed: "",
    description: ""
  });

  // Check for incoming handoff from Viability Scanner
  useEffect(() => {
    const handoff = getAssessmentHandoff();
    if (handoff && (handoff.destination === "agro-connect" || handoff.source === "viability-scanner")) {
      const crop = handoff.crop || "Crop";
      const location = handoff.readableLocation || (handoff.location?.district ? `${handoff.location.district}, ${handoff.location.state || ""}` : "");
      const condition = handoff.conditionQuality || "fresh";
      const qty = handoff.quantity?.value ? String(handoff.quantity.value) : "";
      const img = handoff.selectedImage || (handoff.images?.[0]?.image) || null;

      setForm(f => ({
        ...f,
        crop_type: crop,
        location: location || f.location,
        condition: condition || f.condition,
        quantity_kg: qty,
        post_type: "offering_waste",
        title: `${crop} Crop Residue / Waste for Farmers`,
        description: `Field viability assessment conducted for ${crop}. Available for local agricultural recycling or exchange.`
      }));

      if (img) setImageFile(img);
      setDialogOpen(true);
      clearAssessmentHandoff();
    }
  }, []);

  useEffect(() => { 
    loadPosts(); 
    const unsub = syncManager.subscribe((event) => {
      if (event.type === "ACTION_SYNCED" || event.type === "SYNC_COMPLETE") {
        loadPosts();
      }
    });
    return () => unsub();
  }, [user]);

  async function loadPosts() {
    setLoading(true);
    let existing = [];
    try {
      existing = await localDB.async.getData(KEYS.AGRO);
    } catch (e) {
      existing = localDB.getData(KEYS.AGRO);
    }
    if (!existing || existing.length === 0) {
      existing = localDB.getData(KEYS.AGRO);
    }

    let data = (existing || []).map(p => ({
      id: p.id,
      creatorId: p.creatorId || p.creator_id || null,
      creatorRole: p.creatorRole || p.creator_role || "farmer",
      creatorVerificationStatus: p.creatorVerificationStatus || "verified",
      title: p.title,
      crop_type: p.crop || p.crop_type,
      post_type: p.post_type || "offering_waste",
      quantity_kg: p.quantity !== undefined ? Number(p.quantity) : (p.quantity_kg !== undefined ? Number(p.quantity_kg) : 0),
      condition: p.condition || null,
      location: p.location,
      topic: p.topic || null,
      resource_needed: p.resource_needed || p.resourceNeeded || null,
      description: p.description || p.title,
      farmer_name: p.creatorName || p.farmer_name || p.user || "Community Farmer",
      image: p.image || p.image_url || null,
      created_date: p.date || p.created_at || new Date().toISOString(),
      status: p.status || "available",
      sync_status: p.sync_status || null,
      phone: p.creatorPhone || p.phone || p.contact_phone,
      interactions: Array.isArray(p.interactions) ? p.interactions : [],
      connections: Array.isArray(p.connections) ? p.connections : []
    }));

    setPosts(data);
    setLoading(false);
  }

  function handleSubmit(e) {
    if (e) e.preventDefault();
    if (!canCreateListing(user)) {
      alert("Only registered Farmers can create new crop community posts.");
      return;
    }

    if (!form.crop_type) {
      alert("Please specify the crop name.");
      return;
    }

    if (form.post_type === "offering_waste" && (!form.quantity_kg || !form.location)) {
      alert("Please provide the quantity and location for offering crop waste.");
      return;
    }

    if (form.post_type === "requesting_resource" && (!form.resource_needed || !form.location)) {
      alert("Please specify the resource needed and your location.");
      return;
    }

    if ((form.post_type === "seeking_advice" || form.post_type === "sharing_knowledge") && (!form.topic || !form.description)) {
      alert("Please provide the topic and description.");
      return;
    }

    setUploadingImage(true);
    let base64String = typeof imageFile === "string" ? imageFile : "";
    setUploadingImage(false);

    const currentUserId = user.userId || user.id;
    let postTitle = form.title;
    if (!postTitle) {
      if (form.post_type === "offering_waste") {
        postTitle = `${form.quantity_kg}kg ${form.crop_type} Crop Residue Available`;
      } else if (form.post_type === "requesting_resource") {
        postTitle = `Seeking ${form.resource_needed} for ${form.crop_type} Crop`;
      } else if (form.post_type === "seeking_advice") {
        postTitle = `Advice on ${form.topic} (${form.crop_type})`;
      } else {
        postTitle = `Practice: ${form.topic} (${form.crop_type})`;
      }
    }

    const newPost = {
      id: `ap_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      creatorId: currentUserId,
      creatorRole: user.activeRole || user.roles?.[0] || "farmer",
      creatorName: user.name || user.full_name || "Community Farmer",
      creatorPhone: user.phone || null,
      creatorVerificationStatus: user.verificationStatus || "verified",
      title: postTitle,
      crop: form.crop_type,
      crop_type: form.crop_type,
      quantity: form.quantity_kg ? Number(form.quantity_kg) : null,
      quantity_kg: form.quantity_kg ? Number(form.quantity_kg) : null,
      location: form.location || "Local Area",
      user: user.name || user.full_name || "Community Farmer",
      farmer_name: user.name || user.full_name || "Community Farmer",
      phone: user.phone || null,
      date: new Date().toISOString(),
      condition: form.condition || null,
      post_type: form.post_type,
      topic: form.topic || null,
      resource_needed: form.resource_needed || null,
      description: form.description || postTitle,
      image: base64String,
      status: "available",
      sync_status: "pending",
      interactions: [],
      connections: []
    };

    localDB.addItem(KEYS.AGRO, newPost);

    // Enqueue in offline sync queue
    enqueueAction({
      userId: currentUserId,
      actionType: ACTION_TYPES.CREATE_AGROCONNECT_POST,
      entityType: "agroConnectActivity",
      entityId: newPost.id,
      payload: newPost
    }).then(() => {
      if (syncManager.isOnline()) {
        syncManager.processQueue(currentUserId).catch(() => {});
      }
    }).catch(err => console.warn("[AgroConnect] Enqueue sync error:", err));

    setDialogOpen(false);
    setImageFile(null);
    setForm({
      title: "",
      crop_type: "",
      quantity_kg: "",
      condition: "fresh",
      location: "",
      post_type: "offering_waste",
      topic: "",
      resource_needed: "",
      description: ""
    });
    loadPosts();
  }

  function handleDelete(id) {
    const item = posts.find(p => p.id === id);
    if (!isRecordOwner(item, user)) {
      alert("You can only remove posts that you created.");
      return;
    }
    if (confirm("Are you sure you want to remove this crop community post?")) {
      localDB.deleteItem(KEYS.AGRO, id);
      loadPosts();
    }
  }

  async function handleInteract(postId, interactionData) {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const updatedInteractions = [...(post.interactions || []), {
      id: `int_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...interactionData,
      created_at: new Date().toISOString()
    }];

    const updatedPost = { ...post, interactions: updatedInteractions };
    localDB.updateItem(KEYS.AGRO, postId, updatedPost);

    // Call REST endpoint if online, otherwise enqueue
    const currentUserId = user?.userId || user?.id;
    try {
      const apiBase = import.meta.env?.VITE_API_BASE_URL || "/api/v1";
      await fetch(`${apiBase}/agroconnect/posts/${postId}/interact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(interactionData)
      });
    } catch (e) {
      console.warn("[AgroConnect] Remote interaction queued offline:", e);
    }

    loadPosts();
  }

  async function handleAcceptConnection(postId, requestingFarmerId, requestingFarmerName) {
    const post = posts.find(p => p.id === postId);
    if (!post || !isRecordOwner(post, user)) return;

    const currentConnections = Array.isArray(post.connections) ? post.connections : [];
    const updatedConnections = [
      ...currentConnections.filter(c => c.farmer_id !== requestingFarmerId),
      {
        farmer_id: requestingFarmerId,
        farmer_name: requestingFarmerName,
        status: "connected",
        connected_at: new Date().toISOString()
      }
    ];

    const updatedPost = { ...post, connections: updatedConnections };
    localDB.updateItem(KEYS.AGRO, postId, updatedPost);

    const currentUserId = user?.userId || user?.id;
    try {
      const apiBase = import.meta.env?.VITE_API_BASE_URL || "/api/v1";
      await fetch(`${apiBase}/agroconnect/posts/${postId}/connect`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          requestingFarmerId,
          requestingFarmerName,
          action: "accept"
        })
      });
    } catch (e) {
      console.warn("[AgroConnect] Remote connection accept queued offline:", e);
    }

    loadPosts();
  }

  // Filter posts by category and search query
  const filtered = posts.filter(p => {
    const matchesCategory = filter === "all" || p.post_type === filter;
    if (!matchesCategory) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchCrop = (p.crop_type || "").toLowerCase().includes(q);
    const matchTitle = (p.title || "").toLowerCase().includes(q);
    const matchLocation = (p.location || "").toLowerCase().includes(q);
    const matchTopic = (p.topic || "").toLowerCase().includes(q);
    const matchResource = (p.resource_needed || "").toLowerCase().includes(q);
    return matchCrop || matchTitle || matchLocation || matchTopic || matchResource;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
              {t("agroConnect.title", {}, "AgroConnect Crop Community")}
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">
            {t("agroConnect.subtitle", {}, "Farmers helping farmers with crop-related knowledge, problems, resources, and crop waste")}
          </p>
        </div>
        <FarmerPostCreation
          dialogOpen={dialogOpen}
          setDialogOpen={setDialogOpen}
          handleSubmit={handleSubmit}
          form={form}
          setForm={setForm}
          imageFile={imageFile}
          setImageFile={setImageFile}
          uploadingImage={uploadingImage}
        />
      </div>

      {/* Search and Category Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("agroConnect.searchPlaceholder", {}, "Search by crop, topic, or location...")}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 rounded-2xl bg-card border-border/80"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {[
            { val: "all", label: t("agroConnect.filters.all", {}, "All Crop Posts") },
            { val: "offering_waste", label: t("agroConnect.filters.offeringWaste", {}, "🌾 Crop Waste") },
            { val: "requesting_resource", label: t("agroConnect.filters.requestingResource", {}, "🌱 Crop Resource") },
            { val: "seeking_advice", label: t("agroConnect.filters.seekingAdvice", {}, "❓ Crop Advice") },
            { val: "sharing_knowledge", label: t("agroConnect.filters.sharingKnowledge", {}, "💡 Crop Knowledge") },
          ].map(f => (
            <Button 
              key={f.val} 
              variant={filter === f.val ? "default" : "outline"} 
              size="sm" 
              onClick={() => setFilter(f.val)}
              className="rounded-full text-xs h-9 px-3.5 font-medium"
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      <CommunityListings
        loading={loading}
        filtered={filtered}
        loadPosts={loadPosts}
        handleDelete={handleDelete}
        handleInteract={handleInteract}
        handleAcceptConnection={handleAcceptConnection}
      />
    </div>
  );
}