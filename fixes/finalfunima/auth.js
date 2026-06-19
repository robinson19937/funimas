import {
  auth,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
  serverTimestamp,
  signInWithEmailAndPassword,
  signOut
} from "./firebase.js";

import { Funimas } from "../sdk/index.js";
import { resolveCompanyId } from "./companySettings.js";
import { PRODUCTION_LOGIN_URL, PRODUCTION_ORIGIN } from "./productionOrigin.js";

/* ============================================
   LOGIN
   ============================================ */
const COMPANY_KEY = "app:company-id";

const loginBtn = document.getElementById("loginBtn");
const toggleAuthModeBtn = document.getElementById("toggleAuthMode");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const companyNameInput = document.getElementById("companyName");
const loginError = document.getElementById("loginError");
const loginMessage = document.getElementById("loginMessage");
const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
const forgotPasswordRow = document.getElementById("forgotPasswordRow");
const loginTitle = document.querySelector(".login-title");
const loginSubtitle = document.querySelector(".login-subtitle");

let authMode = "login";

async function bootstrapMissingCompanyData({ uid, email }) {
  // If Firestore collections (users/companies) were deleted, recover a minimal tenant setup.
  // Note: Storage still requires custom claims (set via Admin SDK script), this only recreates Firestore docs.
  const timestamp = serverTimestamp();
  const companyId = resolveCompanyId();

  const [userSnap, companySnap] = await Promise.all([Funimas.database.get('users', uid), Funimas.database.get('companies', companyId)]);

  if (!userSnap.exists()) {
    // Our rules only allow creating users/{uid} when the target company doc does NOT exist.
    if (companySnap.exists()) {
      throw new Error(
        "Tu perfil de usuario fue borrado, pero la empresa ya existe. Por seguridad, las reglas no permiten recrear el perfil automáticamente. Contacta al soporte o recrea la empresa desde 'Crear cuenta'."
      );
    }

    const safeEmail = (email || "").trim();
    if (!safeEmail) {
      throw new Error("No se pudo recuperar el correo del usuario para recrear la configuración.");
    }

    await Funimas.database.set('users', uid, {
      email: safeEmail,
      companyId,
      createdAt: timestamp
    });
  }

  if (!companySnap.exists()) {
    await Funimas.database.set('companies', companyId, {
      name: "Mi empresa",
      ownerUid: uid,
      createdAt: timestamp
    });

    await Funimas.database.setAtPath('companies', companyId, 'settings', 'main', {
      businessName: "Mi empresa",
      logoUrl: "/assets/img/logo.png",
      primaryColor: "#E58E26",
      secondaryColor: "#C67010",
      phone: "",
      whatsapp: "",
      email: safeEmail || "contacto@suempresa.com",
      pdfFooter: "Documento generado automáticamente – No requiere firma física",
      currency: "COP",
      companyId,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  try {
    localStorage.setItem(COMPANY_KEY, companyId);
  } catch (error) {
    console.warn("No se pudo guardar el companyId en localStorage", error);
  }

  return companyId;
}

async function cacheCompanyId(uid, fallback) {
  if (!uid) return fallback || null;

  try {
    const snap = await Funimas.database.get('users', uid);
    const companyId = snap.data()?.companyId || fallback || resolveCompanyId();

    if (companyId) {
      localStorage.setItem(COMPANY_KEY, companyId);
    }

    return companyId || null;
  } catch (error) {
    console.warn("No se pudo guardar el companyId en localStorage", error);
    return fallback || null;
  }
}

function normalizeCompanyId(name, uid) {
  const uniqueSuffix = uid ? uid.slice(0, 8) : Date.now().toString(36);
  const cleanedName = (name || "").toLowerCase().trim();
  const base = cleanedName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  // Always append uid suffix so two signups with the same business name
  // do not collide on companies/{companyId} (Firestore rules reject that).
  if (base) return `${base.slice(0, 31)}-${uniqueSuffix}`;
  return `company-${uniqueSuffix}`;
}

function setLoading(isLoading) {
  if (!loginBtn) return;
  loginBtn.disabled = isLoading;
  const loadingText = authMode === "login" ? "Ingresando..." : "Creando cuenta...";
  const defaultText = authMode === "login" ? "Ingresar" : "Crear cuenta";
  loginBtn.textContent = isLoading ? loadingText : defaultText;
}

function setAuthMode(mode) {
  authMode = mode;
  const isRegister = mode === "register";

  confirmPasswordInput?.classList.toggle("hidden", !isRegister);
  companyNameInput?.classList.toggle("hidden", !isRegister);

  if (loginTitle) {
    loginTitle.textContent = isRegister ? "Crear cuenta" : "Bienvenido";
  }

  if (loginSubtitle) {
    loginSubtitle.textContent = isRegister
      ? "Crea tu cuenta para empezar"
      : "Accede para continuar";
  }

  if (passwordInput) {
    passwordInput.autocomplete = isRegister ? "new-password" : "current-password";
  }

  if (toggleAuthModeBtn) {
    toggleAuthModeBtn.textContent = isRegister ? "Ya tengo cuenta" : "Crear cuenta";
  }

  if (loginBtn) {
    loginBtn.textContent = isRegister ? "Crear cuenta" : "Ingresar";
  }

  if (loginError) {
    loginError.textContent = "";
  }

  if (loginMessage) {
    loginMessage.textContent = "";
  }

  forgotPasswordRow?.classList.toggle("hidden", isRegister);
}

function setForgotPasswordLoading(isLoading) {
  if (!forgotPasswordBtn) return;
  forgotPasswordBtn.disabled = isLoading;
  forgotPasswordBtn.textContent = isLoading ? "Enviando..." : "Restablecer";
}

function getFriendlyResetError(error) {
  const code = error?.code || "";

  if (code === "auth/invalid-email") return "Ingresa un correo válido.";
  if (code === "auth/too-many-requests") return "Demasiados intentos. Intenta de nuevo más tarde.";

  // Avoid account enumeration; keep generic for the rest (including auth/user-not-found)
  return "Si el correo está registrado, recibirás un enlace para restablecer la contraseña.";
}

function getPasswordResetContinueUrl() {
  const origin = window.location.origin;
  const isHttpOrigin = origin.startsWith("https://") || origin.startsWith("http://");

  // PWABuilder / MS Store apps may run under non-http(s) origins (e.g. ms-appx-web://).
  // Firebase rejects those as continue URLs, so fall back to the production hosted URL.
  if (!isHttpOrigin) {
    return PRODUCTION_LOGIN_URL;
  }

  // In local dev, keep the flow working by returning to the production login.
  // (Optionally, allowlist localhost in Firebase Auth if you want local end-to-end.)
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return PRODUCTION_LOGIN_URL;
  }

  return new URL("/login.html", origin).toString();
}

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const email = emailInput?.value.trim();
    const password = passwordInput?.value.trim();
    const confirmPassword = confirmPasswordInput?.value.trim();
    const companyName = companyNameInput?.value.trim();

    if (loginError) {
      loginError.textContent = "";
    }

    if (loginMessage) {
      loginMessage.textContent = "";
    }

    if (!email || !password || (authMode === "register" && !confirmPassword)) {
      if (loginError) {
        loginError.textContent = "Completa todos los campos.";
      }
      return;
    }

    if (authMode === "register" && password.length < 6) {
      if (loginError) {
        loginError.textContent = "La contraseña debe tener al menos 6 caracteres.";
      }
      return;
    }

    if (authMode === "register" && password !== confirmPassword) {
      if (loginError) {
        loginError.textContent = "Las contraseñas no coinciden.";
      }
      return;
    }

    try {
      setLoading(true);
      if (authMode === "login") {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        // If users/companies were deleted, recreate minimal docs so the app can work again.
        try {
          await bootstrapMissingCompanyData({
            uid: userCredential.user?.uid,
            email: userCredential.user?.email || email
          });
        } catch (bootstrapError) {
          console.warn("No se pudo recrear la configuración automáticamente", bootstrapError);
        }

        await cacheCompanyId(userCredential.user?.uid);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        const companyId = normalizeCompanyId(companyName, uid);
        const businessName = companyName || "Mi empresa";
        const timestamp = serverTimestamp();

        await Funimas.database.set('users', uid, {
          companyId,
          email,
          createdAt: timestamp
        });

        await Funimas.database.set('companies', companyId, {
          name: businessName,
          ownerUid: uid,
          createdAt: timestamp
        });

        await Funimas.database.setAtPath('companies', companyId, 'settings', 'main', {
          businessName,
          logoUrl: "/assets/img/logo.png",
          primaryColor: "#E58E26",
          secondaryColor: "#C67010",
          phone: "",
          whatsapp: "",
          email,
          pdfFooter: "Documento generado automáticamente – No requiere firma física",
          currency: "COP",
          companyId,
          createdAt: timestamp,
          updatedAt: timestamp
        });

        try {
          localStorage.setItem(COMPANY_KEY, companyId);
        } catch (error) {
          console.warn("No se pudo guardar el companyId en localStorage", error);
        }

        await cacheCompanyId(uid, companyId);
      }

      window.location.href = "./index.html";
    } catch (error) {
      console.error("Error de autenticación:", error);

      if (authMode === "register" && auth.currentUser) {
        try {
          await deleteUser(auth.currentUser);
        } catch (rollbackError) {
          console.warn("No se pudo revertir el usuario de Auth tras fallo de registro", rollbackError);
        }
      }

      if (loginError) {
        loginError.textContent = getFriendlyAuthError(error);
      }
    } finally {
      setLoading(false);
    }
  });
}

