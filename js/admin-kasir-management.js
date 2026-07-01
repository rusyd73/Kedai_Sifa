/* ============================================================
   REQUIREMENT #5: ADMIN KASIR MANAGEMENT
   Add/remove kasir accounts, manage deposits, view status
============================================================ */

async function loginAdmin() {
  const user = document.getElementById('aUser').value.trim();
  const pass = document.getElementById('aPass').value.trim();
  const errEl = document.getElementById('aErr');
  
  if (!user || !pass) {
    errEl.textContent = 'Username dan password wajib diisi';
    errEl.style.display = 'block';
    return;
  }
  
  errEl.style.display = 'none';
  const btn = event?.target;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Verifikasi...';
  }
  
  try {
    // Query admin credentials from Firestore
    const adminSnap = await db.collection('admin')
      .where('username', '==', user)
      .limit(1)
      .get();
    
    if (adminSnap.empty) {
      errEl.textContent = 'Username atau password salah';
      errEl.style.display = 'block';
      playSound('error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Masuk →';
      }
      return;
    }
    
    const adminDoc = adminSnap.docs[0];
    const adminData = adminDoc.data();
    
    // Simple password check (in production, use proper hashing)
    if (adminData.password !== pass) {
      errEl.textContent = 'Username atau password salah';
      errEl.style.display = 'block';
      playSound('error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Masuk →';
      }
      return;
    }
    
    // Store admin session
    localStorage.setItem('adminId', adminDoc.id);
    localStorage.setItem('adminUsername', adminData.username);
    localStorage.setItem('adminLoginTime', new Date().toISOString());
    
    playSound('success');
    toast(`✅ Selamat datang, Admin ${adminData.username}!`, 'success');
    
    // Load dashboard data
    loadAdminDashboard();
    showPage('p-admin');
    
    // Reset form
    document.getElementById('aUser').value = '';
    document.getElementById('aPass').value = '';
    
  } catch (error) {
    await handleFirebaseError(error, 'loginAdmin');
    errEl.textContent = 'Login gagal. Coba lagi.';
    errEl.style.display = 'block';
    playSound('error');
    
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Masuk →';
    }
  }
}

function logoutAdmin() {
  if (!confirm('Yakin logout?')) return;
  
  localStorage.removeItem('adminId');
  localStorage.removeItem('adminUsername');
  localStorage.removeItem('adminLoginTime');
  
  toast('✅ Logout berhasil', 'success');
  showPage('p-home');
}

function isAdminLoggedIn() {
  return !!localStorage.getItem('adminId');
}

async function loadAdminDashboard() {
  if (!isAdminLoggedIn()) {
    showPage('p-adminlogin');
    return;
  }
  
  try {
    // Load statistics
    await loadAdminStats();
    
    // Load initial tab (riwayat)
    adminTab('riwayat');
    
  } catch (e) {
    console.error('Dashboard load error:', e);
  }
}

async function loadAdminStats() {
  try {
    // Get all orders
    const pesananSnap = await db.collection('pesanan').get();
    let totalOrder = pesananSnap.size;
    let totalUang = 0;
    let totalFee = 0;
    let totalTip = 0;
    
    pesananSnap.forEach(doc => {
      const p = doc.data();
      totalUang += p.total || 0;
      totalFee += p.platformFee || 0;
      totalTip += p.tip || 0;
    });
    
    document.getElementById('aTotalOrder').textContent = totalOrder;
    document.getElementById('aTotalUang').textContent = rp(totalUang);
    document.getElementById('aTotalFee').textContent = rp(totalFee);
    document.getElementById('aTotalTip').textContent = rp(totalTip);
    
  } catch (e) {
    console.error('Stats load error:', e);
  }
}

