/**
 * KONFIGURASI APLIKASI DIGIASHA
 * Menggunakan Supabase Unified Backend (Shared Database dengan Flutter DigiCore)
 */
const CONFIG = {
  // Supabase Project URL & Anon Key
  SUPABASE_URL: "https://pqfzkizqqhmsnidocumv.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxZnpraXpxcWhtc25pZG9jdW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4Nzc2MTUsImV4cCI6MjEwNDQ1MzYxNX0.06q1t6BEk01wwQOO68hH_HtcsIdfUgbtBbcOhoXukKo",
  
  // Storage Bucket untuk Seluruh Media Bukti
  MEDIA_BUCKET: "digiasha-media",

  // Mode Database Online
  USE_ONLINE_DB: true,

  // Fallback Google Apps Script jika dibutuhkan
  API_URL: "https://script.google.com/macros/s/AKfycbzd9S7BBb4aaHWjam_EiUmupSiPGICqYwrfolLm_IpO67qt6ajdvExGB2rxQkXes9m0aw/exec"
};

// Inisialisasi Supabase JS Client Global
const supabaseClient = (window.supabase && typeof window.supabase.createClient === "function")
  ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY)
  : null;
