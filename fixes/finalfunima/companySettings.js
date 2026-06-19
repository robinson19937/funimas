// Company settings & subscription helpers
import { Funimas } from "../sdk/index.js";
import {
  auth,
  getDownloadURL,
  onAuthStateChanged,
  ref,
  serverTimestamp,
  storage,
  uploadBytesResumable
} from "./firebase.js";
import { DEFAULT_GALLERY_CATEGORIES, normalizeGalleryCategories } from "./galleryCategories.js";
import { SUPPORT_EMAIL } from "./productionOrigin.js";

const DEFAULT_SETTINGS = {
  businessName: "Roblop Business",
  logoUrl: "/assets/img/logo.png",
  primaryColor: "#4f6ef7",
  secondaryColor: "#3b5bdb",
  phone: "",
  whatsapp: "",
  email: "contacto@suempresa.com",
  address: "",
  taxId: "",
  website: "",
  pdfFooter: "Documento generado automáticamente – No requiere firma física",
  currency: "COP",
  galleryCategories: [...DEFAULT_GALLERY_CATEGORIES]
};

const CACHE_KEY = "app:company-settings";
const COMPANY_KEY = "app:company-id";
const USAGE_WARNING_RATIO = 0.8;
const PLAN_LIMITS = {
  free: {
    documentLimit: 25,
    galleryLimit: 10,
    storageLimitBytes: 50 * 1024 * 1024,
    maxImageBytes: 2 * 1024 * 1024,
    documentPeriod: "none"
  },
  pro: {
    documentLimit: 300,
    galleryLimit: 500,
    storageLimitBytes: 1024 * 1024 * 1024,
    maxImageBytes: 2 * 1024 * 1024,
    documentPeriod: "monthly"
  }
};

const DEFAULT_SUBSCRIPTION = {
  plan: "free",
  documentsUsed: 0,
  documentLimit: PLAN_LIMITS.free.documentLimit,
  galleryUsed: 0,
  galleryLimit: PLAN_LIMITS.free.galleryLimit,
  storageUsedBytes: 0,
  storageLimitBytes: PLAN_LIMITS.free.storageLimitBytes,
  maxImageBytes: PLAN_LIMITS.free.maxImageBytes,
  periodKey: null,
  limit: PLAN_LIMITS.free.documentLimit
};
const SUBSCRIPTION_DOC_ID = "main";

let settingsPromise = null;
let currentSettings = null;
const logoDataCache = new Map();
let subscriptionPromise = null;

function getPlanLimits(plan) {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

function getCurrentPeriodKey() {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

function normalizeCompanyId(rawId) {
  const cleanId = (rawId || "").trim();
  return cleanId
    ? cleanId.replace(/[^a-zA-Z0-9-_]/g, "-")
    : "default-company";
}

export function resolveCompanyId() {
  if (typeof window === "undefined") return "default-company";

  const paramsId = new URLSearchParams(window.location.search).get("companyId");
  if (paramsId) {
    const normalized = normalizeCompanyId(paramsId);
    localStorage.setItem(COMPANY_KEY, normalized);
    return normalized;
  }

  const stored = localStorage.getItem(COMPANY_KEY);
  if (stored) return normalizeCompanyId(stored);

  const hostname = window.location.hostname || "default-company";
  const normalized = normalizeCompanyId(hostname);
  localStorage.setItem(COMPANY_KEY, normalized);
  return normalized;
}

function normalizeSettings(raw = {}) {
  const companyId = raw.companyId || resolveCompanyId();
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    companyId,
    galleryCategories: normalizeGalleryCategories(raw.galleryCategories)
  };
}

/** companyId del usuario autenticado (perfil Firestore), sin hostname genérico. */
export async function getAuthenticatedCompanyId() {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const snap = await Funimas.database.get('users', user.uid);
    const fromProfile = snap.exists() ? snap.data()?.companyId : null;
    if (fromProfile) {
      const normalized = normalizeCompanyId(fromProfile);
      try {
        localStorage.setItem(COMPANY_KEY, normalized);
      } catch (_) { }
      return normalized;
    }
  } catch (error) {
    console.warn("No se pudo leer companyId del perfil", error);
  }

  return resolveCompanyId();
}

