(function () {
  const cfg = window.TEARZ_DOWNLOAD || {};
  const brand = document.getElementById('brand');
  const btn = document.getElementById('downloadBtn');
  const versionLabel = document.getElementById('versionLabel');
  const hint = document.getElementById('statusHint');
  const qrCard = document.getElementById('qrCard');
  const canvas = document.getElementById('qr');

  if (brand && cfg.brand) brand.textContent = cfg.brand;
  if (versionLabel) versionLabel.textContent = cfg.version ? `v${cfg.version}` : '';

  const apkUrlRaw = (cfg.apkUrl || './tearz.apk').trim();
  const apkUrl = new URL(apkUrlRaw, window.location.href).href;
  const looksLikePlaceholder = /tearz\.apk$/i.test(apkUrlRaw) && apkUrlRaw.startsWith('./');
  const isRemote = /^https?:\/\//i.test(apkUrlRaw);

  btn.setAttribute('href', apkUrl);
  if (isRemote) {
    // Cross-origin: атрибут download часто игнорируется — открываем прямое скачивание.
    btn.removeAttribute('download');
    btn.setAttribute('target', '_blank');
    btn.setAttribute('rel', 'noopener');
  } else {
    btn.setAttribute('download', '');
  }

  function setMissingApk() {
    btn.classList.add('is-disabled');
    btn.removeAttribute('download');
    btn.setAttribute('aria-disabled', 'true');
    btn.addEventListener('click', (e) => e.preventDefault());
    if (hint) {
      hint.classList.add('is-warn');
      hint.textContent =
        cfg.waitlistNote ||
        'APK ещё не загружен на сайт. Собери preview-сборку и положи tearz.apk сюда или пропиши ссылку в config.js.';
    }
    qrCard.classList.add('is-hidden');
  }

  function drawQr(url) {
    if (!window.QRCode || !canvas) return;
    window.QRCode.toCanvas(
      canvas,
      url,
      {
        width: 148,
        margin: 1,
        color: { dark: '#1A1A1A', light: '#FFFFFF' },
      },
      (err) => {
        if (err) qrCard.classList.add('is-hidden');
      },
    );
  }

  // If local relative APK — probe HEAD/GET; remote URL assumed ready.
  if (looksLikePlaceholder) {
    fetch(apkUrl, { method: 'HEAD' })
      .then((res) => {
        if (!res.ok) throw new Error('missing');
        drawQr(apkUrl);
      })
      .catch(() => setMissingApk());
  } else {
    drawQr(apkUrl);
  }
})();
