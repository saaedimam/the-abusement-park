import { LEAGUE_ID, MISSING_ARCHIVE_IMAGES, OLD_GUARDS, seasons } from './data.js';
import { buildStats, escapeHtml, renderManagerName, trailingStreak } from './domain.js';
import { loadLiveStandings } from './live.js';

const missingArchiveImages = new Set(MISSING_ARCHIVE_IMAGES);

let lightboxIndex = 0;
let lightboxReturnFocus = null;

function renderPodium(sorted) {
  const el = document.getElementById('podium');
  const medals = ['🥈', '🥇', '🥉'];
  const places = ['place-2', 'place-1', 'place-3'];
  const top3 = [sorted[1], sorted[0], sorted[2]].filter(Boolean);

  el.innerHTML = top3.map((entry, i) => {
    const [name, wins] = entry;
    const place = places[i];
    return `<div class="podium-card ${place}">
      <div class="podium-medal">${medals[i]}</div>
      <div class="podium-name">${renderManagerName(name)}</div>
      <div class="podium-titles">${wins}</div>
      <div class="podium-lbl">${wins === 1 ? 'title' : 'titles'}</div>
    </div>`;
  }).join('');
}

function renderAwards(shame) {
  document.getElementById('awards-shame').innerHTML = shame.map(a => `
    <div class="award-card shame">
      <div class="award-emoji">${a.emoji}</div>
      <div class="award-title">${escapeHtml(a.title)}</div>
      <div class="award-winner">${escapeHtml(a.winner)}</div>
      <div class="award-detail">${escapeHtml(a.detail)}</div>
    </div>
  `).join('');
}

function updateView(mode, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');

  const stats = buildStats(mode);
  document.getElementById('standings-panel').setAttribute('aria-labelledby', btn.id);

  const bottleName = stats.bottleLeader?.name || '—';
  const bottleTitle = stats.bottleLeader
    ? `${stats.bottleLeader.count} runner-up finish${stats.bottleLeader.count !== 1 ? 'es' : ''} in this view`
    : 'No runner-up data in this view';
  const mostTitleCount = stats.sorted[0]?.[1] || 0;
  const mostTitleLeaders = stats.sorted
    .filter(([, wins]) => wins === mostTitleCount)
    .map(([name]) => name);
  const mostTitleNames = mostTitleLeaders.join(' & ');
  const reigningName = stats.data[stats.data.length - 1]?.winner || '—';
  const oldGuardNames = OLD_GUARDS.map(manager => manager.name).join(', ');
  const oldGuardItems = OLD_GUARDS.map(manager => `<li>${escapeHtml(manager.displayName)}</li>`).join('');
  document.getElementById('stats-bar').innerHTML = `
    <div class="stat"><div class="stat-val">${stats.total}</div><div class="stat-lbl">Seasons</div></div>
    <div class="stat"><div class="stat-val">${stats.uniqueChamps}</div><div class="stat-lbl">Champions</div></div>
    <div class="stat stat-named"><div class="stat-val stat-val-text">${escapeHtml(reigningName)}</div><div class="stat-lbl">Reigning champ</div></div>
    <div class="stat stat-named" title="${escapeHtml(bottleTitle)}"><div class="stat-val stat-val-text">${escapeHtml(bottleName)}</div><div class="stat-lbl">Chief bottler</div></div>
    <div class="stat stat-most-titles" title="${escapeHtml(mostTitleNames)} · ${mostTitleCount} title${mostTitleCount !== 1 ? 's' : ''} each">
      <div class="stat-val">${mostTitleCount}</div>
      <p class="stat-detail">${escapeHtml(mostTitleNames)}</p>
      <div class="stat-lbl">Most titles</div>
    </div>
    <div class="stat stat-old-guards" title="${escapeHtml(oldGuardNames)}" aria-label="The OGs: ${escapeHtml(oldGuardNames)}">
      <ul class="old-guards-list">${oldGuardItems}</ul>
      <div class="stat-lbl">The OGs</div>
    </div>
  `;

  renderPodium(stats.sorted);

  const standingsEl = document.getElementById('standings');
  standingsEl.innerHTML = '';
  stats.sorted.forEach(([name], i) => {
    const safeName = escapeHtml(name);
    const wonYears = stats.data.filter(s => s.winner === name).map(s => s.year.slice(-2));
    const streak = trailingStreak(stats.data, name);
    const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
    const streakTag = streak >= 2 ? `<span class="streak-badge" title="${streak} in a row">🔥 ×${streak}</span>` : '';

    const row = document.createElement('div');
    row.className = `row ${rankClass}`;
    row.innerHTML = `
      <div class="rank-num">${i + 1}</div>
      <div class="manager-col" title="${safeName}">
                  <div>
                    <div class="manager-name">${renderManagerName(name)}${streakTag}</div>
                  </div>
                </div>
                <div class="wins-col">
                            <div class="wins-trophies">${wonYears.map(year => `<span title="Won '${escapeHtml(year)}'">🏆</span>`).join('')}</div>
                            <div class="wins-years">${wonYears.map(y => `<span class="season-badge">${escapeHtml(y)}</span>`).join('')}</div>
                          </div>`;
    standingsEl.appendChild(row);
  });
}

