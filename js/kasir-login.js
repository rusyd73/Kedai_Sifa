/* ============================================================
   REQUIREMENT #3: KASIR LOGIN WITH FIREBASE VALIDATION
   Validates credentials against Firebase, checks account status
============================================================ */

async function loginKasir() {
  const nama = document.getElementById('klNama').value.trim();
  const pin = document.getElementById('klPin').value.trim();
  const errEl = document.getElementById('klErr');
  
  if (!nama || !pin) {
    errEl.textContent = 'Nama dan PIN wajib diisi';
    errEl.style.display = 'block';
    return;
  }
  
  if (pin.length < 4 || pin.length > 6) {
    errEl.textContent = 'PIN harus 4-6 digit';
    errEl.style.display = 'block';
    return;
  }
  
  errEl.style.display = 'none';
  
  const btn = event?.target;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Validasi...';
  }
  
  try {
    // Query Firestore for kasir with matching nama and PIN
    const kasirSnap = await db.collection('kasir')
      .where('nama', '==', nama)
      .where('pin', '==', pin)
      .limit(1)
      .get();
    
    if (kasirSnap.empty) {
      errEl.textContent = 'Nama atau PIN salah / akun tidak aktif';
      errEl.style.display = 'block';
      playSound('error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Masuk →';
      }
      return;
    }
    
    const kasirDoc = kasirSnap.docs[0];
    const kasirData = kasirDoc.data();
    
    // Check if account is active
    if (!kasirData.aktif) {
      errEl.textContent = 'Akun belum diaktifkan oleh Admin';
      errEl.style.display = 'block';
      playSound('error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Masuk →';
      }
      return;
    }
    
    // Store kasir info in localStorage
    localStorage.setItem('kasirId', kasirDoc.id);
    localStorage.setItem('kasirNama', kasirData.nama);
    localStorage.setItem('kasirLoginTime', new Date().toISOString());
    
    playSound('success');
    toast(`✅ Selamat datang, ${kasirData.nama}!`, 'success');
    
    // Update UI
    document.getElementById('kasirNamaInfo').textContent = kasirData.nama;
    updateKasirTime();
    
    // Load incoming orders
    loadIncomingOrders();
    
    showPage('p-kasir');
    
    // Reset form
    document.getElementById('klNama').value = '';
    document.getElementById('klPin').value = '';
    
  } catch (error) {
    const result = await handleFirebaseError(error, 'loginKasir', {nama, pin});
    
    if (result.reason === 'permission') {
      errEl.textContent = 'Akses ditolak. Hubungi Admin.';
    } else if (result.reason === 'unavailable') {
      errEl.textContent = 'Server sibuk. Coba lagi.';
    } else {
      errEl.textContent = error.message || 'Login gagal';
    }
    errEl.style.display = 'block';
    playSound('error');
    
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Masuk →';
    }
  }
}

function updateKasirTime() {
  const loginTime = localStorage.getItem('kasirLoginTime');
  if (loginTime) {
    const time = new Date(loginTime).toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'});
    const jamEl = document.getElementById('kasirJamInfo');
    if (jamEl) {
      jamEl.textContent = `Login: ${time}`;
    }
  }
}

function logoutKasir() {
  if (!confirm('Yakin selesai shift?')) return;
  
  try {
    // Cleanup
    cleanupScanner?.();
    
    // Clear localStorage
    localStorage.removeItem('kasirId');
    localStorage.removeItem('kasirNama');
    localStorage.removeItem('kasirLoginTime');
    
    // Reset form
    resetKasirForm();
    
    toast('✅ Shift berakhir', 'success');
    showPage('p-home');
  } catch (e) {
    console.error('Logout error:', e);
  }
}

function isKasirLoggedIn() {
  return !!localStorage.getItem('kasirId');
}

// Protect kasir page
function checkKasirAuth() {
  if (!isKasirLoggedIn()) {
    showPage('p-kasirlogin');
    toast('⚠️ Silakan login terlebih dahulu', 'error');
    return false;
  }
  return true;
}
