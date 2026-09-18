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
        <div class="phase3-brand">
          <img src="./icon.svg" alt="Blohsh" class="phase3-logo">
          <h1 class="phase3-title">BLOHSH<br>BLAST</h1>
          <p class="phase3-subtitle">Puzzle Arcade // Phase 3</p>
        </div>

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

        <div class="phase3-panel" style="margin-top:12px">
          <div class="phase3-section-title">Leaderboard local</div>
          <div id="phase3-leaderboard" class="phase3-leaderboard"></div>
          <div class="phase3-nickname">
            <input id="phase3-nickname" maxlength="16" autocomplete="nickname" placeholder="SEU NICK" aria-label="Seu nickname">
          </div>
        </div>

        <div class="phase3-actions">
          <button id="phase3-stats-button" class="phase3-action" type="button">Estatísticas</button>
          <button id="phase3-menu-sound" class="phase3-action" type="button">SFX ON</button>
          <button id="phase3-close-menu" class="phase3-action" type="button">Fechar</button>
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
    if (logo) logo.src = './icon.svg';

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

      const actionWrap = legacyGameOverButton.parentElement;
      if (actionWrap) {
        actionWrap.classList.add('phase3-gameover-actions');
        actionWrap.appendChild(menuBtn);
      }
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
