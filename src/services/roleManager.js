/**
 * AgroCycle Centralized Multi-Role Management Service
 *
 * Provides helpers for multi-role user accounts (roles: ["farmer", "buyer"]),
 * active role switching, role-specific action guards, and dual profile completeness.
 */

export const ROLES = {
  FARMER: "farmer",
  BUYER: "buyer"
};

export const BUYER_BUSINESS_TYPES = [
  "Food Processing",
  "Hotel / Hospitality",
  "Animal Feed",
  "Biofuel / Biomass",
  "Composting",
  "Agricultural Aggregator",
  "Other"
];

/**
 * Check if the user possesses a given role
 * @param {Object|null} user
 * @param {string} role
 * @returns {boolean}
 */
export function hasRole(user, role) {
  if (!user || !role) return false;
  const targetRole = role.toLowerCase();
  
  // Check roles array
  if (Array.isArray(user.roles)) {
    return user.roles.map(r => r.toLowerCase()).includes(targetRole);
  }
  
  // Check legacy single role property
  if (typeof user.role === "string") {
    return user.role.toLowerCase() === targetRole;
  }
  
  return false;
}

/**
 * Check if the user is a Farmer (possesses farmer role)
 * @param {Object|null} user
 * @returns {boolean}
 */
export function isFarmer(user) {
  return hasRole(user, ROLES.FARMER);
}

/**
 * Check if the user is a Buyer (possesses buyer role)
 * @param {Object|null} user
 * @returns {boolean}
 */
export function isBuyer(user) {
  return hasRole(user, ROLES.BUYER);
}

/**
 * Check if the user has both Farmer and Buyer roles
 * @param {Object|null} user
 * @returns {boolean}
 */
export function isDualRole(user) {
  return isFarmer(user) && isBuyer(user);
}

/**
 * Retrieves the currently active role for a user
 * @param {Object|null} user
 * @returns {string}
 */
export function getActiveRole(user) {
  if (!user) return ROLES.FARMER;
  if (user.activeRole && hasRole(user, user.activeRole)) {
    return user.activeRole.toLowerCase();
  }
  if (Array.isArray(user.roles) && user.roles.length > 0) {
    return user.roles[0].toLowerCase();
  }
  if (typeof user.role === "string") {
    return user.role.toLowerCase();
  }
  return ROLES.FARMER;
}

/**
 * Check if user is currently operating in active Farmer mode
 * @param {Object|null} user
 * @returns {boolean}
 */
export function isActiveFarmer(user) {
  return getActiveRole(user) === ROLES.FARMER;
}

/**
 * Check if user is currently operating in active Buyer mode
 * @param {Object|null} user
 * @returns {boolean}
 */
export function isActiveBuyer(user) {
  return getActiveRole(user) === ROLES.BUYER;
}

/**
 * Check if user profile is officially verified
 * @param {Object|null} user
 * @returns {boolean}
 */
export function isVerified(user) {
  if (!user) return false;
  return user.verificationStatus === "verified";
}

/**
 * Calculate Farmer profile completeness percentage (0 to 100)
 * @param {Object|null} farmerProfile
 * @param {Object|null} user
 * @returns {number}
 */
export function calculateFarmerCompleteness(farmerProfile = {}, user = {}) {
  const merged = { ...user, ...farmerProfile };
  const farmerFields = [
    Boolean(merged.name || merged.full_name || merged.display_name),
    Boolean(merged.phone),
    Boolean(merged.farmLocation || merged.location || merged.farm_location),
    Boolean(merged.farmSize || merged.farm_size),
    Boolean(merged.primaryCrops || merged.primary_crops)
  ];
  const filled = farmerFields.filter(Boolean).length;
  return Math.round((filled / farmerFields.length) * 100);
}

/**
 * Calculate Buyer profile completeness percentage (0 to 100)
 * @param {Object|null} buyerProfile
 * @param {Object|null} user
 * @returns {number}
 */
export function calculateBuyerCompleteness(buyerProfile = {}, user = {}) {
  const merged = { ...user, ...buyerProfile };
  const buyerFields = [
    Boolean(merged.name || merged.full_name || merged.display_name),
    Boolean(merged.phone),
    Boolean(merged.operatingLocation || merged.location || merged.operating_location),
    Boolean(merged.businessName || merged.business_name || merged.organization_name),
    Boolean(merged.businessType || merged.business_type),
    Boolean(merged.intendedUse || merged.intended_use)
  ];
  const filled = buyerFields.filter(Boolean).length;
  return Math.round((filled / buyerFields.length) * 100);
}

/**
 * Calculates overall and role-specific profile completeness
 * @param {Object|null} user
 * @returns {{ farmer: number, buyer: number, overall: number }}
 */
export function getProfileCompleteness(user) {
  if (!user) return { farmer: 0, buyer: 0, overall: 0 };
  
  const hasFarmerRole = isFarmer(user);
  const hasBuyerRole = isBuyer(user);

  const farmerComp = hasFarmerRole 
    ? calculateFarmerCompleteness(user.farmerProfile, user) 
    : 0;

  const buyerComp = hasBuyerRole 
    ? calculateBuyerCompleteness(user.buyerProfile, user) 
    : 0;

  let overall = 0;
  if (hasFarmerRole && hasBuyerRole) {
    overall = Math.round((farmerComp + buyerComp) / 2);
  } else if (hasFarmerRole) {
    overall = farmerComp;
  } else if (hasBuyerRole) {
    overall = buyerComp;
  }

  return {
    farmer: farmerComp,
    buyer: buyerComp,
    overall: overall
  };
}

