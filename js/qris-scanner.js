/* ============================================================
   REQUIREMENT #2: QRIS CAMERA SCANNER
   - Add camera open/close options
   - Auto-close after successful scan
   - Handle permission denied gracefully
============================================================ */

let qrScanner = null;
let isScanning = false;

function bukaScanner() {
  const scanBox = document.getElementById('scanBox');
  const qrisInfo = document.getElementById('kQrisInfo');
  
  // Hide QRIS info, show scanner
  if (qrisInfo) qrisInfo.style.display = 'none';
  scanBox.style.display = 'block';
  
  // Initialize scanner
  if (!qrScanner) {
    qrScanner = new Html5Qrcode("qr-reader");
  }
  
  if (isScanning) return; // Already scanning
  isScanning = true;
  
  // Try to start scanning with rear camera
  qrScanner.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 250, height: 250 } },
    onScanSuccess,
    onScanError
  ).catch(err => {
    console.error('Scanner start error:', err);
    
    if (err.name === 'NotAllowedError') {
      // Camera permission denied
      toast('⚠️ Akses kamera ditolak', 'error');
      scanBox.innerHTML = `
        <div style="color:#fff;text-align:center;padding:30px;background:#333;border-radius:12px">
          <div style="font-size:48px;margin-bottom:12px">📷</div>
          <b style="display:block;margin-bottom:8px">Akses Kamera Ditolak</b>
          <p style="font-size:13px;margin:0;color:#ccc">
            Izinkan akses kamera di pengaturan browser:
          </p>
          <p style="font-size:12px;margin:8px 0 0;color:#888">
            Settings → Privacy → Camera → Izinkan untuk situs ini
          </p>
        </div>
      `;
      isScanning = false;
    } 
    else if (err.name === 'NotFoundError' || err.name === 'NotSupportedError') {
      // No camera device
      toast('❌ Kamera tidak ditemukan atau tidak didukung', 'error');
      scanBox.innerHTML = `
        <div style="color:#fff;text-align:center;padding:30px;background:#333;border-radius:12px">
          <div style="font-size:48px;margin-bottom:12px">❌</div>
          <b style="display:block;margin-bottom:8px">Kamera Tidak Tersedia</b>
          <p style="font-size:13px;margin:0;color:#ccc">
            Perangkat Anda tidak memiliki kamera atau browser tidak mendukung.
          </p>
        </div>
      `;
      isScanning = false;
    }
    else {
      toast('❌ Error: ' + err.message, 'error');
      isScanning = false;
    }
  });
}

function onScanSuccess(decodedText) {
  console.log('✅ QRIS Scanned:', decodedText);
  
  // Update result display
  const resultEl = document.getElementById('scanResult');
  if (resultEl) {
    resultEl.textContent = '✅ QRIS Terbaca!';
    resultEl.style.color = '#28a745';
  }
  
  // Store QRIS value
  const qrisInput = document.getElementById('qrisValue');
  if (qrisInput) {
    qrisInput.value = decodedText;
  }
  
  playSound('success');
  toast('✅ QRIS berhasil discan', 'success');
  
  // Auto close after 2 seconds
  setTimeout(tutupScanner, 2000);
}

function onScanError(err) {
  // Ignore "QR code not detected" errors during normal scanning
  if (err && err.name !== 'NotAllowedError' && err.name !== 'NotFoundError') {
    // Silently continue scanning
    return;
  }
}

function tutupScanner() {
  const scanBox = document.getElementById('scanBox');
  const qrisInfo = document.getElementById('kQrisInfo');
  
  if (qrScanner && isScanning) {
    qrScanner.stop().catch(err => {
      console.warn('Error stopping scanner:', err);
    }).finally(() => {
      isScanning = false;
      scanBox.style.display = 'none';
      if (qrisInfo) qrisInfo.style.display = 'block';
    });
  } else {
    scanBox.style.display = 'none';
    if (qrisInfo) qrisInfo.style.display = 'block';
  }
}

// Cleanup scanner on page change
function cleanupScanner() {
  if (qrScanner && isScanning) {
    tutupScanner();
  }
}
