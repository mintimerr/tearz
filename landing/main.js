(function () {
  const cfg = window.TEARZ_DOWNLOAD || {};
  const brand = document.getElementById('brand');
  const btn = document.getElementById('downloadBtn');
  const hint = document.getElementById('statusHint');

  if (brand && cfg.brand) brand.textContent = cfg.brand;

  const apkUrlRaw = (cfg.apkUrl || './tearz.apk').trim();
  const apkUrl = new URL(apkUrlRaw, window.location.href).href;
  const looksLikePlaceholder = /tearz\.apk$/i.test(apkUrlRaw) && apkUrlRaw.startsWith('./');
  const isRemote = /^https?:\/\//i.test(apkUrlRaw);

  btn.setAttribute('href', apkUrl);
  if (isRemote) {
    btn.removeAttribute('download');
    btn.setAttribute('target', '_blank');
    btn.setAttribute('rel', 'noopener');
  } else {
    btn.setAttribute('download', '');
  }

  if (looksLikePlaceholder) {
    fetch(apkUrl, { method: 'HEAD' })
      .then((res) => {
        if (!res.ok) throw new Error('missing');
      })
      .catch(() => {
        btn.classList.add('is-disabled');
        btn.addEventListener('click', (e) => e.preventDefault());
        if (hint) {
          hint.classList.add('is-warn');
          hint.textContent = cfg.waitlistNote || 'APK скоро появится.';
        }
      });
  }
})();