function normalizeSubscription(raw = {}) {
  const companyId = raw.companyId || resolveCompanyId();
  const plan = raw.plan || DEFAULT_SUBSCRIPTION.plan;
  const planLimits = getPlanLimits(plan);

  const documentLimit = Number(
    raw.documentLimit ?? raw.limit ?? planLimits.documentLimit ?? DEFAULT_SUBSCRIPTION.documentLimit
  );
  const galleryLimit = Number(
    raw.galleryLimit ?? planLimits.galleryLimit ?? DEFAULT_SUBSCRIPTION.galleryLimit
  );
  const storageLimitBytes = Number(
    raw.storageLimitBytes ?? planLimits.storageLimitBytes ?? DEFAULT_SUBSCRIPTION.storageLimitBytes
  );
  const maxImageBytes = Number(
    raw.maxImageBytes ?? planLimits.maxImageBytes ?? DEFAULT_SUBSCRIPTION.maxImageBytes
  );

  return {
    ...DEFAULT_SUBSCRIPTION,
    ...planLimits,
    ...raw,
    companyId,
    plan,
    documentLimit,
    galleryLimit,
    storageLimitBytes,
    maxImageBytes,
    periodKey: raw.periodKey || raw.period || raw.usagePeriod || DEFAULT_SUBSCRIPTION.periodKey,
    limit: documentLimit
  };
}

function getUsageWarning(label, used, limit, plan) {
  if (!limit || limit <= 0) return null;

  const ratio = used / limit;

  if (ratio >= USAGE_WARNING_RATIO && used < limit) {
    if (plan === "pro") {
      return `Estás llegando al uso razonable del Plan Pro para ${label}.`;
    }

    return `Estás cerca del límite del plan gratuito para ${label}.`;
  }

  return null;
}

function getLimitMessage(label, plan) {
  const supportEmail = SUPPORT_EMAIL;
  if (plan === "pro") {
    return `Has alcanzado el uso razonable del Plan Pro para ${label}. Puedes reanudar en el siguiente ciclo o escribirnos a ${supportEmail} para más opciones.`;
  }

  return `Has alcanzado el límite del plan gratuito para ${label}. Actualiza a Pro o contáctanos en ${supportEmail} para seguir trabajando sin interrupciones.`;
}

export async function ensureSubscription() {
  if (!subscriptionPromise) {
    subscriptionPromise = (async () => {
      const companyId = resolveCompanyId();
      const loaded = await loadSubscriptionFromFirestore(companyId);
      return applyUsageResets(loaded, companyId);
    })().catch((error) => {
      subscriptionPromise = null;
      console.error("No se pudo inicializar la suscripción", error);
      throw error;
    });
  }

  return subscriptionPromise;
}

async function applyUsageResets(subscription, companyId) {
  const limits = getPlanLimits(subscription.plan);
  const updates = {};
  const requiresMonthlyDocuments = limits.documentPeriod === "monthly";
  const currentPeriod = requiresMonthlyDocuments ? getCurrentPeriodKey() : subscription.periodKey;

  if (requiresMonthlyDocuments && subscription.periodKey !== currentPeriod) {
    updates.documentsUsed = 0;
    updates.periodKey = currentPeriod;
  }

  if (!subscription.documentLimit && limits.documentLimit) {
    updates.documentLimit = limits.documentLimit;
  }

  if (
    subscription.plan === "free" &&
    limits.documentLimit &&
    Number(subscription.documentLimit) > 0 &&
    Number(subscription.documentLimit) < limits.documentLimit
  ) {
    updates.documentLimit = limits.documentLimit;
  }

  if (!subscription.galleryLimit && limits.galleryLimit) {
    updates.galleryLimit = limits.galleryLimit;
  }

  if (!subscription.maxImageBytes && limits.maxImageBytes) {
    updates.maxImageBytes = limits.maxImageBytes;
  }

  if (
    (subscription.storageLimitBytes === undefined || subscription.storageLimitBytes === null) &&
    limits.storageLimitBytes !== undefined
  ) {
    updates.storageLimitBytes = limits.storageLimitBytes;
  }

  if (Object.keys(updates).length === 0) {
    return subscription;
  }

  updates.limit = updates.documentLimit ?? subscription.documentLimit;
  updates.updatedAt = serverTimestamp();

  try {
    await Funimas.database.updateAtPath(
      "companies",
      companyId,
      "subscription",
      SUBSCRIPTION_DOC_ID,
      updates
    );
  } catch (error) {
    if (error?.code === "permission-denied" || String(error?.message || "").toLowerCase().includes("permission")) {
      console.warn("No autorizado para actualizar la subscripción; usando valores actualizados en cliente.", error);
      return normalizeSubscription({ ...subscription, ...updates });
    }
    throw error;
  }

  return normalizeSubscription({ ...subscription, ...updates });
}

