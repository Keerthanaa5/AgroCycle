import { useState, useEffect } from "react";
import { mockApi } from "@/api/mockApi";
import { useAuth } from "@/lib/AuthContext";
import { isRecordOwner } from "@/services/roleManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Plus, FileCheck, Upload, Loader2, Clock, CheckCircle2, AlertCircle, 
  ShieldCheck, Sparkles, ExternalLink, PhoneCall, Info, Trash2, Eye, FileText,
  Calendar, MapPin, Printer, ArrowRight, CheckSquare, Square, AlertTriangle,
  Building2, Smartphone, Shield, HelpCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import VerifiedBadge from "@/components/VerifiedBadge";
import SyncStatusBadge from "@/components/SyncStatusBadge";
import VoiceButton from "@/components/VoiceButton";
import { useLanguage } from "@/i18n";
import { enqueueAction, ACTION_TYPES } from "@/services/syncQueue";
import { syncManager } from "@/services/syncManager";
import { 
  getAssessmentHandoff, 
  consumeAssessmentHandoff, 
  hasPendingHandoff 
} from "@/services/assessmentHandoffService";
import {
  OFFICIAL_PMFBY_PORTAL_URL,
  OFFICIAL_PMFBY_HELPLINE,
  OFFICIAL_PMFBY_APP_URL,
  APPLICABLE_INTIMATION_WINDOW_HOURS,
  PERIL_OPTIONS,
  LOSS_TIME_OPTIONS,
  SEASON_OPTIONS,
  LOSS_CATEGORY_OPTIONS,
  REPORTED_DAMAGE_EXTENT_OPTIONS,
  isLocalizedOrPostHarvestPeril,
  normalizePerilValue,
  calculateLocalEvidenceReview
} from "@/services/claimRocketService";