function updateLightboxNav() {
  document.getElementById('lightbox-prev').disabled = lightboxIndex <= 0;
  document.getElementById('lightbox-next').disabled = lightboxIndex >= seasons.length - 1;
}

function showLightboxImage() {
  const s = seasons[lightboxIndex];
  const img = document.getElementById('lightbox-img');
  const err = document.getElementById('lightbox-error');
  const caption = document.getElementById('lightbox-caption');
  const title = document.getElementById('lightbox-title');

  caption.textContent = `${s.year} · Won by ${s.winner}`;
  title.textContent = `Final league table – ${s.year}`;
  img.alt = `Final league table – ${s.year}`;
  img.onload = () => { img.hidden = false; err.hidden = true; };
  img.onerror = () => { img.hidden = true; err.hidden = false; };
  if (missingArchiveImages.has(s.img)) {
    img.onload = null;
    img.onerror = null;
    img.hidden = true;
    img.removeAttribute('src');
    err.hidden = false;
    updateLightboxNav();
    return;
  }
  err.hidden = true;
  img.hidden = true;
  img.src = s.img;
  updateLightboxNav();
}

function openLightboxAt(index) {
  lightboxIndex = index;
  const modal = document.getElementById('lightbox');
  lightboxReturnFocus = document.activeElement;
  showLightboxImage();
  modal.hidden = false;
  modal.classList.add('active');
  document.getElementById('lightbox-close').focus();
  document.addEventListener('keydown', handleLightboxKeydown);
}

function closeLightbox() {
  const modal = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  modal.classList.remove('active');
  modal.hidden = true;
  img.src = '';
  img.onload = null;
  img.onerror = null;
  document.removeEventListener('keydown', handleLightboxKeydown);
  lightboxReturnFocus?.focus?.();
  lightboxReturnFocus = null;
}

function handleLightboxKeydown(e) {
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft' && lightboxIndex > 0) { lightboxIndex--; showLightboxImage(); }
  if (e.key === 'ArrowRight' && lightboxIndex < seasons.length - 1) { lightboxIndex++; showLightboxImage(); }
}

function injectJsonLd() {
  const script = document.getElementById('json-ld');
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SportsOrganization',
        name: 'The Abusement Park',
        url: 'https://the-abusement-park.pages.dev/',
        description: 'Fantasy Premier League mini-league since 2008/09',
      },
      {
        '@type': 'ItemList',
        name: 'Season champions',
        itemListElement: seasons.map((s, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: s.year,
          description: `Winner: ${s.winner}`,
        })),
      },
    ],
  });
}

function setupFplLink() {
  const link = document.getElementById('fpl-link');
  if (!LEAGUE_ID) { link.hidden = true; return; }
  link.href = `https://fantasy.premierleague.com/leagues/${LEAGUE_ID}/standings/c`;
  link.hidden = false;
}

