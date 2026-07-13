import { reflectionBank } from './reflection-bank.js';
import { initWellbeing } from './wellbeing.js';

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const store = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Penyimpanan mungkin dibatasi. */ }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { /* Abaikan pembatasan penyimpanan. */ }
  }
};

const categoryNames = Object.keys(reflectionBank);
const favoriteStorageKey = 'bs-favorite-quotes-v2';
const state = {
  quotes: [],
  quoteMap: new Map(),
  favorites: new Map(),
  seenIds: new Set(),
  currentQuote: null,
  installPrompt: null,
  toastTimer: null
};

function toast(message) {
  const element = $('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => element.classList.remove('show'), 2800);
}

function formatDate(date, options = {}) {
  return new Intl.DateTimeFormat('id-ID', options).format(date);
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hashString(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(items, random = Math.random) {
  return items[Math.floor(random() * items.length)];
}

function normalizeQuote(value) {
  if (!value || typeof value !== 'object') return null;
  const text = String(value.text || '').trim();
  const category = String(value.category || '').trim();
  if (!text || !category) return null;
  return {
    id: String(value.id || `r-${hashString(`${category}|${text}`).toString(36)}`),
    text,
    category,
    source: String(value.source || 'Bisikan yang dirangkai di perangkatmu')
  };
}

function composeReflection(category = 'all', random = Math.random) {
  const selectedCategory = category === 'all' || !reflectionBank[category]
    ? pick(categoryNames, random)
    : category;
  const bank = reflectionBank[selectedCategory];
  const lead = pick(bank.leads, random);
  const bridge = pick(bank.bridges, random);
  const close = pick(bank.closes, random);
  const patterns = [
    `${lead}. ${bridge}. ${close}`,
    `${lead}. ${close} ${bridge}.`,
    `${bridge}. ${lead}. ${close}`,
    `${lead}; ${bridge.charAt(0).toLowerCase()}${bridge.slice(1)}. ${close}`
  ];
  return normalizeQuote({
    text: pick(patterns, random).replace(/\.\./g, '.'),
    category: selectedCategory,
    source: 'Bisikan yang dirangkai di perangkatmu'
  });
}

function registerQuote(quote, { prepend = false } = {}) {
  const normalized = normalizeQuote(quote);
  if (!normalized) return null;
  state.seenIds.add(normalized.id);
  state.quoteMap.set(normalized.id, normalized);
  const existingIndex = state.quotes.findIndex((item) => item.id === normalized.id);
  if (existingIndex >= 0) state.quotes.splice(existingIndex, 1);
  if (prepend) state.quotes.unshift(normalized);
  else state.quotes.push(normalized);
  return normalized;
}

function createUniqueReflection(category = 'all', random = Math.random) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const quote = composeReflection(category, random);
    if (!state.seenIds.has(quote.id) && !state.favorites.has(quote.id)) return quote;
  }
  const fallback = composeReflection(category, random);
  fallback.text = `${fallback.text} Tetaplah hadir pada napasmu.`;
  fallback.id = `r-${hashString(`${fallback.text}|${Date.now()}`).toString(36)}`;
  return fallback;
}

function generateBatch(amount = 9, category = 'all', { prepend = false, announce = true } = {}) {
  const created = [];
  for (let index = 0; index < amount; index += 1) {
    const quote = createUniqueReflection(category);
    registerQuote(quote, { prepend });
    created.push(quote);
  }
  updateGeneratedCount();
  renderLibrary();
  if (announce) toast(`${amount} bisikan baru dirangkai tanpa API.`);
  return created;
}

function createDailyReflection() {
  const random = seededRandom(hashString(`bisikan-sufi|${localDateKey()}`));
  const quote = composeReflection('all', random);
  registerQuote(quote, { prepend: true });
  return quote;
}

function loadFavorites() {
  const saved = store.get(favoriteStorageKey, []);
  if (!Array.isArray(saved)) return;
  saved.map(normalizeQuote).filter(Boolean).forEach((quote) => {
    state.favorites.set(quote.id, quote);
    state.quoteMap.set(quote.id, quote);
  });
}

function persistFavorites() {
  store.set(favoriteStorageKey, [...state.favorites.values()]);
}

function updateGeneratedCount() {
  const count = $('#generated-count');
  if (count) count.textContent = String(state.quotes.length);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Malam masih panjang. Mari hening sejenak.';
  if (hour < 11) return 'Selamat pagi. Mulai dengan hati yang lapang.';
  if (hour < 15) return 'Selamat siang. Beri jiwa ruang untuk bernapas.';
  if (hour < 18) return 'Selamat sore. Pelankan langkahmu.';
  return 'Selamat malam. Pulangkan hati pada ketenangan.';
}

function initDates() {
  const now = new Date();
  if ($('#greeting')) $('#greeting').textContent = greeting();
  if ($('#today-label')) $('#today-label').textContent = formatDate(now, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if ($('#journal-day')) $('#journal-day').textContent = formatDate(now, { weekday: 'long' });
  if ($('#journal-date')) $('#journal-date').textContent = formatDate(now, { day: 'numeric', month: 'long', year: 'numeric' });
  if ($('#year')) $('#year').textContent = String(now.getFullYear());
}

function showQuote(quote, { scroll = false } = {}) {
  const normalized = normalizeQuote(quote);
  if (!normalized) return;
  state.currentQuote = normalized;
  state.quoteMap.set(normalized.id, normalized);
  if ($('#daily-quote')) $('#daily-quote').textContent = normalized.text;
  if ($('#quote-category')) $('#quote-category').textContent = normalized.category;
  if ($('#quote-source')) $('#quote-source').textContent = `— ${normalized.source}`;
  updateFavoriteButton();
  if (scroll) $('#renungan')?.scrollIntoView({ behavior: document.documentElement.classList.contains('reduce-motion') ? 'auto' : 'smooth' });
}

function createFreshQuote() {
  const theme = $('#generator-theme')?.value || 'all';
  const quote = createUniqueReflection(theme);
  registerQuote(quote, { prepend: true });
  updateGeneratedCount();
  showQuote(quote);
  renderLibrary();
}

function quoteShareText(quote = state.currentQuote) {
  return `“${quote?.text || ''}”\n\n— ${quote?.source || 'Bisikan Sufi'}\n${location.href.split('#')[0]}`;
}

async function copyText(text, successMessage = 'Teks disalin.') {
  try {
    await navigator.clipboard.writeText(text);
    toast(successMessage);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
    toast(successMessage);
  }
}

async function shareCurrentQuote() {
  const payload = {
    title: 'Bisikan Sufi',
    text: quoteShareText(),
    url: location.href.split('#')[0]
  };
  if (navigator.share) {
    try { await navigator.share(payload); } catch (error) {
      if (error.name !== 'AbortError') await copyText(quoteShareText(), 'Renungan disalin untuk dibagikan.');
    }
  } else {
    await copyText(quoteShareText(), 'Renungan disalin untuk dibagikan.');
  }
}

function findQuote(id) {
  return state.quoteMap.get(id) || state.favorites.get(id) || null;
}

function toggleFavorite(id = state.currentQuote?.id) {
  if (!id) return;
  if (state.favorites.has(id)) {
    state.favorites.delete(id);
    toast('Renungan dihapus dari simpanan.');
  } else {
    const quote = findQuote(id);
    if (!quote) return;
    state.favorites.set(id, quote);
    toast('Renungan disimpan di perangkat ini.');
  }
  persistFavorites();
  updateFavoriteButton();
  renderLibrary();
}

function updateFavoriteButton() {
  const button = $('#favorite-quote');
  if (!button || !state.currentQuote) return;
  const active = state.favorites.has(state.currentQuote.id);
  button.setAttribute('aria-pressed', String(active));
  button.textContent = active ? '♥ Tersimpan' : '♡ Simpan';
}

function wrapCanvasText(context, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function downloadQuoteCard() {
  if (!state.currentQuote) return;
  const canvas = $('#quote-canvas');
  const context = canvas?.getContext('2d');
  if (!canvas || !context) return;

  const gradient = context.createLinearGradient(0, 0, 1080, 1080);
  gradient.addColorStop(0, '#080b14');
  gradient.addColorStop(.52, '#171a2c');
  gradient.addColorStop(1, '#0a1214');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1080, 1080);

  const glow = context.createRadialGradient(830, 170, 0, 830, 170, 460);
  glow.addColorStop(0, 'rgba(225,190,119,.2)');
  glow.addColorStop(1, 'rgba(225,190,119,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 1080, 1080);

  context.strokeStyle = 'rgba(225,190,119,.34)';
  context.lineWidth = 2;
  context.strokeRect(70, 70, 940, 940);

  context.fillStyle = '#e1be77';
  context.font = '700 27px system-ui, sans-serif';
  context.fillText(state.currentQuote.category.toUpperCase(), 110, 155);

  context.fillStyle = '#f6f0e5';
  context.font = '48px Georgia, serif';
  const lines = wrapCanvasText(context, state.currentQuote.text, 820);
  const lineHeight = 65;
  const totalHeight = lines.length * lineHeight;
  let y = Math.max(265, 525 - totalHeight / 2);
  lines.slice(0, 10).forEach((line) => {
    context.fillText(line, 110, y);
    y += lineHeight;
  });

  context.fillStyle = '#e1be77';
  context.font = '24px system-ui, sans-serif';
  context.fillText(`— ${state.currentQuote.source}`, 110, Math.min(y + 42, 890));

  context.fillStyle = '#999bac';
  context.font = '22px system-ui, sans-serif';
  context.fillText('BISIKAN SUFI  •  DIRANGKAI LOKAL TANPA API', 110, 945);

  const link = document.createElement('a');
  link.download = `bisikan-sufi-${state.currentQuote.id}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  toast('Kartu renungan diunduh.');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function populateCategories() {
  const options = categoryNames.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  if ($('#category-filter')) $('#category-filter').innerHTML = `<option value="all">Semua kategori</option>${options}`;
  if ($('#generator-theme')) $('#generator-theme').innerHTML = `<option value="all">Tema campuran</option>${options}`;
}

function quotesForLibrary() {
  const combined = new Map();
  state.quotes.forEach((quote) => combined.set(quote.id, quote));
  state.favorites.forEach((quote) => combined.set(quote.id, quote));
  return [...combined.values()];
}

function filteredQuotes() {
  const search = ($('#quote-search')?.value || '').trim().toLocaleLowerCase('id');
  const category = $('#category-filter')?.value || 'all';
  const onlyFavorites = $('#favorites-filter')?.checked || false;
  const source = onlyFavorites ? [...state.favorites.values()] : quotesForLibrary();
  return source.filter((quote) => {
    const matchesText = !search || `${quote.text} ${quote.category}`.toLocaleLowerCase('id').includes(search);
    const matchesCategory = category === 'all' || quote.category === category;
    return matchesText && matchesCategory;
  });
}

function renderLibrary() {
  const grid = $('#quote-grid');
  if (!grid) return;
  const quotes = filteredQuotes();
  grid.innerHTML = quotes.map((quote, index) => {
    const favorite = state.favorites.has(quote.id);
    return `
      <article class="quote-card" style="--card-index:${index % 9}">
        <div class="quote-card-topline">
          <span class="pill">${escapeHtml(quote.category)}</span>
          <button class="icon-button favorite-card" type="button" data-favorite-id="${escapeHtml(quote.id)}" aria-pressed="${favorite}" aria-label="${favorite ? 'Hapus dari simpanan' : 'Simpan renungan'}">${favorite ? '♥' : '♡'}</button>
        </div>
        <blockquote>“${escapeHtml(quote.text)}”</blockquote>
        <div class="quote-card-footer">
          <span>${escapeHtml(quote.source)}</span>
          <button class="card-read" type="button" data-open-id="${escapeHtml(quote.id)}">Baca penuh <span aria-hidden="true">↗</span></button>
        </div>
      </article>`;
  }).join('');

  if ($('#empty-state')) $('#empty-state').hidden = quotes.length !== 0;
}

function resetStream() {
  state.quotes = [];
  state.seenIds = new Set([...state.favorites.keys()]);
  state.quoteMap = new Map(state.favorites);
  const daily = createDailyReflection();
  generateBatch(17, $('#generator-theme')?.value || 'all', { announce: false });
  showQuote(daily);
  updateGeneratedCount();
  renderLibrary();
  toast('Aliran baru dimulai. Favorit tetap tersimpan.');
}

function initQuoteEvents() {
  $('#new-quote')?.addEventListener('click', createFreshQuote);
  $('#favorite-quote')?.addEventListener('click', () => toggleFavorite());
  $('#copy-quote')?.addEventListener('click', () => copyText(quoteShareText(), 'Renungan disalin.'));
  $('#share-quote')?.addEventListener('click', shareCurrentQuote);
  $('#download-quote')?.addEventListener('click', downloadQuoteCard);
  $('#quote-search')?.addEventListener('input', renderLibrary);
  $('#category-filter')?.addEventListener('change', renderLibrary);
  $('#favorites-filter')?.addEventListener('change', renderLibrary);
  $('#generate-batch')?.addEventListener('click', () => generateBatch(9, $('#generator-theme')?.value || 'all'));
  $('#load-more')?.addEventListener('click', () => generateBatch(9, $('#generator-theme')?.value || 'all'));
  $('#reset-stream')?.addEventListener('click', resetStream);
  $('#quote-grid')?.addEventListener('click', (event) => {
    const favoriteButton = event.target.closest('[data-favorite-id]');
    if (favoriteButton) {
      toggleFavorite(favoriteButton.dataset.favoriteId);
      return;
    }
    const openButton = event.target.closest('[data-open-id]');
    if (openButton) showQuote(findQuote(openButton.dataset.openId), { scroll: true });
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  if ($('#theme-icon')) $('#theme-icon').textContent = theme === 'dark' ? '☾' : '☀';
  const metaTheme = $('meta[name="theme-color"]');
  if (metaTheme) metaTheme.content = theme === 'dark' ? '#080b14' : '#f3eee4';
}

function initPreferences() {
  const savedTheme = store.get('bs-theme', null);
  const initialTheme = savedTheme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  applyTheme(initialTheme);
  $('#theme-toggle')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    store.set('bs-theme', next);
  });

  const reduceMotion = store.get('bs-reduce-motion', matchMedia('(prefers-reduced-motion: reduce)').matches);
  document.documentElement.classList.toggle('reduce-motion', reduceMotion);
  $('#motion-toggle')?.setAttribute('aria-pressed', String(reduceMotion));
  $('#motion-toggle')?.addEventListener('click', (event) => {
    const active = !document.documentElement.classList.contains('reduce-motion');
    document.documentElement.classList.toggle('reduce-motion', active);
    event.currentTarget.setAttribute('aria-pressed', String(active));
    store.set('bs-reduce-motion', active);
    toast(active ? 'Animasi dikurangi.' : 'Animasi diaktifkan.');
  });
}

function initNavigation() {
  const button = $('#menu-button');
  const nav = $('#main-nav');
  button?.addEventListener('click', () => {
    const open = nav?.classList.toggle('open') || false;
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
  });
  nav?.addEventListener('click', (event) => {
    if (event.target.matches('a')) {
      nav.classList.remove('open');
      button?.setAttribute('aria-expanded', 'false');
    }
  });
}

function initReveal() {
  const elements = $$('.reveal');
  if (document.documentElement.classList.contains('reduce-motion') || !('IntersectionObserver' in window)) {
    elements.forEach((element) => element.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: .1, rootMargin: '0px 0px -32px' });
  elements.forEach((element) => observer.observe(element));
}

function initInstall() {
  const button = $('#install-button');
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    state.installPrompt = event;
    if (button) button.hidden = false;
  });
  button?.addEventListener('click', async () => {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    await state.installPrompt.userChoice;
    state.installPrompt = null;
    button.hidden = true;
  });
  window.addEventListener('appinstalled', () => toast('Bisikan Sufi berhasil dipasang.'));
}

function initServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((error) => console.warn('Service worker gagal:', error)));
  }
}

function initReflections() {
  loadFavorites();
  populateCategories();
  const daily = createDailyReflection();
  generateBatch(17, 'all', { announce: false });
  showQuote(daily);
  updateGeneratedCount();
  renderLibrary();
}

function init() {
  initDates();
  initPreferences();
  initNavigation();
  initQuoteEvents();
  initReflections();
  initWellbeing({ $, $$, store, toast, formatDate, localDateKey });
  initReveal();
  initInstall();
  initServiceWorker();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
