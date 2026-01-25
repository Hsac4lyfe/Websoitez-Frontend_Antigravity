document.addEventListener('DOMContentLoaded', () => {

  /* ================= CONFIG ================= */

  const CONFIG = {
    API_BASE_URL: 'https://api-production-6812.up.railway.app',
    POLLING_INTERVAL: 1500,
    MAX_POLLING_ATTEMPTS: 240,
  };

  /* ================= DOM ================= */

  const DOM = {
    // Shared
    cursor: document.getElementById('customCursor'),
    bgVideo: document.getElementById('bg-video'),
    bgVideoBlur: document.getElementById('bg-video-blur'), // New
    logoVideo: document.querySelector('.title-video video'),

    // Home Page
    dropdown: document.querySelector('.dropdown'),
    dropdownBtn: document.getElementById('dropdownBtn'),
    dropdownMenu: document.getElementById('dropdownMenu'),
    urlInput: document.getElementById('url'),
    transcribeBtn: document.getElementById('transcribeBtn'),
    resultEl: document.getElementById('result'),
    statusEl: document.getElementById('status'),
    timerEl: document.getElementById('timer'),
    barEl: document.getElementById('progress-bar'),
    copyBtn: document.getElementById('copyBtn'),

    // Ad Page
    adForm: document.getElementById('adForm'),
    emailInput: document.getElementById('emailInput'),
    emailTooltip: document.getElementById('emailTooltip'),
    messageInput: document.getElementById('messageInput'),
    messageTooltip: document.getElementById('messageTooltip'),
    charCount: document.getElementById('count'),
    successMsg: document.getElementById('successMsg'),
  };

  /* ================= STATE ================= */

  const STATE = {
    selectedFormat: 'plain',
    isTranscribing: false,
    startTime: 0,
    timerRAF: null,
  };

  /* ================= INIT ================= */

  init();

  function init() {
    setupCursor();
    setupBackgroundVideo();

    if (DOM.transcribeBtn) {
      setupHomeListeners();
      updateInputAndButtonStates();
      setupWipeAndReload();
    }

    if (DOM.adForm) {
      setupAdListeners();
    }
  }

  /* ================= SHARED: CURSOR ================= */

  function setupCursor() {
    if (!DOM.cursor || window.matchMedia('(pointer: coarse)').matches) {
      if (DOM.cursor) DOM.cursor.style.display = 'none';
      document.body.style.cursor = 'auto';
      return;
    }

    DOM.cursor.style.opacity = '1';
    let last = 0;

    document.addEventListener('mousemove', e => {
      const now = performance.now();
      if (now - last > 16) {
        // -10 offset matches the advertise.html logic
        DOM.cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
        last = now;
      }
    });

    document.querySelectorAll('button, a, input, textarea, .dropbtn').forEach(el => {
      el.addEventListener('mouseenter', () => DOM.cursor.classList.add('paused'));
      el.addEventListener('mouseleave', () => DOM.cursor.classList.remove('paused'));
    });
  }

  /* ================= SHARED: VIDEO ================= */

  function setupBackgroundVideo() {
    const videos = document.querySelectorAll('video');

    const playAll = () => {
      videos.forEach(video => {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Fallback for Safari/Autoplay blockers
            document.addEventListener('click', () => {
              video.play();
            }, { once: true });
          });
        }
      });
    };

    window.addEventListener('load', () => {
      playAll();
      // Remove loading state for fade-in
      requestAnimationFrame(() => {
        document.body.classList.remove('is-loading');
      });
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        document.body.classList.add('is-returning');
        videos.forEach(v => {
          v.currentTime = 0;
          v.play().catch(() => { });
        });
        requestAnimationFrame(() => {
          document.body.classList.remove('is-returning');
        });
      }
    });
  }

  /* ================= HOME PAGE LOGIC ================= */

  function setupHomeListeners() {
    DOM.dropdownBtn.addEventListener('click', toggleDropdown);
    DOM.dropdownMenu.addEventListener('click', selectFormat);
    window.addEventListener('click', closeDropdown);
    DOM.urlInput.addEventListener('input', updateInputAndButtonStates);
    DOM.transcribeBtn.addEventListener('click', transcribe);
    DOM.copyBtn.addEventListener('click', copyToClipboard);
  }

  function setupWipeAndReload() {
    // Clear inputs on back/forward cache
    window.addEventListener('pageshow', () => {
      document.querySelectorAll('input, textarea').forEach(el => el.value = '');
      // Optional: clear URL params if needed
      // history.replaceState(null, '', location.pathname); 
    });
    // Force reload on cache traversal
    if (performance.navigation.type === 2) location.reload(true);
  }

  function updateInputAndButtonStates() {
    const hasUrl = DOM.urlInput.value.trim().length > 0;
    DOM.transcribeBtn.disabled = !hasUrl || STATE.isTranscribing;
    DOM.dropdownBtn.disabled = STATE.isTranscribing;
    DOM.urlInput.disabled = STATE.isTranscribing;
    DOM.transcribeBtn.classList.toggle('is-pending', STATE.isTranscribing);
    DOM.copyBtn.disabled = STATE.isTranscribing;
  }

  function setUIState(isTranscribing) {
    STATE.isTranscribing = isTranscribing;
    DOM.transcribeBtn.textContent = isTranscribing ? 'Transcribing' : 'Transcribe';
    updateInputAndButtonStates();
  }

  function resetUI() {
    DOM.resultEl.value = '';
    DOM.resultEl.value = '';
    DOM.barEl.style.width = '0%';
    DOM.barEl.style.width = '0%';
    DOM.barEl.style.transition = 'none'; /* BLOCKY: No smoothing */
    DOM.barEl.classList.remove('invert-flash'); /* Reset flash */
    STATE.simulatedProgress = 0; /* track fake progress */
    DOM.statusEl.textContent = 'Warming up the servers…';
    DOM.timerEl.innerHTML = '00<span id="colon">:</span>00';
  }

  function toggleDropdown(e) {
    e.preventDefault();
    if (!STATE.isTranscribing) DOM.dropdown.classList.toggle('show');
  }

  function selectFormat(e) {
    e.preventDefault();
    const item = e.target.closest('a');
    if (!item) return;
    STATE.selectedFormat = item.dataset.value;
    DOM.dropdownBtn.textContent = `${item.textContent} ▼`;
    DOM.dropdown.classList.remove('show');
  }

  function closeDropdown(e) {
    if (!DOM.dropdown.contains(e.target)) {
      DOM.dropdown.classList.remove('show');
    }
  }

  // Timer Logic
  function startTimer() {
    STATE.startTime = performance.now();
    tickTimer();
  }

  function stopTimer() {
    cancelAnimationFrame(STATE.timerRAF);
    STATE.timerRAF = null;
    clearTimeout(STATE.progressTimer); /* Stop simulation */
    STATE.progressTimer = null;
  }

  function tickTimer() {
    const elapsed = performance.now() - STATE.startTime;
    const total = Math.floor(elapsed / 1000);
    const mm = String(Math.floor(total / 60)).padStart(2, '0');
    const ss = String(total % 60).padStart(2, '0');
    const blink = Math.floor(elapsed / 500) % 2;

    DOM.timerEl.innerHTML =
      `${mm}<span id="colon" style="opacity:${blink};">:</span>${ss}`;

    STATE.timerRAF = requestAnimationFrame(tickTimer);
  }

  // Rewrite of transcription logic
  async function transcribe() {
    const url = DOM.urlInput.value.trim();
    if (!url) return alert('Please paste a valid link first.');

    setUIState(true);
    resetUI();
    startTimer();
    simulateProgress(); /* Start the simulation loop */

    try {
      const taskId = await startTranscription(url);
      const transcript = await pollForResult(taskId);

      DOM.resultEl.value = transcript;
      DOM.statusEl.textContent = 'Transcription complete!';
      DOM.resultEl.value = transcript;
      DOM.statusEl.textContent = 'Transcription complete!';
      DOM.barEl.style.transition = 'none'; /* Instant snap */
      DOM.barEl.style.width = '100%';
      DOM.barEl.classList.add('invert-flash'); /* 10. Invert Flash */
      STATE.simulatedProgress = 100;

      DOM.resultEl.style.opacity = '0';
      setTimeout(() => {
        DOM.resultEl.style.transition = 'opacity 1s ease';
        DOM.resultEl.style.opacity = '1';
      }, 100);

    } catch (err) {
      console.error(err);
      DOM.statusEl.textContent = 'Connection failed. Please try again.';
    } finally {
      stopTimer();
      setUIState(false);
    }
  }

  async function startTranscription(url) {
    const res = await fetch(`${CONFIG.API_BASE_URL}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, format: STATE.selectedFormat }),
    });

    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    return data.task_id;
  }

  async function pollForResult(taskId) {
    for (let i = 0; i < CONFIG.MAX_POLLING_ATTEMPTS; i++) {
      const res = await fetch(`${CONFIG.API_BASE_URL}/result/${taskId}`);
      if (!res.ok) throw new Error('Polling failed');

      const data = await res.json();
      if (data.status === 'completed') return data.transcript;
      if (data.status === 'error') throw new Error(data.error);

      // Ignore backend progress, use our simulation
      updateStatusText();
      await new Promise(r => setTimeout(r, CONFIG.POLLING_INTERVAL));
    }
    throw new Error('Timed out');
  }

  /* --- SMART SIMULATION LOGIC --- */
  function simulateProgress() {
    // 1. Calculate next step
    if (STATE.simulatedProgress >= 90) return; // Cap at 90%

    // 2. Randomize increment (0-15%)
    // 30% chance to stall (increment 0)
    const isStall = Math.random() < 0.3;
    const increment = isStall ? 0 : 5; // 2. Grid Style (5% blocks)

    STATE.simulatedProgress = Math.min(STATE.simulatedProgress + increment, 90);

    // 3. Apply changes (Instant snap)
    DOM.barEl.style.width = `${STATE.simulatedProgress}%`;
    updateStatusText(); // Keep text synced to "perceived" progress

    // 4. Re-roll random interval for "Appearing" effect
    const randomDelay = Math.floor(Math.random() * 800) + 200; // Random delay 200ms-1000ms
    STATE.progressTimer = setTimeout(simulateProgress, randomDelay);
  }

  function updateStatusText() {
    // Keep text tied to the visual bar so it "feels" true
    const pct = STATE.simulatedProgress;
    if (pct < 30) DOM.statusEl.textContent = `Analyzing audio…`;
    else if (pct < 70) DOM.statusEl.textContent = `Generating text…`;
    else DOM.statusEl.textContent = `Finalizing…`;
  }
  /* ----------------------------- */

  function copyToClipboard() {
    if (!DOM.resultEl.value) return;
    navigator.clipboard.writeText(DOM.resultEl.value).then(() => {
      const txt = DOM.copyBtn.textContent;
      DOM.copyBtn.textContent = 'Copied!';
      setTimeout(() => DOM.copyBtn.textContent = txt, 1500);
    });
  }

  /* ================= AD PAGE LOGIC ================= */

  function setupAdListeners() {
    // Character Counter
    DOM.messageInput.addEventListener('input', () => {
      DOM.charCount.textContent = DOM.messageInput.value.length;
    });

    // Validation Listeners
    setupValidation(DOM.emailInput, DOM.emailTooltip);
    setupValidation(DOM.messageInput, DOM.messageTooltip);

    // Form Submit
    DOM.adForm.addEventListener('submit', handleAdSubmit);
  }

  function setupValidation(input, tooltip) {
    input.addEventListener('invalid', (e) => {
      e.preventDefault();
      tooltip.classList.add('show');
    });
    input.addEventListener('input', () => {
      if (input.value.length > 0) {
        tooltip.classList.remove('show');
      }
    });
  }

  async function handleAdSubmit(e) {
    e.preventDefault();
    DOM.adForm.classList.add('was-submitted');

    const btn = DOM.adForm.querySelector('button');
    const originalText = btn.textContent;
    btn.textContent = "Sending...";
    btn.disabled = true;

    const body = new FormData(DOM.adForm);
    try {
      await fetch(DOM.adForm.action, { method: 'POST', body });
      DOM.adForm.style.display = 'none';
      DOM.successMsg.style.display = 'block';
    } catch (err) {
      alert("Could not send. Check your connection.");
      btn.textContent = originalText;
      btn.disabled = false;
    }
  }










});
