(() => {
  'use strict';

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
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage may be disabled. */ }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch { /* Ignore storage restrictions. */ }
    }
  };

  const state = {
    quotes: [],
    currentQuote: null,
    favorites: new Set(store.get('bs-favorites', [])),
    visibleQuotes: 9,
    selectedMinutes: 3,
    breathing: false,
    breathPaused: false,
    breathInterval: null,
    totalBreathSeconds: 180,
    breathRemaining: 180,
    phaseIndex: 0,
    phaseRemaining: 0,
    audio: {
      context: null,
      master: null,
      nodes: [],
      playing: false,
      type: 'drone'
    },
    installPrompt: null,
    toastTimer: null
  };

  const fallbackQuotes = [
    { id: 'fallback-1', text: 'Diam bukan berarti kosong. Kadang di sanalah hati akhirnya terdengar.', category: 'Hening', source: 'Renungan Bisikan Sufi' },
    { id: 'fallback-2', text: 'Tarik napas. Bahumu boleh beristirahat meski masalah belum selesai.', category: 'Kehadiran', source: 'Renungan Bisikan Sufi' }
  ];

  const phases = [
    { key: 'inhale', label: 'Tarik', seconds: 4, instruction: 'Tarik perlahan melalui hidung' },
    { key: 'hold', label: 'Tahan', seconds: 4, instruction: 'Tahan lembut, jangan memaksa' },
    { key: 'exhale', label: 'Hembuskan', seconds: 6, instruction: 'Hembuskan perlahan melalui mulut' },
    { key: 'rest', label: 'Diam', seconds: 2, instruction: 'Berdiam sebelum napas berikutnya' }
  ];

  function toast(message) {
    const element = $('#toast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => element.classList.remove('show'), 2600);
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
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
      hash = ((hash << 5) - hash) + input.charCodeAt(index);
      hash |= 0;
    }
    return Math.abs(hash);
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
    const greetingElement = $('#greeting');
    if (greetingElement) greetingElement.textContent = greeting();
    const today = $('#today-label');
    if (today) today.textContent = formatDate(now, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const journalDay = $('#journal-day');
    if (journalDay) journalDay.textContent = formatDate(now, { weekday: 'long' });
    const journalDate = $('#journal-date');
    if (journalDate) journalDate.textContent = formatDate(now, { day: 'numeric', month: 'long', year: 'numeric' });
    const year = $('#year');
    if (year) year.textContent = String(now.getFullYear());
  }

  async function loadQuotes() {
    try {
      const response = await fetch('assets/quotes.json', { cache: 'no-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) throw new Error('Data renungan kosong');
      state.quotes = data.filter((quote) => quote.id && quote.text && quote.category);
    } catch (error) {
      console.warn('Menggunakan renungan cadangan:', error);
      state.quotes = fallbackQuotes;
      toast('Mode offline: renungan cadangan digunakan.');
    }

    const quoteCount = $('#quote-count');
    if (quoteCount) quoteCount.textContent = String(state.quotes.length);
    populateCategories();
    selectDailyQuote();
    renderLibrary();
  }

  function selectDailyQuote() {
    const index = hashString(localDateKey()) % state.quotes.length;
    showQuote(state.quotes[index]);
  }

  function showQuote(quote) {
    if (!quote) return;
    state.currentQuote = quote;
    const text = $('#daily-quote');
    const category = $('#quote-category');
    const source = $('#quote-source');
    if (text) text.textContent = quote.text;
    if (category) category.textContent = quote.category;
    if (source) source.textContent = `— ${quote.source || 'Renungan Bisikan Sufi'}`;
    updateFavoriteButton();
  }

  function randomQuote() {
    if (state.quotes.length < 2) return state.quotes[0];
    let next = state.currentQuote;
    while (next?.id === state.currentQuote?.id) {
      next = state.quotes[Math.floor(Math.random() * state.quotes.length)];
    }
    return next;
  }

  function quoteShareText(quote = state.currentQuote) {
    return `“${quote?.text || ''}”\n\n— ${quote?.source || 'Renungan Bisikan Sufi'}\n${location.href.split('#')[0]}`;
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

  function toggleFavorite(id = state.currentQuote?.id) {
    if (!id) return;
    if (state.favorites.has(id)) {
      state.favorites.delete(id);
      toast('Renungan dihapus dari simpanan.');
    } else {
      state.favorites.add(id);
      toast('Renungan disimpan di perangkat ini.');
    }
    store.set('bs-favorites', [...state.favorites]);
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
    gradient.addColorStop(0, '#0a0e1d');
    gradient.addColorStop(.55, '#171b35');
    gradient.addColorStop(1, '#0a1119');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 1080, 1080);

    const glow = context.createRadialGradient(830, 160, 0, 830, 160, 420);
    glow.addColorStop(0, 'rgba(217,182,111,.18)');
    glow.addColorStop(1, 'rgba(217,182,111,0)');
    context.fillStyle = glow;
    context.fillRect(0, 0, 1080, 1080);

    context.strokeStyle = 'rgba(217,182,111,.28)';
    context.lineWidth = 2;
    context.strokeRect(70, 70, 940, 940);

    context.fillStyle = '#d9b66f';
    context.font = '700 28px system-ui, sans-serif';
    context.letterSpacing = '4px';
    context.fillText(state.currentQuote.category.toUpperCase(), 110, 160);

    context.fillStyle = '#f5f0e7';
    context.font = '54px Georgia, serif';
    const lines = wrapCanvasText(context, state.currentQuote.text, 820);
    const lineHeight = 74;
    const totalHeight = lines.length * lineHeight;
    let y = 520 - totalHeight / 2;
    lines.forEach((line) => {
      context.fillText(line, 110, y);
      y += lineHeight;
    });

    context.fillStyle = '#d9b66f';
    context.font = '26px system-ui, sans-serif';
    context.fillText(`— ${state.currentQuote.source || 'Renungan Bisikan Sufi'}`, 110, y + 48);

    context.fillStyle = '#8d91a3';
    context.font = '24px system-ui, sans-serif';
    context.fillText('BISIKAN SUFI  •  RUANG HENING DIGITAL', 110, 945);

    const link = document.createElement('a');
    link.download = `bisikan-sufi-${state.currentQuote.id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('Kartu renungan diunduh.');
  }

  function populateCategories() {
    const select = $('#category-filter');
    if (!select) return;
    const categories = [...new Set(state.quotes.map((quote) => quote.category))].sort((a, b) => a.localeCompare(b, 'id'));
    select.innerHTML = '<option value="all">Semua kategori</option>' + categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[character]);
  }

  function filteredQuotes() {
    const search = ($('#quote-search')?.value || '').trim().toLocaleLowerCase('id');
    const category = $('#category-filter')?.value || 'all';
    const onlyFavorites = $('#favorites-filter')?.checked || false;
    return state.quotes.filter((quote) => {
      const matchesText = !search || `${quote.text} ${quote.category}`.toLocaleLowerCase('id').includes(search);
      const matchesCategory = category === 'all' || quote.category === category;
      const matchesFavorite = !onlyFavorites || state.favorites.has(quote.id);
      return matchesText && matchesCategory && matchesFavorite;
    });
  }

  function renderLibrary() {
    const grid = $('#quote-grid');
    if (!grid) return;
    const quotes = filteredQuotes();
    const visible = quotes.slice(0, state.visibleQuotes);
    grid.innerHTML = visible.map((quote) => {
      const favorite = state.favorites.has(quote.id);
      return `
        <article class="quote-card">
          <span class="pill">${escapeHtml(quote.category)}</span>
          <blockquote>“${escapeHtml(quote.text)}”</blockquote>
          <div class="quote-card-footer">
            <span>${escapeHtml(quote.source || 'Renungan Bisikan Sufi')}</span>
            <button class="icon-button favorite-card" type="button" data-favorite-id="${escapeHtml(quote.id)}" aria-pressed="${favorite}" aria-label="${favorite ? 'Hapus dari simpanan' : 'Simpan renungan'}">${favorite ? '♥' : '♡'}</button>
          </div>
        </article>`;
    }).join('');

    const empty = $('#empty-state');
    if (empty) empty.hidden = quotes.length !== 0;
    const loadMore = $('#load-more');
    if (loadMore) loadMore.hidden = quotes.length <= state.visibleQuotes;
  }

  function initQuoteEvents() {
    $('#new-quote')?.addEventListener('click', () => showQuote(randomQuote()));
    $('#favorite-quote')?.addEventListener('click', () => toggleFavorite());
    $('#copy-quote')?.addEventListener('click', () => copyText(quoteShareText(), 'Renungan disalin.'));
    $('#share-quote')?.addEventListener('click', shareCurrentQuote);
    $('#download-quote')?.addEventListener('click', downloadQuoteCard);
    $('#quote-search')?.addEventListener('input', () => { state.visibleQuotes = 9; renderLibrary(); });
    $('#category-filter')?.addEventListener('change', () => { state.visibleQuotes = 9; renderLibrary(); });
    $('#favorites-filter')?.addEventListener('change', () => { state.visibleQuotes = 9; renderLibrary(); });
    $('#load-more')?.addEventListener('click', () => { state.visibleQuotes += 9; renderLibrary(); });
    $('#quote-grid')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-favorite-id]');
      if (button) toggleFavorite(button.dataset.favoriteId);
    });
  }

  function secondsToClock(seconds) {
    const safe = Math.max(0, seconds);
    const minutes = Math.floor(safe / 60);
    const rest = String(safe % 60).padStart(2, '0');
    return `${minutes}:${rest}`;
  }

  function updateBreathDisplay() {
    const phase = phases[state.phaseIndex];
    const ring = $('#breath-ring');
    const phaseLabel = $('#breath-phase');
    const countdown = $('#breath-countdown');
    const instruction = $('#breath-instruction');
    if (ring) ring.dataset.phase = state.breathing ? phase.key : 'idle';
    if (phaseLabel) phaseLabel.textContent = state.breathing ? phase.label : 'Siap';
    if (countdown) countdown.textContent = secondsToClock(state.breathRemaining);
    if (instruction) instruction.textContent = state.breathing ? `${phase.instruction} • ${state.phaseRemaining} detik` : 'Duduk nyaman dan rilekskan bahu';
  }

  function resetBreath() {
    clearInterval(state.breathInterval);
    state.breathInterval = null;
    state.breathing = false;
    state.breathPaused = false;
    state.totalBreathSeconds = state.selectedMinutes * 60;
    state.breathRemaining = state.totalBreathSeconds;
    state.phaseIndex = 0;
    state.phaseRemaining = phases[0].seconds;
    const start = $('#breath-start');
    if (start) start.textContent = 'Mulai latihan';
    updateBreathDisplay();
  }

  function completeBreath() {
    clearInterval(state.breathInterval);
    state.breathInterval = null;
    state.breathing = false;
    state.breathPaused = false;
    state.breathRemaining = 0;
    updateBreathDisplay();
    const ring = $('#breath-ring');
    const phaseLabel = $('#breath-phase');
    const instruction = $('#breath-instruction');
    if (ring) ring.dataset.phase = 'idle';
    if (phaseLabel) phaseLabel.textContent = 'Selesai';
    if (instruction) instruction.textContent = 'Bawa ketenangan ini ke langkah berikutnya';
    const start = $('#breath-start');
    if (start) start.textContent = 'Mulai lagi';
    recordPractice();
    toast('Latihan selesai. Terima kasih sudah memberi diri waktu.');
  }

  function breathTick() {
    if (!state.breathing || state.breathPaused) return;
    state.breathRemaining -= 1;
    state.phaseRemaining -= 1;
    if (state.breathRemaining <= 0) {
      completeBreath();
      return;
    }
    if (state.phaseRemaining <= 0) {
      state.phaseIndex = (state.phaseIndex + 1) % phases.length;
      state.phaseRemaining = phases[state.phaseIndex].seconds;
    }
    updateBreathDisplay();
  }

  function toggleBreath() {
    if (!state.breathing) {
      if (state.breathRemaining <= 0) resetBreath();
      state.breathing = true;
      state.breathPaused = false;
      state.phaseIndex = 0;
      state.phaseRemaining = phases[0].seconds;
      state.breathInterval = setInterval(breathTick, 1000);
      const start = $('#breath-start');
      if (start) start.textContent = 'Jeda';
      updateBreathDisplay();
      return;
    }

    state.breathPaused = !state.breathPaused;
    const start = $('#breath-start');
    if (start) start.textContent = state.breathPaused ? 'Lanjutkan' : 'Jeda';
    const phaseLabel = $('#breath-phase');
    if (state.breathPaused && phaseLabel) phaseLabel.textContent = 'Dijeda';
  }

  function recordPractice() {
    const dates = new Set(store.get('bs-practice-dates', []));
    dates.add(localDateKey());
    store.set('bs-practice-dates', [...dates].sort());
    renderStreak();
  }

  function currentStreak() {
    const dates = new Set(store.get('bs-practice-dates', []));
    let cursor = new Date();
    let streak = 0;
    if (!dates.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (dates.has(localDateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function renderStreak() {
    const streak = $('#streak-count');
    if (streak) streak.textContent = String(currentStreak());
  }

  function initBreathing() {
    resetBreath();
    renderStreak();
    $('#duration-options')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-minutes]');
      if (!button || state.breathing) {
        if (state.breathing) toast('Atur ulang latihan sebelum mengganti durasi.');
        return;
      }
      state.selectedMinutes = Number(button.dataset.minutes);
      $$('#duration-options button').forEach((item) => item.classList.toggle('active', item === button));
      resetBreath();
    });
    $('#breath-start')?.addEventListener('click', toggleBreath);
    $('#breath-reset')?.addEventListener('click', resetBreath);
  }

  function createNoiseBuffer(context, seconds = 2) {
    const length = context.sampleRate * seconds;
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) channel[index] = (Math.random() * 2) - 1;
    return buffer;
  }

  function clearAudioNodes() {
    state.audio.nodes.forEach((node) => {
      try { node.stop?.(); } catch { /* Node may already be stopped. */ }
      try { node.disconnect?.(); } catch { /* Ignore disconnect errors. */ }
    });
    state.audio.nodes = [];
  }

  function createDrone(context, output) {
    [110, 164.81, 220].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 1 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index === 0 ? -7 : index === 2 ? 5 : 0;
      gain.gain.value = index === 1 ? .055 : .035;
      oscillator.connect(gain).connect(output);
      oscillator.start();
      state.audio.nodes.push(oscillator, gain);
    });
  }

  function createRain(context, output) {
    const source = context.createBufferSource();
    const highpass = context.createBiquadFilter();
    const lowpass = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = createNoiseBuffer(context, 3);
    source.loop = true;
    highpass.type = 'highpass';
    highpass.frequency.value = 900;
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 7000;
    gain.gain.value = .28;
    source.connect(highpass).connect(lowpass).connect(gain).connect(output);
    source.start();
    state.audio.nodes.push(source, highpass, lowpass, gain);
  }

  function createWind(context, output) {
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    source.buffer = createNoiseBuffer(context, 4);
    source.loop = true;
    filter.type = 'bandpass';
    filter.frequency.value = 420;
    filter.Q.value = .7;
    gain.gain.value = .18;
    lfo.frequency.value = .12;
    lfoGain.gain.value = 170;
    lfo.connect(lfoGain).connect(filter.frequency);
    source.connect(filter).connect(gain).connect(output);
    source.start();
    lfo.start();
    state.audio.nodes.push(source, filter, gain, lfo, lfoGain);
  }

  async function startAudio() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      toast('Browser ini belum mendukung suara ambient.');
      return;
    }
    if (!state.audio.context) {
      state.audio.context = new AudioContextClass();
      state.audio.master = state.audio.context.createGain();
      state.audio.master.gain.value = Number($('#volume')?.value || 35) / 100;
      state.audio.master.connect(state.audio.context.destination);
    }
    if (state.audio.context.state === 'suspended') await state.audio.context.resume();
    clearAudioNodes();
    if (state.audio.type === 'rain') createRain(state.audio.context, state.audio.master);
    else if (state.audio.type === 'wind') createWind(state.audio.context, state.audio.master);
    else createDrone(state.audio.context, state.audio.master);
    state.audio.playing = true;
    renderAudioState();
  }

  function stopAudio() {
    clearAudioNodes();
    state.audio.playing = false;
    renderAudioState();
  }

  function renderAudioState() {
    const consoleElement = $('.audio-console');
    const toggle = $('#audio-toggle');
    const icon = $('#audio-play-icon');
    const status = $('#audio-status');
    consoleElement?.classList.toggle('playing', state.audio.playing);
    toggle?.setAttribute('aria-pressed', String(state.audio.playing));
    if (icon) icon.textContent = state.audio.playing ? '■' : '▶';
    if (status) status.textContent = state.audio.playing ? 'Sedang diputar' : 'Siap diputar';
  }

  function initAudio() {
    const soundNames = { drone: 'Ruang Hening', rain: 'Hujan Jauh', wind: 'Angin Malam' };
    $('.sound-grid')?.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-sound]');
      if (!button) return;
      state.audio.type = button.dataset.sound;
      $$('.sound-card').forEach((card) => {
        const active = card === button;
        card.classList.toggle('active', active);
        card.setAttribute('aria-pressed', String(active));
      });
      const title = $('#audio-title');
      if (title) title.textContent = soundNames[state.audio.type];
      if (state.audio.playing) await startAudio();
    });
    $('#audio-toggle')?.addEventListener('click', () => state.audio.playing ? stopAudio() : startAudio());
    $('#volume')?.addEventListener('input', (event) => {
      if (state.audio.master) state.audio.master.gain.setTargetAtTime(Number(event.target.value) / 100, state.audio.context.currentTime, .02);
    });
    window.addEventListener('pagehide', stopAudio);
  }

  function journalKey() { return `bs-journal-${localDateKey()}`; }

  function countWords(value) {
    const clean = value.trim();
    return clean ? clean.split(/\s+/).length : 0;
  }

  function updateWordCount() {
    const entry = $('#journal-entry');
    const count = $('#word-count');
    if (entry && count) count.textContent = String(countWords(entry.value));
  }

  function saveJournal(silent = false) {
    const entry = $('#journal-entry');
    if (!entry) return;
    store.set(journalKey(), { text: entry.value, savedAt: new Date().toISOString() });
    const status = $('#journal-status');
    if (status) status.textContent = `Tersimpan ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    if (!silent) toast('Jurnal tersimpan di perangkat ini.');
  }

  function initJournal() {
    const entry = $('#journal-entry');
    if (!entry) return;
    const saved = store.get(journalKey(), null);
    if (saved?.text) {
      entry.value = saved.text;
      const status = $('#journal-status');
      if (status) status.textContent = 'Jurnal hari ini dimuat';
    }
    updateWordCount();
    let autosaveTimer;
    entry.addEventListener('input', () => {
      updateWordCount();
      const status = $('#journal-status');
      if (status) status.textContent = 'Belum disimpan';
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(() => saveJournal(true), 1200);
    });
    $('#journal-save')?.addEventListener('click', () => saveJournal(false));
    $('#journal-clear')?.addEventListener('click', () => {
      if (!entry.value.trim() || window.confirm('Hapus jurnal hari ini dari perangkat ini?')) {
        entry.value = '';
        store.remove(journalKey());
        updateWordCount();
        const status = $('#journal-status');
        if (status) status.textContent = 'Jurnal dikosongkan';
        toast('Jurnal hari ini dihapus.');
      }
    });
    $('#journal-export')?.addEventListener('click', () => {
      const content = `BISIKAN SUFI — JURNAL PRIBADI\n${formatDate(new Date(), { dateStyle: 'full' })}\n\n${entry.value}`;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `jurnal-bisikan-sufi-${localDateKey()}.txt`;
      link.click();
      URL.revokeObjectURL(url);
      toast('Jurnal diekspor sebagai berkas teks.');
    });
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const icon = $('#theme-icon');
    if (icon) icon.textContent = theme === 'dark' ? '☾' : '☀';
    const metaTheme = $('meta[name="theme-color"]');
    if (metaTheme) metaTheme.content = theme === 'dark' ? '#0b1020' : '#f3efe6';
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
    }, { threshold: .12, rootMargin: '0px 0px -40px' });
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

  function init() {
    initDates();
    initPreferences();
    initNavigation();
    initQuoteEvents();
    initBreathing();
    initAudio();
    initJournal();
    initReveal();
    initInstall();
    initServiceWorker();
    loadQuotes();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
