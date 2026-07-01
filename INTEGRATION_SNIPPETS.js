/* ============================================================
   INTEGRATION SNIPPETS FOR MAIN HTML FILE
   Copy these into your existing kedai-sifa-v3.html
============================================================ */

// 1. ADD TO CUSTOMER ORDER SUBMISSION (submitPesananCustomer function)
// Replace or enhance existing submitPesananCustomer():

async function submitPesananCustomer() {
  // Validate inputs
  const nama = document.getElementById('cNama').value.trim();
  const hp = document.getElementById('cHp').value.trim();
  
  if (!validateForm({
    'cNama': { value: nama, type: 'required', label: 'Nama' },
    'cHp': { value: hp, type: 'phone', label: 'No. WhatsApp' }
  })) return;
  
  // Build cart items
  let items = [];
  let subtotal = 0;
  menu.forEach(m => {
    const q = jumlah[m.nama] || 0;
    if (q > 0) {
      const subHarga = m.harga * q;
      items.push({
        nama: m.nama,
        harga: m.harga,
        qty: q,
        subtotal: subHarga
      });
      subtotal += subHarga;
    }
  });
  
  if (!items.length) {
    toast('⚠️ Pilih minimal 1 menu', 'error');
    return;
  }
  
  const isAntar = document.getElementById('cJenis').value === 'Antar';
  const oFinal = isAntar ? cOngkir : 0;
  const fee = isAntar ? hitungPlatformFee(subtotal + oFinal) : 0;
  const total = subtotal + oFinal + fee;
  
  const pesanan = {
    nama,
    hp: normalizePhoneNumber(hp),
    jenis: document.getElementById('cJenis').value,
    bayar: document.getElementById('cBayar').value,
    items,
    subtotal,
    ongkir: oFinal,
    platformFee: fee,
    total,
    catatan: document.getElementById('cCatatan').value,
    alamat: document.getElementById('cAlamatTerdeteksi')?.textContent || '',
    tglOrder: new Date(),
    noOrder: generateOrderNumber(),
    status: 'menunggu'
  };
  
  const btn = event?.target;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Mengirim...';
  }
  
  try {
    toast('📤 Mengirim pesanan...', 'info');
    
    // Try Firebase first
    await db.collection('pesanan').add(pesanan);
    
    playSound('success');
    toast('✅ Pesanan berhasil dikirim!', 'success');
    
    // Clear form
    resetCartForm();
    cTab('menu');
    
  } catch (error) {
    // Firebase failed - use WhatsApp fallback
    const result = await handleFirebaseError(error, 'submitPesananCustomer', pesanan);
    
    if (result.fallback) {
      toast('📲 Pesanan dikirim via WhatsApp', 'info');
      resetCartForm();
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '📨 Kirim Pesanan';
    }
  }
}

function resetCartForm() {
  document.getElementById('cNama').value = '';
  document.getElementById('cHp').value = '';
  document.getElementById('cJenis').value = 'Bungkus';
  document.getElementById('cBayar').value = 'Cash';
  document.getElementById('cCatatan').value = '';
  document.getElementById('cAlamatCatatan').value = '';
  jumlah = {};
  menu.forEach(m => jumlah[m.nama] = 0);
  updateCartBar();
}

// ============================================================
// 2. ENHANCE KASIR FORM (Replace submitKasirOrder or kasirKirimWA)

async function kasirKirimWA() {
  // Validate required fields
  const nama = document.getElementById('kNama').value.trim();
  
  if (!validateForm({
    'kNama': { value: nama, type: 'required', label: 'Nama Pembeli' }
  })) return;
  
  // Get cart items
  let items = [];
  let subtotal = 0;
  menu.forEach(m => {
    const q = jumlah[m.nama] || 0;
    if (q > 0) {
      const subHarga = m.harga * q;
      items.push({
        nama: m.nama,
        harga: m.harga,
        qty: q,
        subtotal: subHarga
      });
      subtotal += subHarga;
    }
  });
  
  if (!items.length) {
    toast('⚠️ Pilih minimal 1 menu', 'error');
    return;
  }
  
  const isAntar = document.getElementById('kJenis').value === 'Antar';
  const oFinal = isAntar ? kOngkir : 0;
  const fee = isAntar ? hitungPlatformFee(subtotal + oFinal) : 0;
  const tip = isAntar ? parseInt(document.getElementById('kTip').value) || 0 : 0;
  const total = subtotal + oFinal + fee + tip;
  
  const pesanan = {
    nama,
    hp: '', // Walk-in, no phone
    jenis: document.getElementById('kJenis').value,
    bayar: document.getElementById('kBayar').value,
    items,
    subtotal,
    ongkir: oFinal,
    platformFee: fee,
    tip,
    total,
    catatan: document.getElementById('kCatatan').value,
    kasirId: localStorage.getItem('kasirId'),
    kasirNama: localStorage.getItem('kasirNama'),
    tglOrder: new Date(),
    noOrder: generateOrderNumber(),
    status: 'diproses'
  };
  
  const btn = event?.target;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Proses...';
  }
  
  try {
    // Save to Firestore
    const docRef = await db.collection('pesanan').add(pesanan);
    
    // Generate receipt
    generateStruk(pesanan, docRef.id);
    
    playSound('success');
    toast('✅ Pesanan diproses', 'success');
    
    // Clear form after delay
    setTimeout(() => resetKasirForm(), 2000);
    
  } catch (error) {
    await handleFirebaseError(error, 'kasirKirimWA', pesanan);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🟢 Proses & Kirim ke WA';
    }
  }
}

