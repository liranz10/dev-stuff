/**
 * Games Portal — app.js
 * Loads games.json and renders the game gallery.
 */

const STATUS_LABELS = {
  'in-progress': 'בפיתוח',
  'ready': 'מוכן',
  'published': 'פורסם',
};

const STATUS_CLASS = {
  'in-progress': 'in-progress',
  'ready': 'ready',
  'published': 'published',
};

async function init() {
  const loading = document.getElementById('loading');
  const emptyState = document.getElementById('empty-state');
  const gamesGrid = document.getElementById('games-grid');
  const modal = document.getElementById('modal');
  const modalIframe = document.getElementById('modal-iframe');
  const modalClose = document.getElementById('modal-close');
  const modalBackdrop = document.getElementById('modal-backdrop');

  // Load games data
  let data;
  try {
    const res = await fetch('./games.json?t=' + Date.now());
    data = await res.json();
  } catch {
    loading.innerHTML = '<p>שגיאה בטעינת המשחקים</p>';
    return;
  }

  loading.style.display = 'none';

  const games = data.games || [];

  if (games.length === 0) {
    emptyState.style.display = 'block';
    return;
  }

  // Render game cards
  gamesGrid.style.display = 'grid';
  gamesGrid.innerHTML = games.map(renderCard).join('');

  // Attach play button listeners
  gamesGrid.querySelectorAll('[data-play]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = btn.dataset.play;
      openModal(url, modal, modalIframe);
    });
  });

  // Card click also opens modal
  gamesGrid.querySelectorAll('.game-card').forEach((card) => {
    card.addEventListener('click', () => {
      const url = card.dataset.url;
      if (url) openModal(url, modal, modalIframe);
    });
  });

  // Close modal
  function closeModal() {
    modal.style.display = 'none';
    modalIframe.src = '';
  }

  modalClose.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

function renderCard(game) {
  const statusLabel = STATUS_LABELS[game.status] || game.status;
  const statusClass = STATUS_CLASS[game.status] || '';
  const tags = (game.tags || []).map((t) => `<span class="tag">${t}</span>`).join('');
  const hasUrl = !!game.url;

  const thumbnail = game.thumbnail
    ? `<img src="${game.thumbnail}" alt="${game.name}" loading="lazy" />`
    : `<span>${game.emoji || '🎮'}</span>`;

  return `
    <div class="game-card" data-url="${game.url || ''}">
      <div class="card-thumbnail ${game.thumbnail ? '' : 'placeholder'}">
        ${thumbnail}
      </div>
      <div class="card-body">
        <div class="card-header">
          <h2 class="card-title">${game.name}</h2>
          <span class="status-badge ${statusClass}">${statusLabel}</span>
        </div>
        <p class="card-description">${game.description || ''}</p>
        ${tags ? `<div class="card-tags">${tags}</div>` : ''}
        <div class="card-actions">
          ${hasUrl
            ? `<button class="btn btn-play" data-play="${game.url}">▶ שחק עכשיו</button>`
            : `<button class="btn btn-play" disabled style="opacity:0.4;cursor:default">⏳ בקרוב</button>`
          }
        </div>
      </div>
    </div>
  `;
}

function openModal(url, modal, iframe) {
  iframe.src = url;
  modal.style.display = 'flex';
}

// Run
init();