if (forgotPasswordBtn) {
  forgotPasswordBtn.addEventListener("click", async () => {
    const email = emailInput?.value.trim();

    if (loginError) {
      loginError.textContent = "";
    }

    if (loginMessage) {
      loginMessage.textContent = "";
    }

    if (!email) {
      if (loginError) {
        loginError.textContent = "Escribe tu correo para restablecer la contraseña.";
      }
      return;
    }

    try {
      setForgotPasswordLoading(true);
      const actionCodeSettings = {
        url: getPasswordResetContinueUrl(),
        handleCodeInApp: false
      };

      await sendPasswordResetEmail(auth, email, actionCodeSettings);

      if (loginMessage) {
        loginMessage.textContent =
          "Si el correo está registrado, recibirás un enlace para restablecer la contraseña.";
      }
    } catch (error) {
      console.error("Error al enviar correo de restablecimiento:", error);
      const message = getFriendlyResetError(error);
      if (error?.code === "auth/invalid-email") {
        if (loginError) loginError.textContent = message;
      } else {
        if (loginMessage) loginMessage.textContent = message;
      }
    } finally {
      setForgotPasswordLoading(false);
    }
  });
}

if (toggleAuthModeBtn) {
  toggleAuthModeBtn.addEventListener("click", () => {
    const nextMode = authMode === "login" ? "register" : "login";
    setAuthMode(nextMode);
  });
}