// ============================================================
// 3. ENHANCE PENGANTAR REGISTRATION (Already provided, just verify)

async function daftarPengantar() {
  // Function is complete in pengantar-registration.js
  // Just make sure to call it from your HTML button
}

// ============================================================
// 4. INIT FUNCTIONS (Call once on page load)

function initializeApp() {
  // Initialize validation and security
  secureSession();
  retryFailedSubmissions();
  
  // Initialize menu
  renderMenuGrid('cGridMakanan', 'cGridMinuman', 'c');
  renderMenuGrid('kGridMakanan', 'kGridMinuman', 'k');
  
  // Initialize cart
  updateCartBar();
}

// Call this on body load:
// <body onload="initializeApp()">

// ============================================================
// 5. KASIR INCOMING ORDERS (Add to kasir page)

async function loadIncomingOrders() {
  try {
    const kasirId = localStorage.getItem('kasirId');
    if (!kasirId) return;
    
    const snap = await db.collection('pesanan')
      .where('status', 'in', ['menunggu', 'diproses'])
      .orderBy('tglOrder', 'desc')
      .limit(20)
      .get();
    
    let html = '';
    let badge = 0;
    
    snap.forEach(doc => {
      const p = doc.data();
      badge++;
      html += `<div class="incoming-card">
        <b>${p.noOrder || doc.id.slice(0, 8)}</b> - ${rp(p.total)}<br>
        <small>${p.nama || 'Pelanggan'} • ${p.jenis}</small><br>
        <small style="color:#888">${new Date(p.tglOrder?.toDate?.()).toLocaleTimeString('id-ID')}</small>
      </div>`;
    });
    
    document.getElementById('kIncomingList').innerHTML = html || '<p class="muted">Tidak ada pesanan masuk</p>';
    document.getElementById('badgePesanan').textContent = badge > 0 ? badge : '';
    
  } catch (e) {
    console.error('Load incoming error:', e);
  }
}

// Call periodically:
setInterval(loadIncomingOrders, 5000); // Every 5 seconds

// ============================================================
// 6. GENERATE RECEIPT/STRUK

function generateStruk(pesanan, orderId) {
  let struk = `
═══════════════════════════════════
          KEDAI SIFA
          STRUK PEMESANAN
═══════════════════════════════════

No. Order: ${pesanan.noOrder || orderId.slice(0, 8)}
Tanggal  : ${new Date(pesanan.tglOrder).toLocaleString('id-ID')}
Kasir    : ${pesanan.kasirNama || '-'}

───────────────────────────────────
DETAIL PESANAN
───────────────────────────────────`;
  
  pesanan.items.forEach(item => {
    const qty = item.qty.toString().padStart(2, ' ');
    const harga = rp(item.subtotal);
    struk += `
${item.nama}
  ${qty}x @ ${rp(item.harga)} = ${harga}`;
  });
  
  struk += `
───────────────────────────────────`;
  
  if (pesanan.ongkir) {
    struk += `
Subtotal        : ${rp(pesanan.subtotal)}
Ongkos Antar    : ${rp(pesanan.ongkir)}
Platform Fee    : ${rp(pesanan.platformFee)}
Tip             : ${rp(pesanan.tip || 0)}`;
  }
  
  struk += `
═══════════════════════════════════
TOTAL           : ${rp(pesanan.total)}
═══════════════════════════════════

Jenis      : ${pesanan.jenis}
Pembayaran : ${pesanan.bayar}

Terima kasih atas pesanan Anda!
Tunggu pesanan dengan seksama.

═══════════════════════════════════`;
  
  document.getElementById('bukti').innerHTML = `<pre>${struk}</pre>`;
}

function downloadStrukPDF() {
  const buktiEl = document.getElementById('bukti');
  if (!buktiEl || buktiEl.querySelector('pre').textContent.includes('Struk muncul')) {
    toast('⚠️ Buat pesanan terlebih dahulu', 'error');
    return;
  }
  
  const canvas = html2canvas(buktiEl);
  canvas.then(c => {
    const img = c.toDataURL('image/png');
    const pdf = new jsPDF();
    pdf.addImage(img, 'PNG', 10, 10, 190, 270);
    pdf.save('struk-pesanan.pdf');
  });
}

// ============================================================
// 7. AUTO-SYNC OFFLINE ORDERS (Run periodically)

setInterval(async () => {
  if (navigator.onLine) {
    await retryFailedSubmissions();
  }
}, 30000); // Every 30 seconds

// ============================================================
// 8. PAGE PROTECTION (Add before showing protected pages)

function protectPage(pageName) {
  const kasirId = localStorage.getItem('kasirId');
  const adminId = localStorage.getItem('adminId');
  
  if (pageName === 'p-kasir' && !kasirId) {
    showPage('p-kasirlogin');
    toast('⚠️ Silakan login sebagai kasir', 'error');
    return false;
  }
  
  if (pageName === 'p-admin' && !adminId) {
    showPage('p-adminlogin');
    toast('⚠️ Silakan login sebagai admin', 'error');
    return false;
  }
  
  return true;
}

// Modify showPage() to use this:
function showPageProtected(id) {
  if (!protectPage(id)) return;
  showPage(id);
}