function adminTab(tab) {
  const tabs = ['riwayat', 'pesanan', 'pengantar', 'kasir'];
  const panels = tabs.map(t => `aPanel${t.charAt(0).toUpperCase() + t.slice(1)}`);
  const buttons = tabs.map(t => `aTab${(tabs.indexOf(t) + 1)}`);
  
  // Hide all panels
  panels.forEach(p => document.getElementById(p).classList.add('hidden'));
  buttons.forEach(b => document.getElementById(b).classList.remove('active'));
  
  // Show selected panel
  const panelId = `aPanel${tab.charAt(0).toUpperCase() + tab.slice(1)}`;
  const buttonId = `aTab${(tabs.indexOf(tab) + 1)}`;
  
  document.getElementById(panelId).classList.remove('hidden');
  document.getElementById(buttonId).classList.add('active');
  
  // Load content
  if (tab === 'riwayat') loadRiwayatPesanan();
  else if (tab === 'pesanan') loadPesananOnline();
  else if (tab === 'pengantar') loadPengantarList();
  else if (tab === 'kasir') loadKasirList();
}

async function loadRiwayatPesanan() {
  try {
    const snap = await db.collection('pesanan')
      .orderBy('tglOrder', 'desc')
      .limit(50)
      .get();
    
    let html = '';
    snap.forEach(doc => {
      const p = doc.data();
      html += `<div class="riwayat-item">
        <b>${p.noOrder || doc.id.slice(0, 8)}</b><br>
        <small>${p.nama} • ${rp(p.total)}</small><br>
        <small style="color:#888">${new Date(p.tglOrder?.toDate?.()).toLocaleDateString('id-ID')}</small>
      </div>`;
    });
    
    document.getElementById('aRiwayatList').innerHTML = html || '<p class="muted">Belum ada pesanan</p>';
    
  } catch (e) {
    console.error('Load riwayat error:', e);
    document.getElementById('aRiwayatList').innerHTML = '<p class="muted">Error loading data</p>';
  }
}

async function loadPesananOnline() {
  try {
    const snap = await db.collection('pesanan')
      .where('status', '!=', 'selesai')
      .orderBy('status')
      .orderBy('tglOrder', 'desc')
      .limit(30)
      .get();
    
    let html = '';
    snap.forEach(doc => {
      const p = doc.data();
      html += `<div class="riwayat-item">
        <b>${p.noOrder || doc.id.slice(0, 8)}</b> 
        <span class="status-badge ${getStatusClass(p.status)}">${p.status}</span><br>
        <small>${p.nama} • ${rp(p.total)}</small><br>
        <small style="color:#888">${p.hp || '-'}</small>
      </div>`;
    });
    
    document.getElementById('aPesananList').innerHTML = html || '<p class="muted">Tidak ada pesanan aktif</p>';
    
  } catch (e) {
    console.error('Load pesanan online error:', e);
    document.getElementById('aPesananList').innerHTML = '<p class="muted">Error loading data</p>';
  }
}

async function loadPengantarList() {
  try {
    const snap = await db.collection('pengantar')
      .orderBy('tglDaftar', 'desc')
      .limit(50)
      .get();
    
    let html = '';
    snap.forEach(doc => {
      const p = doc.data();
      const statusColor = p.status === 'approved' ? '#28a745' : p.status === 'rejected' ? '#c62828' : '#ff9f43';
      html += `<div class="riwayat-item">
        <b>${p.nama}</b> <span style="color:${statusColor};font-size:12px">● ${p.status}</span><br>
        <small>${p.hp} • ${p.kendaraan} (${p.plat})</small><br>
        <small style="color:#888">Deposit: ${rp(p.deposit)}</small>
      </div>`;
    });
    
    document.getElementById('aPengantarList').innerHTML = html || '<p class="muted">Belum ada pendaftar</p>';
    
  } catch (e) {
    console.error('Load pengantar error:', e);
    document.getElementById('aPengantarList').innerHTML = '<p class="muted">Error loading data</p>';
  }
}

