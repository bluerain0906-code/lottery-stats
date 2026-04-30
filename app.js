const GAMES = {
  lotto649: {
    name: '大樂透',
    mainRange: [1, 49],
    mainPick: 6,
    specialLabel: '特別號出現次數（與一般號同池 1-49）',
    getMain: r => r.numbers,
    getSpecial: r => r.special,
    specialRange: [1, 49],
    specialBallClass: 'special',
  },
  super_lotto: {
    name: '威力彩',
    mainRange: [1, 38],
    mainPick: 6,
    specialLabel: '第二區出現次數（1-8）',
    getMain: r => r.first_area,
    getSpecial: r => r.second_area,
    specialRange: [1, 8],
    specialBallClass: 'second',
  },
  daily_cash: {
    name: '今彩539',
    mainRange: [1, 39],
    mainPick: 5,
    specialLabel: null,
    getMain: r => r.numbers,
    getSpecial: null,
    specialRange: null,
    specialBallClass: null,
  },
};

let rawData = null;
let currentGame = 'lotto649';
let currentRange = 'all';
let mainChart = null;
let specialChart = null;

let adminState = { isAdmin: false, name: null };

async function fetchAdminState() {
  try {
    const r = await fetch('/api/me', { credentials: 'same-origin' });
    if (r.ok) adminState = await r.json();
  } catch {
    adminState = { isAdmin: false };
  }
}

function applyAdminUI() {
  const card = document.getElementById('generatorCard');
  if (!card) return;
  if (adminState.isAdmin) {
    card.classList.remove('locked-mode');
    const who = document.getElementById('adminWho');
    if (who) who.textContent = adminState.name ? `管理員：${adminState.name}` : '';
  } else {
    card.classList.add('locked-mode');
  }
}

async function loadData() {
  const res = await fetch('data.json');
  rawData = await res.json();
  const lottoN = (rawData.lotto649 || []).length;
  const superN = (rawData.super_lotto || []).length;
  const dailyN = (rawData.daily_cash || []).length;
  document.getElementById('heroMeta').textContent =
    `目前已收錄：大樂透 ${lottoN} 期、威力彩 ${superN} 期、今彩539 ${dailyN} 期 · 最後更新 ${rawData.updated_at || '—'}`;
  render();
}

function filterByRange(records, range) {
  if (range === 'all') return records;
  const now = new Date();
  const cutoff = new Date(now);
  if (range === '1y') cutoff.setFullYear(now.getFullYear() - 1);
  if (range === '3y') cutoff.setFullYear(now.getFullYear() - 3);
  return records.filter(r => new Date(r.date) >= cutoff);
}

function countFreq(records, getter, [lo, hi]) {
  const counts = {};
  for (let i = lo; i <= hi; i++) counts[i] = 0;
  for (const r of records) {
    const v = getter(r);
    if (Array.isArray(v)) v.forEach(n => counts[n] !== undefined && counts[n]++);
    else if (counts[v] !== undefined) counts[v]++;
  }
  return counts;
}

function renderChart(ctx, existing, counts, color) {
  const labels = Object.keys(counts).map(Number);
  const values = labels.map(k => counts[k]);
  if (existing) existing.destroy();
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: '出現次數', data: values, backgroundColor: color }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { autoSkip: false, font: { size: 10 } } },
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}

function render() {
  if (!rawData) return;
  const game = GAMES[currentGame];
  const records = filterByRange(rawData[currentGame] || [], currentRange);

  document.getElementById('meta').textContent = `共 ${records.length} 期`;

  const mainCounts = countFreq(records, game.getMain, game.mainRange);
  mainChart = renderChart(
    document.getElementById('mainChart').getContext('2d'),
    mainChart,
    mainCounts,
    '#2563eb'
  );

  const specialCard = document.getElementById('specialCard');
  if (game.getSpecial && game.specialRange) {
    specialCard.style.display = '';
    document.getElementById('specialTitle').textContent = game.specialLabel;
    const specialCounts = countFreq(records, game.getSpecial, game.specialRange);
    specialChart = renderChart(
      document.getElementById('specialChart').getContext('2d'),
      specialChart,
      specialCounts,
      game.specialBallClass === 'second' ? '#ef4444' : '#f59e0b'
    );
  } else {
    specialCard.style.display = 'none';
    if (specialChart) {
      specialChart.destroy();
      specialChart = null;
    }
  }

  document.getElementById('genResult').innerHTML = '';
}

