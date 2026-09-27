import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/i18n";
import { formatRoleName, hasRole, ROLES } from "@/services/roleManager";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * RoleGuard Component
 * Enforces role-based application access control on protected routes.
 * A dual-role user possessing the allowed role is granted access.
 *
 * @param {Object} props
 * @param {string[]} props.allowedRoles - e.g. [ROLES.FARMER] or [ROLES.BUYER]
 * @param {React.ReactNode} props.children
 * @param {string} [props.fallbackPath="/"]
 */
export default function RoleGuard({ allowedRoles = [], children, fallbackPath = "/" }) {
  const { user, isAuthenticated, isLoadingAuth, activeRole } = useAuth();
  const { t, language } = useLanguage();
  const location = useLocation();

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if account possesses any of the required roles
  const hasPermission = allowedRoles.length === 0 || allowedRoles.some(r => hasRole(user, r));

  if (!hasPermission) {
    const requiredRoleNames = allowedRoles.map(formatRoleName).join(" or ");
    const currentRolesDisplay = (user.roles || [user.role || activeRole]).map(formatRoleName).join(", ");

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-destructive/30 rounded-2xl p-6 shadow-sm text-center space-y-4">
          <div className="h-12 w-12 bg-destructive/10 text-destructive rounded-2xl flex items-center justify-center mx-auto">
            <ShieldAlert className="h-6 w-6" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-foreground">
              {language === "ta" ? "அணுகல் கட்டுப்படுத்தப்பட்டுள்ளது" : language === "hi" ? "पहुँच प्रतिबंधित है" : "Access Restricted"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {language === "ta" 
                ? `இந்த வசதி ${requiredRoleNames} கணக்குகளுக்கு மட்டுமே ஒதுக்கப்பட்டுள்ளது.` 
                : language === "hi" 
                ? `यह सुविधा विशेष रूप से ${requiredRoleNames} खातों के लिए निर्दिष्ट है।` 
                : `This feature is exclusively designated for ${requiredRoleNames} accounts.`}
            </p>
          </div>

          <div className="bg-muted/40 p-3 rounded-xl text-xs text-left space-y-1 text-muted-foreground border border-border">
            <p>• {language === "ta" ? "உங்கள் கணக்கு முறைமை: " : language === "hi" ? "आपकी खाता भूमिका: " : "Your Account Role(s): "} <span className="font-semibold text-foreground">{currentRolesDisplay}</span></p>
            <p>• {language === "ta" ? "தேவையான அனுமதி: " : language === "hi" ? "आवश्यक अनुमति: " : "Required Permission: "} <span className="font-semibold text-foreground">{requiredRoleNames}</span></p>
            <p className="text-[11px] pt-1 text-muted-foreground/80">
              {language === "ta" ? "சுயவிவர அமைப்புகளில் உங்கள் கணக்கில் தேவையான பங்கை சேர்க்கவும்." : language === "hi" ? "इस सुविधा को अनलॉक करने के लिए प्रोफ़ाइल सेटिंग में आवश्यक भूमिका जोड़ें।" : "Please register or add a role to your account in Profile Settings to unlock this feature."}
            </p>
          </div>

          <Button
            onClick={() => window.location.href = fallbackPath}
            className="w-full gap-2 text-xs font-semibold py-5"
          >
            <ArrowLeft className="h-4 w-4" /> {language === "ta" ? "முகப்புக்குத் திரும்பு" : language === "hi" ? "डैशबोर्ड पर लौटें" : "Return to Dashboard"}
          </Button>
        </div>
      </div>
    );
  }

  return children;
}


