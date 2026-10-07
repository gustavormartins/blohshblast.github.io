    window.BLOHSH_BLAST_PRODUCT_MODE = true;

    // --- GAME CONSTANTS & BALANCED SHAPES ---
    const BOARD_SIZE = 8;

    // Conjunto balanceado: sem linhas de 5 e sem blocos sólidos 3x3.
    const SHAPES = [
      // 1. Monominó
      [[1]],

      // 2. Linhas: Dominó, Trominó e Tetrominó, horizontal e vertical
      [[1, 1]],
      [[1], [1]],
      [[1, 1, 1]],
      [[1], [1], [1]],
      [[1, 1, 1, 1]],
      [[1], [1], [1], [1]],

      // 3. Blocos L e J em todas as orientações 3x2 e 2x3
      [[1, 0], [1, 0], [1, 1]],
      [[0, 1], [0, 1], [1, 1]],
      [[1, 1], [1, 0], [1, 0]],
      [[1, 1], [0, 1], [0, 1]],
      [[1, 0, 0], [1, 1, 1]],
      [[0, 0, 1], [1, 1, 1]],
      [[1, 1, 1], [1, 0, 0]],
      [[1, 1, 1], [0, 0, 1]],

      // 4. Bloco quadrado 2x2
      [[1, 1], [1, 1]],

      // 5. Blocos T em todas as orientações
      [[1, 1, 1], [0, 1, 0]],
      [[0, 1, 0], [1, 1, 1]],
      [[1, 0], [1, 1], [1, 0]],
      [[0, 1], [1, 1], [0, 1]],

      // 6. Escada / Zigue-Zague: S e Z horizontal e vertical
      [[1, 1, 0], [0, 1, 1]],
      [[0, 1, 1], [1, 1, 0]],
      [[1, 0], [1, 1], [0, 1]],
      [[0, 1], [1, 1], [1, 0]]
    ];

    const SKINS = [
      { min: 0, className: 'skin-blohsh', label: 'Nível 1 — Blohsh Original' },
      { min: 1000, className: 'skin-tty', label: 'Nível 2 — TTY / Shell' },
      { min: 2500, className: 'skin-happier', label: 'Nível 3 — Era Happier' },
      { min: 5000, className: 'skin-sushi', label: 'Nível 4 — Sushi Bar' },
      { min: 10000, className: 'skin-halley', label: 'Nível 5 — Cometa Halley' }
    ];

    const SKIN_CLASSES = SKINS.map(skin => skin.className);
    const COMBO_CLASSES = ['combo-arcade', 'combo-root', 'combo-space', 'combo-voxel'];

    // --- GAME STATE ---
    const STATS_KEY = 'blohshBlastStats';
    const SOUND_KEY = 'blohshBlastSound';
    const PERFECT_CLEAR_BONUS = 1000;

    let board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
    let score = 0;
    let displayedScore = 0;
    let scoreAnimationId = null;
    let highScore = Number(localStorage.getItem('blohshHighScore')) || 0;
    let rackPieces = [null, null, null];
    let currentSkin = '';
    let combo = 0;
    let comboTimeout = null;
    let perfectClearTimeout = null;
    let audioContext = null;
    let soundEnabled = localStorage.getItem(SOUND_KEY) !== '0';
    let stats = loadStats();

    // --- PHASE 4 TYPED RUNTIME SEAM ---
    const runtimeSubscribers = new Set();

    function emitRuntimeEvent(type, detail = {}) {
      runtimeSubscribers.forEach(listener => {
        try {
          listener({ type, detail });
        } catch (_) {}
      });
    }


    // Drag state
    let isDragging = false;
    let dragPieceIndex = -1;
    let dragMatrix = null;
    let dragPointerId = null;
    let touchOffsetY = 0;

    // --- DOM ELEMENTS ---
    const boardEl = document.getElementById('board');
    const rackSlots = document.querySelectorAll('.rack-slot');
    const draggingContainer = document.getElementById('dragging-container');
    const scoreDisplay = document.getElementById('score-display');
    const highscoreDisplay = document.getElementById('highscore-display');
    const skinLabel = document.getElementById('skin-label');
    const gameOverModal = document.getElementById('game-over-modal');
    const comboBadge = document.getElementById('combo-badge');
    const screenEffect = document.getElementById('screen-effect');
    const effectLayer = document.getElementById('effect-layer');
    const perfectClearEl = document.getElementById('perfect-clear');
    const soundToggle = document.getElementById('sound-toggle');
    const statsModal = document.getElementById('stats-modal');
    const statsOpen = document.getElementById('stats-open');
    const statsClose = document.getElementById('stats-close');

    // --- INITIALIZATION ---
    function init() {
      highscoreDisplay.innerText = highScore.toLocaleString('pt-BR');
      setDisplayedScore(0);
      createBoard();
      updateSkin();
      updateSoundToggle();
      renderStats();
      if (!window.BLOHSH_BLAST_PRODUCT_MODE) {
        registerGameStart();
        generateRack();
      }
      setupEventListeners();
      setupUiControls();
    }

    function setupUiControls() {
      soundToggle.addEventListener('click', toggleSound);
      statsOpen.addEventListener('click', openStats);
      statsClose.addEventListener('click', closeStats);

      statsModal.addEventListener('click', event => {
        if (event.target === statsModal) closeStats();
      });

      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !statsModal.classList.contains('modal-hidden')) {
          closeStats();
        }
      });
    }

    function createBoard() {
      boardEl.innerHTML = '';

      for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
          const cell = document.createElement('div');
          cell.classList.add('cell');
          cell.dataset.x = x;
          cell.dataset.y = y;
          boardEl.appendChild(cell);
        }
      }
    }

    function updateBoardVisuals() {
      for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
          const cell = getCellEl(x, y);
          cell.className = 'cell';

          if (board[y][x] === 1) {
            cell.classList.add('cell-filled');
          }
        }
      }
    }

    function getCellEl(x, y) {
      return boardEl.children[y * BOARD_SIZE + x];
    }

    // --- SKIN PROGRESSION ---
    function updateSkin() {
      const bridge = window.BlohshBlastBridge;
      if (bridge && typeof bridge.applySkin === 'function') {
        bridge.applySkin();
        return;
      }

      const nextSkin = SKINS.reduce((active, skin) => score >= skin.min ? skin : active, SKINS[0]);

      if (currentSkin !== nextSkin.className) {
        document.body.classList.remove(...SKIN_CLASSES);
        document.body.classList.add(nextSkin.className);
        currentSkin = nextSkin.className;
      }

      skinLabel.innerText = nextSkin.label;
    }

    // --- RACK & PIECES LOGIC ---
    function shapeSignature(matrix) {
      return matrix.map(row => row.join('')).join('/');
    }

    function shapeBlockCount(matrix) {
      return matrix.reduce((total, row) => total + row.filter(Boolean).length, 0);
    }

    function canPlaceAnywhere(matrix) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
          if (checkFit(matrix, x, y)) return true;
        }
      }
      return false;
    }

    function getRandomShape() {
      return SHAPES[Math.floor(Math.random() * SHAPES.length)];
    }

    function canPlayAnyShape() {
      return SHAPES.some(canPlaceAnywhere);
    }

    function buildSmartRack() {
      let bestRack = null;
      let bestScore = -Infinity;

      for (let attempt = 0; attempt < 50; attempt++) {
        const candidates = [getRandomShape(), getRandomShape(), getRandomShape()];
        const signatures = new Set(candidates.map(shapeSignature));
        const playableCount = candidates.filter(canPlaceAnywhere).length;
        const sizes = candidates.map(shapeBlockCount);
        const sizeDiversity = new Set(sizes).size;
        const hasSmallPiece = sizes.some(size => size <= 2);
        const duplicates = candidates.length - signatures.size;

        let candidateScore =
          playableCount * 42 +
          signatures.size * 18 +
          sizeDiversity * 10 +
          (hasSmallPiece ? 8 : 0) +
          Math.random() * 18 -
          duplicates * 26;

        if (playableCount === 0 && canPlayAnyShape()) candidateScore -= 180;

        if (candidateScore > bestScore) {
          bestScore = candidateScore;
          bestRack = candidates;
        }
      }

      if (bestRack && bestRack.every(piece => !canPlaceAnywhere(piece)) && canPlayAnyShape()) {
        const playableShapes = SHAPES.filter(canPlaceAnywhere);
        bestRack[0] = playableShapes[Math.floor(Math.random() * playableShapes.length)];
      }

      return bestRack || [getRandomShape(), getRandomShape(), getRandomShape()];
    }

    function generateRack() {
      const allEmpty = rackPieces.every(piece => piece === null);
      if (!allEmpty) return;

      const bridge = window.BlohshBlastBridge;
      rackPieces = bridge && typeof bridge.getRack === 'function'
        ? bridge.getRack()
        : buildSmartRack();

      renderRack();
    }

    function renderRack() {
      rackSlots.forEach((slot, index) => {
        slot.innerHTML = '';
        slot.classList.remove('hidden-slot');
        slot.onpointerdown = null;
        slot.onkeydown = null;

        const matrix = rackPieces[index];
        if (!matrix) return;

        const preview = document.createElement('div');
        preview.classList.add('piece-preview');
        preview.style.gridTemplateColumns = `repeat(${matrix[0].length}, 1fr)`;
        preview.style.gridTemplateRows = `repeat(${matrix.length}, 1fr)`;

        for (let y = 0; y < matrix.length; y++) {
          for (let x = 0; x < matrix[0].length; x++) {
            const block = document.createElement('div');

            if (matrix[y][x] === 1) {
              block.classList.add('block');
            }

            preview.appendChild(block);
          }
        }

        slot.appendChild(preview);
        slot.onpointerdown = event => startDrag(event, index, matrix, slot);
        slot.onkeydown = event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            startKeyboardPlacement(index, matrix, slot);
          }
        };
      });
    }

    // --- DRAG AND DROP LOGIC ---
    function setupEventListeners() {
      document.addEventListener('pointermove', drag, { passive: false });
      document.addEventListener('pointerup', endDrag);
      document.addEventListener('pointercancel', event => endDrag(event, true));
    }

    function loadStats() {
      const defaults = {
        gamesPlayed: 0,
        piecesPlaced: 0,
        linesCleared: 0,
        perfectClears: 0,
        highestCombo: 0
      };

      try {
        const saved = JSON.parse(localStorage.getItem(STATS_KEY) || 'null');
        return { ...defaults, ...(saved && typeof saved === 'object' ? saved : {}) };
      } catch (_) {
        return defaults;
      }
    }

    function saveStats() {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
      renderStats();
    }

    function registerGameStart() {
      stats.gamesPlayed += 1;
      saveStats();
    }

    function renderStats() {
      document.getElementById('stat-games').innerText = stats.gamesPlayed.toLocaleString('pt-BR');
      document.getElementById('stat-best').innerText = highScore.toLocaleString('pt-BR');
      document.getElementById('stat-pieces').innerText = stats.piecesPlaced.toLocaleString('pt-BR');
      document.getElementById('stat-lines').innerText = stats.linesCleared.toLocaleString('pt-BR');
      document.getElementById('stat-perfect').innerText = stats.perfectClears.toLocaleString('pt-BR');
      document.getElementById('stat-combo').innerText = `${stats.highestCombo}x`;
    }

    function openStats() {
      ensureAudio();
      renderStats();
      statsModal.classList.remove('modal-hidden');
      statsClose.focus();
    }

    function closeStats() {
      statsModal.classList.add('modal-hidden');
      statsOpen.focus();
    }

    function toggleSound() {
      soundEnabled = !soundEnabled;
      localStorage.setItem(SOUND_KEY, soundEnabled ? '1' : '0');
      updateSoundToggle();

      if (soundEnabled) {
        ensureAudio();
        playSound('place');
      }
    }

    function updateSoundToggle() {
      soundToggle.innerText = soundEnabled ? 'SFX ON' : 'SFX OFF';
      soundToggle.setAttribute('aria-pressed', String(soundEnabled));
    }

    function ensureAudio() {
      if (!soundEnabled) return null;

      try {
        if (!audioContext) {
          audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (audioContext.state === 'suspended') audioContext.resume();
        return audioContext;
      } catch (_) {
        return null;
      }
    }

    function playTone(frequency, duration = 0.08, delay = 0, type = 'sine', volume = 0.035) {
      const ctx = ensureAudio();
      if (!ctx) return;

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + delay;

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    }

    function playSound(kind) {
      if (!soundEnabled) return;

      if (kind === 'place') {
        playTone(190, 0.07, 0, 'triangle', 0.026);
        playTone(270, 0.06, 0.025, 'sine', 0.018);
      } else if (kind === 'clear') {
        playTone(420, 0.09, 0, 'square', 0.026);
        playTone(620, 0.10, 0.05, 'triangle', 0.023);
        playTone(860, 0.13, 0.11, 'sine', 0.019);
      } else if (kind === 'combo') {
        playTone(330, 0.08, 0, 'square', 0.024);
        playTone(495, 0.08, 0.07, 'square', 0.022);
        playTone(660, 0.11, 0.14, 'triangle', 0.024);
      } else if (kind === 'perfect') {
        [523, 659, 784, 1047].forEach((freq, index) => {
          playTone(freq, 0.16, index * 0.075, 'sine', 0.028);
        });
      } else if (kind === 'gameover') {
        playTone(420, 0.12, 0, 'sawtooth', 0.022);
        playTone(320, 0.12, 0.10, 'sawtooth', 0.020);
        playTone(220, 0.18, 0.20, 'triangle', 0.018);
      }
    }

    function triggerVibration(pattern) {
      if ('vibrate' in navigator) {
        try { navigator.vibrate(pattern); } catch (_) {}
      }
    }

    function startDrag(event, index, matrix, slotEl) {
      if (!matrix || isDragging) return;

      ensureAudio();
      event.preventDefault();
      isDragging = true;
      dragPieceIndex = index;
      dragMatrix = matrix;
      dragPointerId = event.pointerId;
      touchOffsetY = event.pointerType === 'touch' ? 58 : 0;
      slotEl.classList.add('hidden-slot');

      if (slotEl.setPointerCapture) {
        try {
          slotEl.setPointerCapture(event.pointerId);
        } catch (_) {
          // Pointer capture is best-effort; document listeners remain active.
        }
      }

      draggingContainer.innerHTML = '';
      draggingContainer.style.display = 'grid';
      draggingContainer.style.gridTemplateColumns = `repeat(${matrix[0].length}, 1fr)`;
      draggingContainer.style.gridTemplateRows = `repeat(${matrix.length}, 1fr)`;

      for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[0].length; x++) {
          const block = document.createElement('div');

          if (matrix[y][x] === 1) {
            block.classList.add('block');
          }

          draggingContainer.appendChild(block);
        }
      }

      updateDragPosition(event.clientX, event.clientY);
      drag(event);
    }

    function drag(event) {
      if (!isDragging || !event || event.pointerId !== dragPointerId) return;

      if (event.pointerType === 'touch') {
        event.preventDefault();
      }

      updateDragPosition(event.clientX, event.clientY);
      const gridPos = getGridPosition(event.clientX, event.clientY);

      clearHints();

      if (!gridPos) return;

      const canPlace = checkFit(dragMatrix, gridPos.x, gridPos.y);
      drawHint(dragMatrix, gridPos.x, gridPos.y, canPlace);
    }

    function updateDragPosition(x, y) {
      const rect = draggingContainer.getBoundingClientRect();
      const width = rect.width || dragMatrix[0].length * 40;
      const height = rect.height || dragMatrix.length * 40;
      const adjustedY = y - touchOffsetY;

      draggingContainer.style.left = `${x - width / 2}px`;
      draggingContainer.style.top = `${adjustedY - height / 2}px`;
    }

    function getGridPosition(clientX, clientY) {
      if (!dragMatrix) return null;

      const adjustedY = clientY - touchOffsetY;
      const rect = boardEl.getBoundingClientRect();
      const styles = getComputedStyle(boardEl);
      const borderX = parseFloat(styles.borderLeftWidth) || 0;
      const borderY = parseFloat(styles.borderTopWidth) || 0;
      const paddingX = parseFloat(styles.paddingLeft) || 0;
      const paddingY = parseFloat(styles.paddingTop) || 0;
      const gap = parseFloat(styles.columnGap || styles.gap) || 0;

      const contentWidth = boardEl.clientWidth - paddingX - (parseFloat(styles.paddingRight) || 0);
      const contentHeight = boardEl.clientHeight - paddingY - (parseFloat(styles.paddingBottom) || 0);
      const cellWidth = (contentWidth - gap * (BOARD_SIZE - 1)) / BOARD_SIZE;
      const cellHeight = (contentHeight - gap * (BOARD_SIZE - 1)) / BOARD_SIZE;

      const localX = clientX - rect.left - borderX - paddingX;
      const localY = adjustedY - rect.top - borderY - paddingY;

      if (cellWidth <= 0 || cellHeight <= 0 || localX < 0 || localY < 0 ||
          localX > contentWidth || localY > contentHeight) {
        return null;
      }

      const hoverCellX = Math.min(BOARD_SIZE - 1, Math.floor(localX / (cellWidth + gap)));
      const hoverCellY = Math.min(BOARD_SIZE - 1, Math.floor(localY / (cellHeight + gap)));

      // Keep the original drag feel: the cursor identifies the middle area of the piece.
      const anchorX = Math.floor(hoverCellX - (dragMatrix[0].length / 2) + 0.5);
      const anchorY = Math.floor(hoverCellY - (dragMatrix.length / 2) + 0.5);

      return { x: anchorX, y: anchorY };
    }

    function showScorePopup(points, popupText = null, extraClass = '') {
      const popup = document.createElement('div');
      const rect = scoreDisplay.getBoundingClientRect();
      popup.className = `score-popup ${extraClass}`;
      popup.innerText = popupText || `+${points.toLocaleString('pt-BR')}`;
      popup.style.left = `${rect.left + rect.width / 2}px`;
      popup.style.top = `${rect.top - 2}px`;
      document.body.appendChild(popup);
      setTimeout(() => popup.remove(), 660);
    }

    function animateScoreTo(target) {
      const start = displayedScore;
      const delta = target - start;
      if (scoreAnimationId) cancelAnimationFrame(scoreAnimationId);

      if (delta === 0) {
        scoreDisplay.innerText = target.toLocaleString('pt-BR');
        return;
      }

      const startTime = performance.now();
      const duration = 320;

      const tick = now => {
        const progress = Math.min((now - startTime) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        displayedScore = Math.round(start + delta * eased);
        scoreDisplay.innerText = displayedScore.toLocaleString('pt-BR');

        if (progress < 1) scoreAnimationId = requestAnimationFrame(tick);
        else {
          scoreAnimationId = null;
          displayedScore = target;
          scoreDisplay.innerText = target.toLocaleString('pt-BR');
        }
      };

      scoreAnimationId = requestAnimationFrame(tick);
    }

    function setDisplayedScore(value) {
      displayedScore = value;
      scoreDisplay.innerText = value.toLocaleString('pt-BR');
    }

    function showImpactParticles(cells) {
      if (!cells.length) return;

      const rects = cells.map(cell => cell.getBoundingClientRect());
      const centerX = rects.reduce((sum, rect) => sum + rect.left + rect.width / 2, 0) / rects.length;
      const centerY = rects.reduce((sum, rect) => sum + rect.top + rect.height / 2, 0) / rects.length;

      for (let i = 0; i < 7; i++) {
        const particle = document.createElement('span');
        particle.className = 'impact-particle';
        particle.style.left = `${centerX}px`;
        particle.style.top = `${centerY}px`;
        particle.style.setProperty('--dx', `${(Math.random() - 0.5) * 90}px`);
        particle.style.setProperty('--dy', `${(Math.random() - 0.5) * 90}px`);
        effectLayer.appendChild(particle);
        setTimeout(() => particle.remove(), 470);
      }
    }

    function pulseBoard(className, duration = 350) {
      boardEl.classList.remove(className);
      void boardEl.offsetWidth;
      boardEl.classList.add(className);
      setTimeout(() => boardEl.classList.remove(className), duration);
    }

    function animatePlacementImpact(cells) {
      pulseBoard('impact-place', 240);

      cells.forEach(cell => {
        cell.classList.remove('place-impact');
        void cell.offsetWidth;
        cell.classList.add('place-impact');
        setTimeout(() => cell.classList.remove('place-impact'), 250);
      });

      showImpactParticles(cells);
    }

    function resetCombo() {
      combo = 0;
      document.body.classList.remove(...COMBO_CLASSES);
      comboBadge.classList.remove('show');
      if (comboTimeout) {
        clearTimeout(comboTimeout);
        comboTimeout = null;
      }
    }

    function updateCombo(lines) {
      combo += 1;

      if (combo > stats.highestCombo) {
        stats.highestCombo = combo;
        saveStats();
      }

      activateComboOverlay(combo, lines);
    }

    function endCombo() {
      resetCombo();
    }

    function vibrateClear(lines) {
      if (lines >= 4) triggerVibration([18, 30, 18, 30, 24]);
      else if (lines >= 2) triggerVibration([15, 25, 18]);
      else triggerVibration(12);
    }

    function showPerfectClear() {
      if (perfectClearTimeout) clearTimeout(perfectClearTimeout);

      perfectClearEl.classList.remove('show');
      void perfectClearEl.offsetWidth;
      perfectClearEl.classList.add('show');

      perfectClearTimeout = setTimeout(() => {
        perfectClearEl.classList.remove('show');
      }, 1220);

      playSound('perfect');
      triggerVibration([28, 45, 28, 65, 34]);
      stats.perfectClears += 1;
      saveStats();
    }

    function endDrag(event, cancelled = false) {
      if (!isDragging || !event || event.pointerId !== dragPointerId) return;

      if (cancelled) {
        const slot = rackSlots[dragPieceIndex];
        isDragging = false;
        dragPointerId = null;
        draggingContainer.style.display = 'none';
        clearHints();
        if (slot) slot.classList.remove('hidden-slot');
        dragPieceIndex = -1;
        dragMatrix = null;
        touchOffsetY = 0;
        return;
      }

      const gridPos = getGridPosition(event.clientX, event.clientY);
      const pieceIndex = dragPieceIndex;
      const pieceMatrix = dragMatrix;
      const slot = rackSlots[pieceIndex];

      isDragging = false;
      dragPointerId = null;
      draggingContainer.style.display = 'none';
      clearHints();

      if (gridPos && checkFit(pieceMatrix, gridPos.x, gridPos.y)) {
        placePiece(pieceMatrix, gridPos.x, gridPos.y);
        rackPieces[pieceIndex] = null;
        slot.innerHTML = '';
        const clearedLines = checkLines();
        if (clearedLines === 0) endCombo();
        generateRack();
        checkGameOver();
      } else {
        slot.classList.remove('hidden-slot');
      }

      dragPieceIndex = -1;
      dragMatrix = null;
      touchOffsetY = 0;
    }

    function startKeyboardPlacement(index, matrix, slotEl) {
      if (!matrix || isDragging) return;

      const position = findFirstValidPlacement(matrix);
      if (!position) {
        slotEl.classList.add('hidden-slot');
        setTimeout(() => slotEl.classList.remove('hidden-slot'), 180);
        return;
      }

      ensureAudio();
      placePiece(matrix, position.x, position.y);
      rackPieces[index] = null;
      slotEl.innerHTML = '';
      const clearedLines = checkLines();
      if (clearedLines === 0) endCombo();
      generateRack();
      checkGameOver();
    }

    function findFirstValidPlacement(matrix) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        for (let x = 0; x < BOARD_SIZE; x++) {
          if (checkFit(matrix, x, y)) return { x, y };
        }
      }
      return null;
    }

    // --- GAME RULES ---
    function checkFit(matrix, anchorX, anchorY) {
      for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[0].length; x++) {
          if (matrix[y][x] !== 1) continue;

          const boardX = anchorX + x;
          const boardY = anchorY + y;

          if (boardX < 0 || boardX >= BOARD_SIZE || boardY < 0 || boardY >= BOARD_SIZE) {
            return false;
          }

          if (board[boardY][boardX] === 1) {
            return false;
          }
        }
      }

      return true;
    }

    function placePiece(matrix, anchorX, anchorY) {
      let blocksPlaced = 0;
      const placedCells = [];

      for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[0].length; x++) {
          if (matrix[y][x] === 1) {
            board[anchorY + y][anchorX + x] = 1;
            blocksPlaced++;
            placedCells.push(getCellEl(anchorX + x, anchorY + y));
          }
        }
      }

      stats.piecesPlaced += 1;
      saveStats();

      updateBoardVisuals();
      animatePlacementImpact(placedCells);
      addScore(blocksPlaced * 10);
      const bridge = window.BlohshBlastBridge;
      if (bridge && typeof bridge.onPiecePlaced === 'function') {
        bridge.onPiecePlaced(1);
      }
      emitRuntimeEvent('piecePlaced', { amount: 1 });
      playSound('place');
      triggerVibration(8);
      showScorePopup(blocksPlaced * 10);
    }

    let hintCells = [];

    function clearHints() {
      hintCells.forEach(cell => {
        cell.classList.remove('cell-hint', 'cell-hint-error');
      });
      hintCells = [];
    }

    function drawHint(matrix, anchorX, anchorY, isValid) {
      for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < matrix[0].length; x++) {
          if (matrix[y][x] !== 1) continue;

          const boardX = anchorX + x;
          const boardY = anchorY + y;

          if (boardX < 0 || boardX >= BOARD_SIZE || boardY < 0 || boardY >= BOARD_SIZE) {
            continue;
          }

          const cell = getCellEl(boardX, boardY);

          if (board[boardY][boardX] === 0) {
            cell.classList.add(isValid ? 'cell-hint' : 'cell-hint-error');
          } else {
            cell.classList.add('cell-hint-error');
          }

          hintCells.push(cell);
        }
      }
    }

    function checkLines() {
      const rowsToClear = [];
      const colsToClear = [];

      for (let y = 0; y < BOARD_SIZE; y++) {
        if (board[y].every(cell => cell === 1)) {
          rowsToClear.push(y);
        }
      }

      for (let x = 0; x < BOARD_SIZE; x++) {
        let colFull = true;

        for (let y = 0; y < BOARD_SIZE; y++) {
          if (board[y][x] === 0) {
            colFull = false;
            break;
          }
        }

        if (colFull) {
          colsToClear.push(x);
        }
      }

      const totalLines = rowsToClear.length + colsToClear.length;

      if (totalLines === 0) return 0;

      const cellsMap = new Map();

      rowsToClear.forEach(y => {
        for (let x = 0; x < BOARD_SIZE; x++) {
          board[y][x] = 0;
          cellsMap.set(`${x},${y}`, getCellEl(x, y));
        }
      });

      colsToClear.forEach(x => {
        for (let y = 0; y < BOARD_SIZE; y++) {
          board[y][x] = 0;
          cellsMap.set(`${x},${y}`, getCellEl(x, y));
        }
      });

      const cellsToAnimate = Array.from(cellsMap.values());
      const clearClass = getClearClass(totalLines);
      const clearDelay = getClearDelay(clearClass);
      const isPerfectClear = board.every(row => row.every(cell => cell === 0));

      updateCombo(totalLines);
      stats.linesCleared += totalLines;
      saveStats();

      pulseBoard('impact-clear', 340);
      vibrateClear(totalLines);
      playSound(combo >= 2 ? 'combo' : 'clear');
      triggerSkinClearEffect(cellsToAnimate);

      cellsToAnimate.forEach(cell => {
        cell.classList.remove('cell-filled');
        cell.classList.add('clearing', clearClass);
        setTimeout(() => cell.classList.remove('clearing', clearClass), clearDelay);
      });

      const baseClearScore = (totalLines * 100) * totalLines;
      const comboMultiplier = Math.min(1 + (combo - 1) * 0.35, 3);
      const clearScore = Math.round(baseClearScore * comboMultiplier);
      const bridge = window.BlohshBlastBridge;
      if (bridge && typeof bridge.onLinesCleared === 'function') {
        bridge.onLinesCleared(totalLines);
      }
      emitRuntimeEvent('linesCleared', { amount: totalLines });

      addScore(
        clearScore,
        combo > 1
          ? `+${clearScore.toLocaleString('pt-BR')} // ${combo.toFixed(1)}x`
          : null,
        combo > 1 ? 'combo' : ''
      );

      if (isPerfectClear) {
        addScore(PERFECT_CLEAR_BONUS);
        if (bridge && typeof bridge.onPerfectClear === 'function') {
          bridge.onPerfectClear();
        }
        emitRuntimeEvent('perfectClear', {});
        showPerfectClear();
      }

      setTimeout(updateBoardVisuals, clearDelay);
      return totalLines;
    }

    function getClearClass(totalLines) {
      if (totalLines >= 8) return 'clear-voxel';
      if (document.body.classList.contains('skin-tty')) return 'clear-tty';
      if (document.body.classList.contains('skin-happier')) return 'clear-happier';
      if (document.body.classList.contains('skin-sushi')) return 'clear-sushi';
      if (document.body.classList.contains('skin-halley')) return 'clear-halley';
      return 'clear-blohsh';
    }

    function getClearDelay(clearClass) {
      const delays = {
        'clear-tty': 200,
        'clear-happier': 640,
        'clear-sushi': 460,
        'clear-halley': 540,
        'clear-voxel': 680,
        'clear-blohsh': 420
      };

      return delays[clearClass] || 420;
    }

    function addScore(points, popupText = null, popupClass = '') {
      if (!Number.isFinite(points) || points <= 0) return;

      const bridge = window.BlohshBlastBridge;
      const multiplier = bridge && typeof bridge.scoreMultiplier === 'function'
        ? Math.max(0, Number(bridge.scoreMultiplier()) || 1)
        : 1;
      const awardedPoints = Math.round(points * multiplier);

      score += awardedPoints;
      emitRuntimeEvent('scoreChanged', { score });
      animateScoreTo(score);

      if (score > highScore) {
        highScore = score;
        highscoreDisplay.innerText = highScore.toLocaleString('pt-BR');
        localStorage.setItem('blohshHighScore', highScore);
        renderStats();
      }

      updateSkin();
      if (popupText) showScorePopup(points, popupText, popupClass);
    }

    // --- TEMPORARY COMBO EFFECTS ---
    function activateComboOverlay(currentCombo, lines) {
      document.body.classList.remove(...COMBO_CLASSES);
      screenEffect.className = '';
      comboBadge.classList.remove('show');

      if (comboTimeout) clearTimeout(comboTimeout);
      if (currentCombo < 1) return;

      let comboClass = 'combo-arcade';
      if (currentCombo >= 8) comboClass = 'combo-voxel';
      else if (currentCombo >= 6) comboClass = 'combo-space';
      else if (currentCombo >= 4) comboClass = 'combo-root';

      if (currentCombo >= 2) screenEffect.classList.add('arcade-flash');

      document.body.classList.add(comboClass);
      comboBadge.innerText = currentCombo > 1
        ? `COMBO ${currentCombo}X // ${lines} LINHA${lines > 1 ? 'S' : ''}`
        : `STREAK // ${lines} LINHA${lines > 1 ? 'S' : ''}`;
      comboBadge.classList.add('show');

      comboTimeout = setTimeout(() => {
        comboBadge.classList.remove('show');
        document.body.classList.remove(...COMBO_CLASSES);
        screenEffect.className = '';
      }, 1400);
    }

    function triggerSkinClearEffect(cellsToAnimate) {
      if (document.body.classList.contains('skin-sushi')) {
        createRiceParticles(cellsToAnimate);
      }

      if (document.body.classList.contains('skin-halley')) {
        createCometTrail();
      }
    }

    function createRiceParticles(cells) {
      const selectedCells = cells.slice(0, 28);

      selectedCells.forEach(cell => {
        const rect = cell.getBoundingClientRect();

        for (let i = 0; i < 2; i++) {
          const particle = document.createElement('span');

          particle.className = 'rice-particle';
          particle.style.left = `${rect.left + rect.width / 2}px`;
          particle.style.top = `${rect.top + rect.height / 2}px`;
          particle.style.setProperty('--dx', `${(Math.random() - 0.5) * 120}px`);
          particle.style.setProperty('--dy', `${-35 - Math.random() * 95}px`);

          effectLayer.appendChild(particle);

          setTimeout(() => particle.remove(), 720);
        }
      });
    }

    function createCometTrail() {
      const comet = document.createElement('span');

      comet.className = 'comet-trail';
      comet.style.setProperty('--comet-y', `${26 + Math.random() * 48}vh`);

      effectLayer.appendChild(comet);

      setTimeout(() => comet.remove(), 820);
    }

    function checkGameOver() {
      if (!gameOverModal.classList.contains('modal-hidden')) return;
      if (rackPieces.every(piece => piece === null)) return;

      let canPlay = false;

      for (const piece of rackPieces) {
        if (!piece) continue;

        for (let y = 0; y < BOARD_SIZE; y++) {
          for (let x = 0; x < BOARD_SIZE; x++) {
            if (checkFit(piece, x, y)) {
              canPlay = true;
              break;
            }
          }

          if (canPlay) break;
        }

        if (canPlay) break;
      }

      if (!canPlay) {
        document.getElementById('final-score').innerText = score.toLocaleString('pt-BR');
        playSound('gameover');
        triggerVibration([30, 55, 30]);
        gameOverModal.classList.remove('modal-hidden');
        const bridge = window.BlohshBlastBridge;
        if (bridge && typeof bridge.onGameOver === 'function') {
          bridge.onGameOver(score);
        }
        emitRuntimeEvent('gameOver', { score });
      }
    }

    function resetGame() {
      isDragging = false;
      dragPieceIndex = -1;
      dragMatrix = null;
      dragPointerId = null;
      touchOffsetY = 0;
      draggingContainer.style.display = 'none';
      clearHints();
      board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
      score = 0;
      if (scoreAnimationId) cancelAnimationFrame(scoreAnimationId);
      scoreAnimationId = null;
      setDisplayedScore(0);
      rackPieces = [null, null, null];

      if (perfectClearTimeout) {
        clearTimeout(perfectClearTimeout);
        perfectClearTimeout = null;
      }

      document.body.classList.remove(...COMBO_CLASSES);
      comboBadge.classList.remove('show');
      gameOverModal.classList.add('modal-hidden');

      resetCombo();
      registerGameStart();
      updateSkin();
      updateBoardVisuals();
      generateRack();
      emitRuntimeEvent('reset', { score: 0 });
    }

    init();

    window.BlohshBlastLegacyRuntime = {
      getState: () => ({
        board: board.map(row => [...row]),
        score,
        combo,
        rack: rackPieces.map(piece => piece ? piece.map(row => [...row]) : null),
        gameOver: !gameOverModal.classList.contains('modal-hidden')
      }),
      reset: () => resetGame(),
      placeFirstAvailable: index => {
        const piece = rackPieces[index];
        const slot = rackSlots[index];
        if (!piece || !slot) return false;
        startKeyboardPlacement(index, piece, slot);
        return true;
      },
      subscribe: listener => {
        if (typeof listener !== 'function') return () => {};
        runtimeSubscribers.add(listener);
        return () => runtimeSubscribers.delete(listener);
      }
    };
