import { searchAnime, mediaToWatchlistEntry } from '../lib/anilist.js';
import {
  init,
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  toggleEpisodeWatched,
  getSettings,
  updateSettings,
  getNotifications,
  clearNotifications,
} from '../lib/storage.js';

let currentView = 'notifications';
let displayLanguage = 'english';

// --- DOM refs ---
const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.view');

const watchlistCards = document.getElementById('watchlist-cards');
const watchlistEmpty = document.getElementById('watchlist-empty');

const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchResults = document.getElementById('search-results');
const searchEmpty = document.getElementById('search-empty');

const notificationsCards = document.getElementById('notifications-cards');
const notificationsEmpty = document.getElementById('notifications-empty');
const notificationsClear = document.getElementById('notifications-clear');

const episodesBack = document.getElementById('episodes-back');
const episodesHeader = document.getElementById('episodes-header');
const episodesGrid = document.getElementById('episodes-grid');

const settingPoll = document.getElementById('setting-poll');
const settingNotifications = document.getElementById('setting-notifications');
const settingLanguage = document.getElementById('setting-language');

// --- Navigation ---
function switchView(view) {
  currentView = view;
  navBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === view));
  views.forEach((v) => {
    const viewName = v.id.replace('view-', '');
    v.classList.toggle('active', viewName === view);
  });

  if (view === 'watchlist') renderWatchlist();
  if (view === 'notifications') renderNotifications();
}

