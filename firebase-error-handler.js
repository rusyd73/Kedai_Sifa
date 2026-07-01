/**
 * FIREBASE ERROR HANDLER & FALLBACK SYSTEM
 * Requirement #1, #3, #4: Handle permission errors with WhatsApp fallback
 */

// Centralized Firebase error handler
async function handleFirebaseError(error, context, fallbackData = null) {
  console.error(`[Firebase Error - ${context}]`, error);
  
  if (error.code === 'permission-denied') {
    toast(`❌ Permission Denied: ${context}. Using WhatsApp backup...`, 'error');
    if (fallbackData) {
      await submitViaWhatsApp(fallbackData, context);
    }
    return { success: false, reason: 'permission', fallback: true };
  } 
  else if (error.code === 'unauthenticated') {
    toast('⚠️ Authentication failed. Please re-login.', 'error');
    // Force logout all sessions
    logoutKasir();
    logoutAdmin();
    hentiTracking();
    showPage('p-home');
    return { success: false, reason: 'auth' };
  }
  else if (error.code === 'unavailable' || error.code === 'internal') {
    toast('⚠️ Server sedang sibuk. Mencoba backup...', 'info');
    if (fallbackData) {
      await submitViaWhatsApp(fallbackData, context);
    }
    return { success: false, reason: 'unavailable', fallback: true };
  }
  
  toast(`❌ Error: ${error.message}`, 'error');
  return { success: false, reason: 'unknown' };
}

// Build WhatsApp message from order data
function buildWhatsAppMessage(pesanan, type = 'order') {
  let msg = '';
  
  if (type === 'order') {
    msg = `📦 *PESANAN BARU*\n\n`;
    msg += `Nama: ${pesanan.nama}\n`;
    msg += `HP: ${pesanan.hp}\n`;
    msg += `Jenis: ${pesanan.jenis || 'Bungkus'}\n`;
    msg += `Pembayaran: ${pesanan.bayar}\n`;
    msg += `\n*Detail Pesanan:*\n`;
    
    let subtotal = 0;
    pesanan.items.forEach(item => {
      const subHarga = item.harga * item.qty;
      msg += `- ${item.nama} ×${item.qty} = Rp ${subHarga.toLocaleString('id-ID')}\n`;
      subtotal += subHarga;
    });
    
    msg += `\n*Total:* Rp ${pesanan.total.toLocaleString('id-ID')}\n`;
    msg += `\nCatatan: ${pesanan.catatan || '-'}\n`;
    msg += `\nAlamat: ${pesanan.alamat || '-'}\n`;
  }
  else if (type === 'registration') {
    msg = `📝 *PENDAFTARAN PENGANTAR BARU*\n\n`;
    msg += `Nama: ${pesanan.nama}\n`;
    msg += `HP: ${pesanan.hp}\n`;
    msg += `Alamat: ${pesanan.alamat}\n`;
    msg += `Kendaraan: ${pesanan.kendaraan} (${pesanan.plat})\n`;
    msg += `Deposit: Rp ${pesanan.deposit.toLocaleString('id-ID')}\n`;
    msg += `Status: Pending verifikasi\n`;
  }
  
  return msg;
}

// Submit via WhatsApp when Firebase fails
async function submitViaWhatsApp(pesanan, context) {
  try {
    const type = context.includes('Pengantar') ? 'registration' : 'order';
    const msg = buildWhatsAppMessage(pesanan, type);
    const adminNum = '6281977555007';
    const waUrl = `https://wa.me/${adminNum}?text=${encodeURIComponent(msg)}`;
    
    window.open(waUrl, '_blank');
    playSound('success');
    
    // Also save to localStorage as backup
    const backup = {
      type,
      data: pesanan,
      timestamp: new Date().toISOString(),
      status: 'pending_wa_confirmation'
    };
    const backups = JSON.parse(localStorage.getItem('backupQueue') || '[]');
    backups.push(backup);
    localStorage.setItem('backupQueue', JSON.stringify(backups));
    
    return { success: true, method: 'whatsapp' };
  } catch (e) {
    console.error('WhatsApp fallback error:', e);
    toast('⚠️ Gagal buka WhatsApp. Coba manual ke: 081977555007', 'error');
    return { success: false };
  }
}

// Retry mechanism for failed submissions
async function retryFailedSubmissions() {
  const backups = JSON.parse(localStorage.getItem('backupQueue') || '[]');
  if (!backups.length) return;
  
  console.log(`⏳ Retrying ${backups.length} pending submission(s)...`);
  
  for (let i = 0; i < backups.length; i++) {
    const backup = backups[i];
    try {
      if (backup.type === 'order') {
        await db.collection('pesanan').add({
          ...backup.data,
          tglOrder: new Date(),
          noOrder: generateOrderNumber()
        });
      } else if (backup.type === 'registration') {
        await db.collection('pengantar').add({
          ...backup.data,
          tglDaftar: new Date()
        });
      }
      backups.splice(i, 1);
      i--;
      console.log('✅ Submission retry successful');
    } catch (e) {
      console.warn('Retry still failing:', e);
    }
  }
  
  localStorage.setItem('backupQueue', JSON.stringify(backups));
}

// Initialize retry on app load
window.addEventListener('load', () => {
  if (navigator.onLine) {
    setTimeout(retryFailedSubmissions, 1000);
  }
});

window.addEventListener('online', retryFailedSubmissions);