export async function getSubscription() {
  try {
    return await ensureSubscription();
  } catch (error) {
    return normalizeSubscription({ companyId: resolveCompanyId(), error: true });
  }
}

export async function assertCanCreateDocument() {
  const subscription = await getSubscription();
  const used = Number(subscription.documentsUsed || 0);
  const maxLimit = Number(subscription.documentLimit || subscription.limit || 0);
  const warningMessage = getUsageWarning("documentos", used, maxLimit, subscription.plan);
  const limitMessage = !maxLimit || used < maxLimit
    ? null
    : getLimitMessage("documentos", subscription.plan);

  return {
    allowed: maxLimit === 0 || used < maxLimit,
    subscription,
    warningMessage,
    limitMessage
  };
}

export async function incrementDocumentsUsed() {
  const subscription = await ensureSubscription();
  const companyId = subscription.companyId;

  try {
    const currentUsed = Number(subscription.documentsUsed || 0);
    await Funimas.database.updateAtPath(
      "companies",
      companyId,
      "subscription",
      SUBSCRIPTION_DOC_ID,
      {
        documentsUsed: currentUsed + 1,
        updatedAt: serverTimestamp()
      }
    );

    subscriptionPromise = Funimas.database
      .getAtPath("companies", companyId, "subscription", SUBSCRIPTION_DOC_ID)
      .then((snap) => normalizeSubscription({ ...snap.data(), companyId }))
      .catch((error) => {
        subscriptionPromise = null;
        console.error("No se pudo actualizar la suscripción (leer después de increment).", error);
        throw error;
      });

    return subscriptionPromise;
  } catch (error) {
    if (error?.code === "permission-denied" || String(error?.message || "").toLowerCase().includes("permission")) {
      console.warn("No autorizado para incrementar 'documentsUsed'. Se omite el incremento en cliente.", error);
      const local = normalizeSubscription({
        ...subscription,
        documentsUsed: Number(subscription.documentsUsed || 0) + 1
      });
      subscriptionPromise = Promise.resolve(local);
      return subscriptionPromise;
    }

    subscriptionPromise = null;
    console.error("No se pudo actualizar la suscripción", error);
    throw error;
  }
}

export async function assertCanUploadImage(file) {
  const subscription = await getSubscription();
  const planLimits = getPlanLimits(subscription.plan);
  const fileSize = Number(file?.size || 0);
  const maxImageBytes = Number(subscription.maxImageBytes || planLimits.maxImageBytes || 0);

  if (fileSize && maxImageBytes && fileSize > maxImageBytes) {
    return {
      allowed: false,
      subscription,
      limitMessage: "Cada imagen debe pesar menos de 2 MB."
    };
  }

  const galleryUsed = Number(subscription.galleryUsed || 0);
  const galleryLimit = Number(subscription.galleryLimit || planLimits.galleryLimit || 0);
  const storageUsed = Number(subscription.storageUsedBytes || 0);
  const storageLimitBytes = Number(
    subscription.storageLimitBytes ?? planLimits.storageLimitBytes ?? 0
  );

  if (galleryLimit > 0 && galleryUsed >= galleryLimit) {
    return {
      allowed: false,
      subscription,
      limitMessage: getLimitMessage("la galería", subscription.plan)
    };
  }

  if (storageLimitBytes > 0 && storageUsed >= storageLimitBytes) {
    return {
      allowed: false,
      subscription,
      limitMessage: getLimitMessage("almacenamiento", subscription.plan)
    };
  }

  const projectedStorage = storageUsed + fileSize;

  if (storageLimitBytes > 0 && projectedStorage > storageLimitBytes) {
    return {
      allowed: false,
      subscription,
      limitMessage: getLimitMessage("almacenamiento", subscription.plan)
    };
  }

  const warnings = [];
  const warningGallery = getUsageWarning("la galería", galleryUsed, galleryLimit, subscription.plan);
  const warningStorage = getUsageWarning(
    "almacenamiento",
    projectedStorage,
    storageLimitBytes,
    subscription.plan
  );

  if (warningGallery) warnings.push(warningGallery);
  if (warningStorage) warnings.push(warningStorage);

  return {
    allowed: true,
    subscription,
    warningMessage: warnings.length ? warnings.join(" ") : null
  };
}

