/* ============================================================
   REQUIREMENT #4: REGISTRATION FORM WITH ERROR HANDLING
   File validation, upload to Drive, Firebase submission with fallback
============================================================ */

async function daftarPengantar() {
  // Validate form fields
  const fields = {
    pNama: 'Nama Lengkap',
    pHp: 'No. WhatsApp',
    pAlamat: 'Alamat Domisili',
    pKendaraan: 'Jenis Kendaraan',
    pPlat: 'Plat Nomor',
    pDeposit: 'Deposit Awal'
  };
  
  for (let [id, label] of Object.entries(fields)) {
    const val = document.getElementById(id).value.trim();
    if (!val) {
      toast(`⚠️ ${label} wajib diisi`, 'error');
      return;
    }
  }
  
  // Validate phone number format
  const hp = document.getElementById('pHp').value.replace(/\D/g, '');
  if (!hp.startsWith('62') || hp.length < 11 || hp.length > 13) {
    toast('⚠️ No. WhatsApp harus format 62xxxxxxxxx', 'error');
    return;
  }
  
  // Validate deposit amount
  const deposit = parseInt(document.getElementById('pDeposit').value);
  if (deposit < 10000) {
    toast('⚠️ Deposit minimum Rp 10.000', 'error');
    return;
  }
  
  // Validate file uploads
  const ktpFile = document.getElementById('pKtp').files[0];
  const stNkFile = document.getElementById('pStnk').files[0];
  
  if (!ktpFile) {
    toast('⚠️ Foto KTP wajib diupload', 'error');
    return;
  }
  if (!stNkFile) {
    toast('⚠️ Foto STNK wajib diupload', 'error');
    return;
  }
  
  // Validate file sizes and formats
  const fileValidation = validateFileUpload(ktpFile, 'KTP');
  if (!fileValidation.valid) {
    toast(`❌ ${fileValidation.error}`, 'error');
    return;
  }
  
  const stNkValidation = validateFileUpload(stNkFile, 'STNK');
  if (!stNkValidation.valid) {
    toast(`❌ ${stNkValidation.error}`, 'error');
    return;
  }
  
  // Update button state
  const btn = document.getElementById('btnDaftar');
  btn.disabled = true;
  btn.textContent = '⏳ Mengirim...';
  
  try {
    toast('📤 Mengupload dokumen...', 'info');
    
    // Upload files to Google Drive
    let ktpUrl = '', stNkUrl = '', buktiUrl = '';
    
    try {
      ktpUrl = await uploadToDrive(ktpFile, 'KTP_Pengantar');
      console.log('✅ KTP uploaded:', ktpUrl);
    } catch (e) {
      throw new Error(`Upload KTP gagal: ${e.message}`);
    }
    
    try {
      stNkUrl = await uploadToDrive(stNkFile, 'STNK_Pengantar');
      console.log('✅ STNK uploaded:', stNkUrl);
    } catch (e) {
      throw new Error(`Upload STNK gagal: ${e.message}`);
    }
    
    // Bukti bayar optional
    const buktiFile = document.getElementById('pBukti').files[0];
    if (buktiFile) {
      try {
        buktiUrl = await uploadToDrive(buktiFile, 'Bukti_Deposit');
        console.log('✅ Bukti uploaded:', buktiUrl);
      } catch (e) {
        console.warn('Bukti upload gagal (tidak kritis):', e.message);
      }
    }
    
    // Build registration data
    const pendaftaran = {
      nama: document.getElementById('pNama').value.trim(),
      hp: hp, // stored without formatting
      alamat: document.getElementById('pAlamat').value.trim(),
      kendaraan: document.getElementById('pKendaraan').value,
      plat: document.getElementById('pPlat').value.trim().toUpperCase(),
      deposit: deposit,
      metodeDeposit: document.getElementById('pMetodeDep').value,
      fotoKtp: ktpUrl,
      fotoStnk: stNkUrl,
      fotoBukti: buktiUrl || '',
      status: 'pending',
      tglDaftar: new Date(),
      verified: false
    };
    
    toast('💾 Menyimpan ke database...', 'info');
    
    // Submit to Firestore
    try {
      const docRef = await db.collection('pengantar').add(pendaftaran);
      console.log('✅ Registration saved:', docRef.id);
      
      playSound('success');
      toast('✅ Pendaftaran berhasil dikirim!\nAdmin akan verifikasi dalam 24 jam.', 'success');
      
      // Save to localStorage for reference
      localStorage.setItem('lastRegistration', JSON.stringify({
        ...pendaftaran,
        docId: docRef.id,
        submittedAt: new Date().toISOString()
      }));
      
      // Reset form
      resetPengantarForm();
      
      // Reload status
      loadPengantarStatus();
      
    } catch (firebaseError) {
      // Firebase error - use fallback
      const result = await handleFirebaseError(
        firebaseError, 
        'daftarPengantar',
        pendaftaran
      );
      
      if (result.fallback) {
        // WhatsApp fallback already initiated
        resetPengantarForm();
      } else {
        throw firebaseError;
      }
    }
    
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.message.includes('upload')) {
      toast(`❌ ${error.message}\n\nHub ungi Admin: 081977555007`, 'error');
    } else {
      toast(`❌ Pendaftaran gagal: ${error.message}`, 'error');
    }
    
  } finally {
    btn.disabled = false;
    btn.textContent = '📨 Kirim Pendaftaran';
  }
}

