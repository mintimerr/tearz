(function () {
  const cfg = window.TEARZ_DOWNLOAD || {};
  const brand = document.getElementById('brand');
  const btn = document.getElementById('downloadBtn');
  const hint = document.getElementById('statusHint');
  const mascot = document.getElementById('mascot');

  if (brand && cfg.brand) brand.textContent = cfg.brand;
  if (mascot) mascot.classList.add('is-alive');

  const apkUrlRaw = (cfg.apkUrl || './tearz.apk').trim();
  const apkUrl = new URL(apkUrlRaw, window.location.href).href;
  const looksLikePlaceholder = /tearz\.apk$/i.test(apkUrlRaw);

  btn.setAttribute('href', apkUrl);
  btn.setAttribute('download', 'tearz.apk');
  btn.removeAttribute('target');

  // Лёгкий параллакс на Tearz — ощущение «живого» продукта
  if (mascot && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const img = mascot.querySelector('.mascot-img');
    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;

    const tick = () => {
      curX += (targetX - curX) * 0.08;
      curY += (targetY - curY) * 0.08;
      if (img) {
        img.style.translate = `${curX.toFixed(2)}px ${curY.toFixed(2)}px`;
      }
      raf = requestAnimationFrame(tick);
    };

    window.addEventListener(
      'pointermove',
      (e) => {
        const rect = mascot.getBoundingClientRect();
        const nx = (e.clientX - (rect.left + rect.width / 2)) / rect.width;
        const ny = (e.clientY - (rect.top + rect.height / 2)) / rect.height;
        targetX = Math.max(-1, Math.min(1, nx)) * 10;
        targetY = Math.max(-1, Math.min(1, ny)) * 8;
      },
      { passive: true },
    );

    raf = requestAnimationFrame(tick);
    window.addEventListener('pagehide', () => cancelAnimationFrame(raf));
  }

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
        return fetch(apkUrl, { method: 'GET', headers: { Range: 'bytes=0-0' } }).then((res) => {
          if (!(res.ok || res.status === 206)) throw new Error('missing');
        });
      })
      .catch(markMissing);
  }
})();
