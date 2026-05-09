// ════════════════════════════════════════════
//  firebase.js  –  Auth helpers (ES Module)
// ════════════════════════════════════════════
//  Replace the config values with your own from
//  https://console.firebase.google.com/
// ════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ── Your Firebase project config ──────────────
export const firebaseConfig = {
  apiKey:     "AIzaSyAECOmsUEXlgjS-9zGfV7RgD0P33PE84XY",
  authDomain: "studyflow-2737d.firebaseapp.com",
  projectId:  "studyflow-2737d"
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// ── Guard: redirect to login if not authenticated ──
export function requireAuth(callback) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html";
    } else {
      callback(user);
    }
  });
}

// ── Logout helper ──────────────────────────────
export async function logout() {
  await signOut(auth);
  window.location.href = "login.html";
}