function validateFileUpload(file, label) {
  // Check file type
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return {
      valid: false,
      error: `${label}: hanya JPEG, PNG, atau WebP yang diterima`
    };
  }
  
  // Check file size (5MB max)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    return {
      valid: false,
      error: `${label}: file terlalu besar (${sizeMB}MB, max 5MB)`
    };
  }
  
  return { valid: true };
}

// Validate image resolution asynchronously
function validateImageResolution(file, minWidth = 400, minHeight = 300) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (img.width < minWidth || img.height < minHeight) {
          resolve({
            valid: false,
            error: `Resolusi terlalu rendah (${img.width}×${img.height}px). Min ${minWidth}×${minHeight}px`
          });
        } else {
          resolve({ valid: true });
        }
      };
      img.onerror = () => {
        resolve({
          valid: false,
          error: 'Gagal membaca file gambar'
        });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function resetPengantarForm() {
  document.getElementById('pNama').value = '';
  document.getElementById('pHp').value = '';
  document.getElementById('pAlamat').value = '';
  document.getElementById('pKendaraan').value = 'Motor';
  document.getElementById('pPlat').value = '';
  document.getElementById('pDeposit').value = '10000';
  document.getElementById('pMetodeDep').value = 'QRIS';
  document.getElementById('pKtp').value = '';
  document.getElementById('pStnk').value = '';
  document.getElementById('pBukti').value = '';
  document.getElementById('prevKtp').style.display = 'none';
  document.getElementById('prevStnk').style.display = 'none';
  document.getElementById('prevBukti').style.display = 'none';
}

async function loadPengantarStatus() {
  try {
    const lastReg = localStorage.getItem('lastRegistration');
    if (!lastReg) {
      document.getElementById('pStatusList').innerHTML = 
        '<p class="muted">Belum ada pendaftaran dari perangkat ini.</p>';
      return;
    }
    
    const reg = JSON.parse(lastReg);
    const statusBadge = {
      'pending': '⏳ Menunggu Verifikasi',
      'verified': '✅ Diverifikasi',
      'rejected': '❌ Ditolak',
      'approved': '✅ Disetujui'
    };
    
    const html = `<div class="kasir-account">
      <div>
        <b>${reg.nama}</b><br>
        <small>HP: ${reg.hp}</small><br>
        <span class="status-badge" style="margin-top:4px;display:inline-block">
          ${statusBadge[reg.status] || reg.status}
        </span>
      </div>
    </div>`;
    
    document.getElementById('pStatusList').innerHTML = html;
    
  } catch (e) {
    console.error('Load status error:', e);
  }
}

function toggleMetodeDep() {
  const metode = document.getElementById('pMetodeDep').value;
  document.getElementById('depQris').style.display = metode === 'QRIS' ? 'block' : 'none';
  document.getElementById('depTransfer').style.display = metode === 'Transfer' ? 'block' : 'none';
}