navBtns.forEach((btn) => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// --- Helpers ---
function getTitle(entry) {
  if (displayLanguage === 'english' && entry.title.english) return entry.title.english;
  return entry.title.romaji || entry.title.english || 'Unknown';
}

function statusBadge(status) {
  const map = {
    RELEASING: ['releasing', 'Airing'],
    FINISHED: ['finished', 'Finished'],
    NOT_YET_RELEASED: ['upcoming', 'Upcoming'],
  };
  const [cls, label] = map[status] || ['finished', status];
  return `<span class="badge badge--${cls}">${label}</span>`;
}

function formatDate(unix) {
  if (!unix) return '';
  const d = new Date(unix * 1000);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// --- Watchlist ---
async function renderWatchlist() {
  const watchlist = await getWatchlist();
  const entries = Object.values(watchlist).sort((a, b) => b.addedAt - a.addedAt);

  watchlistEmpty.hidden = entries.length > 0;
  watchlistCards.innerHTML = '';

  for (const entry of entries) {
    const totalEps = entry.totalEpisodes || '?';
    const watchedCount = entry.episodesWatched.length;
    const nextEp = entry.nextAiringEpisode;

    const card = document.createElement('div');
    card.className = 'anime-card';
    card.innerHTML = `
      <img class="anime-card__cover" src="${entry.coverUrl}" alt="" loading="lazy">
      <div class="anime-card__info">
        <div class="anime-card__title">${getTitle(entry)}</div>
        <div class="anime-card__meta">
          ${statusBadge(entry.status)}
          ${nextEp ? `<span>Ep ${nextEp.episode} — ${formatDate(nextEp.airingAt)}</span>` : ''}
        </div>
        <div class="anime-card__progress">${watchedCount}/${totalEps} watched</div>
      </div>
      <div class="anime-card__actions">
        <button class="btn btn--danger btn--small remove-btn" title="Remove">&times;</button>
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.remove-btn')) return;
      showEpisodes(entry);
    });

    card.querySelector('.remove-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      await removeFromWatchlist(entry.mediaId);
      renderWatchlist();
    });

    watchlistCards.appendChild(card);
  }
}

// --- Search ---
let searchTimeout;

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    if (searchInput.value.trim().length >= 2) doSearch();
  }, 400);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch();
});

searchBtn.addEventListener('click', doSearch);

async function doSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  searchResults.innerHTML = '<div style="text-align:center"><div class="spinner"></div></div>';
  searchEmpty.hidden = true;

  try {
    const results = await searchAnime(query);
    const watchlist = await getWatchlist();

    searchResults.innerHTML = '';
    searchEmpty.hidden = results.length > 0;

    for (const media of results) {
      const inList = !!watchlist[media.id];
      const card = document.createElement('div');
      card.className = 'anime-card';
      card.innerHTML = `
        <img class="anime-card__cover" src="${media.coverImage?.medium || ''}" alt="" loading="lazy">
        <div class="anime-card__info">
          <div class="anime-card__title">${displayLanguage === 'english' && media.title.english ? media.title.english : media.title.romaji}</div>
          <div class="anime-card__meta">
            ${statusBadge(media.status)}
            ${media.episodes ? `<span>${media.episodes} eps</span>` : ''}
          </div>
        </div>
        <div class="anime-card__actions">
          <button class="btn btn--primary btn--small add-btn" ${inList ? 'disabled' : ''}>
            ${inList ? 'Added' : '+ Add'}
          </button>
        </div>
      `;

      card.querySelector('.add-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        const entry = mediaToWatchlistEntry(media);
        await addToWatchlist(entry);
        e.target.textContent = 'Added';
        e.target.disabled = true;
      });

      searchResults.appendChild(card);
    }
  } catch (err) {
    searchResults.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
  }
}

// --- Notifications ---
async function renderNotifications() {
  const notifications = await getNotifications();

  notificationsEmpty.hidden = notifications.length > 0;
  notificationsClear.hidden = notifications.length === 0;
  notificationsCards.innerHTML = '';

  for (const notif of notifications) {
    const card = document.createElement('div');
    card.className = 'anime-card';
    card.innerHTML = `
      <img class="anime-card__cover" src="${notif.coverUrl || ''}" alt="" loading="lazy">
      <div class="anime-card__info">
        <div class="anime-card__title">${notif.title}</div>
        <div class="anime-card__meta">Episode ${notif.episode}</div>
        <div class="anime-card__timestamp">${formatDate(notif.timestamp)}</div>
      </div>
    `;

    const img = card.querySelector('.anime-card__cover');
    img.addEventListener('error', () => {
      img.src = '../icons/icon-128.png';
    });

    notificationsCards.appendChild(card);
  }
}

notificationsClear.addEventListener('click', async () => {
  await clearNotifications();
  renderNotifications();
});

// --- Episodes ---
function showEpisodes(entry) {
  // Switch to episodes view
  views.forEach((v) => v.classList.remove('active'));
  document.getElementById('view-episodes').classList.add('active');
  navBtns.forEach((b) => b.classList.remove('active'));

  const totalEps = entry.totalEpisodes || Math.max(entry.episodesWatched.length, entry.nextAiringEpisode?.episode || 12);

  episodesHeader.innerHTML = `
    <img src="${entry.coverUrl}" alt="">
    <div class="episodes-header__info">
      <div class="episodes-header__title">${getTitle(entry)}</div>
      <div class="episodes-header__meta">
        ${entry.episodesWatched.length}/${entry.totalEpisodes || '?'} watched
        ${statusBadge(entry.status)}
      </div>
    </div>
  `;

  renderEpisodeGrid(entry, totalEps);
}

function renderEpisodeGrid(entry, totalEps) {
  episodesGrid.innerHTML = '';

  for (let i = 1; i <= totalEps; i++) {
    const cell = document.createElement('div');
    cell.className = `episode-cell${entry.episodesWatched.includes(i) ? ' watched' : ''}`;
    cell.textContent = i;
    cell.addEventListener('click', async () => {
      const updated = await toggleEpisodeWatched(entry.mediaId, i);
      cell.classList.toggle('watched', updated.includes(i));
      // Update header count
      const countEl = episodesHeader.querySelector('.episodes-header__meta');
      if (countEl) {
        countEl.innerHTML = `${updated.length}/${entry.totalEpisodes || '?'} watched ${statusBadge(entry.status)}`;
      }
    });
    episodesGrid.appendChild(cell);
  }
}

episodesBack.addEventListener('click', () => switchView('watchlist'));

// --- Settings ---
async function loadSettings() {
  const settings = await getSettings();
  settingPoll.value = settings.pollIntervalMinutes;
  settingNotifications.checked = settings.notificationsEnabled;
  settingLanguage.value = settings.displayLanguage;
  displayLanguage = settings.displayLanguage;
}

settingPoll.addEventListener('change', async () => {
  const settings = await updateSettings({ pollIntervalMinutes: Number(settingPoll.value) });
  // Tell the service worker to update the alarm
  chrome.runtime.sendMessage({ type: 'UPDATE_ALARM', interval: settings.pollIntervalMinutes });
});

settingNotifications.addEventListener('change', async () => {
  await updateSettings({ notificationsEnabled: settingNotifications.checked });
});

settingLanguage.addEventListener('change', async () => {
  displayLanguage = settingLanguage.value;
  await updateSettings({ displayLanguage });
  if (currentView === 'watchlist') renderWatchlist();
});

// --- Init ---
async function start() {
  await init();
  await loadSettings();
  renderNotifications();
}

start();