/**
 * Legacy compatibility helper for calculating profile completeness
 * @param {Object|null} user
 * @param {Object} [profileData]
 * @returns {number}
 */
export function calculateProfileCompleteness(user, profileData = {}) {
  if (!user && !profileData) return 0;
  const merged = { ...user, ...profileData };
  const stats = getProfileCompleteness(merged);
  return stats.overall;
}

/**
 * Check if the user can create crop waste / marketplace listings (Farmer or Buyer role required)
 * @param {Object|null} user
 * @returns {boolean}
 */
export function canCreateListing(user) {
  return isFarmer(user) || isBuyer(user);
}


/**
 * Check if the user can book animal feed from silage banks (Farmer role required)
 * @param {Object|null} user
 * @returns {boolean}
 */
export function canBookSilage(user) {
  return isFarmer(user);
}

/**
 * Check if the user can add or manage silage processing centers (Buyer role required)
 * @param {Object|null} user
 * @returns {boolean}
 */
export function canAddSilageCenter(user) {
  return isBuyer(user);
}

/**
 * Check if the user can access farmer-specific diagnostic & agronomic features
 * (Viability Scanner, Claim Rocket, Intercrop Wizard, Listing Creation)
 * @param {Object|null} user
 * @returns {boolean}
 */
export function canAccessFarmerFeature(user) {
  return isFarmer(user);
}

/**
 * Check if the user can access buyer-specific commercial & processing features
 * (Silage Center Creation, Direct Listing Off-take, Carbon Activity Verification)
 * @param {Object|null} user
 * @returns {boolean}
 */
export function canAccessBuyerFeature(user) {
  return isBuyer(user);
}

/**
 * Check if the current authenticated user is the legitimate creator/owner of a record
 * @param {Object|null} record
 * @param {Object|null} user
 * @returns {boolean}
 */
export function isRecordOwner(record, user) {
  if (!record?.creatorId) return false;
  const currentUserId = user?.userId || user?.id;
  if (!currentUserId) return false;
  return record.creatorId === currentUserId;
}

/**
 * Check if a user is eligible to sponsor a specific carbon activity.
 * Strict Self-Sponsorship Prevention:
 * - Must possess Buyer role
 * - Activity creatorId must NOT match user's canonical userId
 * @param {Object|null} user
 * @param {Object|null} activity
 * @returns {boolean}
 */
export function canSponsorActivity(user, activity) {
  if (!user || !activity) return false;
  if (!isBuyer(user)) return false;
  
  const currentUserId = user.userId || user.id;
  const creatorId = activity.creatorId;
  
  // If activity has creatorId and user has userId, prevent self-sponsorship
  if (creatorId && currentUserId && creatorId === currentUserId) {
    return false;
  }
  
  return true;
}

/**
 * Check if a farmer user is eligible to accept/reject an offer on a carbon activity.
 * - Must be the legitimate creator/owner of the activity (creatorId === userId)
 * - Sponsor must NOT be the same user (anti self-sponsorship)
 * @param {Object|null} user
 * @param {Object|null} activity
 * @returns {boolean}
 */
export function canAcceptActivityOffer(user, activity) {
  if (!user || !activity) return false;
  if (!isRecordOwner(activity, user)) return false;
  
  const currentUserId = user.userId || user.id;
  const sponsorId = activity.sponsorId;
  
  // A farmer cannot accept a self-submitted offer
  if (sponsorId && currentUserId && sponsorId === currentUserId) {
    return false;
  }
  
  return true;
}

/**
 * Resolves the target contact phone for a marketplace listing.
 * Strict Self-Contact Prevention: returns null if the authenticated user is the listing creator.
 * NEVER returns the current user's phone.
 * @param {Object|null} listing
 * @param {Object|null} user
 * @returns {string|null}
 */
export function getListingContactPhone(listing, user) {
  if (!listing) return null;
  const currentUserId = user?.userId || user?.id;
  
  // Prevent self-contact
  if (listing.creatorId && currentUserId && listing.creatorId === currentUserId) {
    return null;
  }

  // Target contact resolution directly from the listing record
  if (listing.buyerPhone) return String(listing.buyerPhone).trim();
  if (listing.farmerPhone) return String(listing.farmerPhone).trim();
  if (listing.creatorPhone) return String(listing.creatorPhone).trim();
  if (listing.phone) return String(listing.phone).trim();
  if (listing.contact_phone) return String(listing.contact_phone).trim();
  return null;
}

/**
 * Generates the WhatsApp URL for contacting a listing creator.
 * Returns null if self-contact or no target phone is available.
 * @param {Object|null} listing
 * @param {Object|null} user
 * @returns {string|null}
 */
export function getListingWhatsAppUrl(listing, user) {
  const phone = getListingContactPhone(listing, user);
  if (!phone) return null;
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (!cleanPhone) return null;
  
  const title = listing.crop_type || listing.crop || listing.title || "crops";
  const isBuyerListing = listing.creatorRole === "buyer" || Boolean(listing.buyerPhone) || listing.listingType === "buy";
  const context = isBuyerListing ? `buying requirement for ${title}` : `listing for ${title}`;
  
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hi, I saw your ${context} on AgroCycle.`)}`;
}

/**
 * Formats user role string for UI display
 * @param {string|null} role
 * @returns {string}
 */
export function formatRoleName(role) {
  if (!role) return "User";
  if (role.toLowerCase() === ROLES.FARMER) return "Farmer";
  if (role.toLowerCase() === ROLES.BUYER) return "Buyer";
  return role.charAt(0).toUpperCase() + role.slice(1);
}


