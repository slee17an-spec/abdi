export function initWellbeing({ $, $$, store, toast, formatDate, localDateKey }) {
  const phases = [
    { key: 'inhale', label: 'Tarik', seconds: 4, instruction: 'Tarik perlahan melalui hidung' },
    { key: 'hold', label: 'Tahan', seconds: 4, instruction: 'Tahan lembut, jangan memaksa' },
    { key: 'exhale', label: 'Hembuskan', seconds: 6, instruction: 'Hembuskan perlahan melalui mulut' },
    { key: 'rest', label: 'Diam', seconds: 2, instruction: 'Berdiam sebelum napas berikutnya' }
  ];

  const state = {
    selectedMinutes: 3,
    breathing: false,
    breathPaused: false,
    breathInterval: null,
    breathRemaining: 180,
    phaseIndex: 0,
    phaseRemaining: 4,
    audio: {
      context: null,
      master: null,
      nodes: [],
      playing: false,
      type: 'drone'
    }
  };

  function secondsToClock(seconds) {
    const safe = Math.max(0, seconds);
    return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
  }

  function updateBreathDisplay() {
    const phase = phases[state.phaseIndex];
    if ($('#breath-ring')) $('#breath-ring').dataset.phase = state.breathing ? phase.key : 'idle';
    if ($('#breath-phase')) $('#breath-phase').textContent = state.breathing ? phase.label : 'Siap';
    if ($('#breath-countdown')) $('#breath-countdown').textContent = secondsToClock(state.breathRemaining);
    if ($('#breath-instruction')) $('#breath-instruction').textContent = state.breathing
      ? `${phase.instruction} • ${state.phaseRemaining} detik`
      : 'Duduk nyaman dan rilekskan bahu';
  }

  function resetBreath() {
    clearInterval(state.breathInterval);
    state.breathInterval = null;
    state.breathing = false;
    state.breathPaused = false;
    state.breathRemaining = state.selectedMinutes * 60;
    state.phaseIndex = 0;
    state.phaseRemaining = phases[0].seconds;
    if ($('#breath-start')) $('#breath-start').textContent = 'Mulai latihan';
    updateBreathDisplay();
  }

  function recordPractice() {
    const dates = new Set(store.get('bs-practice-dates', []));
    dates.add(localDateKey());
    store.set('bs-practice-dates', [...dates].sort());
    renderStreak();
  }

  function currentStreak() {
    const dates = new Set(store.get('bs-practice-dates', []));
    const cursor = new Date();
    let streak = 0;
    if (!dates.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (dates.has(localDateKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  function renderStreak() {
    if ($('#streak-count')) $('#streak-count').textContent = String(currentStreak());
  }

  function completeBreath() {
    clearInterval(state.breathInterval);
    state.breathInterval = null;
    state.breathing = false;
    state.breathPaused = false;
    state.breathRemaining = 0;
    updateBreathDisplay();
    if ($('#breath-ring')) $('#breath-ring').dataset.phase = 'idle';
    if ($('#breath-phase')) $('#breath-phase').textContent = 'Selesai';
    if ($('#breath-instruction')) $('#breath-instruction').textContent = 'Bawa ketenangan ini ke langkah berikutnya';
    if ($('#breath-start')) $('#breath-start').textContent = 'Mulai lagi';
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
      if ($('#breath-start')) $('#breath-start').textContent = 'Jeda';
      updateBreathDisplay();
      return;
    }
    state.breathPaused = !state.breathPaused;
    if ($('#breath-start')) $('#breath-start').textContent = state.breathPaused ? 'Lanjutkan' : 'Jeda';
    if (state.breathPaused && $('#breath-phase')) $('#breath-phase').textContent = 'Dijeda';
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
      try { node.stop?.(); } catch { /* Node mungkin sudah berhenti. */ }
      try { node.disconnect?.(); } catch { /* Abaikan kesalahan pemutusan. */ }
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
    $('.audio-console')?.classList.toggle('playing', state.audio.playing);
    $('#audio-toggle')?.setAttribute('aria-pressed', String(state.audio.playing));
    if ($('#audio-play-icon')) $('#audio-play-icon').textContent = state.audio.playing ? '■' : '▶';
    if ($('#audio-status')) $('#audio-status').textContent = state.audio.playing ? 'Sedang diputar' : 'Siap diputar';
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
      if ($('#audio-title')) $('#audio-title').textContent = soundNames[state.audio.type];
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
    if ($('#journal-entry') && $('#word-count')) $('#word-count').textContent = String(countWords($('#journal-entry').value));
  }

  function saveJournal(silent = false) {
    const entry = $('#journal-entry');
    if (!entry) return;
    store.set(journalKey(), { text: entry.value, savedAt: new Date().toISOString() });
    if ($('#journal-status')) $('#journal-status').textContent = `Tersimpan ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
    if (!silent) toast('Jurnal tersimpan di perangkat ini.');
  }

  function initJournal() {
    const entry = $('#journal-entry');
    if (!entry) return;
    const saved = store.get(journalKey(), null);
    if (saved?.text) {
      entry.value = saved.text;
      if ($('#journal-status')) $('#journal-status').textContent = 'Jurnal hari ini dimuat';
    }
    updateWordCount();
    let autosaveTimer;
    entry.addEventListener('input', () => {
      updateWordCount();
      if ($('#journal-status')) $('#journal-status').textContent = 'Belum disimpan';
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(() => saveJournal(true), 1200);
    });
    $('#journal-save')?.addEventListener('click', () => saveJournal(false));
    $('#journal-clear')?.addEventListener('click', () => {
      if (!entry.value.trim() || window.confirm('Hapus jurnal hari ini dari perangkat ini?')) {
        entry.value = '';
        store.remove(journalKey());
        updateWordCount();
        if ($('#journal-status')) $('#journal-status').textContent = 'Jurnal dikosongkan';
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

  initBreathing();
  initAudio();
  initJournal();
}