export async function registerGalleryUpload(bytes = 0) {
  const subscription = await ensureSubscription();
  const companyId = subscription.companyId;
  const updates = {
    galleryUsed: Number(subscription.galleryUsed || 0) + 1,
    updatedAt: serverTimestamp()
  };

  if (bytes > 0) {
    updates.storageUsedBytes = Number(subscription.storageUsedBytes || 0) + bytes;
  }

  try {
    await Funimas.database.updateAtPath(
      "companies",
      companyId,
      "subscription",
      SUBSCRIPTION_DOC_ID,
      updates
    );

    subscriptionPromise = Funimas.database
      .getAtPath("companies", companyId, "subscription", SUBSCRIPTION_DOC_ID)
      .then((snap) => normalizeSubscription({ ...snap.data(), companyId }))
      .catch((error) => {
        subscriptionPromise = null;
        console.error("No se pudo actualizar la suscripción", error);
        throw error;
      });
  } catch (error) {
    const isPermission = error?.code === "permission-denied" || String(error?.message || "").toLowerCase().includes("permission");
    if (isPermission) {
      console.warn("No autorizado para registrar uso de galería. Se usa estado local.", error);
      const local = normalizeSubscription({
        ...subscription,
        galleryUsed: Number(subscription.galleryUsed || 0) + 1,
        storageUsedBytes: Number(subscription.storageUsedBytes || 0) + (bytes || 0)
      });
      subscriptionPromise = Promise.resolve(local);
      return subscriptionPromise;
    }

    subscriptionPromise = null;
    console.error("No se pudo actualizar la suscripción", error);
    throw error;
  }

  return subscriptionPromise;
}

function cacheSettings(settings) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn("No se pudo guardar la caché de configuración", error);
  }
}

function readCachedSettings() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Only accept cached settings if they match the currently resolved companyId
    const resolved = resolveCompanyId();
    if (parsed && parsed.companyId && parsed.companyId !== resolved) {
      // cache is from a different company — ignore to avoid data leakage
      return null;
    }
    return normalizeSettings(parsed);
  } catch (error) {
    console.warn("No se pudo leer la caché de configuración", error);
    return null;
  }
}