async function loadKasirList() {
  try {
    const snap = await db.collection('kasir').orderBy('tglTambah', 'desc').get();
    
    let html = '';
    snap.forEach(doc => {
      const k = doc.data();
      const statusBg = k.aktif ? '#d4edda' : '#f8d7da';
      const statusColor = k.aktif ? '#155724' : '#721c24';
      
      html += `<div class="kasir-account">
        <div>
          <b>${k.nama}</b><br>
          <small style="color:${statusColor};background:${statusBg};padding:2px 6px;border-radius:4px;display:inline-block;margin-top:4px">
            ${k.aktif ? '✅ Aktif' : '⛔ Nonaktif'}
          </small>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-gray" style="width:auto;font-size:12px;padding:6px 10px" onclick="toggleKasirStatus('${doc.id}',${!k.aktif})">
            ${k.aktif ? '🔒 Nonaktifkan' : '🔓 Aktifkan'}
          </button>
          <button class="btn btn-red" style="width:auto;font-size:12px;padding:6px 10px" onclick="hapusKasir('${doc.id}')">
            🗑 Hapus
          </button>
        </div>
      </div>`;
    });
    
    document.getElementById('aKasirList').innerHTML = html || '<p class="muted">Belum ada kasir</p>';
    
  } catch (e) {
    console.error('Load kasir list error:', e);
    document.getElementById('aKasirList').innerHTML = '<p class="muted">Error loading data</p>';
  }
}

async function tambahKasir() {
  const nama = document.getElementById('aKasirNamaBaru').value.trim();
  const pin = document.getElementById('aKasirPinBaru').value.trim();
  
  if (!nama || !pin) {
    toast('⚠️ Nama dan PIN wajib diisi', 'error');
    return;
  }
  
  if (pin.length < 4 || pin.length > 6) {
    toast('⚠️ PIN harus 4-6 digit', 'error');
    return;
  }
  
  try {
    await db.collection('kasir').add({
      nama,
      pin,
      aktif: true,
      tglTambah: new Date(),
      deposit: 0
    });
    
    playSound('success');
    toast(`✅ Kasir "${nama}" berhasil ditambahkan`, 'success');
    
    // Clear inputs
    document.getElementById('aKasirNamaBaru').value = '';
    document.getElementById('aKasirPinBaru').value = '';
    
    // Reload list
    loadKasirList();
    
  } catch (error) {
    await handleFirebaseError(error, 'tambahKasir');
    toast('❌ Gagal tambah kasir', 'error');
  }
}

async function hapusKasir(kasirId) {
  if (!confirm('⚠️ Yakin hapus kasir ini? Data tidak bisa dikembalikan.')) return;
  
  try {
    await db.collection('kasir').doc(kasirId).delete();
    playSound('success');
    toast('✅ Kasir dihapus', 'success');
    loadKasirList();
  } catch (error) {
    await handleFirebaseError(error, 'hapusKasir');
    toast('❌ Gagal hapus kasir', 'error');
  }
}

async function toggleKasirStatus(kasirId, aktif) {
  try {
    await db.collection('kasir').doc(kasirId).update({
      aktif: aktif
    });
    
    playSound('success');
    toast(aktif ? '✅ Kasir diaktifkan' : '✅ Kasir dinonaktifkan', 'success');
    loadKasirList();
    
  } catch (error) {
    await handleFirebaseError(error, 'toggleKasirStatus');
    toast('❌ Gagal update status', 'error');
  }
}

function getStatusClass(status) {
  const classes = {
    'menunggu': 'sb-menunggu',
    'diproses': 'sb-diproses',
    'dikirim': 'sb-dikirim',
    'selesai': 'sb-selesai'
  };
  return classes[status] || 'sb-menunggu';
}

async function hapusRiwayat() {
  if (!confirm('⚠️ Hapus SEMUA riwayat pesanan? Ini tidak bisa dibatalkan!')) return;
  
  try {
    const snap = await db.collection('pesanan').get();
    const batch = db.batch();
    
    snap.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    playSound('success');
    toast('✅ Riwayat dihapus', 'success');
    loadRiwayatPesanan();
    
  } catch (error) {
    await handleFirebaseError(error, 'hapusRiwayat');
    toast('❌ Gagal hapus riwayat', 'error');
  }
}
