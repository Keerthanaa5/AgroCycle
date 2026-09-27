import React, { createContext, useState, useContext, useEffect } from 'react';
import { mockApi } from '@/api/mockApi';
import { storageService } from '@/services/storageService';
import { 
  isFarmer, 
  isBuyer, 
  isDualRole, 
  isActiveFarmer, 
  isActiveBuyer, 
  getActiveRole, 
  isVerified, 
  ROLES 
} from '@/services/roleManager';

const AuthContext = createContext();

export const DEFAULT_DEMO_ACCOUNTS = [
  {
    userId: "usr_farmer_ramesh_01",
    id: "usr_farmer_ramesh_01",
    name: "Ramesh Kumar",
    full_name: "Ramesh Kumar",
    phone: "9876543210",
    email: "ramesh.farmer@agrocycle.in",
    password: "demo",
    roles: [ROLES.FARMER],
    activeRole: ROLES.FARMER,
    role: ROLES.FARMER,
    verificationStatus: "verified",
    farmerProfile: {
      farmLocation: "Warangal, Telangana",
      farmSize: "5.5",
      primaryCrops: "Paddy, Cotton, Chilli"
    },
    buyerProfile: {
      businessName: "",
      businessType: "",
      operatingLocation: "",
      intendedUse: ""
    }
  },
  {
    userId: "usr_buyer_apex_02",
    id: "usr_buyer_apex_02",
    name: "Apex BioEnergy Hub",
    full_name: "Apex BioEnergy Hub",
    phone: "9876543211",
    email: "procurement@apexbioenergy.com",
    password: "demo",
    roles: [ROLES.BUYER],
    activeRole: ROLES.BUYER,
    role: ROLES.BUYER,
    verificationStatus: "verified",
    farmerProfile: {
      farmLocation: "",
      farmSize: "",
      primaryCrops: ""
    },
    buyerProfile: {
      businessName: "Apex BioEnergy Hub Pvt Ltd",
      businessType: "Biofuel & Energy",
      operatingLocation: "Hyderabad Industrial Zone",
      intendedUse: "Pelletization & Biomass Briquettes"
    }
  },
  {
    userId: "usr_dual_suresh_03",
    id: "usr_dual_suresh_03",
    name: "Suresh Patel",
    full_name: "Suresh Patel (Agro & Feed)",
    phone: "9876543212",
    email: "suresh@patelfarms.in",
    password: "demo",
    roles: [ROLES.FARMER, ROLES.BUYER],
    activeRole: ROLES.FARMER,
    role: ROLES.FARMER,
    verificationStatus: "verified",
    farmerProfile: {
      farmLocation: "Guntur, Andhra Pradesh",
      farmSize: "12.0",
      primaryCrops: "Maize, Soybean, Tomato"
    },
    buyerProfile: {
      businessName: "Patel Cattle Feed Processing",
      businessType: "Animal Feed",
      operatingLocation: "Guntur Agri Hub",
      intendedUse: "Silage Baling & Cattle Feed Mash"
    }
  }
];

// Helper to retrieve all registered accounts in the prototype
export function getRegisteredAccounts() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(ACCOUNTS_STORAGE_KEY) : null;
    if (!raw) {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(DEFAULT_DEMO_ACCOUNTS));
      }
      return [...DEFAULT_DEMO_ACCOUNTS];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(DEFAULT_DEMO_ACCOUNTS));
      }
      return [...DEFAULT_DEMO_ACCOUNTS];
    }
    // Ensure default demo accounts are present
    const missingDefaults = DEFAULT_DEMO_ACCOUNTS.filter(d => !parsed.some(p => p.phone === d.phone || p.userId === d.userId));
    if (missingDefaults.length > 0) {
      const merged = [...parsed, ...missingDefaults];
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(merged));
      }
      return merged;
    }
    return parsed;
  } catch (e) {
    return [...DEFAULT_DEMO_ACCOUNTS];
  }
}