async function loadSubscriptionFromFirestore(companyId) {
  const snap = await Funimas.database.getAtPath(
    "companies",
    companyId,
    "subscription",
    SUBSCRIPTION_DOC_ID
  );

  if (snap.exists()) {
    return normalizeSubscription({ ...snap.data(), companyId });
  }

  const defaults = normalizeSubscription({ companyId, periodKey: getCurrentPeriodKey() });

  try {
    await Funimas.database.setAtPath(
      "companies",
      companyId,
      "subscription",
      SUBSCRIPTION_DOC_ID,
      {
        ...defaults,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );
  } catch (error) {
    if (error?.code === "permission-denied" || String(error?.message || "").toLowerCase().includes("permission")) {
      console.warn("No autorizado para crear el documento de subscripción; usando valores por defecto localmente.", error);
      return defaults;
    }
    throw error;
  }

  return defaults;
}

async function loadSettingsFromFirestore() {
  const companyId = resolveCompanyId();
  const snap = await Funimas.database.getAtPath('companies', companyId, 'settings', 'main');

  if (snap.exists()) {
    return normalizeSettings({ ...snap.data(), companyId });
  }

  const defaults = normalizeSettings({ ...DEFAULT_SETTINGS, companyId });
  await Funimas.database.setAtPath('companies', companyId, 'settings', 'main', { ...defaults, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

  return defaults;
}

export async function getCompanySettings() {
  if (currentSettings) return currentSettings;

  if (!settingsPromise) {
    settingsPromise = (async () => {
      const cached = readCachedSettings();
      if (cached && !currentSettings) {
        currentSettings = cached;
        applyBrandingStyles(cached);
      }

      try {
        const loaded = await loadSettingsFromFirestore();
        currentSettings = loaded;
        cacheSettings(loaded);
        applyBrandingStyles(loaded);
        return loaded;
      } catch (error) {
        // If the error is permission-related, log a warning (avoid noisy error traces for unauthenticated pages)
        if (error?.code === "permission-denied" || error?.message?.toLowerCase()?.includes("permission")) {
          console.warn("No se pudo cargar la configuración de empresa (permiso denegado).", error);
        } else {
          console.error("No se pudo cargar la configuración de empresa", error);
        }

        const fallback =
          currentSettings || cached || normalizeSettings({ companyId: resolveCompanyId() });
        currentSettings = fallback;
        return fallback;
      }
    })();
  }

  return settingsPromise;
}

export async function saveCompanySettings(updates = {}) {
  const companyId = resolveCompanyId();

  await Funimas.database.updateAtPath(
    "companies",
    companyId,
    "settings",
    "main",
    { ...updates, updatedAt: serverTimestamp() }
  );

  const merged = normalizeSettings({ ...(currentSettings || DEFAULT_SETTINGS), ...updates, companyId });
  currentSettings = merged;
  cacheSettings(merged);
  applyBrandingStyles(merged);
  return merged;
}

function isDataUrl(value) {
  return typeof value === "string" && value.startsWith("data:image");
}

async function loadImageAsDataURL(url) {
  const response = await fetch(url);
  const blob = await response.blob();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function getLogoDataUrl(preferredUrl, fallbackUrl = DEFAULT_SETTINGS.logoUrl) {
  const url = preferredUrl || fallbackUrl;
  if (!url) return fallbackUrl;

  if (isDataUrl(url)) return url;

  if (logoDataCache.has(url)) return logoDataCache.get(url);

  try {
    const dataUrl = await loadImageAsDataURL(url);
    logoDataCache.set(url, dataUrl);
    return dataUrl;
  } catch (error) {
    console.warn("No se pudo cargar el logo, intentando respaldo", error);
    if (url !== fallbackUrl) {
      // intentar con el fallback (recursivamente)
      return getLogoDataUrl(fallbackUrl, fallbackUrl);
    }
    // último intento: convertir el fallback a data URL
    try {
      const dataUrlFallback = await loadImageAsDataURL(fallbackUrl);
      logoDataCache.set(fallbackUrl, dataUrlFallback);
      return dataUrlFallback;
    } catch (err2) {
      console.warn("No se pudo convertir el logo de respaldo a dataURL", err2);
      // devolver la ruta cruda como última opción (comportamiento anterior)
      return fallbackUrl;
    }
  }
}

export function formatCurrency(value, currencyCode) {
  const amount = Number(value || 0);
  const currency = currencyCode || currentSettings?.currency || DEFAULT_SETTINGS.currency;

  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 0
    }).format(amount);
  } catch (error) {
    console.warn("No se pudo formatear la moneda", error);
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export async function uploadLogoAndGetUrl(file) {
  if (!file) throw new Error("No se seleccionó ningún archivo");

  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Debes iniciar sesión para subir el logo.");

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "png";
  const storageRef = ref(
    storage,
    `users/${uid}/branding/logo-${Date.now()}.${extension}`
  );

  const metadata = {
    contentType: file.type
  };

  const uploadTask = uploadBytesResumable(storageRef, file, metadata);

  await new Promise((resolve, reject) => {
    uploadTask.on("state_changed", null, reject, resolve);
  });

  return getDownloadURL(uploadTask.snapshot.ref);
}

function applyBrandingStyles(settings) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  if (settings.primaryColor) {
    root.style.setProperty("--color-naranja", settings.primaryColor);
    root.style.setProperty("--app-accent", settings.primaryColor);
  }

  if (settings.secondaryColor) {
    root.style.setProperty("--color-naranja-oscuro", settings.secondaryColor);
    root.style.setProperty("--app-accent-strong", settings.secondaryColor);
  } else if (settings.primaryColor) {
    root.style.setProperty("--app-accent-strong", settings.primaryColor);
  }

  const logoTargets = document.querySelectorAll(
    ".logo-header, .login-logo, .legal-logo"
  );
  logoTargets.forEach((img) => {
    if (settings.logoUrl) img.src = settings.logoUrl;
    if (settings.businessName && !img.alt) {
      img.alt = settings.businessName;
    }
  });

  // Update login title if it exists
  const loginTitle = document.querySelector(".login-title");
  if (loginTitle && settings.businessName) {
    loginTitle.textContent = settings.businessName;
  }

  const currencyLabels = document.querySelectorAll("[data-currency-label]");
  currencyLabels.forEach((label) => {
    const baseText = label.getAttribute("data-currency-label");
    if (baseText) {
      label.textContent = `${baseText} (${settings.currency || DEFAULT_SETTINGS.currency})`;
    }
  });
}

export async function initializeBranding() {
  const cached = readCachedSettings();

  // If we have a safe cached copy for this company, apply it immediately
  if (cached && !currentSettings) {
    currentSettings = cached;
    applyBrandingStyles(cached);
  } else if (!cached) {
    applyBrandingStyles(DEFAULT_SETTINGS);
  }

  // Wait for auth state to be available before attempting Firestore reads
  try {
    const user = await new Promise((resolve) => {
      const off = onAuthStateChanged(auth, (u) => {
        off();
        resolve(u);
      });
      // If onAuthStateChanged doesn't fire quickly (rare), we still rely on cached/default styles
    });

    if (!user) {
      // Not authenticated: do not call Firestore to avoid permission errors
      return currentSettings || normalizeSettings({ companyId: resolveCompanyId() });
    }

    // Authenticated — fetch live settings (may still fail but will be handled in getCompanySettings)
    const loaded = await getCompanySettings();
    applyBrandingStyles(loaded);
    return loaded;
  } catch (error) {
    // Any unexpected error: keep using cached/default and don't surface noisy permission errors
    console.warn("No se pudo completar la inicialización de branding (se usará la configuración en caché o por defecto).", error);
    return currentSettings || normalizeSettings({ companyId: resolveCompanyId() });
  }
}

// Initialize subscription warmup only after we know auth state. This avoids permission errors
// when pages like /login.html call initializeBranding() without an authenticated user.
let subscriptionWarmup = null;
function initSubscriptionWarmup() {
  if (subscriptionWarmup) return subscriptionWarmup;

  subscriptionWarmup = (async () => {
    // Wait for auth state to settle
    try {
      const user = await new Promise((resolve) => {
        // If already signed in, onAuthStateChanged will invoke immediately with current user
        const off = onAuthStateChanged(auth, (u) => {
          off();
          resolve(u);
        });
      });

      if (!user) {
        // No authenticated user: return a safe default subscription (do not call Firestore)
        return normalizeSubscription({ companyId: resolveCompanyId() });
      }

      // Authenticated — proceed to initialize subscription from Firestore
      return await ensureSubscription();
    } catch (error) {
      console.warn("No se pudo precargar la suscripción", error);
      return normalizeSubscription({ companyId: resolveCompanyId(), error: true });
    }
  })();

  return subscriptionWarmup;
}

const subscriptionReady = initSubscriptionWarmup();

if (typeof window !== "undefined") {
  window.companySettingsReady = initializeBranding();
  window.subscriptionReady = subscriptionWarmup;

  window.addEventListener("DOMContentLoaded", () => {
    if (currentSettings) {
      applyBrandingStyles(currentSettings);
    }
  });
}

export { DEFAULT_SETTINGS, DEFAULT_SUBSCRIPTION, subscriptionReady };
