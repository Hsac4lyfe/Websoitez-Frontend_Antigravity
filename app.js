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
    bgVideoBlur: document.getElementById('bg-video-blur'),
    bgToggleBtn: document.getElementById('bgToggleBtn'),
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
    progressContainer: document.getElementById('progress-container'),
    copyBtn: document.getElementById('copyBtn'),
    clearBtn: document.getElementById('clearBtn'),

    // Ad Page
    adForm: document.getElementById('adForm'),
    emailInput: document.getElementById('emailInput'),
    emailTooltip: document.getElementById('emailTooltip'),
    messageInput: document.getElementById('messageInput'),
    messageTooltip: document.getElementById('messageTooltip'),
    charCount: document.getElementById('count'),
    successMsg: document.getElementById('successMsg'),

    // Container for styling
    statusGroup: document.querySelector('.status-timer-group'),
  };

  /* ================= STATE ================= */

  const STATE = {
    selectedFormat: 'plain',
    isTranscribing: false,
    startTime: 0,
    timerRAF: null,
    bgEnabled: true,
    mockMode: false,
  };

  /* ================= INIT ================= */

  init();

  function init() {
    setupCursor();
    setupBackgroundVideo();
    setupBgToggle();

    if (DOM.transcribeBtn) {
      setupHomeListeners();
      updateInputAndButtonStates();
      setupWipeAndReload();
    }

    if (DOM.adForm) {
      setupAdListeners();
    }

    setupTestMode();
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

  /* ================= BACKGROUND TOGGLE ================= */

  function setupBgToggle() {
    if (!DOM.bgToggleBtn) return;

    DOM.bgToggleBtn.addEventListener('click', toggleBackground);
  }

  function toggleBackground() {
    STATE.bgEnabled = !STATE.bgEnabled;

    const textEl = DOM.bgToggleBtn.querySelector('.bg-toggle-text');

    // Add toggle animation
    DOM.bgToggleBtn.classList.add('toggling');
    setTimeout(() => {
      DOM.bgToggleBtn.classList.remove('toggling');
    }, 300);

    if (STATE.bgEnabled) {
      // Show backgrounds with fade
      if (DOM.bgVideo) DOM.bgVideo.classList.remove('bg-hidden');
      if (DOM.bgVideoBlur) DOM.bgVideoBlur.classList.remove('bg-hidden');
      DOM.bgToggleBtn.classList.remove('bg-off');
      if (textEl) textEl.textContent = 'BG ON';
    } else {
      // Hide backgrounds with fade
      if (DOM.bgVideo) DOM.bgVideo.classList.add('bg-hidden');
      if (DOM.bgVideoBlur) DOM.bgVideoBlur.classList.add('bg-hidden');
      DOM.bgToggleBtn.classList.add('bg-off');
      if (textEl) textEl.textContent = 'BG OFF';
    }
  }

  /* ================= TEST MODE ================= */

  function setupTestMode() {
    const btn = document.getElementById('testModeBtn');
    const modal = document.getElementById('passwordModal');
    const input = document.getElementById('modalPassword');
    const submit = document.getElementById('modalSubmit');
    const cancel = document.getElementById('modalCancel');

    if (!btn || !modal) return;

    btn.addEventListener('click', () => {
      // Open Modal
      modal.style.display = 'flex';
      input.value = '';
      input.focus();
    });

    submit.addEventListener('click', checkPassword);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') checkPassword();
    });

    cancel.addEventListener('click', () => {
      modal.style.display = 'none';
    });

    function checkPassword() {
      if (input.value === 'test123') {
        toggleMockMode();
        modal.style.display = 'none';
      } else {
        alert('ACCESS DENIED');
        input.value = '';
      }
    }

    function toggleMockMode() {
      STATE.mockMode = !STATE.mockMode;
      const textEl = btn.querySelector('.bg-toggle-text');

      if (STATE.mockMode) {
        btn.classList.add('is-active');
        textEl.textContent = 'TEST ON';
        // Force "success" colors or indicator if needed
      } else {
        btn.classList.remove('is-active');
        textEl.textContent = 'TEST OFF';
      }
    }
  }

  /* ================= HOME PAGE LOGIC ================= */

  function setupHomeListeners() {
    DOM.dropdownBtn.addEventListener('click', toggleDropdown);
    DOM.dropdownMenu.addEventListener('click', selectFormat);
    window.addEventListener('click', closeDropdown);
    DOM.urlInput.addEventListener('input', updateInputAndButtonStates);
    DOM.transcribeBtn.addEventListener('click', transcribe);
    DOM.copyBtn.addEventListener('click', copyToClipboard);
    DOM.clearBtn.addEventListener('click', handleClear);
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
    DOM.clearBtn.disabled = STATE.isTranscribing;
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
    DOM.barEl.className = ''; /* Nukes ALL classes */
    DOM.barEl.id = 'progress-bar'; /* Restore ID */
    DOM.barEl.style.width = '0%';
    DOM.barEl.style.transition = 'none';
    DOM.barEl.style.animation = 'none';
    STATE.simulatedProgress = 0; /* track fake progress */
    DOM.statusEl.textContent = 'Warming up the servers…';
    DOM.timerEl.innerHTML = '00<span id="colon">:</span>00';
    if (DOM.statusGroup) DOM.statusGroup.classList.remove('timer-active');
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

    /* Adjust font size for Timestamps */
    if (STATE.selectedFormat === 'timestamps') {
      DOM.resultEl.style.fontSize = 'calc(1.05rem - 1.5px)';
    } else {
      DOM.resultEl.style.fontSize = '1.05rem';
    }
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
    if (DOM.statusGroup) DOM.statusGroup.classList.add('timer-active');
    simulateProgress(); /* Start the simulation loop */

    try {
      let resultText;

      /* --- MOCK MODE LOGIC --- */
      if (STATE.mockMode) {
        // 1. Wait 10 seconds (simulated)
        // We need to keep the UI responsive, so we await a timeout loop
        const mockDuration = 10000;
        const startMock = performance.now();

        // Loop until 10s passed
        while (performance.now() - startMock < mockDuration) {
          // Check if user cancelled (resetUI clears state?) 
          // For simplicity, just wait 100ms chunks to allow UI updates if single threaded (JS is single threaded, this blocks rendering if we are not careful)
          // Actually, await default timeout is better.
          if (!STATE.isTranscribing) break; // Exit if user hit Clear
          await new Promise(r => setTimeout(r, 100));
        }

        if (!STATE.isTranscribing) return; // Abort if cleared

        resultText = "Simulated Transcription Result";
      } else {
        /* --- REAL LOGIC --- */
        const taskId = await startTranscription(url);
        resultText = await pollForResult(taskId);
      }

      DOM.resultEl.value = resultText;
      DOM.statusEl.textContent = 'Transcription complete!';
      DOM.statusEl.textContent = 'Transcription complete!';

      /* 1. Trigger Recoil (Kickback) */
      DOM.barEl.classList.add('bar-recoil');

      /* 2. Seal & Flash after recoil (500ms) - GREEN flash 2x */
      setTimeout(() => {
        DOM.barEl.classList.remove('bar-recoil');
        DOM.barEl.classList.add('bar-success');
        DOM.barEl.style.width = '100%';
        STATE.simulatedProgress = 100;
      }, 500);

      DOM.resultEl.style.opacity = '0';
      setTimeout(() => {
        DOM.resultEl.style.transition = 'opacity 1s ease';
        DOM.resultEl.style.opacity = '1';
      }, 100);

    } catch (err) {
      console.error(err);
      DOM.statusEl.textContent = 'Connection failed. Please try again.';

      /* ERROR STATE - RED flash 3x + shake */
      DOM.barEl.classList.add('bar-error');
    } finally {
      stopTimer();
      setUIState(false);
      // Keep .timer-active for a moment if successful? 
      // User said "while it's running". So remove it when done.
      if (DOM.statusGroup) DOM.statusGroup.classList.remove('timer-active');
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

  function handleClear() {
    // 6. Reset fully (as if refreshed)
    DOM.urlInput.value = '';
    DOM.resultEl.value = '';

    // 7. Snap bar to 0
    // 8. Default status
    // 10. Hard reset timer
    resetUI();

    // resetUI specifically:
    // - sets bar width 0
    // - sets status "Warming up..." -> Wait, user asked for "Enter a link to begin" (default)
    // - sets timer 00:00

    // Override specific defaults requested if resetUI() differs
    DOM.statusEl.textContent = 'Enter a link to begin';

    /* Trigger Animations */
    DOM.clearBtn.classList.add('anim-shake');
    DOM.urlInput.classList.add('anim-purge');
    DOM.resultEl.classList.add('anim-purge');

    setTimeout(() => {
      DOM.clearBtn.classList.remove('anim-shake');
      DOM.urlInput.classList.remove('anim-purge');
      DOM.resultEl.classList.remove('anim-purge');
    }, 400);

    // 5. Focus back to input
    DOM.urlInput.focus();

    // Update button states (disable transcribe etc)
    updateInputAndButtonStates();
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
      // Remove -> Trigger Reflow -> Add (Restarts Animation)
      tooltip.classList.remove('show');
      void tooltip.offsetWidth;
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
