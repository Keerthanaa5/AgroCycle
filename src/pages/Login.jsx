import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Leaf, 
  Sprout, 
  ShoppingCart, 
  UserCheck, 
  Lock, 
  Phone, 
  User, 
  Mail, 
  Layers, 
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  CheckCircle2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth, DEFAULT_DEMO_ACCOUNTS, getRegisteredAccounts } from "@/lib/AuthContext";
import { useLanguage } from "@/i18n";
import LanguageSelector from "@/components/LanguageSelector";
import { ROLES, BUYER_BUSINESS_TYPES } from "@/services/roleManager";
import { motion, AnimatePresence } from "framer-motion";

export default function Login() {
  const [tab, setTab] = useState("register"); // "register" | "signin"
  const [roleChoice, setRoleChoice] = useState("farmer"); // "farmer" | "buyer" | "both"
  const [showPassword, setShowPassword] = useState(false);
  const { t, language } = useLanguage();
  
  // Registration Form State
  const [regForm, setRegForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    // Farmer fields
    farmLocation: "",
    farmSize: "",
    primaryCrops: "",
    // Buyer fields
    businessName: "",
    businessType: "Food Processing",
    operatingLocation: "",
    intendedUse: ""
  });

  // Sign In Form State
  const [signInPhone, setSignInPhone] = useState("");
  const [signInPassword, setSignInPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const { user, isAuthenticated, login } = useAuth();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleRegister = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    // Validate core fields
    if (!regForm.name.trim()) {
      setErrorMsg(language === "ta" ? "முழு பெயர் அவசியம்." : language === "hi" ? "पूरा नाम आवश्यक है।" : "Full Name is required.");
      return;
    }
    const cleanPhone = regForm.phone.replace(/\D/g, "");
    if (!cleanPhone || !/^\d{10}$/.test(cleanPhone)) {
      setErrorMsg(language === "ta" ? "சரியான 10 இலக்க தொலைபேசி எண்ணை உள்ளிடவும்." : language === "hi" ? "कृपया 10 अंकों का वैध फोन नंबर दर्ज करें।" : "Please enter a valid 10-digit phone number.");
      return;
    }
    if (!regForm.password || regForm.password.length < 4) {
      setErrorMsg(language === "ta" ? "கடவுச்சொல் குறைந்தது 4 எழுத்துக்களாக இருக்க வேண்டும்." : language === "hi" ? "पासवर्ड कम से कम 4 अक्षरों का होना चाहिए।" : "Password must be at least 4 characters.");
      return;
    }

    // Validate role-specific fields
    const roles = roleChoice === "both" 
      ? [ROLES.FARMER, ROLES.BUYER] 
      : [roleChoice];

    if (roles.includes(ROLES.FARMER)) {
      if (!regForm.farmLocation.trim() || !regForm.farmSize || !regForm.primaryCrops.trim()) {
        setErrorMsg(language === "ta" ? "அனைத்து தேவையான விவசாயி விவரங்களை நிரப்பவும் (*)." : language === "hi" ? "कृपया सभी आवश्यक किसान प्रोफ़ाइल फ़ील्ड भरें (*)।" : "Please complete all required Farmer profile fields (*).");
        return;
      }
    }

    if (roles.includes(ROLES.BUYER)) {
      if (!regForm.businessName.trim() || !regForm.businessType || !regForm.operatingLocation.trim() || !regForm.intendedUse.trim()) {
        setErrorMsg(language === "ta" ? "அனைத்து தேவையான வாங்குபவர் விவரங்களை நிரப்பவும் (*)." : language === "hi" ? "कृपया सभी आवश्यक खरीदार प्रोफ़ाइल फ़ील्ड भरें (*)।" : "Please complete all required Buyer profile fields (*).");
        return;
      }
    }

    const accountData = {
      name: regForm.name.trim(),
      full_name: regForm.name.trim(),
      phone: cleanPhone,
      email: regForm.email.trim(),
      password: regForm.password,
      language: language,
      roles: roles,
      activeRole: roles[0],
      farmerProfile: roles.includes(ROLES.FARMER) ? {
        farmLocation: regForm.farmLocation.trim(),
        farmSize: regForm.farmSize,
        primaryCrops: regForm.primaryCrops.trim()
      } : { farmLocation: "", farmSize: "", primaryCrops: "" },
      buyerProfile: roles.includes(ROLES.BUYER) ? {
        businessName: regForm.businessName.trim(),
        businessType: regForm.businessType,
        operatingLocation: regForm.operatingLocation.trim(),
        intendedUse: regForm.intendedUse.trim()
      } : { businessName: "", businessType: "", operatingLocation: "", intendedUse: "" }
    };

    const res = login(accountData);
    if (res && res.success) {
      setSuccessMsg("Account created successfully! Redirecting...");
      setTimeout(() => navigate("/"), 200);
    } else {
      setErrorMsg("Registration failed. Please try again.");
    }
  };

  const handleSignIn = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const cleanedPhone = signInPhone.replace(/\D/g, "");
    if (!cleanedPhone || !/^\d{10}$/.test(cleanedPhone)) {
      setErrorMsg(language === "ta" ? "சரியான 10 இலக்க தொலைபேசி எண்ணை உள்ளிடவும்." : language === "hi" ? "कृपया 10 अंकों का वैध फोन नंबर दर्ज करें।" : "Please enter a valid 10-digit phone number.");
      return;
    }
    if (!signInPassword) {
      setErrorMsg(language === "ta" ? "உங்கள் கடவுச்சொல்லை உள்ளிடவும்." : language === "hi" ? "कृपया अपना पासवर्ड दर्ज करें।" : "Please enter your password.");
      return;
    }

    const accounts = getRegisteredAccounts();
    const existing = accounts.find(a => a.phone === cleanedPhone);

    if (existing && existing.password && String(existing.password).trim() !== String(signInPassword).trim()) {
      setErrorMsg(language === "ta" ? "தவறான கடவுச்சொல். தயவுசெய்து மீண்டும் முயற்சிக்கவும்." : language === "hi" ? "गलत पासवर्ड। कृपया पुनः प्रयास करें।" : "Incorrect password. Please verify and try again.");
      return;
    }

    const res = login({
      phone: cleanedPhone,
      password: signInPassword
    });

    if (res && res.success === false) {
      setErrorMsg(language === "ta" ? "உள்நுழைவு தோல்வியடைந்தது." : language === "hi" ? "लॉगिन विफल रहा।" : "Sign in failed. Please check your credentials.");
      return;
    }

    setSuccessMsg("Signed in successfully! Redirecting...");
    setTimeout(() => navigate("/"), 200);
  };

  const handleQuickDemoLogin = (demoAccount) => {
    setErrorMsg("");
    setSuccessMsg(`Welcome, ${demoAccount.name}! Redirecting to dashboard...`);
    const res = login(demoAccount);
    if (res && res.success) {
      setTimeout(() => navigate("/"), 250);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-6 md:p-8">
      <div className="bg-card w-full max-w-2xl p-6 sm:p-8 rounded-3xl shadow-natural border border-border/80 relative">
        {/* Language selector pill at top right */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
          <LanguageSelector />
        </div>

        {/* Header */}
        <div className="flex flex-col items-center mb-6 text-center pt-2">
          <div className="bg-primary/10 p-3.5 rounded-2xl mb-3 text-primary border border-primary/15 shadow-xs">
            <Leaf className="h-8 w-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{t("login.title")}</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1 max-w-md leading-relaxed">
            {t("login.subtitle")}
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-muted/60 p-1 rounded-2xl mb-6 max-w-sm mx-auto border border-border/80">
          <button
            type="button"
            onClick={() => { setTab("register"); setErrorMsg(""); setSuccessMsg(""); }}
            className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
              tab === "register" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("login.registerTab")}
          </button>
          <button
            type="button"
            onClick={() => { setTab("signin"); setErrorMsg(""); setSuccessMsg(""); }}
            className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
              tab === "signin" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("login.signInTab")}
          </button>
        </div>

        {/* Error Message */}
        {errorMsg && (
          <div className="mb-5 bg-destructive/10 border border-destructive/20 text-destructive text-xs p-3.5 rounded-2xl flex items-center gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Success Message */}
        {successMsg && (
          <div className="mb-5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs p-3.5 rounded-2xl flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab 1: Registration Form */}
        {tab === "register" && (
          <form noValidate onSubmit={handleRegister} className="space-y-6">
            {/* Step 1: Basic Credentials */}
            <div className="space-y-3.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" /> 1. {t("profile.personalInfoTitle")}
              </h2>

              <div className="grid sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <Label htmlFor="name" className="text-xs font-medium text-foreground">{t("login.fullName")}</Label>
                  <Input 
                    id="name" 
                    type="text" 
                    placeholder="e.g. Ramesh Kumar" 
                    value={regForm.name}
                    onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="phone" className="text-xs font-medium text-foreground">{t("login.mobile")}</Label>
                  <Input 
                    id="phone" 
                    type="tel" 
                    placeholder="e.g. 9876543210" 
                    value={regForm.phone}
                    onChange={(e) => setRegForm({ ...regForm, phone: e.target.value.replace(/\D/g, "") })}
                    maxLength={10}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="email" className="text-xs font-medium text-foreground">{t("login.email")}</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@example.com" 
                    value={regForm.email}
                    onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                    className="rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="password" className="text-xs font-medium text-foreground">{t("login.password")}</Label>
                  <div className="relative">
                    <Input 
                      id="password" 
                      type={showPassword ? "text" : "password"} 
                      placeholder="Create a password (min 4 chars)" 
                      value={regForm.password}
                      onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
                      className="rounded-xl pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Role Selector */}
            <div className="space-y-2.5 pt-1">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" /> 2. {t("login.chooseRole")}
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Farmer Option */}
                <button
                  type="button"
                  onClick={() => setRoleChoice("farmer")}
                  className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between transition-all ${
                    roleChoice === "farmer"
                      ? "border-primary bg-primary/5 text-foreground shadow-xs"
                      : "border-border/80 bg-card hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Sprout className={`h-5 w-5 ${roleChoice === "farmer" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="font-bold text-sm text-foreground">{t("common.farmer")}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {t("login.roleFarmerDesc")}
                  </p>
                </button>

                {/* Buyer Option */}
                <button
                  type="button"
                  onClick={() => setRoleChoice("buyer")}
                  className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between transition-all ${
                    roleChoice === "buyer"
                      ? "border-amber-600 bg-amber-500/5 text-foreground shadow-xs"
                      : "border-border/80 bg-card hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <ShoppingCart className={`h-5 w-5 ${roleChoice === "buyer" ? "text-amber-600" : "text-muted-foreground"}`} />
                    <span className="font-bold text-sm text-foreground">{t("common.buyer")}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {t("login.roleBuyerDesc")}
                  </p>
                </button>

                {/* Both Option */}
                <button
                  type="button"
                  onClick={() => setRoleChoice("both")}
                  className={`p-4 rounded-2xl border-2 text-left flex flex-col justify-between transition-all ${
                    roleChoice === "both"
                      ? "border-primary bg-secondary text-foreground shadow-xs"
                      : "border-border/80 bg-card hover:bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <UserCheck className={`h-5 w-5 ${roleChoice === "both" ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="font-bold text-sm text-foreground">{t("common.dualRole")}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {t("login.roleBothDesc")}
                  </p>
                </button>
              </div>
            </div>

            {/* Step 3: Progressive Profile Details */}
            <AnimatePresence mode="wait">
              {/* Farmer Profile Section */}
              {(roleChoice === "farmer" || roleChoice === "both") && (
                <motion.div 
                  key="farmer-section"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-muted/30 border border-primary/20 rounded-3xl p-5 space-y-3.5"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Sprout className="h-4 w-4 text-primary" /> 🌾 {t("profile.farmerDetailsTitle")}
                    </h3>
                    <span className="text-[10px] text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full">* Required</span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <Label htmlFor="farmLocation" className="text-xs font-medium text-foreground">{t("profile.farmLocation")}</Label>
                      <Input 
                        id="farmLocation"
                        placeholder="e.g. Warangal, Telangana"
                        value={regForm.farmLocation}
                        onChange={(e) => setRegForm({ ...regForm, farmLocation: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="farmSize" className="text-xs font-medium text-foreground">{t("profile.farmSizeAcres")}</Label>
                      <Input 
                        id="farmSize"
                        type="number"
                        step="0.5"
                        placeholder="e.g. 5.5"
                        value={regForm.farmSize}
                        onChange={(e) => setRegForm({ ...regForm, farmSize: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <Label htmlFor="primaryCrops" className="text-xs font-medium text-foreground">{t("profile.primaryCrops")}</Label>
                      <Input 
                        id="primaryCrops"
                        placeholder="e.g. Paddy, Cotton, Maize, Chilli, Tomato"
                        value={regForm.primaryCrops}
                        onChange={(e) => setRegForm({ ...regForm, primaryCrops: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Buyer Profile Section */}
              {(roleChoice === "buyer" || roleChoice === "both") && (
                <motion.div 
                  key="buyer-section"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-muted/30 border border-amber-500/20 rounded-3xl p-5 space-y-3.5"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <ShoppingCart className="h-4 w-4 text-amber-600" /> 💼 {t("profile.buyerDetailsTitle")}
                    </h3>
                    <span className="text-[10px] text-muted-foreground font-medium bg-muted px-2 py-0.5 rounded-full">* Required</span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <Label htmlFor="businessName" className="text-xs font-medium text-foreground">{t("profile.businessName")}</Label>
                      <Input 
                        id="businessName"
                        placeholder="e.g. GreenValley Organics Ltd."
                        value={regForm.businessName}
                        onChange={(e) => setRegForm({ ...regForm, businessName: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="businessType" className="text-xs font-medium text-foreground">{t("profile.businessType")}</Label>
                      <Select 
                        value={regForm.businessType} 
                        onValueChange={(v) => setRegForm({ ...regForm, businessType: v })}
                      >
                        <SelectTrigger id="businessType" className="rounded-xl">
                          <SelectValue placeholder="Select Business Type" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {BUYER_BUSINESS_TYPES.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="operatingLocation" className="text-xs font-medium text-foreground">{t("profile.operatingLocation")}</Label>
                      <Input 
                        id="operatingLocation"
                        placeholder="e.g. Hyderabad Industrial Zone"
                        value={regForm.operatingLocation}
                        onChange={(e) => setRegForm({ ...regForm, operatingLocation: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="intendedUse" className="text-xs font-medium text-foreground">{t("profile.intendedUse")}</Label>
                      <Input 
                        id="intendedUse"
                        placeholder="e.g. Animal Feed, Starch Extraction, Biofuel"
                        value={regForm.intendedUse}
                        onChange={(e) => setRegForm({ ...regForm, intendedUse: e.target.value })}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Button type="submit" className="w-full py-5 text-sm font-semibold rounded-xl shadow-xs mt-3">
              {t("login.registerButton")}
            </Button>
          </form>
        )}

        {/* Tab 2: Existing User Sign In */}
        {tab === "signin" && (
          <form noValidate onSubmit={handleSignIn} className="space-y-4 max-w-md mx-auto py-2">
            <div className="space-y-1">
              <Label htmlFor="signin-phone" className="text-xs font-medium text-foreground">{t("login.mobile")}</Label>
              <div className="relative">
                <Phone className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  id="signin-phone" 
                  type="tel" 
                  placeholder="e.g. 9876543210" 
                  className="pl-10 rounded-xl"
                  value={signInPhone}
                  onChange={(e) => setSignInPhone(e.target.value.replace(/\D/g, ""))}
                  maxLength={10}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="signin-password" className="text-xs font-medium text-foreground">{t("login.password")}</Label>
              <div className="relative">
                <Lock className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  id="signin-password" 
                  type={showPassword ? "text" : "password"} 
                  placeholder="Enter your password" 
                  className="pl-10 pr-10 rounded-xl"
                  value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full py-5 text-sm font-semibold rounded-xl shadow-xs mt-3">
              {t("login.signInButton")}
            </Button>
          </form>
        )}

        {/* Quick 1-Click Demo Accounts Section */}
        <div className="mt-8 pt-6 border-t border-border/70">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t("login.demoSignInTitle") || "Quick Demo Logins (Click to Log In):"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {DEFAULT_DEMO_ACCOUNTS.map((demo) => {
              const isDemoFarmer = demo.roles.includes(ROLES.FARMER) && !demo.roles.includes(ROLES.BUYER);
              const isDemoBuyer = demo.roles.includes(ROLES.BUYER) && !demo.roles.includes(ROLES.FARMER);
              const isDemoDual = demo.roles.length > 1;

              return (
                <button
                  key={demo.phone}
                  type="button"
                  onClick={() => handleQuickDemoLogin(demo)}
                  className="p-3 text-left rounded-2xl border border-border/80 bg-muted/40 hover:bg-muted hover:border-primary/50 transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5 truncate">
                        {isDemoFarmer && <Sprout className="h-3.5 w-3.5 text-primary shrink-0" />}
                        {isDemoBuyer && <ShoppingCart className="h-3.5 w-3.5 text-amber-600 shrink-0" />}
                        {isDemoDual && <UserCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                        <span className="truncate">{demo.name}</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">
                      {isDemoFarmer ? demo.farmerProfile.primaryCrops : isDemoBuyer ? demo.buyerProfile.businessName : "Dual Operator"}
                    </p>
                    <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                      Phone: <span className="font-mono">{demo.phone}</span>
                    </p>
                  </div>
                  <div className="mt-2.5 pt-1.5 border-t border-border/50 text-[10px] text-primary font-semibold flex items-center justify-between">
                    <span>1-Click Enter</span>
                    <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