if (loginBtn) {
  setAuthMode("login");
}

function getFriendlyAuthError(error) {
  const code = error?.code || "";
  const message = (error?.message || "").toLowerCase();

  if (authMode === "register") {
    if (code === "auth/email-already-in-use") {
      return "Este correo ya está registrado. Si falló un intento anterior, usa «Restablecer» o prueba otro correo.";
    }
    if (code === "auth/invalid-email") return "Ingresa un correo válido.";
    if (code === "auth/weak-password") return "Usa una contraseña más segura.";
    if (code === "auth/operation-not-allowed") {
      return "El registro con correo no está habilitado. Contacta a soporte.";
    }
    if (code === "auth/unauthorized-domain") {
      return `Este dominio no está autorizado para registrarse. Usa ${PRODUCTION_ORIGIN}`;
    }
    if (code === "permission-denied" || message.includes("insufficient permissions")) {
      return "No se pudo guardar la empresa en la base de datos. Prueba otro nombre de empresa o contacta soporte.";
    }
    if (message.includes("perfil de usuario fue borrado")) {
      return error.message;
    }
    return "No se pudo crear la cuenta. Intenta nuevamente.";
  }

  if (code === "auth/invalid-credential") return "Correo o contraseña incorrectos.";
  if (code === "auth/invalid-email") return "Ingresa un correo válido.";
  return "Correo o contraseña incorrectos.";
}

/* ============================================
   PROTEGER PÁGINAS INTERNAS
   ============================================ */
const privatePages = [
  "/",
  "/index.html",
  "/galeria/index.html",
  "/galeria/categoria.html",
  "/galeria/subir.html",
  "/cotizaciones/index.html",
  "/cotizaciones/nueva.html",
  "/cotizaciones/pdf.html",
  "/recibos/index.html",
  "/recibos/nuevo.html",
  "/recibos/pdf.html",
  "/notas/index.html",
  "/notas/nueva.html",
  "/notas/pdf.html",
  "/varios/index.html",
  "/varios/nuevo.html",
  "/varios/pdf.html",
  "/telemetria/index.html",
  "/configuracion/index.html"
];

// Normalize paths so "/" and directory routes ("/galeria/") map to their index.html
let currentPage = window.location.pathname;
if (currentPage.endsWith("/")) {
  currentPage = currentPage === "/" ? "/index.html" : currentPage + "index.html";
}

onAuthStateChanged(auth, (user) => {
  if (!user && privatePages.includes(currentPage)) {
    window.location.href = "/login.html";
  }
});

/* ============================================
   CERRAR SESIÓN — función global
   ============================================ */
async function logout() {
  await signOut(auth);
  window.location.href = "/login.html";
}

window.logout = logout;

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  logout().catch((error) => console.error("Error al cerrar sesión", error));
});