export default function ClaimRocket() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedClaimForView, setSelectedClaimForView] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [step, setStep] = useState(1);
  const [evidenceReview, setEvidenceReview] = useState(null);
  const [importedHandoff, setImportedHandoff] = useState(null);
  const [docketInputs, setDocketInputs] = useState({});
  const [savingDocketId, setSavingDocketId] = useState(null);

  const getInitialForm = () => {
    const today = new Date().toISOString().split("T")[0];
    return {
      farmer_name: user?.name || user?.full_name || "",
      mobile_number: user?.phone || "",
      policy_number: user?.userId ? `POL-${user.userId.slice(-6).toUpperCase()}` : "POL-AGR-1001",
      aadhar_number: "",
      crop_type: "",
      season: "kharif",
      damage_type: "pest_disease",
      loss_category: "standing_crop",
      area_acres: user?.farmerProfile?.farmSize || "",
      location: user?.farmerProfile?.farmLocation || "",
      loss_date: today,
      loss_time_of_day: "unknown",
      reported_damage_extent: "entire_field",
      material_state: "standing_crop",
      problem_distribution: "widespread",
      incident_description: "",
      farmer_confirmed: false,
      samples: [],
      visualEvidence: null,
      farmerReported: null,
      claimWindowStatus: "not_applicable",
      claimRoutingPriority: "standard",
      isPriorityPath: false,
      assessmentId: null,
      assessmentTimestamp: null
    };
  };

  const [form, setForm] = useState(getInitialForm());

  // Check for incoming Viability Scanner handoff on mount & whenever route activates
  useEffect(() => {
    loadClaims();
    checkIncomingHandoff();
  }, [user]);

  function checkIncomingHandoff() {
    try {
      const handoff = getAssessmentHandoff("claim-rocket");
      if (handoff) {
        setImportedHandoff(handoff);
        applyHandoffToForm(handoff);
        // Automatically open preparation dialog with pre-filled scanner data
        setDialogOpen(true);
      }
    } catch (e) {
      console.warn("[ClaimRocket] Error reading handoff:", e);
    }
  }

  function applyHandoffToForm(handoff) {
    const today = new Date().toISOString().split("T")[0];
    const cropName = handoff.crop || "";
    const acres = handoff.cultivatedAcres || "";
    const loc = handoff.readableLocation || user?.farmerProfile?.farmLocation || "";
    const lossDate = handoff.damageLossDate || today;
    const lossTimeOfDay = handoff.lossTimeOfDay || "unknown";
    const reportedExtent = handoff.reportedDamageExtent || "entire_field";
    const distribution = handoff.problemDistribution || "widespread";

    // Select primary image if available
    if (handoff.selectedImage) {
      setImagePreview(handoff.selectedImage);
    }

    // Prefill "Pest / Disease" ONLY as a suggested/preselected value if farmer indicated insurance documentation is required or scanner detected disease
    let defaultDamageType = "pest_disease";
    if (handoff.farmerReported?.reportedPeril) {
      defaultDamageType = normalizePerilValue(handoff.farmerReported.reportedPeril);
    } else if (handoff.farmerReported?.insuranceClaimIntent === "yes" || handoff.visualEvidence?.primaryDisease) {
      defaultDamageType = "pest_disease";
    }

    setForm({
      farmer_name: user?.name || user?.full_name || "Farmer",
      mobile_number: user?.phone || "",
      policy_number: user?.userId ? `POL-${user.userId.slice(-6).toUpperCase()}` : "POL-AGR-1001",
      aadhar_number: "",
      crop_type: cropName,
      season: "kharif",
      damage_type: defaultDamageType,
      loss_category: isLocalizedOrPostHarvestPeril(defaultDamageType) ? "localized" : "standing_crop",
      area_acres: acres,
      location: loc,
      loss_date: lossDate,
      loss_time_of_day: lossTimeOfDay,
      reported_damage_extent: reportedExtent,
      material_state: handoff.materialState || "standing_crop",
      problem_distribution: distribution,
      incident_description: `Viability Scanner Field Assessment: ${cropName} across ${acres} acres. Reported extent: ${reportedExtent.replace(/_/g, " ")}. Problem distribution: ${distribution}. AI visual observation: ${handoff.visualEvidence?.burdenCategory || "Low"} disease indicators.`,
      farmer_confirmed: false,
      samples: handoff.samples || [],
      visualEvidence: handoff.visualEvidence || null,
      farmerReported: handoff.farmerReported || {
        crop: cropName,
        acres: acres,
        condition: handoff.conditionQuality || "not_sure",
        materialState: handoff.materialState || "standing_crop",
        reportedDamageExtent: reportedExtent,
        damageLossDate: lossDate,
        reportedPeril: defaultDamageType,
        problemDistribution: distribution,
        insuranceClaimIntent: handoff.farmerReported?.insuranceClaimIntent || "yes"
      },
      claimWindowStatus: handoff.claimWindowStatus || "not_applicable",
      claimRoutingPriority: handoff.claimRoutingPriority || "standard",
      isPriorityPath: Boolean(handoff.isPriorityPath),
      assessmentId: handoff.assessmentId || null,
      assessmentTimestamp: handoff.assessmentTimestamp || null
    });
  }

  async function loadClaims() {
    setLoading(true);
    try {
      const data = await mockApi.entities.InsuranceClaim.list("-created_date", 50);
      const currentUserId = user?.userId || user?.id;
      const userClaims = data.filter(c => {
        if (!c.creatorId) return true; // legacy demo claims
        return c.creatorId === currentUserId;
      });
      setClaims(userClaims);
    } catch (err) {
      console.error("Failed to load claims:", err);
    } finally {
      setLoading(false);
    }
  }

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };

  // Missing Information Checker for Step 1
  const missingFields = [];
  if (!form.farmer_name?.trim()) missingFields.push("Farmer Full Name");
  if (!form.mobile_number?.trim() || form.mobile_number.replace(/\D/g, "").length < 10) missingFields.push("10-Digit Mobile Number");
  if (!form.crop_type?.trim()) missingFields.push("Crop Type");
  if (!form.area_acres || Number(form.area_acres) <= 0) missingFields.push("Affected Acreage");
  if (!form.loss_date) missingFields.push("Damage / Loss Date");
  if (!form.location?.trim()) missingFields.push("Farm Location / Survey Details");
  if (!imageFile && !imagePreview && (!form.samples || form.samples.length === 0)) {
    missingFields.push("Photographic Crop Damage Evidence");
  }

  async function handleEvidenceReview(e) {
    if (e) e.preventDefault();

    if (missingFields.length > 0) {
      alert("Please complete the following required fields:\n- " + missingFields.join("\n- "));
      return;
    }

    setSubmitting(true);
    try {
      const reviewResult = calculateLocalEvidenceReview({
        cropType: form.crop_type,
        damageType: form.damage_type,
        areaAcres: form.area_acres,
        location: form.location,
        hasImage: Boolean(imageFile || imagePreview),
        incidentDate: form.loss_date,
        lossTimeOfDay: form.loss_time_of_day,
        reportedDamageExtent: form.reported_damage_extent,
        visualEvidence: form.visualEvidence
      });

      setEvidenceReview(reviewResult);
      setStep(2);
    } catch (err) {
      console.error("Evidence Review Error:", err);
      alert("Evidence review failed: " + (err.message || "Please check inputs."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveDossier() {
    if (!evidenceReview) return;
    setSubmitting(true);

    try {
      let imageUrl = imagePreview || "";
      if (imageFile) {
        try {
          imageUrl = await convertToBase64(imageFile);
        } catch (err) {
          console.error("Base64 conversion failed:", err);
        }
      }

      const currentUserId = user?.userId || user?.id;
      const perilObj = PERIL_OPTIONS.find(p => p.value === form.damage_type);
      const perilLabel = perilObj ? perilObj.label : form.damage_type;

      const createdClaim = await mockApi.entities.InsuranceClaim.create({
        creatorId: currentUserId,
        creatorRole: "farmer",
        creatorName: user?.name || user?.full_name || form.farmer_name,
        creatorPhone: user?.phone || form.mobile_number,
        creatorVerificationStatus: user?.verificationStatus || "pending",
        
        farmer_name: form.farmer_name || user?.name || "Farmer",
        mobile_number: form.mobile_number || user?.phone || "N/A",
        policy_number: form.policy_number || "N/A",
        aadhar_number: form.aadhar_number || "",
        crop_type: form.crop_type,
        season: form.season,
        damage_type: form.damage_type,
        damage_cause: perilLabel,
        loss_category: form.loss_category,
        location: form.location,
        area_acres: Number(form.area_acres),
        loss_date: form.loss_date,
        loss_time_of_day: form.loss_time_of_day || "unknown",
        reported_damage_extent: form.reported_damage_extent,
        problem_distribution: form.problem_distribution,
        incident_description: form.incident_description,
        damage_image_url: imageUrl,
        
        // Imported spatial samples & decoupled evidence
        samples: form.samples || [],
        visualEvidence: form.visualEvidence || null,
        farmerReported: form.farmerReported || {
          crop: form.crop_type,
          acres: form.area_acres,
          reportedDamageExtent: form.reported_damage_extent,
          damageLossDate: form.loss_date,
          lossTimeOfDay: form.loss_time_of_day || "unknown",
          reportedPeril: form.damage_type,
          problemDistribution: form.problem_distribution
        },
        assessmentId: form.assessmentId,
        assessmentTimestamp: form.assessmentTimestamp,
        
        // AI Evidence Review fields
        evidence_quality: evidenceReview.image_quality,
        damage_indicators: evidenceReview.damage_indicators,
        peril_consistency: evidenceReview.peril_consistency,
        evidence_completeness: evidenceReview.evidence_completeness,
        ai_recommendation: evidenceReview.recommendation,
        assessment_source: evidenceReview.assessment_source,
        window_status: evidenceReview.window_status,
        elapsed_hours: evidenceReview.elapsed_hours,
        next_step_title: evidenceReview.next_step_title,
        next_step_desc: evidenceReview.next_step_desc,
        
        status: "ready",
        sync_status: "pending",
        pmfby_reference_no: "",
        intimation_date: null
      });

      // Clear consumed handoff safely
      consumeAssessmentHandoff("claim-rocket");
      setImportedHandoff(null);

      // Enqueue in offline sync queue
      if (createdClaim) {
        enqueueAction({
          userId: currentUserId,
          actionType: ACTION_TYPES.SAVE_CLAIM_DOSSIER,
          entityType: "claimDossier",
          entityId: String(createdClaim.id),
          payload: createdClaim
        }).then(() => {
          if (syncManager.isOnline()) {
            syncManager.processQueue(currentUserId).catch(() => {});
          }
        }).catch(err => console.warn("[ClaimRocket] Enqueue sync error:", err));
      }

      // Move to step 3: Claim Ready & Official Portal connection
      setStep(3);
      loadClaims();
    } catch (err) {
      console.error("Dossier Save Error:", err);
      alert("Failed to save dossier: " + (err.message || "Unknown error"));
    } finally {
      setSubmitting(false);
    }
  }

  const handleDialogClose = () => {
    setDialogOpen(false);
    setStep(1);
    setImageFile(null);
    setImagePreview(null);
    setEvidenceReview(null);
    setForm(getInitialForm());
    consumeAssessmentHandoff("claim-rocket");
    setImportedHandoff(null);
  };

  const handleOpenOfficialPortal = () => {
    window.open(OFFICIAL_PMFBY_PORTAL_URL, "_blank", "noopener,noreferrer");
  };

  const handleOpenAppPortal = () => {
    window.open(OFFICIAL_PMFBY_APP_URL, "_blank", "noopener,noreferrer");
  };

  const handleSaveDocketNumber = async (claimId) => {
    const docketNo = docketInputs[claimId]?.trim();
    if (!docketNo) {
      alert("Please enter a valid PMFBY Loss Intimation Reference / Docket Number.");
      return;
    }

    setSavingDocketId(claimId);
    try {
      const today = new Date().toISOString().split("T")[0];
      await mockApi.entities.InsuranceClaim.update(claimId, {
        pmfby_reference_no: docketNo,
        status: "submitted_to_portal",
        intimation_date: today
      });
      await loadClaims();
      alert(t("claimRocket.form.docketSavedSuccess") || "Official PMFBY Docket Reference saved successfully!");
    } catch (err) {
      console.error("Failed to save docket number:", err);
      alert("Error saving docket number: " + err.message);
    } finally {
      setSavingDocketId(null);
    }
  };

  const handleDeleteClaim = async (claimId) => {
    if (!confirm("Are you sure you want to remove this claim dossier?")) return;
    try {
      await mockApi.entities.InsuranceClaim.delete(claimId);
      loadClaims();
    } catch (err) {
      console.error("Failed to delete claim:", err);
    }
  };

  const handlePrintDossier = (claim) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      window.print();
      return;
    }

    const perilLabel = PERIL_OPTIONS.find(p => p.value === claim.damage_type)?.label || claim.damage_cause || claim.damage_type;
    const extentLabel = REPORTED_DAMAGE_EXTENT_OPTIONS.find(o => o.value === claim.reported_damage_extent)?.label || claim.reported_damage_extent || "Full";
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>AgroCycle - PMFBY Crop Loss Claim Preparation Dossier</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; line-height: 1.5; }
            .header { border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
            .title { font-size: 20px; font-weight: bold; color: #065f46; }
            .badge { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
            .section { margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; }
            .section-title { font-size: 14px; font-weight: bold; color: #0f172a; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; }
            .field label { color: #64748b; font-size: 11px; display: block; }
            .field value { font-weight: 600; color: #0f172a; }
            .disclaimer { background: #fffbeb; border: 1px solid #fef3c7; padding: 12px; border-radius: 6px; font-size: 11px; color: #92400e; margin-top: 16px; }
            .signatures { margin-top: 30px; display: flex; justify-content: space-between; font-size: 12px; color: #475569; padding-top: 20px; border-top: 1px dashed #cbd5e1; }
            .img-container { margin-top: 10px; max-width: 300px; }
            .img-container img { width: 100%; border-radius: 6px; border: 1px solid #cbd5e1; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">🌾 AgroCycle — PMFBY Crop Loss Claim Preparation Dossier</div>
              <div style="font-size: 12px; color: #64748b;">Intended for official loss intimation under Pradhan Mantri Fasal Bima Yojana</div>
            </div>
            <span class="badge">Preparation Dossier ID: ${claim.id || 'AGR-' + Date.now()}</span>
          </div>

          <div class="section">
            <div class="section-title">1. Applicant & Policy Details</div>
            <div class="grid">
              <div class="field"><label>Farmer Full Name</label><value>${claim.farmer_name || 'Farmer'}</value></div>
              <div class="field"><label>Mobile Number</label><value>${claim.mobile_number || 'N/A'}</value></div>
              <div class="field"><label>Policy / Survey / Application / Khasra No.</label><value>${claim.policy_number || 'N/A'}</value></div>
              <div class="field"><label>PMFBY Reference / Docket No.</label><value>${claim.pmfby_reference_no || 'Pending Intimation'}</value></div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">2. Crop & Land Specifics</div>
            <div class="grid">
              <div class="field"><label>Cultivated Crop & Affected Acreage</label><value>${claim.crop_type || 'N/A'} (${claim.area_acres || 'N/A'} Acres)</value></div>
              <div class="field"><label>Cultivation Season</label><value>${claim.season || 'Kharif'}</value></div>
              <div class="field"><label>Farm / Field Location</label><value>${claim.location || 'N/A'}</value></div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">3. Loss Event & Farmer-Reported Peril (Farmer Reported)</div>
            <div class="grid">
              <div class="field"><label>Reported Peril / Cause</label><value>${perilLabel} (Farmer Reported)</value></div>
              <div class="field"><label>Date of Loss / Incident</label><value>${claim.loss_date || 'Recorded'} ${claim.loss_time_of_day && claim.loss_time_of_day !== 'unknown' ? `(${claim.loss_time_of_day})` : ''}</value></div>
              <div class="field"><label>Farmer-Reported Damage Extent</label><value>${extentLabel}</value></div>
              <div class="field"><label>Problem Distribution</label><value>${claim.problem_distribution || 'Widespread'}</value></div>
            </div>
            <div style="margin-top: 10px; font-size: 12px;">
              <label style="color: #64748b; font-size: 11px; display: block;">Farmer Incident Observations</label>
              <div style="background: #f8fafc; padding: 8px; border-radius: 4px; border: 1px solid #e2e8f0; margin-top: 4px;">
                ${claim.incident_description || 'No additional notes logged.'}
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">4. AI Visual Evidence & Observations (AgroCycle Visual Observation)</div>
            <div style="font-size: 12px; margin-bottom: 8px;">
              <strong>Observations:</strong> ${claim.damage_indicators || 'Photographic visual evidence recorded on-device.'}<br/>
              <strong>Recommendation:</strong> ${claim.ai_recommendation || 'Proceed with official loss intimation through authorized PMFBY channels.'}
            </div>
            ${claim.damage_image_url ? `<div class="img-container"><img src="${claim.damage_image_url}" alt="Crop Damage Photo"/></div>` : ''}
          </div>

          <div class="disclaimer">
            <strong>Official Notice:</strong> AgroCycle provides claim preparation documentation assistance only. AgroCycle is NOT the insurer or official loss assessor and does not declare indemnity percentages or claim payouts. Joint field loss survey and indemnity assessment are conducted exclusively by authorized PMFBY surveyors and state government officials.
          </div>

          <div class="signatures">
            <div>____________________________<br/>Farmer Signature / Thumbprint</div>
            <div>____________________________<br/>PMFBY Surveyor / Bank Official</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const statusConfig = {
    ready: { label: t("claimRocket.dossierReadyTitle") || "Dossier Prepared", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300", icon: CheckCircle2 },
    draft: { label: "Draft Saved", color: "bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300", icon: Clock },
    submitted_to_portal: { label: "Intimated to PMFBY Portal", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300", icon: FileCheck },
    under_review: { label: "Joint Survey in Progress", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", icon: AlertCircle },
    approved: { label: "Settled by Insurer", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300", icon: CheckCircle2 },
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">📄 {t("claimRocket.title")}</h1>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 rounded-full px-2.5 py-0.5">
              {t("claimRocket.badge")}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {t("claimRocket.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button 
            variant="outline" 
            onClick={handleOpenOfficialPortal}
            className="gap-2 text-xs border-border/80 hover:bg-muted rounded-xl"
          >
            <ExternalLink className="h-3.5 w-3.5 text-primary" />
            <span>{t("claimRocket.openPortalButton")}</span>
          </Button>

          <Button 
            variant="outline"
            onClick={() => {
              alert(`Official PMFBY Farmer Toll-Free Helpline: ${OFFICIAL_PMFBY_HELPLINE}\nAvailable 24x7 across India in multiple languages for claim intimation and farmer grievances.`);
            }}
            className="gap-2 text-xs border-border/80 rounded-xl"
          >
            <PhoneCall className="h-3.5 w-3.5 text-primary" />
            <span>{t("claimRocket.helplineButton")}</span>
          </Button>

          <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleDialogClose(); else setDialogOpen(true); }}>
            <DialogTrigger asChild>
              <Button className="gap-2 rounded-xl shadow-xs">
                <Plus className="h-4 w-4" /> {t("claimRocket.prepareClaimButton")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl p-6">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-2 text-base font-bold">
                  <div className="flex items-center gap-2">
                    <span>{t("claimRocket.badge")}</span>
                    {form.isPriorityPath && (
                      <Badge className="bg-emerald-600 text-white text-[10px] uppercase font-bold tracking-wide">
                        Priority Path (Within 72h)
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">Step {step} of 3</span>
                </DialogTitle>
                
                {/* Stepper Header */}
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mt-2 bg-muted/60 p-2 rounded-2xl">
                  <span className={`px-2.5 py-1 rounded-xl transition-colors ${step === 1 ? "bg-primary text-primary-foreground font-bold shadow-xs" : ""}`}>
                    {t("claimRocket.steps.step1")}
                  </span>
                  <span>&rarr;</span>
                  <span className={`px-2.5 py-1 rounded-xl transition-colors ${step === 2 ? "bg-primary text-primary-foreground font-bold shadow-xs" : ""}`}>
                    {t("claimRocket.steps.step2")}
                  </span>
                  <span>&rarr;</span>
                  <span className={`px-2.5 py-1 rounded-xl transition-colors ${step === 3 ? "bg-primary text-primary-foreground font-bold shadow-xs" : ""}`}>
                    {t("claimRocket.steps.step3")}
                  </span>
                </div>
              </DialogHeader>

              {/* STEP 1: Claim Details & Missing Info Checker */}
              {step === 1 && (
                <form onSubmit={handleEvidenceReview} className="space-y-4 pt-2">
                  {/* Farmer Identity Badge */}
                  <div className="bg-muted/40 p-3.5 rounded-2xl border border-border/70 text-xs flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{t("claimRocket.form.applicantLabel", { name: user?.name || user?.full_name || form.farmer_name || "Farmer" })}</p>
                      <p className="text-muted-foreground font-mono text-[11px]">{t("claimRocket.form.userIdLabel", { id: user?.userId || form.assessmentId || "N/A" })}</p>
                    </div>
                    <VerifiedBadge status={user?.verificationStatus} />
                  </div>

                  {/* Imported Scanner Notice */}
                  {(form.visualEvidence || form.samples?.length > 0) && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" />
                          Viability Scanner Evidence Loaded ({form.samples?.length || 5} Spatial Zones)
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                          {form.claimWindowStatus === "within_window" ? "Within 72h Window" : (form.claimWindowStatus === "outside_window" ? "Outside 72h Window" : "Loss Date Check")}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        Pre-populated from on-device assessment: <strong>{form.crop_type}</strong> ({form.area_acres} acres). Visual evidence and farmer-reported damage are maintained separately.
                      </p>
                    </div>
                  )}

                  {/* Missing Info Checklist */}
                  <div className="bg-card border border-border/70 p-3.5 rounded-2xl text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <CheckSquare className="h-4 w-4 text-primary" />
                        {t("claimRocket.missingInfoTitle")}
                      </span>
                      {missingFields.length === 0 ? (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 text-[10px]">
                          ✅ Complete & Ready
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">
                          {missingFields.length} Item{missingFields.length > 1 ? "s" : ""} Pending
                        </Badge>
                      )}
                    </div>
                    {missingFields.length > 0 && (
                      <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-500/20 space-y-1">
                        <p className="font-medium">Please provide the following before generating claim dossier:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                          {missingFields.map((f, idx) => (
                            <li key={idx}>{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Section A: Applicant & Policy */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">{t("claimRocket.form.farmerName")}</label>
                      <Input 
                        placeholder="Farmer Name" 
                        value={form.farmer_name} 
                        onChange={e => setForm(f => ({ ...f, farmer_name: e.target.value }))} 
                        required 
                        className="rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">{t("claimRocket.form.mobile")}</label>
                      <Input 
                        placeholder="10-digit Phone" 
                        value={form.mobile_number} 
                        onChange={e => setForm(f => ({ ...f, mobile_number: e.target.value.replace(/\D/g, "") }))} 
                        required 
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">{t("claimRocket.form.policyNumber")}</label>
                      <Input 
                        placeholder="e.g. POL-123456 or Survey / Khasra No." 
                        value={form.policy_number} 
                        onChange={e => setForm(f => ({ ...f, policy_number: e.target.value }))} 
                        className="rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">{t("claimRocket.form.cultivationSeason")}</label>
                      <Select value={form.season} onValueChange={v => setForm(f => ({ ...f, season: v }))}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {SEASON_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Section B: Crop & Loss Event */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">{t("claimRocket.form.cropType") || "Cultivated Crop *"}</label>
                      <Input 
                        placeholder="e.g. Potato, Paddy, Cotton" 
                        value={form.crop_type} 
                        onChange={e => setForm(f => ({ ...f, crop_type: e.target.value }))} 
                        required 
                        className="rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">{t("claimRocket.form.areaAcres") || "Affected Acreage (Acres) *"}</label>
                      <Input 
                        type="number" 
                        step="0.1" 
                        placeholder="Area (acres)" 
                        value={form.area_acres} 
                        onChange={e => setForm(f => ({ ...f, area_acres: e.target.value }))} 
                        required 
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">{t("claimRocket.form.lossDate") || "Damage / Loss Date *"}</label>
                      <Input 
                        type="date" 
                        value={form.loss_date} 
                        onChange={e => setForm(f => ({ ...f, loss_date: e.target.value }))} 
                        required 
                        className="rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">{t("claimRocket.form.approximateTime") || "Approximate Time of Loss"}</label>
                      <Select value={form.loss_time_of_day || "unknown"} onValueChange={v => setForm(f => ({ ...f, loss_time_of_day: v }))}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {LOSS_TIME_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-foreground">{t("claimRocket.form.perilCause") || "Reported Peril / Cause *"}</label>
                        <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground font-medium">Farmer Reported</Badge>
                      </div>
                      <Select value={form.damage_type} onValueChange={v => setForm(f => ({ ...f, damage_type: v }))}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {PERIL_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">{t("claimRocket.form.reportedExtent") || "Farmer-Reported Damage Extent"}</label>
                      <Select value={form.reported_damage_extent} onValueChange={v => setForm(f => ({ ...f, reported_damage_extent: v }))}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {REPORTED_DAMAGE_EXTENT_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">{t("claimRocket.form.lossCategory") || "PMFBY Loss Category / Provision"}</label>
                    <Select value={form.loss_category} onValueChange={v => setForm(f => ({ ...f, loss_category: v }))}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {LOSS_CATEGORY_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">{t("claimRocket.form.location") || "Farm Location / Survey Details *"}</label>
                    <Input 
                      placeholder="e.g. Madhavaram, Chennai, Tamil Nadu" 
                      value={form.location} 
                      onChange={e => setForm(f => ({ ...f, location: e.target.value }))} 
                      required
                      className="rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">{t("claimRocket.form.notes") || "Incident Observations & Field Notes"}</label>
                    <Textarea 
                      placeholder="Describe flood depth, hail intensity, pest infestation spread, or lodging observations..." 
                      value={form.incident_description} 
                      onChange={e => setForm(f => ({ ...f, incident_description: e.target.value }))} 
                      rows={2}
                      className="text-xs resize-none rounded-xl"
                    />
                  </div>

                  {/* AI VISUAL EVIDENCE - Compact Separate Section */}
                  {(form.visualEvidence || (form.samples && form.samples.length > 0)) && (
                    <div className="bg-card border border-primary/20 p-3.5 rounded-2xl space-y-2.5 text-xs shadow-xs">
                      <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                        <span className="font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wide text-[11px]">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          AI VISUAL EVIDENCE
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 font-medium">
                          AgroCycle Visual Observation
                        </Badge>
                      </div>

                      <p className="text-xs text-foreground font-medium">
                        {form.visualEvidence?.positiveZonesCount !== undefined
                          ? `Disease indicators detected in ${form.visualEvidence.positiveZonesCount}/${form.visualEvidence.totalValidSamples || 5} sampled field zones.`
                          : (form.samples?.length > 0
                              ? `Disease indicators detected in ${form.samples.filter(s => s.hasDisease).length}/${form.samples.length} sampled field zones.`
                              : "AgroCycle detected photographic crop visual observations.")}
                      </p>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-muted/40 p-2.5 rounded-xl border border-border/40">
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Detected Crop / Issue:</span>
                          <span className="font-semibold text-foreground truncate block">
                            {form.visualEvidence?.primaryDisease || form.crop_type || "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Highest Confidence:</span>
                          <span className="font-semibold text-foreground">
                            {form.visualEvidence?.highestConfidence 
                              ? `${(Number(form.visualEvidence.highestConfidence) * (form.visualEvidence.highestConfidence <= 1 ? 100 : 1)).toFixed(1)}%` 
                              : "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Visual Coverage:</span>
                          <span className="font-semibold text-foreground">
                            {form.visualEvidence?.visualCoverage 
                              ? `${Number(form.visualEvidence.visualCoverage).toFixed(1)}%` 
                              : "N/A"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px]">Positive Zones:</span>
                          <span className="font-semibold text-foreground">
                            {form.visualEvidence?.positiveZonesText || `${form.visualEvidence?.positiveZonesCount || 0} Zones`}
                          </span>
                        </div>
                      </div>

                      {form.samples && form.samples.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[11px] font-medium text-muted-foreground block">
                            5-Zone Spatial Evidence:
                          </span>
                          <div className="grid grid-cols-5 gap-1.5">
                            {form.samples.map((s, idx) => (
                              <div key={idx} className="bg-background p-1 rounded-lg border border-border/60 text-center text-[9px]">
                                {s.image ? (
                                  <img src={s.image} alt={s.zone} className="w-full h-10 object-cover rounded mb-0.5" />
                                ) : (
                                  <div className="w-full h-10 bg-muted rounded flex items-center justify-center text-muted-foreground text-[9px]">
                                    {s.zone}
                                  </div>
                                )}
                                <span className="font-medium capitalize text-foreground truncate block">{s.zone}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <p className="text-[10px] text-muted-foreground/80 italic pt-0.5 border-t border-border/40">
                        *AI Visual Observation only. Official loss assessment and disease verification are conducted exclusively by authorized PMFBY surveyors.
                      </p>
                    </div>
                  )}

                  {/* Upload/Replace Primary Evidence */}
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">{t("claimRocket.form.attachEvidence") || "Attach Photographic Crop Damage Evidence *"}</label>
                    <label className="flex flex-col items-center border-2 border-dashed border-border/80 rounded-2xl p-4 cursor-pointer hover:border-primary/50 transition-all bg-card/60">
                      {imagePreview ? (
                        <div className="flex items-center gap-3 w-full">
                          <img src={imagePreview} alt="Evidence Preview" className="w-16 h-16 rounded-xl object-cover border border-border/60" />
                          <div className="text-left flex-1 min-w-0">
                            <p className="text-xs font-semibold text-primary truncate">{imageFile?.name || "Photo attached / Imported from Scanner"}</p>
                            <p className="text-[11px] text-muted-foreground">Click to replace photo</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                          <p className="text-xs font-medium text-foreground">Upload clear field / crop damage photo</p>
                          <p className="text-[11px] text-muted-foreground">PNG, JPG up to 10MB</p>
                        </>
                      )}
                      <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                    </label>
                  </div>

                  {/* Disclaimer Note */}
                  <div className="bg-primary/5 p-3.5 rounded-2xl border border-primary/15 text-xs text-muted-foreground flex items-start gap-2.5">
                    <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      {t("claimRocket.legalDisclaimerText")}
                    </p>
                  </div>

                  <Button type="submit" className="w-full gap-2 rounded-xl" disabled={submitting || missingFields.length > 0}>
                    {submitting ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}</>
                    ) : (
                      <><Sparkles className="h-4 w-4" /> Review Evidence & Prepare Dossier</>
                    )}
                  </Button>
                </form>
              )}

              {/* STEP 2: Evidence Review & Decoupled Data Breakdown */}
              {step === 2 && evidenceReview && (
                <div className="space-y-4 pt-2">
                  {/* Timeline Status or Standing Crop Workflow Card */}
                  <div className={`p-4 rounded-2xl border text-xs space-y-1.5 ${
                    evidenceReview.is_localized
                      ? (evidenceReview.window_status === "within_window"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                          : "bg-blue-50 dark:bg-blue-950/40 border-blue-500/30 text-blue-900 dark:text-blue-200")
                      : "bg-muted/40 border-border/80 text-foreground"
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {evidenceReview.is_localized 
                          ? "PMFBY Loss Intimation Timeline Status" 
                          : "PMFBY Standing Crop & Pest/Disease Workflow"}
                      </span>
                      {evidenceReview.window_status_badge ? (
                        <Badge className={evidenceReview.window_status === "within_window" ? "bg-emerald-600 text-white" : "bg-blue-600 text-white"}>
                          {evidenceReview.window_status_badge}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                          Standing Crop Workflow
                        </Badge>
                      )}
                    </div>
                    <p className="leading-relaxed">
                      {evidenceReview.window_message}
                    </p>
                  </div>

                  {/* Decoupled Cards: Farmer Reported vs AI Visual Evidence */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Farmer Reported Card */}
                    <div className="bg-card border border-border/80 rounded-2xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between border-b pb-1.5">
                        <span className="font-bold text-foreground">👨‍🌾 Farmer-Reported Loss</span>
                        <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground font-medium">Farmer Reported</Badge>
                      </div>
                      <div className="space-y-1 text-muted-foreground">
                        <p><span className="text-foreground font-medium">Crop & Area:</span> {form.crop_type} ({form.area_acres} Acres)</p>
                        <p><span className="text-foreground font-medium">Reported Extent:</span> <strong className="text-foreground">{REPORTED_DAMAGE_EXTENT_OPTIONS.find(o => o.value === form.reported_damage_extent)?.label || form.reported_damage_extent}</strong></p>
                        <p><span className="text-foreground font-medium">Loss Date:</span> {form.loss_date} {form.loss_time_of_day && form.loss_time_of_day !== "unknown" ? `(${form.loss_time_of_day})` : ""}</p>
                        <p><span className="text-foreground font-medium">Peril Cause:</span> {PERIL_OPTIONS.find(p => p.value === form.damage_type)?.label || form.damage_type}</p>
                        <p><span className="text-foreground font-medium">Distribution:</span> {form.problem_distribution}</p>
                      </div>
                    </div>

                    {/* AI Visual Evidence Card */}
                    <div className="bg-card border border-border/80 rounded-2xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between border-b pb-1.5">
                        <span className="font-bold text-foreground">🤖 AI Visual Evidence</span>
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 font-medium">AgroCycle Visual Observation</Badge>
                      </div>
                      <div className="space-y-1 text-muted-foreground">
                        <p><span className="text-foreground font-medium">Image Quality:</span> {evidenceReview.image_quality === "good" ? "✅ Good Quality" : "⚠️ Adequate Quality"}</p>
                        <p><span className="text-foreground font-medium">Evidence Completeness:</span> {evidenceReview.evidence_completeness?.includes("Sufficient") ? "✅ Complete" : "⚠️ Partial"}</p>
                        <p><span className="text-foreground font-medium">Spatial Zones:</span> {form.samples?.length || 1} Zone Samples Attached</p>
                        {form.visualEvidence?.burdenCategory && (
                          <p><span className="text-foreground font-medium">Visual Burden:</span> {form.visualEvidence.burdenCategory}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/80 italic pt-1">
                          *Visual observations provide photographic records and do not constitute official insurance assessment.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Recommendation Box */}
                  <div className="bg-card border border-border/80 rounded-2xl p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground block font-bold text-xs uppercase tracking-wide">
                        {evidenceReview.next_step_title || "NEXT STEP: PREPARE YOUR INSURANCE CLAIM"}
                      </span>
                      <VoiceButton text={evidenceReview.next_step_desc || evidenceReview.recommendation} variant="icon" />
                    </div>
                    <p className="text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl font-medium border border-emerald-500/20 leading-relaxed">
                      {evidenceReview.next_step_desc || evidenceReview.recommendation}
                    </p>
                  </div>

                  {/* Farmer Confirmation Checkbox */}
                  <div 
                    onClick={() => setForm(f => ({ ...f, farmer_confirmed: !f.farmer_confirmed }))}
                    className="flex items-start gap-2.5 p-3 bg-muted/40 rounded-2xl border border-border/70 cursor-pointer hover:bg-muted/60 transition-colors text-xs"
                  >
                    {form.farmer_confirmed ? (
                      <CheckSquare className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <label className="text-foreground font-medium cursor-pointer select-none leading-snug">
                      {t("claimRocket.form.farmerConfirmation")}
                    </label>
                  </div>

                  {/* Disclaimer */}
                  <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-2xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <p className="font-semibold">Preliminary Documentation Notice</p>
                      <p className="mt-0.5 leading-relaxed text-[11px]">
                        {evidenceReview.disclaimer}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2.5">
                    <Button variant="outline" onClick={() => setStep(1)} className="w-1/3 rounded-xl" disabled={submitting}>
                      {t("common.back")}
                    </Button>
                    <Button onClick={handleSaveDossier} className="w-2/3 gap-2 rounded-xl" disabled={submitting || !form.farmer_confirmed}>
                      {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}</> : (t("claimRocket.generateDossier") || "Generate Claim Preparation Dossier")}
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 3: Claim Ready, Official Submission & Reference Storage */}
              {step === 3 && (
                <div className="space-y-4 pt-2 text-center">
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 p-5 rounded-2xl space-y-2">
                    <div className="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <h2 className="text-xl font-bold text-emerald-800 dark:text-emerald-300">
                      {t("claimRocket.dossierReadyTitle") || "Claim Preparation Dossier Prepared"}
                    </h2>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto">
                      {t("claimRocket.dossierReadySubtitle")}
                    </p>
                  </div>

                  {/* Summary Box */}
                  <div className="bg-card border border-border/80 rounded-2xl p-4 text-left text-xs space-y-2.5">
                    <div className="flex justify-between items-center border-b pb-1.5">
                      <span className="text-muted-foreground">{t("claimRocket.form.farmerName") || "Farmer Full Name *"}:</span>
                      <span className="font-semibold text-foreground">{form.farmer_name}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-1.5">
                      <span className="text-muted-foreground">{t("claimRocket.form.policyNumber") || "Policy / Survey / Application / Khasra No."}:</span>
                      <span className="font-mono text-foreground font-semibold">{form.policy_number}</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-1.5">
                      <span className="text-muted-foreground">Cultivated Crop & Affected Acreage:</span>
                      <span className="font-semibold text-foreground">{form.crop_type} ({form.area_acres} {Number(form.area_acres) === 1 ? "acre" : "acres"})</span>
                    </div>
                    <div className="flex justify-between items-center border-b pb-1.5">
                      <span className="text-muted-foreground">{t("claimRocket.form.perilCause") || "Reported Peril / Cause *"}:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground capitalize">
                          {PERIL_OPTIONS.find(p => p.value === form.damage_type)?.label || form.damage_type}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground font-medium">
                          Farmer Reported
                        </Badge>
                      </div>
                    </div>
                    <div className="flex justify-between items-center border-b pb-1.5">
                      <span className="text-muted-foreground">AI Visual Evidence:</span>
                      <div className="flex items-center gap-1.5 text-right">
                        <span className="font-medium text-foreground">
                          {form.visualEvidence?.positiveZonesCount !== undefined
                            ? `Disease indicators detected in ${form.visualEvidence.positiveZonesCount}/${form.visualEvidence.totalValidSamples || 5} sampled field zones.`
                            : (form.samples?.length > 0
                                ? `Disease indicators detected in ${form.samples.filter(s => s.hasDisease).length}/${form.samples.length} sampled field zones.`
                                : "AgroCycle detected visual crop observations.")}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 font-medium shrink-0">
                          AgroCycle Visual Observation
                        </Badge>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">{t("claimRocket.form.location") || "Farm Location / Survey Details"}:</span>
                      <span className="font-semibold text-foreground">{form.location || "Local Field"}</span>
                    </div>
                  </div>

                  {/* Print / Export Claim Preparation Dossier Button */}
                  <Button 
                    variant="outline"
                    onClick={() => handlePrintDossier({ ...form, id: 'AGR-' + Date.now() })}
                    className="w-full gap-2 text-xs border-border/80 rounded-xl"
                  >
                    <Printer className="h-4 w-4 text-primary" />
                    <span>Print / Export Claim Preparation Dossier</span>
                  </Button>

                  {/* Connect to Official PMFBY Channels - Conditional Header & Description */}
                  {(() => {
                    const isLocalized = isLocalizedOrPostHarvestPeril(form.damage_type);
                    const nextStepHeader = isLocalized 
                      ? "NEXT STEP: REPORT LOSS THROUGH OFFICIAL CHANNEL" 
                      : "NEXT STEP: PREPARE YOUR INSURANCE CLAIM";
                    const nextStepBody = isLocalized
                      ? "For applicable localized calamities and specified post-harvest losses, PMFBY guidelines provide for loss intimation within 72 hours of occurrence. Report the loss through an official channel as soon as possible."
                      : "Your reported loss involves pest/disease. Claim Rocket will help you organize the required information and evidence and guide you through the applicable PMFBY claim process.";

                    return (
                      <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl text-left space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                            <h4 className="font-bold text-xs uppercase tracking-wide text-foreground">{nextStepHeader}</h4>
                          </div>
                          <VoiceButton
                            text={`${nextStepHeader}. ${nextStepBody}`}
                            variant="icon"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {nextStepBody}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <Button 
                            onClick={handleOpenOfficialPortal} 
                            className="gap-2 text-xs bg-primary text-primary-foreground font-semibold rounded-xl"
                          >
                            <ExternalLink className="h-4 w-4" />
                            <span>PMFBY Portal (pmfby.gov.in)</span>
                          </Button>
                          
                          <Button 
                            variant="outline" 
                            onClick={handleOpenAppPortal}
                            className="gap-2 text-xs border-border/80 rounded-xl"
                          >
                            <Smartphone className="h-3.5 w-3.5 text-primary" />
                            <span>Crop Insurance App</span>
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              alert(`Official PMFBY Farmer Toll-Free Helpline: ${OFFICIAL_PMFBY_HELPLINE}\nCall 14447 to register your loss intimation directly with an official operator.`);
                            }}
                            className="gap-2 text-xs border-border/80 rounded-xl"
                          >
                            <PhoneCall className="h-3.5 w-3.5 text-primary" />
                            <span>Toll-Free Helpline: 14447</span>
                          </Button>

                          <Button 
                            variant="ghost"
                            onClick={() => {
                              alert("Offline Submission Guide:\nVisit your nearest Common Service Center (CSC), Bank Branch where your KCC/Loan is linked, or District Agriculture Officer with this printed Claim Dossier.");
                            }}
                            className="gap-2 text-xs rounded-xl"
                          >
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>CSC / Bank / Dept Guide</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })()}

                  <Button variant="ghost" onClick={handleDialogClose} className="w-full text-xs rounded-xl">
                    {t("common.close") || "Close & View My Prepared Claims"}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Claims List Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">
            {t("claimRocket.savedDossiersTitle", { count: claims.length })}
          </h2>
          <span className="text-xs text-muted-foreground">
            {t("claimRocket.savedDossiersSubtitle")}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : claims.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border/80 rounded-3xl text-muted-foreground space-y-3">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <div>
              <p className="font-semibold text-foreground">{t("claimRocket.noDossiers")}</p>
            </div>
            <Button onClick={() => setDialogOpen(true)} variant="outline" size="sm" className="gap-2 text-xs rounded-xl">
              <Plus className="h-3.5 w-3.5" /> {t("claimRocket.prepareClaimButton")}
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            {claims.map((claim, i) => {
              const sc = statusConfig[claim.status] || statusConfig.ready;
              const Icon = sc.icon;
              const isOwner = isRecordOwner(claim, user);

              return (
                <motion.div 
                  key={claim.id || i} 
                  initial={{ opacity: 0, y: 15 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: i * 0.04 }}
                  className="bg-card rounded-3xl border border-border/80 p-5 sm:p-6 hover:border-primary/30 transition-all shadow-natural hover:shadow-natural-lg"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      {/* Title & Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base text-foreground">
                          {claim.farmer_name || "Farmer"}
                        </h3>
                        <Badge className={`${sc.color} rounded-full px-2.5 py-0.5 font-medium`}>
                          <Icon className="h-3 w-3 mr-1" />
                          {sc.label}
                        </Badge>
                        <SyncStatusBadge status={claim.sync_status || "draft_offline"} />
                        {claim.creatorVerificationStatus && (
                          <VerifiedBadge status={claim.creatorVerificationStatus} />
                        )}
                        {claim.policy_number && (
                          <span className="text-[11px] bg-muted text-muted-foreground px-2.5 py-0.5 rounded-full font-mono font-medium">
                            {claim.policy_number}
                          </span>
                        )}
                        {claim.pmfby_reference_no && (
                          <Badge variant="outline" className="text-[11px] bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30 rounded-full">
                            Docket: {claim.pmfby_reference_no}
                          </Badge>
                        )}
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs text-muted-foreground">
                        <div className="bg-muted/40 p-2.5 rounded-2xl border border-border/40">
                          <span className="block text-[10px] text-muted-foreground/80 uppercase font-medium">{t("claimRocket.form.cropType")}</span>
                          <span className="text-foreground font-semibold">{claim.crop_type}</span>
                        </div>
                        <div className="bg-muted/40 p-2.5 rounded-2xl border border-border/40">
                          <span className="block text-[10px] text-muted-foreground/80 uppercase font-medium">{t("claimRocket.form.perilCause")}</span>
                          <span className="text-foreground font-semibold capitalize">{claim.damage_cause || claim.damage_type}</span>
                        </div>
                        <div className="bg-muted/40 p-2.5 rounded-2xl border border-border/40">
                          <span className="block text-[10px] text-muted-foreground/80 uppercase font-medium">{t("claimRocket.form.areaAcres")}</span>
                          <span className="text-foreground font-semibold">{claim.area_acres} acres</span>
                        </div>
                        <div className="bg-muted/40 p-2.5 rounded-2xl border border-border/40">
                          <span className="block text-[10px] text-muted-foreground/80 uppercase font-medium">{t("claimRocket.form.lossDate")}</span>
                          <span className="text-foreground font-semibold">{claim.loss_date || claim.created_date?.split("T")[0] || "Recorded"}</span>
                        </div>
                      </div>

                      {/* AI Observations & Farmer Reported Damage */}
                      <div className="text-xs bg-muted/40 p-3.5 rounded-2xl border border-border/60 space-y-1.5">
                        {claim.reported_damage_extent && (
                          <p className="text-muted-foreground">
                            <span className="font-semibold text-foreground">Farmer Reported Damage: </span>
                            {REPORTED_DAMAGE_EXTENT_OPTIONS.find(o => o.value === claim.reported_damage_extent)?.label || claim.reported_damage_extent}
                          </p>
                        )}
                        {claim.damage_indicators && (
                          <p className="text-muted-foreground leading-relaxed">
                            <span className="font-semibold text-foreground">AI Evidence Review: </span>
                            {claim.damage_indicators}
                          </p>
                        )}
                        {claim.ai_recommendation && (
                          <p className="text-emerald-800 dark:text-emerald-300 font-medium text-[11px]">
                            💡 {claim.ai_recommendation}
                          </p>
                        )}
                      </div>

                      {/* Official Docket Reference Field */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <Input 
                          placeholder="Enter PMFBY Docket / Reference No."
                          value={docketInputs[claim.id] !== undefined ? docketInputs[claim.id] : (claim.pmfby_reference_no || "")}
                          onChange={(e) => setDocketInputs({ ...docketInputs, [claim.id]: e.target.value })}
                          className="text-xs h-8 max-w-xs rounded-xl"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSaveDocketNumber(claim.id)}
                          disabled={savingDocketId === claim.id}
                          className="text-xs h-8 rounded-xl"
                        >
                          {savingDocketId === claim.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (t("claimRocket.form.saveDocketCTA") || "Save Docket ID")}
                        </Button>
                      </div>

                      {/* Action Bar */}
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <Button 
                          size="sm" 
                          onClick={handleOpenOfficialPortal}
                          className="gap-1.5 text-xs bg-primary text-primary-foreground font-medium h-8 rounded-xl shadow-xs"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Submit on PMFBY Portal</span>
                        </Button>

                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handlePrintDossier(claim)}
                          className="gap-1.5 text-xs h-8 border-border/80 rounded-xl"
                        >
                          <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>Print Dossier</span>
                        </Button>

                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedClaimForView(claim);
                            setViewDialogOpen(true);
                          }}
                          className="gap-1.5 text-xs h-8 border-border/80 rounded-xl"
                        >
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>View Full Dossier</span>
                        </Button>

                        {isOwner && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDeleteClaim(claim.id)}
                            className="text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 h-8 rounded-xl ml-auto"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            <span>{t("common.delete")}</span>
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Evidence Thumbnail */}
                    {claim.damage_image_url && (
                      <div className="shrink-0">
                        <img 
                          src={claim.damage_image_url.startsWith('blob:') ? "https://placehold.co/150x150?text=Evidence" : claim.damage_image_url} 
                          alt="Crop Damage Evidence" 
                          className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover border border-border/70 shadow-xs" 
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* View Full Dossier Modal */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 text-base font-bold">
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-primary" />
                <span>Claim Preparation Dossier</span>
              </div>
              {selectedClaimForView?.pmfby_reference_no && (
                <Badge className="bg-blue-600 text-white text-xs">
                  Docket: {selectedClaimForView.pmfby_reference_no}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedClaimForView && (
            <div className="space-y-4 pt-2 text-xs">
              {/* Applicant Card */}
              <div className="bg-muted/40 p-3.5 rounded-2xl border border-border/70 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-foreground">{selectedClaimForView.farmer_name}</span>
                  {selectedClaimForView.creatorVerificationStatus && (
                    <VerifiedBadge status={selectedClaimForView.creatorVerificationStatus} />
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                  <p>Mobile: <span className="text-foreground font-medium">{selectedClaimForView.mobile_number}</span></p>
                  <p>Policy ID: <span className="font-mono text-foreground font-medium">{selectedClaimForView.policy_number || "N/A"}</span></p>
                </div>
              </div>

              {/* Crop & Incident Info */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-card border border-border/80 p-3 rounded-2xl">
                  <span className="text-muted-foreground block text-[11px]">{t("claimRocket.form.cropType")} & {t("claimRocket.form.areaAcres")}</span>
                  <span className="font-semibold text-foreground">{selectedClaimForView.crop_type} ({selectedClaimForView.area_acres} acres)</span>
                </div>
                <div className="bg-card border border-border/80 p-3 rounded-2xl">
                  <span className="text-muted-foreground block text-[11px]">{t("claimRocket.form.perilCause")}</span>
                  <span className="font-semibold text-foreground capitalize">{selectedClaimForView.damage_cause || selectedClaimForView.damage_type}</span>
                </div>
                <div className="bg-card border border-border/80 p-3 rounded-2xl">
                  <span className="text-muted-foreground block text-[11px]">{t("claimRocket.form.lossDate")}</span>
                  <span className="font-semibold text-foreground">{selectedClaimForView.loss_date || "Recorded"}</span>
                </div>
                <div className="bg-card border border-border/80 p-3 rounded-2xl">
                  <span className="text-muted-foreground block text-[11px]">{t("claimRocket.form.location")}</span>
                  <span className="font-semibold text-foreground">{selectedClaimForView.location || "Not specified"}</span>
                </div>
              </div>

              {/* Farmer Reported Damage Extent */}
              {selectedClaimForView.reported_damage_extent && (
                <div className="bg-card border border-border/80 p-3 rounded-2xl">
                  <span className="text-muted-foreground block text-[11px]">{t("claimRocket.form.reportedExtent")}</span>
                  <span className="font-semibold text-foreground">
                    {REPORTED_DAMAGE_EXTENT_OPTIONS.find(o => o.value === selectedClaimForView.reported_damage_extent)?.label || selectedClaimForView.reported_damage_extent}
                  </span>
                </div>
              )}

              {/* Description */}
              {selectedClaimForView.incident_description && (
                <div className="bg-card border border-border/80 p-3.5 rounded-2xl">
                  <span className="font-semibold text-foreground block mb-1">Farmer Incident Notes:</span>
                  <p className="text-muted-foreground leading-relaxed">{selectedClaimForView.incident_description}</p>
                </div>
              )}

              {/* AI Review Details */}
              <div className="bg-card border border-border/80 p-3.5 rounded-2xl space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground">AI Evidence Observations:</span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full font-medium">
                    {selectedClaimForView.assessment_source || "Local Review"}
                  </span>
                </div>
                <p className="text-muted-foreground leading-relaxed">{selectedClaimForView.damage_indicators}</p>
                {selectedClaimForView.ai_recommendation && (
                  <p className="text-emerald-800 dark:text-emerald-300 font-medium pt-1.5 border-t border-border/50 text-[11px]">
                    💡 {selectedClaimForView.ai_recommendation}
                  </p>
                )}
              </div>

              {/* Evidence Photo */}
              {selectedClaimForView.damage_image_url && (
                <div className="space-y-1.5">
                  <span className="font-semibold text-foreground block">Attached Field Evidence:</span>
                  <img 
                    src={selectedClaimForView.damage_image_url.startsWith('blob:') ? "https://placehold.co/300x200?text=Evidence" : selectedClaimForView.damage_image_url} 
                    alt="Field Evidence" 
                    className="w-full h-48 rounded-2xl object-cover border border-border/80 shadow-xs" 
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>
              )}

              {/* Official Disclaimer */}
              <div className="bg-muted/60 p-3.5 rounded-2xl border border-border/50 text-[11px] text-muted-foreground leading-relaxed">
                <p className="font-semibold text-foreground mb-0.5">{t("claimRocket.legalDisclaimerTitle")}:</p>
                {t("claimRocket.legalDisclaimerText")}
              </div>

              <div className="flex gap-2.5 pt-2 flex-wrap">
                <Button onClick={handleOpenOfficialPortal} className="flex-1 gap-2 rounded-xl text-xs font-semibold">
                  <ExternalLink className="h-4 w-4" />
                  {t("claimRocket.continueToPMFBY")}
                </Button>
                <Button variant="outline" onClick={() => handlePrintDossier(selectedClaimForView)} className="rounded-xl text-xs gap-1.5">
                  <Printer className="h-4 w-4" />
                  <span>Print Dossier</span>
                </Button>
                <Button variant="outline" onClick={() => setViewDialogOpen(false)} className="rounded-xl text-xs">
                  {t("common.close")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}