function setupStickyFilter() {
  const wrap = document.getElementById('filter-sticky');
  const observer = new IntersectionObserver(
    ([e]) => wrap.classList.toggle('is-stuck', !e.isIntersecting),
    { rootMargin: '-1px 0px 0px 0px', threshold: [1] }
  );
  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'height:1px;margin-top:-1px';
  wrap.parentNode.insertBefore(sentinel, wrap);
  observer.observe(sentinel);
}

function buildHistory() {
  const historyEl = document.getElementById('history');
  const latestYear = seasons[seasons.length - 1].year;
  seasons.map((s, idx) => ({ s, idx })).reverse().forEach(({ s, idx }) => {
    const isCurrent = s.year === latestYear;
    const card = document.createElement('div');
    card.className = `history-card${isCurrent ? ' current-season' : ''}`;
    card.addEventListener('click', () => openLightboxAt(idx));
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute(
      'aria-label',
      `View season details · ${s.year} · ${s.winner}${isCurrent ? ' · Latest' : ''}`
    );
    card.innerHTML = `
      <div class="trophy-icon" aria-hidden="true">🏆</div>
      <div class="history-season">${escapeHtml(s.year)}</div>
      <div class="history-winner">${escapeHtml(s.winner.split(' ')[0])}</div>
      ${isCurrent ? '<div class="current-label">Latest</div>' : ''}`;
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightboxAt(idx); }
    });
    historyEl.appendChild(card);
  });
}

document.addEventListener('error', e => {
  const img = e.target;
  if (!img?.classList?.contains('avatar-img')) return;
  const wrap = img.parentElement;
  wrap.style.color = wrap.dataset.fg || '#fff';
  wrap.textContent = wrap.dataset.initials || '?';
}, true);

// --- FEATURE: Bragging Rights Generator ---
function setupBraggingRights() {
  const btn = document.getElementById('btn-share-podium');

  btn.addEventListener('click', () => {
    const target = document.getElementById('brag-container');
    const originalBg = target.style.background;

    if (typeof html2canvas !== 'function') {
      btn.textContent = '❌ Failed';
      setTimeout(() => { btn.textContent = '📸 Share Podium to WhatsApp'; }, 2000);
      return;
    }

    target.style.background = '#0a0c10';
    btn.textContent = '📸 Generating...';

    html2canvas(target, {
      backgroundColor: '#0a0c10',
      scale: 2,
      useCORS: true
    }).then(canvas => {
      target.style.background = originalBg;
      btn.textContent = '📸 Share Podium to WhatsApp';

      const link = document.createElement('a');
      link.download = 'abusement-park-podium.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    }).catch(err => {
      console.error("Screenshot failed:", err);
      btn.textContent = '❌ Failed';
      target.style.background = originalBg;
      setTimeout(() => btn.textContent = '📸 Share Podium to WhatsApp', 2000);
    });
  });
}

function init() {
  setupFplLink();
  injectJsonLd();
  buildHistory();
  setupStickyFilter();

  loadLiveStandings();
  setupBraggingRights();

  const allTimeStats = buildStats('all');
  renderAwards(allTimeStats.awardsShame);

  document.getElementById('lightbox').addEventListener('click', e => {
    if (e.target.id === 'lightbox') closeLightbox();
  });
  document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
  document.getElementById('lightbox-prev').addEventListener('click', e => {
    e.stopPropagation();
    if (lightboxIndex > 0) { lightboxIndex--; showLightboxImage(); }
  });
  document.getElementById('lightbox-next').addEventListener('click', e => {
    e.stopPropagation();
    if (lightboxIndex < seasons.length - 1) { lightboxIndex++; showLightboxImage(); }
  });

  document.querySelector('.filter-bar').addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (btn) updateView(btn.dataset.mode, btn);
  });

  const start = () => updateView('all', document.getElementById('tab-all'));
  start();
}

init();
