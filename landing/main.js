(function () {
  const cfg = window.TEARZ_DOWNLOAD || {};
  const brand = document.getElementById('brand');
  const btn = document.getElementById('downloadBtn');
  const hint = document.getElementById('statusHint');

  if (brand && cfg.brand) brand.textContent = cfg.brand;

  const apkUrlRaw = (cfg.apkUrl || './tearz.apk').trim();
  const apkUrl = new URL(apkUrlRaw, window.location.href).href;
  const looksLikePlaceholder = /tearz\.apk$/i.test(apkUrlRaw);

  btn.setAttribute('href', apkUrl);
  // Same-origin: атрибут download работает на Android Chrome
  btn.setAttribute('download', 'tearz.apk');
  btn.removeAttribute('target');

  function markMissing() {
    btn.classList.add('is-disabled');
    btn.addEventListener('click', (e) => e.preventDefault());
    if (hint) {
      hint.hidden = false;
      hint.textContent = cfg.waitlistNote || 'APK скоро появится.';
    }
  }

  if (looksLikePlaceholder) {
    fetch(apkUrl, { method: 'HEAD' })
      .then((res) => {
        if (!res.ok) throw new Error('missing');
      })
      .catch(() => {
        // HEAD иногда режется — пробуем GET range
        return fetch(apkUrl, { method: 'GET', headers: { Range: 'bytes=0-0' } }).then((res) => {
          if (!(res.ok || res.status === 206)) throw new Error('missing');
        });
      })
      .catch(markMissing);
  }
})();
