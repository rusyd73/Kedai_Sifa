/* ============================================================
   REQUIREMENTS #6 & #7: SECURITY & FORM VALIDATION UTILITIES
   Firebase security rules, credential protection, input validation
============================================================ */

/* ============================================================
   FIREBASE SECURITY RULES (Firestore)
   Place this in Firebase Console → Firestore → Rules tab
============================================================

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Public menu (read-only)
    match /menu/{document=**} {
      allow read;
    }
    
    // Customer orders (anyone can create, only owner can read)
    match /pesanan/{document=**} {
      allow create: if true;
      allow read, update: if resource.data.hp == request.auth.token.phone || 
                           request.auth.token.role == 'admin';
      allow delete: if request.auth.token.role == 'admin';
    }
    
    // Kasir accounts (admin only)
    match /kasir/{document=**} {
      allow read, write: if request.auth.token.role == 'admin';
    }
    
    // Pengantar accounts
    match /pengantar/{document=**} {
      allow create: if true;
      allow read, update, delete: if request.auth.token.role == 'admin' || 
                                     resource.data.hp == request.auth.token.phone;
    }
    
    // Admin collection
    match /admin/{document=**} {
      allow read, write: if request.auth.token.role == 'admin';
    }
    
    // Mode tracking (pengantar GPS)
    match /tracking/{document=**} {
      allow read, write: if request.auth.token.hp == resource.data.hp || 
                           request.auth.token.role == 'admin';
    }
  }
}

============================================================ */

/* ============================================================
   VALIDATION UTILITIES
============================================================ */

// Phone number validation (Indonesian format)
function validatePhoneNumber(hp) {
  const cleaned = hp.replace(/\D/g, '');
  // Must start with 62 and be 11-13 digits total
  return /^62[0-9]{9,11}$/.test(cleaned);
}

// Normalize phone number to standard format (62xxxxxxxxxx)
function normalizePhoneNumber(hp) {
  let cleaned = hp.replace(/\D/g, '');
  
  // Convert 0 prefix to 62
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }
  
  // Ensure it starts with 62
  if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  
  return cleaned;
}

// Email validation
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Validate form fields
function validateForm(fieldMap) {
  /*
    fieldMap = {
      'inputId': { 
        value: 'value to validate',
        type: 'text|phone|email|number|required',
        label: 'Display name for error message'
      }
    }
  */
  
  for (let [id, config] of Object.entries(fieldMap)) {
    const { value, type, label, min, max } = config;
    
    if (type === 'required' && !value.trim()) {
      toast(`⚠️ ${label} wajib diisi`, 'error');
      return false;
    }
    
    if (value && type === 'phone' && !validatePhoneNumber(value)) {
      toast(`⚠️ ${label} format salah (gunakan 0 atau 62)`, 'error');
      return false;
    }
    
    if (value && type === 'email' && !validateEmail(value)) {
      toast(`⚠️ ${label} bukan email valid`, 'error');
      return false;
    }
    
    if (type === 'number') {
      const num = parseInt(value);
      if (isNaN(num)) {
        toast(`⚠️ ${label} harus angka`, 'error');
        return false;
      }
      if (min && num < min) {
        toast(`⚠️ ${label} minimal ${min}`, 'error');
        return false;
      }
      if (max && num > max) {
        toast(`⚠️ ${label} maksimal ${max}`, 'error');
        return false;
      }
    }
  }
  
  return true;
}

// Safe text sanitization (prevent XSS)
function sanitizeText(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Generate order number
function generateOrderNumber() {
  const prefix = 'WC';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.random().toString(36).substr(2, 5).toUpperCase();
  return `${prefix}-${timestamp}${random}`;
}

// Check network status
function isOnline() {
  return navigator.onLine;
}

// Store data safely in localStorage
function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn('LocalStorage error:', e);
    return false;
  }
}

function safeStorageGet(key) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    console.warn('LocalStorage parse error:', e);
    return null;
  }
}

/* ============================================================
   SECURITY BEST PRACTICES
============================================================ */

// Prevent sensitive data in console
function secureLogs() {
  // Disable console in production
  if (window.location.hostname !== 'localhost') {
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};
  }
}

