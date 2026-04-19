(function () {
  const LINE_ID = 'AIRORTON';
  const QR_IMG = 'line-qr.png'; // 放你的 LINE QR code 圖檔

  const modal = document.createElement('div');
  modal.className = 'line-modal';
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="line-modal-backdrop" data-close></div>
    <div class="line-modal-box" role="dialog" aria-labelledby="line-modal-title">
      <button class="line-modal-close" data-close aria-label="關閉">×</button>
      <h3 id="line-modal-title">加入我們的 LINE</h3>
      <div class="line-qr">
        <img src="${QR_IMG}" alt="LINE QR Code" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'qr-placeholder',textContent:'尚未放置 QR 圖檔'}))" />
      </div>
      <p class="line-id-row">LINE ID：<b>${LINE_ID}</b></p>
      <p class="line-modal-hint">請開啟 LINE 掃描上方 QR code，或於 LINE 搜尋 ID 加入。</p>
    </div>
  `;
  document.body.appendChild(modal);

  function open() {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  modal.addEventListener('click', e => {
    if (e.target.dataset.close !== undefined) close();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('open')) close();
  });

  document.querySelectorAll('.line-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      open();
    });
  });
})();
