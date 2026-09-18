/* Blohsh Blast — Phase 3 product layer
 * Adds menu, modes, persistent progression, unlockable skins, missions,
 * daily challenge, PWA/offline registration and local leaderboard.
 */
(() => {
  'use strict';

  const P3 = {
    PROGRESSION_KEY: 'blohshBlastProgressionV3',
    MISSIONS_KEY: 'blohshBlastMissionsV3',
    LEADERBOARD_KEY: 'blohshBlastLeaderboardV3',
    DAILY_KEY: 'blohshBlastDailyV3',
    NICKNAME_KEY: 'blohshBlastNickname',
    XP_THRESHOLDS: [0, 300, 800, 1500, 2500, 3800, 5500, 7800, 10800, 14500],
    SKINS: [
      { minLevel: 1, className: 'skin-blohsh', label: 'Blohsh Original' },
      { minLevel: 2, className: 'skin-tty', label: 'TTY / Shell' },
      { minLevel: 4, className: 'skin-happier', label: 'Era Happier' },
      { minLevel: 6, className: 'skin-sushi', label: 'Sushi Bar' },
      { minLevel: 8, className: 'skin-halley', label: 'Cometa Halley' }
    ],
    MODES: {
      classic: { label: 'CLASSIC', description: 'Padrão', smartRng: true, maxBlocks: Infinity, scoreMultiplier: 1, xpMultiplier: 1 },
      zen: { label: 'ZEN', description: 'Relax', smartRng: true, maxBlocks: 3, scoreMultiplier: 1, xpMultiplier: 1.08 },
      hardcore: { label: 'HARDCORE', description: 'Sem ajuda', smartRng: false, maxBlocks: Infinity, scoreMultiplier: 1.5, xpMultiplier: 1.2 },
      daily: { label: 'DAILY', description: 'Desafio diário', smartRng: true, maxBlocks: Infinity, scoreMultiplier: 1, xpMultiplier: 1.05 }
    },
    MISSIONS: [
      { type: 'score', target: 1200, reward: 100, label: 'Faça 1.200 pontos' },
      { type: 'score', target: 3000, reward: 180, label: 'Faça 3.000 pontos' },
      { type: 'lines', target: 8, reward: 120, label: 'Limpe 8 linhas' },
      { type: 'lines', target: 20, reward: 220, label: 'Limpe 20 linhas' },
      { type: 'pieces', target: 18, reward: 100, label: 'Coloque 18 peças' },
      { type: 'pieces', target: 35, reward: 180, label: 'Coloque 35 peças' },
      { type: 'combo', target: 3, reward: 160, label: 'Alcance COMBO 3x' },
      { type: 'perfect', target: 1, reward: 260, label: 'Faça 1 Perfect Clear' }
    ],
    mode: 'classic',
    rngState: null,
    gameEnded: false,
    progression: null,
    missions: null,
    daily: null,
    leaderboard: null,
    nickname: 'PLAYER',
    base: {}
  };

  function $(id) {
    return document.getElementById(id);
  }

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const data = JSON.parse(raw);
      return data ?? fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function dateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function random01() {
    if (P3.rngState === null) return Math.random();
    P3.rngState = (Math.imul(P3.rngState, 1664525) + 1013904223) >>> 0;
    return P3.rngState / 4294967296;
  }

  function shapeBlockCountLocal(matrix) {
    return matrix.reduce((total, row) => total + row.filter(Boolean).length, 0);
  }

  function shapePool() {
    return P3.MODE.S.maxBlocks === Infinity
      ? SHAPES
      : SHAPES.filter(shape => shapeBlockCountLocal(shape) <= P3.MODE.S.maxBlocks);
  }

  function canPlaceAnywhereLocal(matrix) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (checkFit(matrix, x, y)) return true;
      }
    }
    return false;
  }

  function canPlayAnyLocal() {
    return shapePool().some(canPlaceAnywhereLocal);
  }

  function shapeSignatureLocal(matrix) {
    return matrix.map(row => row.join('')).join('/');
  }

  function getRandomShapeLocal() {
    const pool = shapePool();
    return pool[Math.floor(random01() * pool.length)];
  }

  function smartRackLocal() {
    let bestRack = null;
    let bestScore = -Infinity;

    for (let attempt = 0; attempt < 55; attempt++) {
      const candidates = [getRandomShapeLocal(), getRandomShapeLocal(), getRandomShapeLocal()];
      const signatures = new Set(candidates.map(shapeSignatureLocal));
      const playable = candidates.filter(canPlaceAnywhereLocal).length;
      const sizes = candidates.map(shapeBlockCountLocal);
      const diversity = new Set(sizes).size;
      const hasSmall = sizes.some(size => size <= 2);
      const duplicates = candidates.length - signatures.size;
      const candidateScore =
        playable * 45 +
        signatures.size * 19 +
        diversity * 11 +
        (hasSmall ? 10 : 0) +
        random01() * 16 -
        duplicates * 28;

      if (candidateScore > bestScore) {
        bestScore = candidateScore;
        bestRack = candidates;
      }
    }

    if (bestRack && !bestRack.some(canPlaceAnywhereLocal) && canPlayAnyLocal()) {
      const playable = shapePool().filter(canPlaceAnywhereLocal);
      bestRack[0] = playable[Math.floor(random01() * playable.length)];
    }

    return bestRack || [getRandomShapeLocal(), getRandomShapeLocal(), getRandomShapeLocal()];
  }

  function loadProgression() {
    const fallback = {
      xp: 0,
      level: 1,
      unlockedSkins: ['skin-blohsh'],
      selectedSkin: 'skin-blohsh'
    };
    const saved = readJSON(P3.PROGRESSION_KEY, fallback);
    return {
      xp: Math.max(0, Number(saved.xp) || 0),
      level: Math.max(1, Number(saved.level) || 1),
      unlockedSkins: Array.isArray(saved.unlockedSkins) ? [...new Set(saved.unlockedSkins)] : ['skin-blohsh'],
      selectedSkin: typeof saved.selectedSkin === 'string' ? saved.selectedSkin : 'skin-blohsh'
    };
  }

  function getLevel(xp) {
    let level = 1;
    P3.XP_THRESHOLDS.forEach((threshold, index) => {
      if (xp >= threshold) level = index + 1;
    });
    return Math.min(level, P3.XP_THRESHOLDS.length);
  }

  function syncSkins(save = true) {
    const old = JSON.stringify(P3.progression);
    P3.progression.level = getLevel(P3.progression.xp);

    P3.SKINS.forEach(skin => {
      if (P3.progression.level >= skin.minLevel && !P3.progression.unlockedSkins.includes(skin.className)) {
        P3.progression.unlockedSkins.push(skin.className);
      }
    });

    if (!P3.progression.unlockedSkins.includes(P3.progression.selectedSkin)) {
      P3.progression.selectedSkin = 'skin-blohsh';
    }

    if (save && old !== JSON.stringify(P3.progression)) {
      writeJSON(P3.PROGRESSION_KEY, P3.progression);
    }
  }

  function addXP(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    const previous = P3.progression.level;
    P3.progression.xp += Math.round(amount);
    P3.progression.level = getLevel(P3.progression.xp);
    syncSkins(false);
    writeJSON(P3.PROGRESSION_KEY, P3.progression);

    if (P3.progression.level > previous) {
      triggerVibration([24, 45, 24, 70, 30]);
      showMiniToast(`LEVEL UP // NÍVEL ${P3.progression.level}`);
    }

    renderMenu();
  }

  function loadMissions() {
    const today = dateKey();
    const saved = readJSON(P3.MISSIONS_KEY, null);
    if (saved && saved.date === today && Array.isArray(saved.missions)) {
      return saved;
    }

    const seed = hashString(today + ':missions');
    const pool = [...P3.MISSIONS];
    const selected = [];

    for (let i = 0; i < 3; i++) {
      const index = Math.abs((seed + i * 1013904223) | 0) % pool.length;
      const mission = pool.splice(index, 1)[0];
      selected.push({ ...mission, id: `${today}-${i}` });
    }

    return {
      date: today,
      missions: selected,
      progress: { score: 0, lines: 0, pieces: 0, combo: 0, perfect: 0 },
      claimed: []
    };
  }

  function missionEvent(type, amount = 1) {
    if (!P3.missions) return;

    if (type === 'combo') {
      P3.missions.progress.combo = Math.max(P3.missions.progress.combo || 0, Number(amount) || 0);
    } else {
      P3.missions.progress[type] = (P3.missions.progress[type] || 0) + (Number(amount) || 0);
    }

    P3.missions.missions.forEach(mission => {
      if (P3.missions.claimed.includes(mission.id)) return;
      const current = Number(P3.missions.progress[mission.type] || 0);
      if (current >= mission.target) {
        P3.missions.claimed.push(mission.id);
        addXP(mission.reward);
        showMiniToast(`MISSION COMPLETE // +${mission.reward} XP`);
      }
    });

    writeJSON(P3.MISSIONS_KEY, P3.missions);
    renderMissions();
  }

  function loadDaily() {
    const today = dateKey();
    const saved = readJSON(P3.DAILY_KEY, null);
    return saved && saved.date === today
      ? { date: today, best: Math.max(0, Number(saved.best) || 0) }
      : { date: today, best: 0 };
  }

  function loadLeaderboard() {
    const saved = readJSON(P3.LEADERBOARD_KEY, []);
    return Array.isArray(saved)
      ? saved.filter(entry => entry && Number.isFinite(Number(entry.score))).slice(0, 50)
      : [];
  }

  function saveLeaderboard() {
    P3.leaderboard.sort((a, b) => b.score - a.score);
    P3.leaderboard = P3.leaderboard.slice(0, 50);
    writeJSON(P3.LEADERBOARD_KEY, P3.leaderboard);
    renderLeaderboard();
  }

  function recordScore(finalScore) {
    if (!finalScore || finalScore <= 0) return;

    const entry = {
      name: P3.nickname || 'PLAYER',
      score: Math.round(finalScore),
      mode: P3.MODE.S.label,
      date: dateKey()
    };

    P3.leaderboard.push(entry);
    saveLeaderboard();

    if (P3.mode === 'daily' && finalScore > P3.daily.best) {
      P3.daily.best = Math.round(finalScore);
      writeJSON(P3.DAILY_KEY, P3.daily);
    }

    renderMenu();
  }

  function applyPhase3Skin() {
    syncSkins(false);

    const chosen = P3.SKINS.find(
      skin => skin.className === P3.progression.selectedSkin &&
              P3.progression.unlockedSkins.includes(skin.className)
    ) || P3.SKINS[0];

    if (typeof SKIN_CLASSES !== 'undefined') {
      document.body.classList.remove(...SKIN_CLASSES);
    }
    document.body.classList.add(chosen.className);

    const index = P3.SKINS.findIndex(skin => skin.className === chosen.className) + 1;
    const skinLabel = $('skin-label');
    if (skinLabel) skinLabel.innerText = `Nível ${index} — ${chosen.label}`;
  }

  function selectSkin(className) {
    if (!P3.progression.unlockedSkins.includes(className)) return;
    P3.progression.selectedSkin = className;
    writeJSON(P3.PROGRESSION_KEY, P3.progression);
    updateSkin();
    renderMenu();
  }

  function startGame(mode = 'classic') {
    P3.mode = P3.MODES[mode] ? mode : 'classic';
    P3.MODE = { S: P3.MODES[P3.mode] };
    P3.rngState = P3.mode === 'daily' ? hashString(P3.daily.date + ':game') : null;
    P3.gameEnded = false;

    board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
    score = 0;
    if (typeof scoreAnimationId !== 'undefined' && scoreAnimationId) cancelAnimationFrame(scoreAnimationId);
    if (typeof setDisplayedScore === 'function') setDisplayedScore(0);
    else if ($('score-display')) $('score-display').innerText = '0';
    rackPieces = [null, null, null];

    resetCombo();
    if (typeof perfectClearTimeout !== 'undefined' && perfectClearTimeout) {
      clearTimeout(perfectClearTimeout);
    }
    if ($('perfect-clear')) $('perfect-clear').classList.remove('show');
    if ($('game-over-modal')) $('game-over-modal').classList.add('modal-hidden');

    const modeLabel = $('mode-label');
    if (modeLabel) modeLabel.innerText = P3.MODE.S.label;

    registerGameStart();
    hideMenu();
    updateSkin();
    updateBoardVisuals();
    generateRack();
    updateModeChip();
  }

  function resetGame() {
    startGame(P3.mode);
  }

  function getCurrentShape() {
    const pool = shapePool();
    return pool[Math.floor(random01() * pool.length)];
  }

  function generateRack() {
    if (!rackPieces.every(piece => piece === null)) return;

    const useSmart = P3.MODE.S.smartRng;
    rackPieces = useSmart
      ? smartRackLocal()
      : [getCurrentShape(), getCurrentShape(), getCurrentShape()];

    renderRack();
    checkGameOver();
  }

  function addScore(points, popupText = null, popupClass = '') {
    if (!Number.isFinite(points) || points <= 0) return;

    const awarded = Math.round(points * P3.MODE.S.scoreMultiplier);
    P3.base.addScore(awarded, popupText, popupClass);

    missionEvent('score', awarded);
    addXP(Math.max(1, Math.round((awarded / 12) * P3.MODE.S.xpMultiplier)));
  }

  function placePiece(matrix, anchorX, anchorY) {
    P3.base.placePiece(matrix, anchorX, anchorY);
    missionEvent('pieces', 1);
  }

  function checkLines() {
    const before = combo;
    const result = P3.base.checkLines();

    if (result > 0) {
      missionEvent('lines', result);
      missionEvent('combo', combo);
      if (board.every(row => row.every(cell => cell === 0))) {
        missionEvent('perfect', 1);
      }
    } else if (before > 0) {
      // The base game already resets the combo from its caller; mission progress stays as a maximum.
    }

    return result;
  }

  function checkGameOver() {
    P3.base.checkGameOver();

    const modal = $('game-over-modal');
    const visible = modal && !modal.classList.contains('modal-hidden');

    if (visible && !P3.gameEnded) {
      P3.gameEnded = true;
      recordScore(score);
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      updateOfflineStatus(false);
      return;
    }

    navigator.serviceWorker.register('./sw.js')
      .then(() => updateOfflineStatus(true))
      .catch(() => updateOfflineStatus(false));
  }

  function updateOfflineStatus(serviceWorkerReady = null) {
    const online = navigator.onLine;
    const status = online
      ? (serviceWorkerReady === false ? 'ONLINE' : 'ONLINE // OFFLINE READY')
      : 'OFFLINE // LOCAL MODE';

    const node = $('phase3-offline');
    if (node) node.innerText = status;
  }

  function showMiniToast(message) {
    const toast = document.createElement('div');
    toast.className = 'phase3-toast';
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1900);
  }

  function renderProgress() {
    const level = P3.progression.level;
    const currentThreshold = P3.XP_THRESHOLDS[level - 1] || 0;
    const nextThreshold = P3.XP_THRESHOLDS[level] || currentThreshold + 1000;
    const range = Math.max(1, nextThreshold - currentThreshold);
    const current = Math.max(0, P3.progression.xp - currentThreshold);

    const levelEl = $('phase3-level');
    const xpEl = $('phase3-xp');
    const fill = $('phase3-xp-fill');
    if (!levelEl || !xpEl || !fill) return;

    levelEl.innerText = `NÍVEL ${level}`;
    xpEl.innerText = `${P3.progression.xp.toLocaleString('pt-BR')} XP`;
    fill.style.width = `${Math.min(100, current / range * 100)}%`;
  }

  function renderMissions() {
    const list = $('phase3-missions');
    if (!list || !P3.missions) return;

    list.innerHTML = P3.missions.missions.map(mission => {
      const progress = Math.min(mission.target, Number(P3.missions.progress[mission.type] || 0));
      const percent = Math.min(100, progress / mission.target * 100);
      const done = P3.missions.claimed.includes(mission.id);

      return `<div class="p3-mission ${done ? 'done' : ''}">
        <div><span>${mission.label}</span><b>${progress}/${mission.target}</b></div>
        <div class="p3-track"><i style="width:${percent}%"></i></div>
      </div>`;
    }).join('');
  }

  function skinSwatch(className) {
    const map = {
      'skin-blohsh': '#39ff14',
      'skin-tty': 'linear-gradient(90deg,#00e5ff,#ff00ff)',
      'skin-happier': 'linear-gradient(90deg,#f7d36a,#8d5f1c)',
      'skin-sushi': 'linear-gradient(90deg,#ff8a70,#d7263d,#fff1cf)',
      'skin-halley': 'linear-gradient(90deg,#8ecbff,#a86bff)'
    };
    return map[className] || '#39ff14';
  }

  function renderSkins() {
    const list = $('phase3-skins');
    if (!list) return;

    list.innerHTML = P3.SKINS.map(skin => {
      const unlocked = P3.progression.unlockedSkins.includes(skin.className);
      const selected = P3.progression.selectedSkin === skin.className;
      const label = unlocked ? (selected ? 'EQUIPADA' : 'DESBLOQUEADA') : `NÍVEL ${skin.minLevel}`;
      return `<button class="p3-skin ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-skin="${skin.className}" type="button" ${unlocked ? '' : 'disabled'}>
        <i style="background:${skinSwatch(skin.className)}"></i>
        <strong>${skin.label}</strong>
        <small>${label}</small>
      </button>`;
    }).join('');

    list.querySelectorAll('[data-skin]').forEach(button => {
      button.addEventListener('click', () => selectSkin(button.dataset.skin));
    });
  }

  function renderLeaderboard() {
    const list = $('phase3-leaderboard');
    if (!list) return;

    if (!P3.leaderboard.length) {
      list.innerHTML = '<div class="p3-empty">Nenhum score salvo ainda.</div>';
      return;
    }

    list.innerHTML = P3.leaderboard.slice(0, 10).map((entry, index) =>
      `<div class="p3-leader-row">
        <span>${String(index + 1).padStart(2, '0')}</span>
        <b>${escapeHTML(entry.name)}</b>
        <small>${entry.mode}</small>
        <strong>${Number(entry.score).toLocaleString('pt-BR')}</strong>
      </div>`
    ).join('');
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    })[char]);
  }

  function renderMenu() {
    renderProgress();
    renderMissions();
    renderSkins();
    renderLeaderboard();

    const dailyLabel = $('phase3-daily-label');
    const dailyBest = $('phase3-daily-best');
    if (dailyLabel) dailyLabel.innerText = `Desafio ${P3.daily.date.split('-').reverse().join('/')}`;
    if (dailyBest) dailyBest.innerText = `BEST: ${P3.daily.best.toLocaleString('pt-BR')}`;

    const nickname = $('phase3-nickname');
    if (nickname && document.activeElement !== nickname) nickname.value = P3.nickname;

    const sfx = $('sound-toggle');
    if (sfx && typeof soundEnabled !== 'undefined') sfx.innerText = soundEnabled ? 'SFX ON' : 'SFX OFF';

    updateOfflineStatus();
  }

  function updateModeChip() {
    const modeChip = $('phase3-mode-chip');
    if (modeChip) modeChip.innerText = P3.MODE.S.label;
  }

  function showMenu() {
    document.body.classList.add('phase3-menu-open');
    renderMenu();
  }

  function hideMenu() {
    document.body.classList.remove('phase3-menu-open');
  }

  function openStats() {
    const modal = $('phase3-stats-modal');
    if (!modal) return;

    $('phase3-stat-games').innerText = stats.gamesPlayed.toLocaleString('pt-BR');
    $('phase3-stat-best').innerText = highScore.toLocaleString('pt-BR');
    $('phase3-stat-pieces').innerText = stats.piecesPlaced.toLocaleString('pt-BR');
    $('phase3-stat-lines').innerText = stats.linesCleared.toLocaleString('pt-BR');
    $('phase3-stat-perfect').innerText = stats.perfectClears.toLocaleString('pt-BR');
    $('phase3-stat-combo').innerText = `${stats.highestCombo}x`;
    $('phase3-stat-xp').innerText = P3.progression.xp.toLocaleString('pt-BR');
    $('phase3-stat-daily').innerText = P3.daily.best.toLocaleString('pt-BR');

    modal.classList.remove('modal-hidden');
  }

  function closeStats() {
    const modal = $('phase3-stats-modal');
    if (modal) modal.classList.add('modal-hidden');
  }

  function setupMenuEvents() {
    document.querySelectorAll('.phase3-mode').forEach(button => {
      button.addEventListener('click', () => startGame(button.dataset.mode));
    });

    $('phase3-stats-button').addEventListener('click', openStats);
    $('phase3-stats-close').addEventListener('click', closeStats);
    $('phase3-stats-modal').addEventListener('click', event => {
      if (event.target.id === 'phase3-stats-modal') closeStats();
    });

    $('phase3-nickname').addEventListener('input', event => {
      const clean = event.target.value.replace(/[^a-zA-Z0-9 _-]/g, '').slice(0, 16);
      P3.nickname = clean || 'PLAYER';
      localStorage.setItem(P3.NICKNAME_KEY, P3.nickname);
      renderLeaderboard();
    });

    $('phase3-menu-sound').addEventListener('click', () => {
      if (typeof toggleSound === 'function') toggleSound();
      renderMenu();
    });

    $('phase3-skins-link').addEventListener('click', () => {
      $('phase3-skins').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    $('phase3-close-menu').addEventListener('click', hideMenu);

    document.querySelectorAll('[data-pc-action]').forEach(button => {
      button.addEventListener('click', () => {
        const action = button.dataset.pcAction;
        const menu = $('phase3-menu');

        if (action === 'play') return startGame('classic');
        if (action === 'daily') return startGame('daily');
        if (action === 'stats') return openStats();

        if (action === 'modes') {
          menu.classList.toggle('pc-modes-open');
          menu.classList.remove('pc-sections-open');
          return;
        }

        if (action === 'skins' || action === 'missions') {
          const alreadyOpen = menu.classList.contains('pc-sections-open');
          menu.classList.remove('pc-modes-open');
          menu.classList.toggle('pc-sections-open', !alreadyOpen);
          const target = action === 'skins' ? $('phase3-skins') : $('phase3-missions');
          if (!alreadyOpen) target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
      });
    });

    window.addEventListener('online', () => updateOfflineStatus());
    window.addEventListener('offline', () => updateOfflineStatus());

    const gameMenuButton = document.createElement('button');
    gameMenuButton.type = 'button';
    gameMenuButton.id = 'phase3-menu-game';
    gameMenuButton.className = 'header-tool';
    gameMenuButton.innerText = 'Menu';
    gameMenuButton.setAttribute('aria-label', 'Abrir menu principal');
    gameMenuButton.addEventListener('click', showMenu);

    const scoreTools = document.querySelector('.score-tools');
    if (scoreTools && !$('phase3-menu-game')) {
      scoreTools.prepend(gameMenuButton);
    }

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        const statsModal = $('phase3-stats-modal');
        if (statsModal && !statsModal.classList.contains('modal-hidden')) {
          closeStats();
        } else if (!document.body.classList.contains('phase3-menu-open')) {
          showMenu();
        }
      }
    });
  }

  function injectUI() {
    const style = document.createElement('style');
    style.textContent = `
      body.phase3-menu-open > *:not(#phase3-menu):not(#phase3-stats-modal){visibility:hidden!important;pointer-events:none!important}
      #phase3-menu{visibility:visible!important;pointer-events:auto!important}
      #phase3-stats-modal{visibility:visible!important;pointer-events:auto!important}
      .phase3-menu{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:14px;background:rgba(0,0,0,.9);overflow:auto}
      .phase3-menu-card{width:min(100%,560px);max-height:calc(100dvh - 28px);overflow:auto;padding:22px;border-radius:28px}
      .phase3-brand{text-align:center;margin-bottom:16px}
      .phase3-logo{width:58px;height:58px;margin:0 auto 8px;filter:drop-shadow(0 0 14px var(--accent))}
      .phase3-title{margin:0;color:var(--accent);font-size:34px;font-weight:700;line-height:.9;letter-spacing:-.08em;text-shadow:0 0 10px var(--accent)}
      .phase3-subtitle{margin:7px 0 0;color:var(--text-muted);font-size:9px;letter-spacing:.28em;text-transform:uppercase}
      .phase3-profile{padding:12px 14px;border:1px solid color-mix(in srgb,var(--accent) 22%,transparent);border-radius:18px;background:rgba(0,0,0,.24);margin-bottom:14px}
      .phase3-profile-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .phase3-level{color:var(--accent);font-weight:700;font-size:13px}
      .phase3-xp{color:var(--text-muted);font-size:9px;letter-spacing:.08em}
      .phase3-progress{height:5px;margin-top:7px;background:rgba(255,255,255,.08);border-radius:99px;overflow:hidden}
      .phase3-progress i{display:block;height:100%;background:var(--accent);box-shadow:0 0 10px var(--accent);transition:width 220ms ease}
      .phase3-section-title{margin:15px 0 8px;color:var(--text-muted);font-size:9px;letter-spacing:.2em;text-transform:uppercase}
      .phase3-modes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .phase3-mode{border:1px solid color-mix(in srgb,var(--accent) 24%,transparent);background:rgba(0,0,0,.2);color:var(--text-main);border-radius:17px;padding:14px;text-align:left;font:inherit;cursor:pointer;transition:transform 160ms ease,border-color 160ms ease,background 160ms ease}
      .phase3-mode:hover,.phase3-mode:focus-visible{transform:translateY(-2px);border-color:var(--accent);background:color-mix(in srgb,var(--accent) 9%,transparent);outline:none}
      .phase3-mode strong{display:block;color:var(--accent);font-size:13px;letter-spacing:.08em}
      .phase3-mode span{display:block;margin-top:5px;color:var(--text-muted);font-size:9px;line-height:1.4}
      .phase3-mode small{display:block;margin-top:6px;color:var(--text-muted);font-size:8px;letter-spacing:.08em}
      .phase3-mode.daily strong{color:#8ecbff}
      .phase3-columns{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
      .phase3-panel{padding:14px;border-radius:18px;background:rgba(0,0,0,.2);border:1px solid color-mix(in srgb,var(--accent) 14%,transparent)}
      .p3-mission{padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.03);margin-bottom:7px}
      .p3-mission:last-child{margin-bottom:0}
      .p3-mission.done{border:1px solid color-mix(in srgb,var(--accent) 28%,transparent)}
      .p3-mission>div:first-child{display:flex;justify-content:space-between;gap:8px;font-size:9px}
      .p3-mission b{color:var(--accent);white-space:nowrap}
      .p3-track{height:4px;margin-top:6px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden}
      .p3-track i{display:block;height:100%;background:var(--accent)}
      .phase3-skins{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .p3-skin{border:1px solid color-mix(in srgb,var(--accent) 16%,transparent);background:rgba(0,0,0,.14);color:var(--text-main);padding:9px;border-radius:13px;text-align:left;font:inherit;cursor:pointer}
      .p3-skin i{display:block;height:7px;border-radius:99px;margin-bottom:6px}
      .p3-skin strong{display:block;font-size:9px}
      .p3-skin small{display:block;margin-top:3px;color:var(--text-muted);font-size:8px}
      .p3-skin.selected{border-color:var(--accent);box-shadow:0 0 12px color-mix(in srgb,var(--accent) 18%,transparent)}
      .p3-skin.locked{opacity:.36;cursor:not-allowed}
      .phase3-leaderboard{display:grid;gap:7px}
      .p3-leader-row{display:grid;grid-template-columns:24px 1fr auto auto;gap:7px;align-items:center;font-size:9px}
      .p3-leader-row>span{color:var(--accent);font-weight:700}
      .p3-leader-row b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .p3-leader-row small{color:var(--text-muted);font-size:8px}
      .p3-leader-row strong{font-size:10px}
      .p3-empty{color:var(--text-muted);font-size:9px}
      .phase3-nickname{display:flex;gap:8px;margin-top:10px}
      #phase3-nickname{width:100%;border:1px solid color-mix(in srgb,var(--accent) 24%,transparent);background:rgba(0,0,0,.3);color:var(--text-main);border-radius:12px;padding:9px 11px;font:inherit;font-size:10px}
      #phase3-nickname:focus{outline:2px solid var(--accent);outline-offset:1px}
.phase3-actions{display:flex;gap:8px;margin-top:11px}
      .phase3-gameover-actions{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
      .phase3-gameover-actions .restart-button,.phase3-gameover-actions .menu-action{flex:1;min-width:130px}
      .phase3-action{flex:1;border:1px solid color-mix(in srgb,var(--accent) 20%,transparent);background:transparent;color:var(--text-main);padding:10px;border-radius:12px;font:inherit;font-size:9px;letter-spacing:.08em;text-transform:uppercase;cursor:pointer}
      .phase3-action:hover,.phase3-action:focus-visible{border-color:var(--accent);color:var(--accent);outline:none}
      .phase3-offline{margin:10px 0 0;text-align:center;color:var(--text-muted);font-size:8px;letter-spacing:.08em;text-transform:uppercase}
      .phase3-toast{position:fixed;left:50%;top:16%;transform:translateX(-50%);z-index:300;padding:9px 14px;border:1px solid var(--accent);border-radius:999px;background:rgba(0,0,0,.82);color:var(--accent);font:700 10px var(--font-main);letter-spacing:.1em;box-shadow:0 0 24px color-mix(in srgb,var(--accent) 35%,transparent);animation:p3Toast 1900ms ease forwards;pointer-events:none}
      @keyframes p3Toast{0%{opacity:0;transform:translate(-50%,8px) scale(.92)}10%,78%{opacity:1;transform:translate(-50%,0) scale(1)}100%{opacity:0;transform:translate(-50%,-22px) scale(1.02)}}
      .phase3-stats{position:fixed;inset:0;z-index:305;display:flex;align-items:center;justify-content:center;padding:15px;background:rgba(0,0,0,.9)}
      .phase3-stats-card{width:min(100%,420px);padding:22px;border-radius:23px}
      .phase3-stats-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:15px}
      .phase3-stats-head h2{margin:0;color:var(--accent);font-size:24px}
      #phase3-stats-close{width:34px;height:34px;border-radius:50%;border:1px solid color-mix(in srgb,var(--accent) 35%,transparent);background:transparent;color:var(--text-main);font:inherit;font-size:18px;cursor:pointer}
      .phase3-stats-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      .phase3-stat{padding:12px;border-radius:15px;border:1px solid color-mix(in srgb,var(--accent) 13%,transparent);background:rgba(0,0,0,.22)}
      .phase3-stat span{display:block;color:var(--text-muted);font-size:8px;letter-spacing:.1em;text-transform:uppercase}
      .phase3-stat strong{display:block;margin-top:4px;color:var(--text-main);font-size:21px}
      .phase3-note{margin:12px 0 0;color:var(--text-muted);font-size:9px;line-height:1.5;text-align:center}

      /* --- PC MENU: neon arcade desktop experience --- */
      @media (min-width: 901px) {
        body.phase3-menu-open {
          overflow: hidden;
        }

        .phase3-menu {
          padding: 0;
          background:
            radial-gradient(circle at 50% 38%, rgba(57,255,20,.16), transparent 34%),
            radial-gradient(circle at 50% 100%, rgba(57,255,20,.12), transparent 42%),
            #020302;
        }

        .phase3-menu::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: .42;
          background:
            linear-gradient(rgba(57,255,20,.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(57,255,20,.055) 1px, transparent 1px);
          background-size: 46px 46px;
          mask-image: linear-gradient(to bottom, transparent 0%, black 45%, black 100%);
        }

        .phase3-menu::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 24vh;
          pointer-events: none;
          background:
            linear-gradient(to bottom, transparent, rgba(57,255,20,.08)),
            repeating-linear-gradient(90deg, rgba(57,255,20,.16) 0 1px, transparent 1px 80px),
            repeating-linear-gradient(0deg, rgba(57,255,20,.16) 0 1px, transparent 1px 42px);
          transform: perspective(260px) rotateX(56deg);
          transform-origin: bottom;
          opacity: .55;
        }

        .phase3-menu-card {
          position: relative;
          width: 100vw;
          height: 100dvh;
          max-height: none;
          overflow: hidden;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
        }

        .phase3-brand {
          position: absolute;
          z-index: 10;
          top: 28px;
          left: 34px;
          margin: 0;
          text-align: left;
        }

        .phase3-brand::after {
          content: 'PLUG > DROP > BLAST';
          display: block;
          margin-top: 8px;
          color: var(--accent);
          font-size: 12px;
          letter-spacing: .16em;
          text-shadow: 0 0 8px var(--accent);
        }

        .phase3-logo {
          position: fixed;
          z-index: 3;
          left: 50%;
          top: 7vh;
          width: 180px;
          height: 250px;
          margin: 0;
          object-fit: contain;
          transform: translateX(-50%);
          filter: drop-shadow(0 0 12px var(--accent)) drop-shadow(0 0 32px color-mix(in srgb, var(--accent) 42%, transparent));
          mix-blend-mode: screen;
        }

        .phase3-title {
          font-size: 44px;
          line-height: .86;
          letter-spacing: -.07em;
          text-shadow: 0 0 8px var(--accent), 0 0 24px color-mix(in srgb, var(--accent) 45%, transparent);
        }

        .phase3-subtitle {
          margin-top: 10px;
          font-size: 10px;
          letter-spacing: .2em;
        }

        .phase3-profile {
          position: absolute;
          z-index: 8;
          left: 30px;
          bottom: 24px;
          width: 280px;
          margin: 0;
          padding: 14px;
          border-radius: 18px;
          background: rgba(0,0,0,.58);
          backdrop-filter: blur(12px);
        }

        .phase3-pc-nav {
          position: absolute;
          z-index: 9;
          top: 39%;
          left: 50%;
          width: min(470px, 42vw);
          transform: translateX(-50%);
          display: grid;
          gap: 9px;
        }

        .phase3-pc-nav button {
          min-height: 54px;
          border: 1px solid var(--accent);
          border-radius: 15px;
          padding: 0 22px;
          background: rgba(0,0,0,.58);
          color: var(--text-main);
          font: inherit;
          font-size: 16px;
          font-weight: 700;
          letter-spacing: .12em;
          text-align: left;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(57,255,20,.08), inset 0 0 18px rgba(57,255,20,.025);
          transition: transform 150ms ease, background 150ms ease, color 150ms ease, box-shadow 150ms ease;
        }

        .phase3-pc-nav button::before {
          content: '›';
          display: inline-block;
          width: 28px;
          color: var(--accent);
          font-size: 25px;
          line-height: 0;
          transform: translateY(2px);
        }

        .phase3-pc-nav button:hover,
        .phase3-pc-nav button:focus-visible {
          transform: translateY(-2px);
          background: rgba(57,255,20,.11);
          box-shadow: 0 0 20px rgba(57,255,20,.2), inset 0 0 20px rgba(57,255,20,.06);
          outline: none;
        }

        .phase3-pc-nav button[data-pc-action="play"] {
          min-height: 68px;
          background: var(--accent);
          color: #020302;
          box-shadow: 0 0 26px rgba(57,255,20,.35);
        }

        .phase3-pc-nav button[data-pc-action="play"]::before {
          content: '▶';
          color: #020302;
          font-size: 18px;
        }

        .phase3-pc-nav button[data-pc-action="daily"]::before {
          content: '◆';
          font-size: 14px;
        }

        .phase3-modes {
          display: none;
        }

        .phase3-menu.pc-modes-open .phase3-modes {
          position: absolute;
          z-index: 20;
          left: 50%;
          top: 39%;
          width: min(470px, 42vw);
          transform: translateX(-50%);
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 9px;
          padding: 0;
        }

        .phase3-menu.pc-modes-open .phase3-pc-nav {
          display: none;
        }

        .phase3-menu.pc-modes-open .phase3-mode {
          min-height: 72px;
          border-radius: 15px;
          background: rgba(0,0,0,.8);
        }

        .phase3-menu.pc-modes-open .phase3-mode strong {
          font-size: 15px;
        }

        .phase3-columns {
          display: none;
        }

        .phase3-menu.pc-sections-open .phase3-columns {
          position: absolute;
          z-index: 21;
          left: 50%;
          bottom: 24px;
          width: min(720px, 55vw);
          transform: translateX(-50%);
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin: 0;
        }

        .phase3-menu.pc-sections-open .phase3-profile {
          filter: brightness(.55);
        }

        .phase3-leaderboard-panel {
          position: absolute !important;
          z-index: 8;
          right: 30px;
          bottom: 24px;
          width: 320px;
          margin: 0 !important;
          padding: 14px;
          border-radius: 18px;
          background: rgba(0,0,0,.58);
          backdrop-filter: blur(12px);
        }

        .phase3-menu.pc-sections-open .phase3-leaderboard-panel {
          opacity: .35;
        }

        .phase3-actions {
          position: absolute;
          z-index: 12;
          top: 28px;
          right: 30px;
          display: flex;
          gap: 10px;
          margin: 0;
        }

        .phase3-action {
          flex: 0 0 auto;
          width: 52px;
          height: 44px;
          padding: 0;
          border-radius: 13px;
          font-size: 8px;
          letter-spacing: .06em;
        }

        .phase3-offline {
          position: absolute;
          z-index: 12;
          left: 50%;
          bottom: 8px;
          transform: translateX(-50%);
          margin: 0;
        }

        .phase3-menu.pc-sections-open .phase3-pc-nav button[data-pc-action="skins"],
        .phase3-menu.pc-sections-open .phase3-pc-nav button[data-pc-action="missions"] {
          border-color: var(--accent);
        }
      }


      /* --- UNIFIED MENU V2: same neon arcade experience on PC + mobile --- */
      #phase3-menu {
        isolation: isolate;
        padding: 0;
        overflow: hidden;
        background:
          radial-gradient(circle at 50% 40%, rgba(57,255,20,.15), transparent 32%),
          radial-gradient(circle at 50% 100%, rgba(57,255,20,.1), transparent 44%),
          #010201;
      }

      #phase3-menu::before {
        content: '';
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        background:
          linear-gradient(90deg, rgba(57,255,20,.02) 1px, transparent 1px),
          linear-gradient(0deg, rgba(57,255,20,.018) 1px, transparent 1px);
        background-size: 52px 52px;
        animation: p3AmbientGrid 9s linear infinite;
        opacity: .6;
      }

      #phase3-menu::after {
        content: '';
        position: absolute;
        inset: 0;
        z-index: 1;
        pointer-events: none;
        background: linear-gradient(180deg, rgba(0,0,0,0) 0 62%, rgba(57,255,20,.04) 84%, rgba(57,255,20,.1) 100%);
      }

      .phase3-menu-card {
        position: relative;
        width: 100vw;
        height: 100dvh;
        max-height: none;
        overflow: hidden;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
      }

      .p3-scene {
        position: absolute;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        overflow: hidden;
      }

      .p3-scene::before {
        content: '';
        position: absolute;
        inset: -18%;
        background:
          radial-gradient(circle at 50% 48%, rgba(57,255,20,.13), transparent 19%),
          radial-gradient(circle at 50% 84%, rgba(57,255,20,.08), transparent 30%);
        filter: blur(10px);
        animation: p3GlowBreath 4.6s ease-in-out infinite alternate;
      }

      .p3-light-columns {
        position: absolute;
        inset: 0;
        transform: translateZ(0);
      }

      .p3-light-columns i {
        position: absolute;
        left: var(--x);
        bottom: 18%;
        width: var(--w);
        height: var(--h);
        opacity: .48;
        background: linear-gradient(180deg, transparent, rgba(57,255,20,.12) 28%, rgba(57,255,20,.82) 84%, rgba(57,255,20,.06));
        box-shadow: 0 0 22px rgba(57,255,20,.14), 0 0 48px rgba(57,255,20,.1);
        animation: p3ColumnPulse 4.8s ease-in-out var(--d) infinite;
      }

      .p3-light-columns i::after {
        content: '';
        position: absolute;
        left: 50%;
        bottom: -7px;
        width: 160%;
        height: 18px;
        transform: translateX(-50%);
        border-radius: 50%;
        background: rgba(57,255,20,.65);
        filter: blur(7px);
      }

      .p3-floor {
        position: absolute;
        left: -12%;
        right: -12%;
        bottom: -12%;
        height: 38%;
        background:
          linear-gradient(to bottom, rgba(57,255,20,.14), transparent 18%),
          repeating-linear-gradient(90deg, rgba(57,255,20,.18) 0 1px, transparent 1px 62px),
          repeating-linear-gradient(0deg, rgba(57,255,20,.18) 0 1px, transparent 1px 42px);
        transform-origin: bottom;
        transform: perspective(430px) rotateX(62deg) translateY(12px);
        opacity: .58;
        animation: p3FloorDrift 6.5s linear infinite;
      }

      .p3-horizon {
        position: absolute;
        left: -10%;
        right: -10%;
        bottom: 24%;
        height: 2px;
        background: linear-gradient(90deg, transparent, rgba(57,255,20,.4) 12%, #39ff14 50%, rgba(57,255,20,.4) 88%, transparent);
        box-shadow: 0 0 16px rgba(57,255,20,.5), 0 -8px 28px rgba(57,255,20,.08);
        animation: p3HorizonPulse 2.8s ease-in-out infinite alternate;
      }

      .p3-particles {
        position: absolute;
        inset: 0;
      }

      .p3-particles i {
        position: absolute;
        left: var(--x);
        top: var(--y);
        width: var(--s);
        height: var(--s);
        background: #39ff14;
        box-shadow: 0 0 10px rgba(57,255,20,.72);
        opacity: .42;
        animation: p3ParticleFloat var(--dur) ease-in-out var(--delay) infinite;
      }

      .phase3-brand {
        position: absolute;
        z-index: 10;
        top: 26px;
        left: 34px;
        margin: 0;
        text-align: left;
      }

      .phase3-brand::after {
        content: 'PLUG > DROP > BLAST';
        display: block;
        margin-top: 8px;
        color: var(--accent);
        font-size: 11px;
        letter-spacing: .16em;
        text-shadow: 0 0 9px var(--accent);
      }

      .phase3-title {
        font-size: 44px;
        line-height: .86;
        letter-spacing: -.07em;
        text-shadow: 0 0 8px var(--accent), 0 0 24px color-mix(in srgb, var(--accent) 45%, transparent);
      }

      .phase3-subtitle {
        margin-top: 10px;
        font-size: 9px;
        letter-spacing: .2em;
      }

      .phase3-logo {
        position: fixed;
        z-index: 4;
        left: 50%;
        top: 7vh;
        width: 175px;
        height: 255px;
        object-fit: contain;
        transform: translateX(-50%);
        filter: drop-shadow(0 0 10px var(--accent)) drop-shadow(0 0 28px rgba(57,255,20,.34));
        animation: p3LogoFloat 3.2s ease-in-out infinite;
      }

      .phase3-pc-nav {
        position: absolute;
        z-index: 12;
        left: 50%;
        top: 38%;
        width: min(470px, 42vw);
        transform: translateX(-50%);
        display: grid;
        gap: 9px;
      }

      .phase3-pc-nav button {
        min-height: 54px;
        display: grid;
        grid-template-columns: 42px 1fr;
        align-items: center;
        gap: 2px;
        padding: 0 20px;
        border: 1px solid var(--accent);
        border-radius: 14px;
        background: rgba(0,0,0,.56);
        color: var(--text-main);
        font: inherit;
        font-size: 15px;
        font-weight: 700;
        letter-spacing: .1em;
        text-align: left;
        text-transform: uppercase;
        cursor: pointer;
        box-shadow: inset 0 0 18px rgba(57,255,20,.03), 0 0 10px rgba(57,255,20,.06);
        transition: transform 150ms ease, background 150ms ease, color 150ms ease, box-shadow 150ms ease;
        backdrop-filter: blur(6px);
      }

      .phase3-pc-nav button:hover,
      .phase3-pc-nav button:focus-visible {
        transform: translateY(-2px);
        background: rgba(57,255,20,.1);
        color: #fff;
        box-shadow: 0 0 22px rgba(57,255,20,.2), inset 0 0 20px rgba(57,255,20,.06);
        outline: none;
      }

      .phase3-pc-nav button[data-pc-action="play"] {
        min-height: 70px;
        background: var(--accent);
        color: #010201;
        box-shadow: 0 0 28px rgba(57,255,20,.34);
        animation: p3PlayPulse 2.5s ease-in-out infinite;
      }

      .phase3-pc-nav button[data-pc-action="play"] .p3-nav-icon {
        color: #010201;
      }

      .p3-nav-icon {
        display: inline-grid;
        place-items: center;
        width: 28px;
        color: var(--accent);
        font-size: 22px;
        text-shadow: 0 0 8px currentColor;
      }

      .phase3-modes,
      .phase3-columns {
        display: none;
      }

      .phase3-menu.pc-modes-open .phase3-pc-nav,
      .phase3-menu.pc-sections-open .phase3-pc-nav {
        opacity: .18;
        filter: blur(1px);
        pointer-events: none;
      }

      .phase3-menu.pc-modes-open .phase3-modes {
        position: absolute;
        z-index: 20;
        left: 50%;
        top: 36%;
        width: min(470px, calc(100vw - 30px));
        transform: translateX(-50%);
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 9px;
        padding: 0;
      }

      .phase3-menu.pc-modes-open .phase3-mode {
        min-height: 76px;
        padding: 12px;
        border: 1px solid var(--accent);
        border-radius: 14px;
        background: rgba(0,0,0,.84);
        box-shadow: 0 0 14px rgba(57,255,20,.08);
      }

      .phase3-menu.pc-modes-open .phase3-mode strong {
        font-size: 14px;
        color: var(--accent);
      }

      .phase3-menu.pc-modes-open .phase3-mode span {
        margin-top: 4px;
        font-size: 8px;
      }

      .phase3-menu.pc-sections-open .phase3-columns {
        position: absolute;
        z-index: 21;
        left: 50%;
        top: 28%;
        width: min(720px, calc(100vw - 30px));
        max-height: 58vh;
        overflow: auto;
        transform: translateX(-50%);
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        padding: 0;
        margin: 0;
      }

      .phase3-menu.pc-sections-open .phase3-columns .phase3-panel {
        min-width: 0;
        background: rgba(0,0,0,.78);
      }

      .phase3-profile {
        position: absolute;
        z-index: 11;
        left: 30px;
        bottom: 24px;
        width: 280px;
        margin: 0;
        padding: 14px;
        border-radius: 18px;
        background: rgba(0,0,0,.58);
        backdrop-filter: blur(12px);
      }

      .phase3-leaderboard-panel {
        position: absolute !important;
        z-index: 11;
        right: 30px;
        bottom: 24px;
        width: 320px;
        margin: 0 !important;
        padding: 14px;
        border-radius: 18px;
        background: rgba(0,0,0,.58);
        backdrop-filter: blur(12px);
      }

      .phase3-actions {
        position: absolute;
        z-index: 14;
        top: 28px;
        right: 30px;
        display: flex;
        gap: 9px;
        margin: 0;
      }

      .phase3-action {
        flex: 0 0 auto;
        width: 52px;
        height: 44px;
        padding: 0;
        border-radius: 13px;
        font-size: 0;
        letter-spacing: 0;
      }

      #phase3-stats-button::before { content: '▥'; }
      #phase3-menu-sound::before { content: '◖'; }
      #phase3-close-menu::before { content: '×'; }

      .phase3-action::before {
        color: var(--accent);
        font-size: 21px;
        line-height: 1;
        text-shadow: 0 0 8px var(--accent);
      }

      .phase3-offline {
        position: absolute;
        z-index: 12;
        left: 50%;
        bottom: 8px;
        transform: translateX(-50%);
        margin: 0;
      }

      @keyframes p3AmbientGrid {
        0% { background-position: 0 0, 0 0; }
        100% { background-position: 0 52px, 52px 0; }
      }

      @keyframes p3GlowBreath {
        from { transform: scale(.96); opacity: .56; }
        to { transform: scale(1.08); opacity: 1; }
      }

      @keyframes p3ColumnPulse {
        0%, 100% { opacity: .2; transform: translateY(7%); filter: blur(.3px); }
        50% { opacity: .62; transform: translateY(-4%); filter: blur(0); }
      }

      @keyframes p3FloorDrift {
        from { transform: perspective(430px) rotateX(62deg) translateY(18px); }
        to { transform: perspective(430px) rotateX(62deg) translateY(-4px); }
      }

      @keyframes p3HorizonPulse {
        from { opacity: .42; transform: scaleX(.94); }
        to { opacity: .9; transform: scaleX(1.02); }
      }

      @keyframes p3ParticleFloat {
        0%,100% { opacity: .22; transform: translate3d(0,0,0) scale(1); }
        50% { opacity: .9; transform: translate3d(0,-13px,0) scale(1.18); }
      }

      @keyframes p3LogoFloat {
        0%,100% { transform: translateX(-50%) translateY(0) scale(1); }
        50% { transform: translateX(-50%) translateY(-9px) scale(1.035); }
      }

      @keyframes p3PlayPulse {
        0%,100% { box-shadow: 0 0 20px rgba(57,255,20,.24); }
        50% { box-shadow: 0 0 36px rgba(57,255,20,.48), 0 0 60px rgba(57,255,20,.16); }
      }

      @media (max-width: 900px) {
        .phase3-brand {
          top: 17px;
          left: 18px;
        }

        .phase3-title {
          font-size: clamp(27px, 8vw, 35px);
        }

        .phase3-subtitle {
          font-size: 7px;
          letter-spacing: .13em;
        }

        .phase3-brand::after {
          margin-top: 6px;
          font-size: 8px;
          letter-spacing: .12em;
        }

        .phase3-logo {
          top: 11%;
          width: min(94px, 24vw);
          height: 142px;
        }

        .phase3-pc-nav {
          top: 34%;
          width: calc(100vw - 30px);
          max-width: 470px;
          gap: 7px;
        }

        .phase3-pc-nav button {
          min-height: 47px;
          grid-template-columns: 32px 1fr;
          padding: 0 14px;
          border-radius: 12px;
          font-size: clamp(10px, 3.2vw, 14px);
          letter-spacing: .07em;
        }

        .phase3-pc-nav button[data-pc-action="play"] {
          min-height: 58px;
        }

        .p3-nav-icon {
          font-size: 18px;
        }

        .phase3-profile {
          left: 14px;
          bottom: 14px;
          width: min(185px, calc(50vw - 20px));
          padding: 10px;
          border-radius: 14px;
        }

        .phase3-level {
          font-size: 10px;
        }

        .phase3-xp {
          font-size: 8px;
        }

        .phase3-leaderboard-panel {
          right: 14px;
          bottom: 14px;
          width: min(160px, calc(46vw - 16px));
          padding: 10px;
          border-radius: 14px;
        }

        .phase3-leaderboard-panel .phase3-section-title {
          margin-top: 4px;
          font-size: 7px;
        }

        .phase3-leaderboard-panel .p3-leader-row {
          grid-template-columns: 18px 1fr auto;
          gap: 4px;
          font-size: 7px;
        }

        .phase3-leaderboard-panel .p3-leader-row small {
          display: none;
        }

        .phase3-leaderboard-panel .p3-leader-row strong {
          font-size: 8px;
        }

        .phase3-nickname {
          display: none;
        }

        .phase3-actions {
          top: 14px;
          right: 14px;
          gap: 6px;
        }

        .phase3-action {
          width: 39px;
          height: 34px;
          border-radius: 10px;
        }

        .phase3-action::before {
          font-size: 17px;
        }

        .phase3-offline {
          bottom: 4px;
          font-size: 6px;
          white-space: nowrap;
        }

        .phase3-menu.pc-modes-open .phase3-modes {
          top: 33%;
          width: calc(100vw - 30px);
          gap: 7px;
        }

        .phase3-menu.pc-modes-open .phase3-mode {
          min-height: 70px;
        }

        .phase3-menu.pc-sections-open .phase3-columns {
          top: 27%;
          width: calc(100vw - 24px);
          max-height: 56vh;
          gap: 8px;
          grid-template-columns: 1fr;
        }

        .phase3-menu.pc-sections-open .phase3-columns .phase3-panel {
          padding: 11px;
        }

        .p3-floor {
          height: 31%;
          bottom: -9%;
        }

        .p3-horizon {
          bottom: 21%;
        }
      }

      @media (max-width: 430px) {
        .phase3-logo {
          top: 10.5%;
          width: 78px;
          height: 125px;
        }

        .phase3-pc-nav {
          top: 32%;
          width: calc(100vw - 24px);
        }

        .phase3-pc-nav button {
          min-height: 44px;
          grid-template-columns: 28px 1fr;
          padding: 0 11px;
          font-size: 10px;
        }

        .phase3-pc-nav button[data-pc-action="play"] {
          min-height: 54px;
        }

        .phase3-profile {
          width: 145px;
          left: 10px;
          bottom: 10px;
        }

        .phase3-leaderboard-panel {
          width: 134px;
          right: 10px;
          bottom: 10px;
        }

        .phase3-actions {
          top: 10px;
          right: 10px;
        }

        .phase3-action {
          width: 34px;
          height: 30px;
        }

        .phase3-action::before {
          font-size: 15px;
        }

        .p3-floor {
          height: 28%;
        }
      }

      @media (max-height: 620px) and (orientation: landscape) {
        .phase3-logo {
          top: 4%;
          width: 72px;
          height: 105px;
        }

        .phase3-pc-nav {
          top: 25%;
          width: min(520px, 54vw);
          grid-template-columns: 1fr 1fr;
        }

        .phase3-pc-nav button,
        .phase3-pc-nav button[data-pc-action="play"] {
          min-height: 43px;
        }

        .phase3-profile,
        .phase3-leaderboard-panel {
          bottom: 9px;
        }

        .phase3-columns {
          max-height: 62vh;
        }

        .p3-floor {
          height: 38%;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        #phase3-menu::before,
        .p3-scene::before,
        .p3-light-columns i,
        .p3-floor,
        .p3-horizon,
        .p3-particles i,
        .phase3-logo,
        .phase3-pc-nav button[data-pc-action="play"] {
          animation: none !important;
        }
      }

      @media(max-width:620px){.phase3-columns{grid-template-columns:1fr}}
      @media(max-width:420px){.phase3-menu-card{padding:15px}.phase3-title{font-size:29px}}
      @media(max-height:620px) and (orientation:landscape){.phase3-menu{align-items:flex-start}.phase3-menu-card{margin:6px 0}.phase3-brand{margin-bottom:9px}.phase3-logo{width:42px;height:42px}.phase3-title{font-size:25px}.phase3-columns{grid-template-columns:1fr 1fr}.phase3-panel{padding:10px}}
    `;
    document.head.appendChild(style);

    const menu = document.createElement('div');
    menu.id = 'phase3-menu';
    menu.className = 'phase3-menu';
    menu.innerHTML = `
      <div class="phase3-menu-card glass-panel border-neon">
        <div class="p3-scene" aria-hidden="true">
          <div class="p3-light-columns">
            <i style="--x:7%;--w:2px;--h:42%;--d:-1.8s"></i>
            <i style="--x:14%;--w:4px;--h:58%;--d:-3.1s"></i>
            <i style="--x:23%;--w:2px;--h:36%;--d:-.8s"></i>
            <i style="--x:31%;--w:7px;--h:65%;--d:-2.4s"></i>
            <i style="--x:40%;--w:2px;--h:48%;--d:-4s"></i>
            <i style="--x:49%;--w:8px;--h:72%;--d:-1.2s"></i>
            <i style="--x:59%;--w:3px;--h:54%;--d:-2.8s"></i>
            <i style="--x:68%;--w:6px;--h:63%;--d:-3.6s"></i>
            <i style="--x:77%;--w:2px;--h:43%;--d:-1.1s"></i>
            <i style="--x:86%;--w:5px;--h:57%;--d:-2.1s"></i>
            <i style="--x:94%;--w:2px;--h:39%;--d:-3.3s"></i>
          </div>
          <div class="p3-floor"></div>
          <div class="p3-horizon"></div>
          <div class="p3-particles">
            <i style="--x:5%;--y:22%;--s:5px;--dur:5.7s;--delay:-2.2s"></i>
            <i style="--x:12%;--y:64%;--s:8px;--dur:7.1s;--delay:-4.8s"></i>
            <i style="--x:19%;--y:36%;--s:4px;--dur:4.9s;--delay:-1.1s"></i>
            <i style="--x:27%;--y:76%;--s:7px;--dur:6.2s;--delay:-3.5s"></i>
            <i style="--x:33%;--y:18%;--s:5px;--dur:5.3s;--delay:-.5s"></i>
            <i style="--x:41%;--y:54%;--s:4px;--dur:7.8s;--delay:-5.4s"></i>
            <i style="--x:47%;--y:28%;--s:8px;--dur:6.5s;--delay:-2.7s"></i>
            <i style="--x:55%;--y:69%;--s:5px;--dur:5.8s;--delay:-4s"></i>
            <i style="--x:62%;--y:43%;--s:4px;--dur:7.4s;--delay:-1.9s"></i>
            <i style="--x:70%;--y:24%;--s:7px;--dur:5.1s;--delay:-3.1s"></i>
            <i style="--x:76%;--y:61%;--s:5px;--dur:6.9s;--delay:-.9s"></i>
            <i style="--x:83%;--y:34%;--s:4px;--dur:5.6s;--delay:-4.2s"></i>
            <i style="--x:91%;--y:70%;--s:8px;--dur:7.5s;--delay:-2.5s"></i>
            <i style="--x:96%;--y:17%;--s:5px;--dur:6.1s;--delay:-3.7s"></i>
          </div>
        </div>
        <div class="phase3-brand">
          <img src="./logo-official.svg" alt="Logo oficial Blohsh Blast" class="phase3-logo">
          <h1 class="phase3-title">BLOHSH<br>BLAST</h1>
          <p class="phase3-subtitle">PUZZLE ARCADE // PC EDITION</p>
        </div>

        <nav class="phase3-pc-nav" aria-label="Menu principal">
          <button type="button" data-pc-action="play"><span class="p3-nav-icon" aria-hidden="true">▶</span><span>PLAY</span></button>
          <button type="button" data-pc-action="modes"><span class="p3-nav-icon" aria-hidden="true">▦</span><span>MODOS DE JOGO</span></button>
          <button type="button" data-pc-action="skins"><span class="p3-nav-icon" aria-hidden="true">◆</span><span>SKINS</span></button>
          <button type="button" data-pc-action="missions"><span class="p3-nav-icon" aria-hidden="true">▣</span><span>MISSÕES</span></button>
          <button type="button" data-pc-action="daily"><span class="p3-nav-icon" aria-hidden="true">▦</span><span>DAILY CHALLENGE</span></button>
          <button type="button" data-pc-action="stats"><span class="p3-nav-icon" aria-hidden="true">▥</span><span>ESTATÍSTICAS</span></button>
        </nav>

        <div class="phase3-profile">
          <div class="phase3-profile-row">
            <div><div id="phase3-level" class="phase3-level">NÍVEL 1</div><div id="phase3-xp" class="phase3-xp">0 XP</div></div>
            <button id="phase3-skins-link" class="menu-back" type="button">SKINS</button>
          </div>
          <div class="phase3-progress"><i id="phase3-xp-fill"></i></div>
        </div>

        <div class="phase3-section-title">Escolha seu modo</div>
        <div class="phase3-modes">
          <button class="phase3-mode" data-mode="classic" type="button"><strong>CLASSIC</strong><span>Modo padrão com Smart RNG e progressão.</span><small>NORMAL</small></button>
          <button class="phase3-mode" data-mode="zen" type="button"><strong>ZEN</strong><span>Peças menores para uma experiência relaxada.</span><small>RELAX</small></button>
          <button class="phase3-mode" data-mode="hardcore" type="button"><strong>HARDCORE</strong><span>RNG puro, sem auxílio de distribuição.</span><small>1.5X SCORE</small></button>
          <button class="phase3-mode daily" data-mode="daily" type="button"><strong>DAILY</strong><span id="phase3-daily-label">Desafio de hoje</span><small id="phase3-daily-best">BEST: 0</small></button>
        </div>

        <div class="phase3-columns">
          <div class="phase3-panel">
            <div class="phase3-section-title">Missões de hoje</div>
            <div id="phase3-missions"></div>
          </div>
          <div class="phase3-panel">
            <div class="phase3-section-title">Skins desbloqueáveis</div>
            <div id="phase3-skins" class="phase3-skins"></div>
          </div>
        </div>

        <div class="phase3-panel phase3-leaderboard-panel" style="margin-top:12px">
          <div class="phase3-section-title">Leaderboard local</div>
          <div id="phase3-leaderboard" class="phase3-leaderboard"></div>
          <div class="phase3-nickname">
            <input id="phase3-nickname" maxlength="16" autocomplete="nickname" placeholder="SEU NICK" aria-label="Seu nickname">
          </div>
        </div>

        <div class="phase3-actions">
          <button id="phase3-stats-button" class="phase3-action" type="button" aria-label="Estatísticas">Estatísticas</button>
          <button id="phase3-menu-sound" class="phase3-action" type="button" aria-label="Som">SFX ON</button>
          <button id="phase3-close-menu" class="phase3-action" type="button" aria-label="Fechar menu">Fechar</button>
        </div>
        <p id="phase3-offline" class="phase3-offline">Verificando modo offline...</p>
      </div>
    `;
    document.body.insertAdjacentElement('afterbegin', menu);

    const statsModal = document.createElement('div');
    statsModal.id = 'phase3-stats-modal';
    statsModal.className = 'phase3-stats modal-hidden';
    statsModal.innerHTML = `
      <div class="phase3-stats-card glass-panel border-neon">
        <div class="phase3-stats-head">
          <h2>Estatísticas</h2>
          <button id="phase3-stats-close" type="button" aria-label="Fechar estatísticas">×</button>
        </div>
        <div class="phase3-stats-grid">
          <div class="phase3-stat"><span>Partidas</span><strong id="phase3-stat-games">0</strong></div>
          <div class="phase3-stat"><span>Melhor score</span><strong id="phase3-stat-best">0</strong></div>
          <div class="phase3-stat"><span>Peças</span><strong id="phase3-stat-pieces">0</strong></div>
          <div class="phase3-stat"><span>Linhas</span><strong id="phase3-stat-lines">0</strong></div>
          <div class="phase3-stat"><span>Perfect Clears</span><strong id="phase3-stat-perfect">0</strong></div>
          <div class="phase3-stat"><span>Maior combo</span><strong id="phase3-stat-combo">0x</strong></div>
          <div class="phase3-stat"><span>XP total</span><strong id="phase3-stat-xp">0</strong></div>
          <div class="phase3-stat"><span>Daily best</span><strong id="phase3-stat-daily">0</strong></div>
        </div>
        <p class="phase3-note">Progressão, missões e leaderboard são armazenados localmente neste dispositivo.</p>
      </div>
    `;
    document.body.insertAdjacentElement('afterbegin', statsModal);
  }

  function patchExistingUI() {
    const logo = document.querySelector('header img.brand-logo');
    if (logo) logo.src = './logo-official.svg';

    const head = document.head;
    if (!head.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement('link');
      manifest.rel = 'manifest';
      manifest.href = './manifest.webmanifest';
      head.appendChild(manifest);
    }

    if (!head.querySelector('meta[name="theme-color"]')) {
      const theme = document.createElement('meta');
      theme.name = 'theme-color';
      theme.content = '#39ff14';
      head.appendChild(theme);
    }

    if (typeof nickname !== 'undefined') {
      P3.nickname = localStorage.getItem(P3.NICKNAME_KEY) || 'PLAYER';
    }
  }

  function patchEngine() {
    P3.base.generateRack = generateRack;
    P3.base.getRandomShape = getRandomShape;
    P3.base.addScore = addScore;
    P3.base.placePiece = placePiece;
    P3.base.checkLines = checkLines;
    P3.base.checkGameOver = checkGameOver;
    P3.base.resetGame = resetGame;

    // Base game functions call this symbol during combo/Perfect Clear.
    if (typeof missionEvent === 'function') {
      missionEvent = function(type, amount = 1) {
        if (type === 'score') return;
        if (type === 'pieces') return;
        if (type === 'lines') return;
        if (type === 'combo') return P3.missionProxy(type, amount);
        if (type === 'perfect') return P3.missionProxy(type, amount);
        return P3.missionProxy(type, amount);
      };
    }

    generateRack = function() {
      if (!rackPieces.every(piece => piece === null)) return;

      const useSmart = P3.MODE.S.smartRng;
      rackPieces = useSmart
        ? smartRackLocal()
        : [getRandomShapeLocal(), getRandomShapeLocal(), getRandomShapeLocal()];

      renderRack();
      checkGameOver();
    };

    getRandomShape = getRandomShapeLocal;

    addScore = function(points, popupText = null, popupClass = '') {
      if (!Number.isFinite(points) || points <= 0) return;
      const awarded = Math.round(points * P3.MODE.S.scoreMultiplier);
      P3.base.addScore(awarded, popupText, popupClass);
      P3.missionProxy('score', awarded);
      addXP(Math.max(1, Math.round((awarded / 12) * P3.MODE.S.xpMultiplier)));
    };

    placePiece = function(matrix, anchorX, anchorY) {
      P3.base.placePiece(matrix, anchorX, anchorY);
      P3.missionProxy('pieces', 1);
    };

    checkLines = function() {
      const result = P3.base.checkLines();
      if (result > 0) {
        P3.missionProxy('lines', result);
        P3.missionProxy('combo', combo);
        if (board.every(row => row.every(cell => cell === 0))) {
          P3.missionProxy('perfect', 1);
        }
      }
      return result;
    };

    checkGameOver = function() {
      P3.base.checkGameOver();
      const modal = $('game-over-modal');
      const visible = modal && !modal.classList.contains('modal-hidden');

      if (visible && !P3.gameEnded) {
        P3.gameEnded = true;
        recordScore(score);
      }
    };

    resetGame = function() {
      startGame(P3.mode);
    };

    updateSkin = applyPhase3Skin;
  }

  P3.missionProxy = function(type, amount) {
    missionEventLocal(type, amount);
  };

  function missionEventLocal(type, amount = 1) {
    if (!P3.missions) return;

    if (type === 'combo') {
      P3.missions.progress.combo = Math.max(P3.missions.progress.combo || 0, Number(amount) || 0);
    } else {
      P3.missions.progress[type] = (P3.missions.progress[type] || 0) + (Number(amount) || 0);
    }

    P3.missions.missions.forEach(mission => {
      if (P3.missions.claimed.includes(mission.id)) return;

      const current = Number(P3.missions.progress[mission.type] || 0);
      if (current >= mission.target) {
        P3.missions.claimed.push(mission.id);
        addXP(mission.reward);
        showMiniToast(`MISSION COMPLETE // +${mission.reward} XP`);
      }
    });

    writeJSON(P3.MISSIONS_KEY, P3.missions);
    renderMissions();
  }

  // Alias used by public helper above.
  const missionEventLocalRef = missionEventLocal;

  function initPhase3() {
    injectUI();

    P3.progression = loadProgression();
    syncSkins(true);
    P3.missions = loadMissions();
    P3.daily = loadDaily();
    P3.leaderboard = loadLeaderboard();
    P3.nickname = localStorage.getItem(P3.NICKNAME_KEY) || 'PLAYER';

    P3.mode = 'classic';
    P3.MODE = { S: P3.MODES.classic };

    // The legacy phase-2 init started one anonymous game automatically. Remove that synthetic count.
    if (typeof stats !== 'undefined' && stats.gamesPlayed > 0) {
      stats.gamesPlayed -= 1;
      if (typeof saveStats === 'function') saveStats();
    }

    patchExistingUI();
    patchEngine();
    setupMenuEvents();

    document.body.classList.add('phase3-menu-open');
    applyPhase3Skin();
    renderMenu();
    registerServiceWorker();

    // Keep the existing header accessible once a mode starts.
    const originalGameMenu = $('phase3-menu-game');
    if (originalGameMenu) originalGameMenu.addEventListener('click', showMenu);

    const legacyGameOverButton = $('game-over-modal')?.querySelector('button');
    if (legacyGameOverButton) {
      legacyGameOverButton.removeAttribute('onclick');
      legacyGameOverButton.id = 'phase3-restart';
      legacyGameOverButton.innerText = 'Jogar Novamente';
      legacyGameOverButton.className = 'primary-button restart-button';
      legacyGameOverButton.addEventListener('click', () => startGame(P3.mode));

      const menuBtn = document.createElement('button');
      menuBtn.type = 'button';
      menuBtn.id = 'phase3-gameover-menu';
      menuBtn.className = 'menu-action';
      menuBtn.innerText = 'Menu Principal';
      menuBtn.addEventListener('click', showMenu);

      const actionWrap = document.createElement('div');
      actionWrap.className = 'phase3-gameover-actions';
      legacyGameOverButton.parentElement?.insertBefore(actionWrap, legacyGameOverButton);
      actionWrap.appendChild(legacyGameOverButton);
      actionWrap.appendChild(menuBtn);
    }

    if ($('phase3-close-menu')) $('phase3-close-menu').addEventListener('click', () => startGame('classic'));

    // Phase-2 game-over handlers can remain; our handler guards duplicate leaderboard entries.
  }

  // Expose minimal debug information without exposing mutable internals.
  window.BlohshBlastPhase3 = {
    startGame,
    showMenu,
    openStats,
    getMode: () => P3.mode,
    getProgression: () => ({ ...P3.progression })
  };

  // Global helpers are already defined by the game script above, so this runs after its init().
  initPhase3();
})();
