/**
 * Service Worker Registration for AgroCycle PWA & Offline Support
 */

export function registerServiceWorker() {
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          console.log("[AgroCycle PWA] Service Worker registered with scope:", registration.scope);
        })
        .catch((error) => {
          console.warn("[AgroCycle PWA] Service Worker registration failed:", error);
        });
    });
  }
}

export default registerServiceWorker;