// Helper to save registered accounts
export function saveRegisteredAccounts(accounts) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
    }
  } catch (e) {}

  if (Array.isArray(accounts)) {
    storageService.bulkPut(storageService.STORES.USERS, accounts).catch(err => {
      console.warn("[AuthContext] IndexedDB user sync warning:", err);
    });
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    checkUserAuth();
  }, []);

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      let localUser = null;

      try {
        const raw = localStorage.getItem("user");
        if (raw) localUser = JSON.parse(raw);
      } catch (e) {}

      // If localStorage is empty, attempt to recover session from IndexedDB
      if (!localUser) {
        try {
          const idbSession = await storageService.sessions.getCurrentUser();
          if (idbSession) {
            localUser = idbSession;
          }
        } catch (e) {}
      }

      if (localUser) {
        const migratedUser = migrateUserObject(localUser);

        // Synchronize with accounts registry
        const accounts = getRegisteredAccounts();
        const existingIdx = accounts.findIndex(a => a.userId === migratedUser.userId || (migratedUser.phone && a.phone === migratedUser.phone));
        if (existingIdx !== -1) {
          accounts[existingIdx] = { ...accounts[existingIdx], ...migratedUser };
        } else {
          accounts.push(migratedUser);
        }
        saveRegisteredAccounts(accounts);

        try {
          localStorage.setItem("user", JSON.stringify(migratedUser));
        } catch (e) {}

        storageService.sessions.setCurrentUser(migratedUser).catch(() => {});
        storageService.users.save(migratedUser).catch(() => {});

        setUser(migratedUser);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);
      
      setAuthError({
        type: 'auth_required',
        message: 'Authentication required'
      });
    }
  };

  // Safe migration helper for existing single-role accounts
  const migrateUserObject = (currentUser) => {
    const migrated = { ...currentUser };
    
    // Ensure persistent, single userId
    if (!migrated.userId && !migrated.id) {
      migrated.userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      migrated.id = migrated.userId;
    } else {
      migrated.userId = migrated.userId || migrated.id;
      migrated.id = migrated.userId;
    }

    // Migrate single role string to roles array
    if (!migrated.roles || !Array.isArray(migrated.roles) || migrated.roles.length === 0) {
      const legacyRole = (migrated.role || ROLES.FARMER).toLowerCase();
      migrated.roles = [legacyRole];
    } else {
      // Normalize roles
      migrated.roles = Array.from(new Set(migrated.roles.map(r => r.toLowerCase())));
    }

    // Ensure activeRole is valid and in roles list
    if (!migrated.activeRole || !migrated.roles.includes(migrated.activeRole.toLowerCase())) {
      migrated.activeRole = migrated.roles[0];
    } else {
      migrated.activeRole = migrated.activeRole.toLowerCase();
    }

    // Keep legacy single .role property in sync with activeRole for backward compatibility
    migrated.role = migrated.activeRole;

    // Ensure verificationStatus defaults to pending
    if (!migrated.verificationStatus) {
      migrated.verificationStatus = "pending";
    }

    migrated.full_name = migrated.name || migrated.full_name || "User";
    migrated.name = migrated.full_name;

    // Ensure separate structured profiles exist without losing historical flat fields
    if (!migrated.farmerProfile) {
      migrated.farmerProfile = {
        farmLocation: migrated.farmLocation || migrated.location || migrated.farm_location || "",
        farmSize: migrated.farmSize || migrated.farm_size || "",
        primaryCrops: migrated.primaryCrops || migrated.primary_crops || ""
      };
    }
    if (!migrated.buyerProfile) {
      migrated.buyerProfile = {
        businessName: migrated.businessName || migrated.business_name || "",
        businessType: migrated.businessType || migrated.business_type || "",
        operatingLocation: migrated.operatingLocation || migrated.location || migrated.operating_location || "",
        intendedUse: migrated.intendedUse || migrated.intended_use || ""
      };
    }

    return migrated;
  };

  const login = (accountData) => {
    const accounts = getRegisteredAccounts();
    const phone = accountData.phone ? String(accountData.phone).trim() : "";
    
    // Look up existing account by phone
    const existing = phone ? accounts.find(a => a.phone === phone) : null;

    // If existing account has a password and accountData provided a password, verify match
    if (existing && existing.password && accountData.password) {
      if (String(existing.password).trim() !== String(accountData.password).trim()) {
        return { success: false, error: "invalid_password" };
      }
    }

    let targetUserId = existing ? (existing.userId || existing.id) : (accountData.userId || accountData.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
    let verificationStatus = existing ? (existing.verificationStatus || "pending") : (accountData.verificationStatus || "pending");

    // Merge roles if existing
    let combinedRoles = [];
    if (existing && Array.isArray(existing.roles)) {
      combinedRoles = [...existing.roles];
    } else if (existing && existing.role) {
      combinedRoles = [existing.role];
    }

    if (accountData.roles && Array.isArray(accountData.roles)) {
      combinedRoles.push(...accountData.roles);
    } else if (accountData.role) {
      combinedRoles.push(accountData.role);
    }

    if (combinedRoles.length === 0) {
      combinedRoles = [ROLES.FARMER];
    }
    combinedRoles = Array.from(new Set(combinedRoles.map(r => r.toLowerCase())));

    // Determine active role
    let activeRole = accountData.activeRole || existing?.activeRole || combinedRoles[0];
    if (!combinedRoles.includes(activeRole)) {
      activeRole = combinedRoles[0];
    }

    const mergedUser = {
      ...(existing || {}),
      ...accountData,
      userId: targetUserId,
      id: targetUserId,
      roles: combinedRoles,
      activeRole: activeRole,
      role: activeRole,
      phone: phone || existing?.phone || "",
      name: accountData.name || (existing ? existing.name : "AgroCycle User"),
      full_name: accountData.name || (existing ? existing.full_name : "AgroCycle User"),
      verificationStatus: verificationStatus,
      farmerProfile: {
        ...(existing?.farmerProfile || {}),
        ...(accountData.farmerProfile || {}),
        farmLocation: accountData.farmerProfile?.farmLocation || accountData.location || existing?.farmerProfile?.farmLocation || "",
        farmSize: accountData.farmerProfile?.farmSize || accountData.farm_size || existing?.farmerProfile?.farmSize || "",
        primaryCrops: accountData.farmerProfile?.primaryCrops || accountData.primary_crops || existing?.farmerProfile?.primaryCrops || "",
      },
      buyerProfile: {
        ...(existing?.buyerProfile || {}),
        ...(accountData.buyerProfile || {}),
        businessName: accountData.buyerProfile?.businessName || accountData.business_name || existing?.buyerProfile?.businessName || "",
        businessType: accountData.buyerProfile?.businessType || accountData.business_type || existing?.buyerProfile?.businessType || "",
        operatingLocation: accountData.buyerProfile?.operatingLocation || accountData.location || existing?.buyerProfile?.operatingLocation || "",
        intendedUse: accountData.buyerProfile?.intendedUse || accountData.intended_use || existing?.buyerProfile?.intendedUse || "",
      }
    };

    // Save to accounts list
    const updatedAccounts = accounts.filter(a => a.userId !== targetUserId && a.phone !== phone);
    updatedAccounts.push(mergedUser);
    saveRegisteredAccounts(updatedAccounts);

    // Save to current active user
    try {
      localStorage.setItem("user", JSON.stringify(mergedUser));
    } catch (e) {}

    storageService.sessions.setCurrentUser(mergedUser).catch(() => {});
    storageService.users.save(mergedUser).catch(() => {});

    setUser(mergedUser);
    setIsAuthenticated(true);
    return { success: true, user: mergedUser };
  };

  const switchRole = (targetRole) => {
    if (!user) return false;
    const normalizedTarget = (targetRole || "").toLowerCase();
    
    // Strict guard: Cannot switch to a role the account does not possess
    if (!user.roles || !user.roles.map(r => r.toLowerCase()).includes(normalizedTarget)) {
      console.warn(`Role switch rejected: User does not possess role "${targetRole}"`);
      return false;
    }

    const updatedUser = {
      ...user,
      activeRole: normalizedTarget,
      role: normalizedTarget
    };

    // Update in localStorage, accounts registry, and IndexedDB
    try {
      localStorage.setItem("user", JSON.stringify(updatedUser));
    } catch (e) {}
    
    const accounts = getRegisteredAccounts();
    const idx = accounts.findIndex(a => a.userId === user.userId);
    if (idx !== -1) {
      accounts[idx] = updatedUser;
      saveRegisteredAccounts(accounts);
    }

    storageService.sessions.setCurrentUser(updatedUser).catch(() => {});
    storageService.users.save(updatedUser).catch(() => {});

    setUser(updatedUser);
    return true;
  };

  const updateUser = (updatedFields) => {
    if (!user) return;
    
    const updatedUser = {
      ...user,
      ...updatedFields,
      userId: user.userId,
      id: user.userId,
      roles: user.roles, // prevent arbitrary role deletion via profile edit
      activeRole: user.activeRole,
      verificationStatus: updatedFields.verificationStatus || user.verificationStatus || "pending",
      farmerProfile: {
        ...user.farmerProfile,
        ...(updatedFields.farmerProfile || {})
      },
      buyerProfile: {
        ...user.buyerProfile,
        ...(updatedFields.buyerProfile || {})
      }
    };

    if (updatedFields.name) {
      updatedUser.full_name = updatedFields.name;
    }

    try {
      localStorage.setItem("user", JSON.stringify(updatedUser));
    } catch (e) {}
    
    const accounts = getRegisteredAccounts();
    const idx = accounts.findIndex(a => a.userId === user.userId || (user.phone && a.phone === user.phone));
    if (idx !== -1) {
      accounts[idx] = updatedUser;
      saveRegisteredAccounts(accounts);
    }

    storageService.sessions.setCurrentUser(updatedUser).catch(() => {});
    storageService.users.save(updatedUser).catch(() => {});

    setUser(updatedUser);
  };

  const setVerificationStatus = (newStatus) => {
    if (!user) return;
    const validStatus = newStatus === "verified" ? "verified" : "pending";
    const updatedUser = {
      ...user,
      verificationStatus: validStatus
    };

    try {
      localStorage.setItem("user", JSON.stringify(updatedUser));
    } catch (e) {}

    const accounts = getRegisteredAccounts();
    const idx = accounts.findIndex(a => a.userId === user.userId || (user.phone && a.phone === user.phone));
    if (idx !== -1) {
      accounts[idx] = { ...accounts[idx], verificationStatus: validStatus };
      saveRegisteredAccounts(accounts);
    }

    storageService.sessions.setCurrentUser(updatedUser).catch(() => {});
    storageService.users.save(updatedUser).catch(() => {});

    setUser(updatedUser);
  };

  const addRole = (newRole) => {
    if (!user || !newRole) return;
    const normalizedRole = newRole.toLowerCase();
    if (![ROLES.FARMER, ROLES.BUYER].includes(normalizedRole)) return;
    
    const existingRoles = Array.isArray(user.roles) ? user.roles : [user.role || ROLES.FARMER];
    if (existingRoles.includes(normalizedRole)) return; // already has role

    const updatedRoles = [...existingRoles, normalizedRole];
    const updatedUser = {
      ...user,
      roles: updatedRoles,
      role: user.activeRole
    };

    try {
      localStorage.setItem("user", JSON.stringify(updatedUser));
    } catch (e) {}
    
    const accounts = getRegisteredAccounts();
    const idx = accounts.findIndex(a => a.userId === user.userId);
    if (idx !== -1) {
      accounts[idx] = updatedUser;
      saveRegisteredAccounts(accounts);
    }

    storageService.sessions.setCurrentUser(updatedUser).catch(() => {});
    storageService.users.save(updatedUser).catch(() => {});

    setUser(updatedUser);
  };

  const logout = () => {
    try {
      localStorage.removeItem("user");
    } catch (e) {}
    storageService.sessions.clear().catch(() => {});
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = "/login";
  };

  const navigateToLogin = () => {
    window.location.href = "/login";
  };

  const activeRole = getActiveRole(user);
  const roles = user?.roles || [activeRole];

  return (
    <AuthContext.Provider value={{ 
      user,
      roles,
      activeRole,
      role: activeRole, // backward compatibility
      isFarmer: isFarmer(user),
      isBuyer: isBuyer(user),
      isDualRole: isDualRole(user),
      isActiveFarmer: isActiveFarmer(user),
      isActiveBuyer: isActiveBuyer(user),
      isVerified: isVerified(user),
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: {},
      login,
      switchRole,
      addRole,
      updateUser,
      setVerificationStatus,
      logout,
      navigateToLogin,
      checkAppState: checkUserAuth
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
