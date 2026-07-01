/**
 * FIREBASE ERROR HANDLER & FALLBACK SYSTEM
 * Handles permission errors with WhatsApp and localStorage fallback
 * Requirements: #1 (order sending), #3 (kasir login), #4 (registration)
 */

// Centralized Firebase error handler
async function handleFirebaseError(error, context, fallbackData = null) {
  console.error(`[Firebase Error - ${context}]`, error);
  
  if (error.code === 'permission-denied') {
    toast(`❌ Permission Denied: ${context}. Using WhatsApp backup...`, 'error');
    playSound('error');
    if (fallbackData) {
      await submitViaWhatsApp(fallbackData, context);
    }
    return { success: false, reason: 'permission', fallback: true };
  } 
  else if (error.code === 'unauthenticated') {
    toast('⚠️ Authentication failed. Please re-login.', 'error');
    logoutKasir();
    logoutAdmin();
    hentiTracking?.();
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

// Build WhatsApp message from order/registration data
function buildWhatsAppMessage(pesanan, type = 'order') {
  let msg = '';
  
  if (type === 'order') {
    msg = `📦 *PESANAN BARU*\n\n`;
    msg += `👤 Nama: ${pesanan.nama}\n`;
    msg += `📱 HP: ${pesanan.hp}\n`;
    msg += `📦 Jenis: ${pesanan.jenis || 'Bungkus'}\n`;
    msg += `💳 Bayar: ${pesanan.bayar}\n`;
    
    if (pesanan.alamat) {
      msg += `📍 Alamat: ${pesanan.alamat}\n`;
    }
    
    msg += `\n*Detail Pesanan:*\n`;
    
    let subtotal = 0;
    if (pesanan.items && Array.isArray(pesanan.items)) {
      pesanan.items.forEach(item => {
        const subHarga = item.harga * item.qty;
        msg += `• ${item.nama} ×${item.qty} = Rp ${subHarga.toLocaleString('id-ID')}\n`;
        subtotal += subHarga;
      });
    }
    
    msg += `\n*Total: Rp ${pesanan.total.toLocaleString('id-ID')}*\n`;
    
    if (pesanan.catatan) {
      msg += `\n📝 Catatan: ${pesanan.catatan}\n`;
    }
  }
  else if (type === 'registration') {
    msg = `📝 *PENDAFTARAN PENGANTAR BARU*\n\n`;
    msg += `👤 Nama: ${pesanan.nama}\n`;
    msg += `📱 HP: ${pesanan.hp}\n`;
    msg += `📍 Alamat: ${pesanan.alamat}\n`;
    msg += `🏍️ Kendaraan: ${pesanan.kendaraan} (${pesanan.plat})\n`;
    msg += `💰 Deposit: Rp ${pesanan.deposit.toLocaleString('id-ID')}\n`;
    msg += `⏳ Status: Menunggu verifikasi\n\n`;
    msg += `📎 File KTP & STNK sudah diupload di Google Drive\n`;
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
    
    // Save to localStorage as backup
    const backup = {
      type,
      data: pesanan,
      timestamp: new Date().toISOString(),
      status: 'pending_wa_confirmation',
      context
    };
    
    const backups = JSON.parse(localStorage.getItem('backupQueue') || '[]');
    backups.push(backup);
    localStorage.setItem('backupQueue', JSON.stringify(backups));
    
    toast('📱 Pesanan dikirim via WhatsApp. Admin akan konfirmasi.', 'info');
    return { success: true, method: 'whatsapp' };
  } catch (e) {
    console.error('WhatsApp fallback error:', e);
    toast('⚠️ Gagal buka WhatsApp. Hubungi Admin: 081977555007', 'error');
    return { success: false };
  }
}

// Retry mechanism for failed submissions when connection returns
async function retryFailedSubmissions() {
  if (!navigator.onLine) return;
  
  const backups = JSON.parse(localStorage.getItem('backupQueue') || '[]');
  if (!backups.length) return;
  
  console.log(`⏳ Retrying ${backups.length} pending submission(s)...`);
  
  const successful = [];
  
  for (let backup of backups) {
    try {
      if (backup.type === 'order') {
        await db.collection('pesanan').add({
          ...backup.data,
          tglOrder: new Date(),
          noOrder: generateOrderNumber(),
          importedFromWA: true
        });
        successful.push(backup);
        console.log('✅ Order submission retry successful');
      } 
      else if (backup.type === 'registration') {
        await db.collection('pengantar').add({
          ...backup.data,
          tglDaftar: new Date(),
          importedFromWA: true
        });
        successful.push(backup);
        console.log('✅ Registration submission retry successful');
      }
    } catch (e) {
      console.warn(`⚠️ Retry still failing for ${backup.context}:`, e);
    }
  }
  
  // Remove successful submissions from queue
  const remaining = backups.filter(b => !successful.includes(b));
  localStorage.setItem('backupQueue', JSON.stringify(remaining));
  
  if (successful.length > 0) {
    toast(`✅ ${successful.length} submission(s) synced from backup`, 'success');
  }
}

// Initialize retry on app load and when connection returns
window.addEventListener('load', () => {
  setTimeout(retryFailedSubmissions, 1000);
});

window.addEventListener('online', () => {
  toast('📡 Connection restored. Syncing pending submissions...', 'info');
  retryFailedSubmissions();
});

window.addEventListener('offline', () => {
  toast('📴 Offline mode. Submissions will be sent via WhatsApp.', 'info');
});
