import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage, SUPPORTED_LANGUAGES } from "@/i18n";
import { 
  formatRoleName, 
  isFarmer, 
  isBuyer, 
  isDualRole,
  getProfileCompleteness, 
  BUYER_BUSINESS_TYPES,
  ROLES
} from "@/services/roleManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  User, 
  Save, 
  Loader2, 
  CheckCircle2, 
  ArrowRightLeft, 
  PlusCircle, 
  Briefcase, 
  Sprout, 
  ShieldCheck, 
  Layers 
} from "lucide-react";
import { motion } from "framer-motion";
import VerifiedBadge from "@/components/VerifiedBadge";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import FarmLocationCard from "@/components/FarmLocationCard";

export default function Profile() {
  const { user, updateUser, switchRole, addRole, setVerificationStatus, logout, activeRole, roles } = useAuth();
  const { t, language, setLanguage, languages } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    language: "en",
    // Farmer fields
    farmLocation: "",
    farmSize: "",
    primaryCrops: "",
    // Buyer fields
    businessName: "",
    businessType: "",
    operatingLocation: "",
    intendedUse: ""
  });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || user.full_name || "",
        phone: user.phone || "",
        language: user.language || language || "en",
        farmLocation: user.farmerProfile?.farmLocation || user.farmLocation || user.location || "",
        farmSize: user.farmerProfile?.farmSize || user.farmSize || user.farm_size || "",
        primaryCrops: user.farmerProfile?.primaryCrops || user.primaryCrops || user.primary_crops || "",
        businessName: user.buyerProfile?.businessName || user.businessName || user.business_name || "",
        businessType: user.buyerProfile?.businessType || user.businessType || user.business_type || "",
        operatingLocation: user.buyerProfile?.operatingLocation || user.operatingLocation || user.location || "",
        intendedUse: user.buyerProfile?.intendedUse || user.intendedUse || user.intended_use || ""
      });
    }
  }, [user, language]);

  const userIsFarmer = isFarmer(user);
  const userIsBuyer = isBuyer(user);
  const userIsDual = isDualRole(user);

  const previewUser = {
    ...user,
    name: form.name,
    phone: form.phone,
    farmerProfile: {
      farmLocation: form.farmLocation,
      farmSize: form.farmSize,
      primaryCrops: form.primaryCrops
    },
    buyerProfile: {
      businessName: form.businessName,
      businessType: form.businessType,
      operatingLocation: form.operatingLocation,
      intendedUse: form.intendedUse
    }
  };

  const completeness = getProfileCompleteness(previewUser);

  async function handleSave() {
    if (form.phone && !/^\d{10}$/.test(form.phone)) {
      alert("Phone number must be exactly 10 digits");
      return;
    }

    setSaving(true);
    try {
      updateUser({
        name: form.name,
        full_name: form.name,
        phone: form.phone,
        language: form.language,
        farmerProfile: {
          farmLocation: form.farmLocation,
          farmSize: form.farmSize,
          primaryCrops: form.primaryCrops
        },
        buyerProfile: {
          businessName: form.businessName,
          businessType: form.businessType,
          operatingLocation: form.operatingLocation,
          intendedUse: form.intendedUse
        }
      });

      if (form.language && form.language !== language) {
        setLanguage(form.language);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save profile:", err);
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-card p-6 sm:p-7 rounded-3xl border border-border/80 shadow-natural flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">👤 {t("profile.title")}</h1>
            <VerifiedBadge status={user?.verificationStatus} />
          </div>
          
          <div className="text-xs text-muted-foreground space-y-1.5">
            <p>
              <strong>{t("profile.persistentId", { id: user?.userId || user?.id || "N/A" })}</strong>
            </p>
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-muted-foreground">{t("common.status")}:</span>
              {(roles || []).map(r => (
                <Badge key={r} variant="secondary" className="capitalize text-xs rounded-full px-2.5 py-0.5">
                  {r === ROLES.FARMER ? `🌾 ${t("common.farmer")}` : `💼 ${t("common.buyer")}`}
                </Badge>
              ))}
              <span className="text-muted-foreground ml-2">{t("common.activeMode")}:</span>
              <Badge className={activeRole === ROLES.FARMER ? "bg-primary text-primary-foreground rounded-full px-2.5 py-0.5" : "bg-blue-600 text-white rounded-full px-2.5 py-0.5"}>
                {activeRole === ROLES.FARMER ? `🌾 ${t("common.farmerMode")}` : `💼 ${t("common.buyerMode")}`}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          {userIsDual && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => switchRole(activeRole === ROLES.FARMER ? ROLES.BUYER : ROLES.FARMER)}
              className="gap-2 border-border/80 hover:bg-muted rounded-xl text-xs"
            >
              <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
              {activeRole === ROLES.FARMER ? t("common.switchRoleToBuyer") : t("common.switchRoleToFarmer")}
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={logout} className="rounded-xl text-xs">
            {t("common.logout")}
          </Button>
        </div>
      </div>

      {/* Role Expansion Opportunity for Single-Role Accounts */}
      {!userIsDual && (
        <div className="bg-primary/5 border border-primary/20 rounded-3xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xs">
          <div className="space-y-1">
            <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground">
              <PlusCircle className="h-4 w-4 text-primary" />
              {t("login.roleBoth")}
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {userIsFarmer
                ? (language === "ta" ? "புதிய கணக்கை உருவாக்காமல் சரிபார்க்கப்பட்ட வாங்குபவராக பயிர்க்கழிவுகளை வாங்கலாம் மற்றும் பதப்படுத்தலாம்." : language === "hi" ? "नया खाता बनाए बिना सत्यापित खरीदार के रूप में फसल अवशेष खरीदें और संसाधित करें।" : "Also purchase, aggregate, or process crop residues as a verified Buyer without creating a new account.")
                : (language === "ta" ? "புதிய கணக்கை உருவாக்காமல் சரிபார்க்கப்பட்ட விவசாயியாக பயிர்களை பயிரிட்டு கழிவுகளை பட்டியலிடலாம்." : language === "hi" ? "नया खाता बनाए बिना सत्यापित किसान के रूप में फसल उगाएं और कृषि अवशेष सूचीबद्ध करें।" : "Also cultivate crops and list agricultural waste as a verified Farmer without creating a new account.")}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => addRole(userIsFarmer ? ROLES.BUYER : ROLES.FARMER)}
            className="whitespace-nowrap rounded-xl text-xs shadow-xs shrink-0"
          >
            {userIsFarmer ? `+ ${t("common.buyer")}` : `+ ${t("common.farmer")}`}
          </Button>
        </div>
      )}

      {/* Profile Completeness Section */}
      <div className="bg-card rounded-3xl border border-border/80 p-6 space-y-4 shadow-natural">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base flex items-center gap-2 text-foreground">
            <Layers className="h-4 w-4 text-primary" /> {t("dashboard.profileCompleteness")}
          </h3>
          <span className="font-mono font-bold text-sm text-primary bg-primary/10 px-2.5 py-1 rounded-full">
            {completeness.overall}%
          </span>
        </div>

        {userIsDual ? (
          <div className="grid sm:grid-cols-2 gap-3.5 pt-1">
            <div className="bg-muted/40 p-4 rounded-2xl border border-border/60 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold flex items-center gap-1.5 text-foreground">
                  <Sprout className="h-3.5 w-3.5 text-primary" /> {t("profile.farmerDetailsTitle")}
                </span>
                <span className="font-bold text-primary">{completeness.farmer}%</span>
              </div>
              <Progress value={completeness.farmer} className="h-2 rounded-full" />
              <p className="text-[11px] text-muted-foreground">
                {t("profile.farmLocation")}, {t("profile.farmSizeAcres")}, {t("profile.primaryCrops")}.
              </p>
            </div>

            <div className="bg-muted/40 p-4 rounded-2xl border border-border/60 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold flex items-center gap-1.5 text-foreground">
                  <Briefcase className="h-3.5 w-3.5 text-blue-600" /> {t("profile.buyerDetailsTitle")}
                </span>
                <span className="font-bold text-blue-600">{completeness.buyer}%</span>
              </div>
              <Progress value={completeness.buyer} className="h-2 rounded-full" />
              <p className="text-[11px] text-muted-foreground">
                {t("profile.businessName")}, {t("profile.businessType")}, {t("profile.operatingLocation")}.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground font-medium">
                {userIsFarmer ? t("profile.farmerDetailsTitle") : t("profile.buyerDetailsTitle")}
              </span>
              <span className="font-bold text-primary">{completeness.overall}%</span>
            </div>
            <Progress value={completeness.overall} className="h-2.5 rounded-full" />
          </div>
        )}

        <p className="text-xs text-muted-foreground pt-1 leading-relaxed">
          {completeness.overall === 100
            ? (language === "ta" ? "🎉 உங்கள் சுயவிவரம் 100% நிறைவடைந்துள்ளது! நம்பகத்தன்மை பேட்ஜ்கள் செயல்படுத்தப்பட்டுள்ளன." : language === "hi" ? "🎉 आपकी प्रोफ़ाइल 100% पूर्ण है! सत्यापन बैज और मिलान गति अधिकतम है।" : "🎉 Your profile is 100% complete! Trust badges and matching speed are maximized across AgroCycle.")
            : t("dashboard.completeProfileCTA")}
        </p>
      </div>

      {/* Account Verification Status Section */}
      <div className="bg-card rounded-3xl border border-border/80 p-6 space-y-3 shadow-natural">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="font-bold text-base text-foreground">
                {language === "ta" ? "கணக்கு சரிபார்ப்பு நிலை" : language === "hi" ? "खाता सत्यापन स्थिति" : "Account Verification Status"}
              </h3>
              <VerifiedBadge status={user?.verificationStatus} />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {user?.verificationStatus === "verified"
                ? (language === "ta" ? "இந்தக் கணக்கு சரிபார்க்கப்பட்டுள்ளது. உங்கள் சந்தைப் பதிவுகள் சரிபார்க்கப்பட்ட பேட்ஜைப் பெறும்." : language === "hi" ? "यह खाता सत्यापित है। आपकी बाज़ार लिस्टिंग पर प्राथमिकता सत्यापन बैज प्रदर्शित होंगे।" : "This account has completed AgroCycle verification. Your marketplace listings and silage requests display priority verified badges.")
                : (language === "ta" ? "இந்தக் கணக்கு தற்போது சரிபார்ப்பு நிலுவையில் உள்ளது." : language === "hi" ? "यह खाता वर्तमान में सत्यापन के लिए लंबित है।" : "This account is currently pending verification. In production, verification is completed through agricultural officer or institutional partner review.")}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            {user?.verificationStatus === "verified" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVerificationStatus("pending")}
                className="text-xs text-muted-foreground hover:text-foreground w-full sm:w-auto rounded-xl"
                title="Reset verification status for testing"
              >
                {language === "ta" ? "நிலுவைக்கு மாற்று (மாதிரி)" : language === "hi" ? "लंबित स्थिति पर रीसेट करें (प्रोटोटाइप)" : "Reset to Pending (Prototype Action)"}
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => setVerificationStatus("verified")}
                className="text-xs font-semibold gap-1.5 w-full sm:w-auto rounded-xl shadow-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {language === "ta" ? "சரிபார்ப்பை முடி (மாதிரி)" : language === "hi" ? "सत्यापन पूर्ण करें (प्रोटोटाइप)" : "Complete Verification (Prototype Action)"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Profile Form */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-3xl border border-border/80 p-6 sm:p-8 space-y-6 shadow-natural"
      >
        <div className="flex justify-between items-center pb-3 border-b border-border/80">
          <div>
            <h2 className="font-bold text-lg text-foreground">{t("profile.personalInfoTitle")}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {language === "ta" ? "விவசாயம் மற்றும் வணிக நடவடிக்கைகளுக்கான சுயவிவர விவரங்கள்." : language === "hi" ? "कृषि और व्यावसायिक गतिविधियों के लिए अलग प्रोफ़ाइल विवरण बनाए रखें।" : "Maintain separate profile credentials for farming and commercial activities."}
            </p>
          </div>
          {saveSuccess && (
            <span className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-500/20">
              <CheckCircle2 className="h-3.5 w-3.5" /> {t("profile.savedSuccess")}
            </span>
          )}
        </div>

        {/* Section 1: Basic Information */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t("profile.personalInfoTitle")}
          </h4>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium mb-1 block text-foreground">{t("profile.fullName")}</label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Ramesh Kumar"
                className="rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block text-foreground">{t("profile.mobileNumber")}</label>
              <Input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))}
                placeholder="10-digit mobile number"
                className="rounded-xl"
              />
            </div>

            <div>
              <label className="text-xs font-medium mb-1 block text-foreground">{t("profile.preferredLanguage")}</label>
              <Select
                value={form.language}
                onValueChange={v => {
                  setForm(f => ({ ...f, language: v }));
                  setLanguage(v);
                }}
              >
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {Object.values(SUPPORTED_LANGUAGES).map(lang => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.nativeName} ({lang.label})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Section 2: Farmer Profile Details (if Farmer or Dual) */}
        {userIsFarmer && (
          <div className="space-y-4 pt-4 border-t border-border/80">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-secondary text-primary flex items-center justify-center text-xs">
                🌾
              </div>
              <h4 className="text-sm font-bold text-foreground">
                {t("profile.farmerDetailsTitle")}
              </h4>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium mb-1 block text-foreground">
                  {t("profile.farmLocation")}
                </label>
                <Input
                  value={form.farmLocation}
                  onChange={e => setForm(f => ({ ...f, farmLocation: e.target.value }))}
                  placeholder="e.g. Warangal, Telangana"
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block text-foreground">
                  {t("profile.farmSizeAcres")}
                </label>
                <Input
                  type="number"
                  step="0.5"
                  value={form.farmSize}
                  onChange={e => setForm(f => ({ ...f, farmSize: e.target.value }))}
                  placeholder="e.g. 5"
                  className="rounded-xl"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-medium mb-1 block text-foreground">
                  {t("profile.primaryCrops")}
                </label>
                <Input
                  value={form.primaryCrops}
                  onChange={e => setForm(f => ({ ...f, primaryCrops: e.target.value }))}
                  placeholder="e.g. Paddy, Cotton, Maize, Chilli, Tomato"
                  className="rounded-xl"
                />
              </div>

              {/* Reusable GPS Location Card */}
              <div className="sm:col-span-2 pt-2">
                <FarmLocationCard userId={user?.userId || user?.id} />
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Buyer Profile Details (if Buyer or Dual) */}
        {userIsBuyer && (
          <div className="space-y-4 pt-4 border-t border-border/80">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center text-xs">
                💼
              </div>
              <h4 className="text-sm font-bold text-foreground">
                {t("profile.buyerDetailsTitle")}
              </h4>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium mb-1 block text-foreground">
                  {t("profile.businessName")}
                </label>
                <Input
                  value={form.businessName}
                  onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                  placeholder="e.g. GreenValley Organics Ltd."
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block text-foreground">
                  {t("profile.businessType")}
                </label>
                <Select
                  value={form.businessType}
                  onValueChange={v => setForm(f => ({ ...f, businessType: v }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select Business Type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    {BUYER_BUSINESS_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block text-foreground">
                  {t("profile.operatingLocation")}
                </label>
                <Input
                  value={form.operatingLocation}
                  onChange={e => setForm(f => ({ ...f, operatingLocation: e.target.value }))}
                  placeholder="e.g. Hyderabad Industrial Area"
                  className="rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block text-foreground">
                  {t("profile.intendedUse")}
                </label>
                <Input
                  value={form.intendedUse}
                  onChange={e => setForm(f => ({ ...f, intendedUse: e.target.value }))}
                  placeholder="e.g. Animal Feed, Starch, Biofuel"
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full gap-2 py-5 text-sm rounded-xl mt-4 shadow-xs"
        >
          {saving ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> {t("common.saving")}</>
          ) : (
            <><Save className="h-4 w-4" /> {t("profile.saveChanges")}</>
          )}
        </Button>
      </motion.div>
    </div>
  );
}