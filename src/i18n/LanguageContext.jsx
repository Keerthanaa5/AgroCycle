import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import en from "./en";
import ta from "./ta";
import hi from "./hi";
import { getDiseaseLabel, getScientificDiseaseName, getCropLabel } from "./diseases";
import { storageService } from "@/services/storageService";

export const SUPPORTED_LANGUAGES = {
  en: { code: "en", label: "English", nativeName: "English" },
  ta: { code: "ta", label: "Tamil", nativeName: "தமிழ்" },
  hi: { code: "hi", label: "Hindi", nativeName: "हिन्दी" }
};

export const DEFAULT_LANGUAGE = "en";
const STORAGE_KEY = "agrocycle_language";
const IDB_SETTINGS_KEY = "languagePreference";

const DICTIONARIES = {
  en,
  ta,
  hi
};

const LanguageContext = createContext(null);

function getInitialLanguage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED_LANGUAGES[stored]) {
        return stored;
      }
    }
  } catch (e) {}
  return DEFAULT_LANGUAGE;
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getInitialLanguage);

  // Initialize from IndexedDB systemMeta asynchronously on boot if available
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const idbPref = await storageService.get(storageService.STORES.SYSTEM_META, IDB_SETTINGS_KEY);
        if (idbPref && idbPref.value && SUPPORTED_LANGUAGES[idbPref.value] && isMounted) {
          setLanguageState(idbPref.value);
          try {
            localStorage.setItem(STORAGE_KEY, idbPref.value);
          } catch (e) {}
        }
      } catch (err) {
        // Fallback gracefully to localStorage state without error
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Update HTML document lang attribute when language changes
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language || DEFAULT_LANGUAGE;
    }
  }, [language]);

  const setLanguage = useCallback((newLang) => {
    const validLang = SUPPORTED_LANGUAGES[newLang] ? newLang : DEFAULT_LANGUAGE;
    setLanguageState(validLang);

    // Persist to localStorage synchronously
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(STORAGE_KEY, validLang);
      }
    } catch (e) {}

    // Persist to IndexedDB systemMeta asynchronously
    try {
      storageService.put(storageService.STORES.SYSTEM_META, {
        id: IDB_SETTINGS_KEY,
        value: validLang,
        updatedAt: new Date().toISOString()
      }).catch(() => {});
    } catch (e) {}
  }, []);

  /**
   * Safe, nested key lookup with English fallback and parameter interpolation
   * 
   * @param {string} pathKey - Dot-notated path e.g. "scanner.title"
   * @param {Object} [params] - Dynamic interpolation parameters e.g. { name: "Ramesh", disease: "Late Blight" }
   * @returns {string} Formatted localized string
   */
  const t = useCallback((pathKey, params = {}) => {
    if (!pathKey) return "";

    const resolvePath = (dict, path) => {
      if (!dict) return undefined;
      const keys = String(path).split(".");
      let current = dict;
      for (const k of keys) {
        if (current && typeof current === "object" && k in current) {
          current = current[k];
        } else {
          return undefined;
        }
      }
      return typeof current === "string" ? current : undefined;
    };

    // 1. Try active language
    const currentDict = DICTIONARIES[language] || DICTIONARIES[DEFAULT_LANGUAGE];
    let template = resolvePath(currentDict, pathKey);

    // 2. Fallback to English if missing in active language
    if (template === undefined && language !== DEFAULT_LANGUAGE) {
      template = resolvePath(DICTIONARIES[DEFAULT_LANGUAGE], pathKey);
    }

    // 3. Fallback to humanized key if missing everywhere (never show raw undefined or null)
    if (template === undefined) {
      const lastSegment = String(pathKey).split(".").pop();
      template = lastSegment.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim();
      template = template.charAt(0).toUpperCase() + template.slice(1);
    }

    // 4. Interpolate parameters {key}
    if (params && typeof params === "object") {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        const val = paramValue !== undefined && paramValue !== null ? String(paramValue) : "";
        template = template.replace(new RegExp(`\\{${paramKey}\\}`, "g"), val);
      });
    }

    return template;
  }, [language]);

  const getDiseaseName = useCallback((rawName) => {
    return getDiseaseLabel(rawName, language);
  }, [language]);

  const getScientificName = useCallback((rawName) => {
    return getScientificDiseaseName(rawName, language);
  }, [language]);

  const getCropName = useCallback((cropName) => {
    return getCropLabel(cropName, language);
  }, [language]);

  const value = {
    language,
    setLanguage,
    t,
    supportedLanguages: SUPPORTED_LANGUAGES,
    languages: Object.values(SUPPORTED_LANGUAGES),
    getDiseaseName,
    getScientificName,
    getCropName
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Return safe default instance if used outside provider
    return {
      language: DEFAULT_LANGUAGE,
      setLanguage: () => {},
      t: (key) => key,
      supportedLanguages: SUPPORTED_LANGUAGES,
      languages: Object.values(SUPPORTED_LANGUAGES),
      getDiseaseName: (rawName) => getDiseaseLabel(rawName, DEFAULT_LANGUAGE),
      getScientificName: (rawName) => getScientificDiseaseName(rawName, DEFAULT_LANGUAGE),
      getCropName: (cropName) => getCropLabel(cropName, DEFAULT_LANGUAGE)
    };
  }
  return context;
}