function topN(counts, n) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => Number(k));
}

function pickUnique(pool, k) {
  const copy = [...pool];
  const out = [];
  while (out.length < k && copy.length) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out.sort((a, b) => a - b);
}

function renderSet(container, numbers, special, labelText, game) {
  const set = document.createElement('div');
  set.className = 'gen-set';
  const balls = numbers.map(n => `<span class="ball">${n}</span>`).join('');
  const specialPart = special !== null && special !== undefined
    ? `<span class="label" style="margin-left:6px">特</span><span class="ball ${game.specialBallClass}">${special}</span>`
    : '';
  set.innerHTML = `<span class="label">${labelText}</span>${balls}${specialPart}`;
  container.appendChild(set);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generate() {
  if (!rawData) return;
  const game = GAMES[currentGame];
  const pick = game.mainPick;
  const records = filterByRange(rawData[currentGame] || [], 'all');
  if (!records.length) {
    document.getElementById('genResult').innerHTML =
      '<p class="hint">目前無資料可統計。</p>';
    return;
  }

  const mainCounts = countFreq(records, game.getMain, game.mainRange);
  const hasSpecial = !!game.getSpecial;
  const specialCounts = hasSpecial
    ? countFreq(records, game.getSpecial, game.specialRange)
    : null;
  const specialTop = hasSpecial
    ? topN(specialCounts, Math.min(8, game.specialRange[1]))
    : [];

  const topFixed = topN(mainCounts, pick);
  const top10 = topN(mainCounts, 10);
  const top15 = topN(mainCounts, 15);
  const fixedSpecial = hasSpecial ? specialTop[0] : null;

  const container = document.getElementById('genResult');
  container.innerHTML = '';
  container.insertAdjacentHTML(
    'beforeend',
    `<p class="gen-mode-label">全歷史 · 第 1 組=固定前 ${pick} · 第 2 組=前 10 隨機 · 第 3 組=前 15 隨機</p>`
  );
  renderSet(container, [...topFixed].sort((a, b) => a - b), fixedSpecial, '第 1 組 · 固定', game);
  renderSet(container, pickUnique(top10, pick), hasSpecial ? pickRandom(specialTop) : null, '第 2 組 · 前10隨機', game);
  renderSet(container, pickUnique(top15, pick), hasSpecial ? pickRandom(specialTop) : null, '第 3 組 · 前15隨機', game);
}

function showAnalysis(game) {
  const section = document.getElementById('analysis');
  section.classList.remove('hidden');
  section.setAttribute('aria-hidden', 'false');
  switchTab(game);
  setTimeout(() => {
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 50);
}

function switchTab(game) {
  const tabs = document.querySelectorAll('.tab');
  const tabsEl = document.querySelector('.tabs');
  tabs.forEach((b, i) => {
    const on = b.dataset.game === game;
    b.classList.toggle('active', on);
    if (on) tabsEl.dataset.idx = String(i);
  });
  currentGame = game;
  render();
}

// CTA buttons
document.querySelectorAll('[data-go]').forEach(btn => {
  btn.addEventListener('click', () => showAnalysis(btn.dataset.go));
});

// Tabs inside analysis
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.game));
});

document.getElementById('range').addEventListener('change', e => {
  currentRange = e.target.value;
  render();
});

document.getElementById('genBtn').addEventListener('click', () => generate());

const adBtn = document.getElementById('adGateBtn');
if (adBtn) adBtn.addEventListener('click', () => generate());

document.querySelector('.tabs').dataset.idx = '0';

(async () => {
  await fetchAdminState();
  applyAdminUI();
  try {
    await loadData();
  } catch (err) {
    document.getElementById('heroMeta').textContent = `資料載入失敗：${err.message}`;
  }
})();