// Disable developer tools shortcuts (basic)
document.addEventListener('keydown', (e) => {
  // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
  if (
    e.key === 'F12' ||
    (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C'))
  ) {
    e.preventDefault();
  }
});

// Content Security Policy headers (should be set server-side, not in JS)
// But JavaScript can verify:
function verifyCSP() {
  const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (!meta) {
    console.warn('⚠️ Content-Security-Policy header not set');
  }
}

// Session security
function secureSession() {
  // Regenerate session on sensitive operations
  const sessionId = 'session_' + Date.now() + '_' + Math.random();
  sessionStorage.setItem('sessionId', sessionId);
  
  // Warn on tab change
  window.addEventListener('beforeunload', (e) => {
    const kasirId = localStorage.getItem('kasirId');
    const adminId = localStorage.getItem('adminId');
    
    if (kasirId || adminId) {
      e.preventDefault();
      e.returnValue = 'Anda masih login. Yakin ingin pergi?';
    }
  });
}

// Rate limiting for API calls
const rateLimitMap = new Map();

function checkRateLimit(key, maxAttempts = 5, windowMs = 60000) {
  const now = Date.now();
  const record = rateLimitMap.get(key) || { attempts: 0, firstAttempt: now };
  
  // Reset if window expired
  if (now - record.firstAttempt > windowMs) {
    rateLimitMap.set(key, { attempts: 1, firstAttempt: now });
    return true;
  }
  
  // Check limit
  if (record.attempts >= maxAttempts) {
    console.warn(`Rate limit exceeded for ${key}`);
    return false;
  }
  
  // Increment
  record.attempts++;
  rateLimitMap.set(key, record);
  return true;
}

// Usage example:
// if (!checkRateLimit('login', 5, 300000)) {
//   toast('Terlalu banyak percobaan login. Coba lagi 5 menit.', 'error');
//   return;
// }

/* ============================================================
   ENCRYPTION UTILITY (for sensitive fields)
   Uses simple base64 (for production, use proper encryption library)
============================================================ */

function encryptData(data) {
  try {
    return btoa(JSON.stringify(data));
  } catch (e) {
    console.error('Encrypt error:', e);
    return null;
  }
}

function decryptData(encrypted) {
  try {
    return JSON.parse(atob(encrypted));
  } catch (e) {
    console.error('Decrypt error:', e);
    return null;
  }
}

/* ============================================================
   API CALL WRAPPER WITH ERROR HANDLING
============================================================ */

async function safeApiCall(fn, context, fallbackData = null) {
  try {
    // Check rate limit
    if (!checkRateLimit(context, 10, 60000)) {
      toast('⚠️ Terlalu banyak permintaan. Coba lagi nanti.', 'error');
      return { success: false, reason: 'rateLimit' };
    }
    
    return await fn();
    
  } catch (error) {
    const result = await handleFirebaseError(error, context, fallbackData);
    return result;
  }
}

/* ============================================================
   LOGOUT UTILITIES (cleanup across all roles)
============================================================ */

function logoutAll() {
  // Clear all session data
  localStorage.removeItem('kasirId');
  localStorage.removeItem('adminId');
  localStorage.removeItem('modeHp');
  localStorage.removeItem('kasirNama');
  localStorage.removeItem('adminUsername');
  
  sessionStorage.clear();
  
  // Cleanup resources
  cleanupScanner?.();
  hentiTracking?.();
  
  // Force return to home
  showPage('p-home');
  toast('✅ Semua session dihapus', 'success');
}

// Auto logout on inactivity (30 minutes)
let inactivityTimer;

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  
  if (localStorage.getItem('kasirId') || localStorage.getItem('adminId')) {
    inactivityTimer = setTimeout(() => {
      toast('⚠️ Session expired karena tidak aktif', 'info');
      logoutAll();
    }, 30 * 60 * 1000); // 30 minutes
  }
}

document.addEventListener('mousemove', resetInactivityTimer);
document.addEventListener('keypress', resetInactivityTimer);
document.addEventListener('click', resetInactivityTimer);
document.addEventListener('scroll', resetInactivityTimer);

// Initialize on page load
window.addEventListener('load', () => {
  secureLogs();
  verifyCSP();
  secureSession();
  resetInactivityTimer();
});
