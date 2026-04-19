const ADMIN_KEY = 'airorton2026'; // ⚠️ 改成你的密鑰
const STORAGE_KEY = 'lotto_admin_v1';

const GAMES = {
  lotto649: {
    name: '大樂透',
    mainRange: [1, 49],
    specialLabel: '特別號出現次數（與一般號同池 1-49）',
    getMain: r => r.numbers,
    getSpecial: r => r.special,
    specialRange: [1, 49],
    specialBallClass: 'special',
  },
  super_lotto: {
    name: '威力彩',
    mainRange: [1, 38],
    specialLabel: '第二區出現次數（1-8）',
    getMain: r => r.first_area,
    getSpecial: r => r.second_area,
    specialRange: [1, 8],
    specialBallClass: 'second',
  },
};

let rawData = null;
let currentGame = 'lotto649';
let currentRange = 'all';
let mainChart = null;
let specialChart = null;

function isAdmin() {
  return localStorage.getItem(STORAGE_KEY) === '1';
}

function checkAdminParam() {
  const params = new URLSearchParams(location.search);
  const k = params.get('admin');
  if (k === ADMIN_KEY) {
    localStorage.setItem(STORAGE_KEY, '1');
    history.replaceState({}, '', location.pathname);
    alert('管理員模式已啟用（本機永久記住）');
  } else if (params.get('logout') === '1') {
    localStorage.removeItem(STORAGE_KEY);
    history.replaceState({}, '', location.pathname);
    alert('已登出管理員');
  }
}

function applyAdminUI() {
  const card = document.getElementById('generatorCard');
  if (!card) return;
  if (isAdmin()) card.classList.remove('locked-mode');
  else card.classList.add('locked-mode');
}

async function loadData() {
  const res = await fetch('data.json');
  rawData = await res.json();
  const lottoN = (rawData.lotto649 || []).length;
  const superN = (rawData.super_lotto || []).length;
  document.getElementById('heroMeta').textContent =
    `目前已收錄：大樂透 ${lottoN} 期、威力彩 ${superN} 期 · 最後更新 ${rawData.updated_at || '—'}`;
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
  document.getElementById('specialTitle').textContent = game.specialLabel;

  const mainCounts = countFreq(records, game.getMain, game.mainRange);
  const specialCounts = countFreq(records, game.getSpecial, game.specialRange);

  mainChart = renderChart(
    document.getElementById('mainChart').getContext('2d'),
    mainChart,
    mainCounts,
    '#2563eb'
  );
  specialChart = renderChart(
    document.getElementById('specialChart').getContext('2d'),
    specialChart,
    specialCounts,
    game.specialBallClass === 'second' ? '#ef4444' : '#f59e0b'
  );

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

function generate() {
  if (!isAdmin()) return;
  if (!rawData) return;
  const game = GAMES[currentGame];
  const records = filterByRange(rawData[currentGame] || [], currentRange);
  if (!records.length) {
    document.getElementById('genResult').innerHTML =
      '<p class="hint">目前無資料可統計。</p>';
    return;
  }

  const mainCounts = countFreq(records, game.getMain, game.mainRange);
  const specialCounts = countFreq(records, game.getSpecial, game.specialRange);
  const mainPool = topN(mainCounts, 15);
  const specialTop = topN(specialCounts, Math.min(8, game.specialRange[1]));

  const container = document.getElementById('genResult');
  container.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const main = pickUnique(mainPool, 6);
    const special = specialTop[Math.floor(Math.random() * specialTop.length)];
    const set = document.createElement('div');
    set.className = 'gen-set';
    const balls = main.map(n => `<span class="ball">${n}</span>`).join('');
    const specialBall = `<span class="ball ${game.specialBallClass}">${special}</span>`;
    set.innerHTML = `<span class="label">第 ${i + 1} 組</span>${balls}<span class="label" style="margin-left:6px">特</span>${specialBall}`;
    container.appendChild(set);
  }
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

document.getElementById('genBtn').addEventListener('click', generate);

checkAdminParam();
applyAdminUI();
document.querySelector('.tabs').dataset.idx = '0';

loadData().catch(err => {
  document.getElementById('heroMeta').textContent = `資料載入失敗：${err.message}`;
});
