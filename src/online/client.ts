import type { GameEngine } from '../game/engine';
import { normalizeNickname, createScorePayload, type RunMetrics, type OnlineMode } from './logic';

type User = { id: string; nickname: string; email: string };
type RunReply = { runId: string; mode: OnlineMode; rulesVersion: string };
type OnlineRow = { nickname: string; score: number; mode: OnlineMode; createdAt: string };
type ApiEnvelope<T> = { data: T };
type Session = RunMetrics & { token: string; runPromise: Promise<string | null>; closed: boolean };

const SESSION_KEY = 'blohshBlastOnlineSessionV1';
let token = '';
let user: User | null = null;
let registerMode = false;
let busy = false;
let session: Session | null = null;
let message = '';
let onlineScores: OnlineRow[] = [];
let isFetchingScores = false;

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error('Blohsh online UI element is missing: ' + id);
  return value as T;
}

async function request<T>(path: string, opts: { method?: 'GET' | 'POST'; body?: unknown; auth?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth) headers.Authorization = 'Bearer ' + opts.auth;
  const response = await fetch(path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: 'no-store',
    signal: AbortSignal.timeout(12000)
  });
  const data = await response.json() as ApiEnvelope<T> & { error?: string };
  if (!response.ok) {
    const error = new Error(data.error || 'request_failed');
    Object.assign(error, { status: response.status });
    throw error;
  }
  return data.data;
}

function isUnauthorized(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'status' in error && error.status === 401;
}

function notify(text: string): void {
  message = text;
  element('online-account-status').textContent = text;
}

function clearAccount(): void {
  token = '';
  user = null;
  session = null;
  sessionStorage.removeItem(SESSION_KEY);
  renderAccount();
}

function renderAccount(): void {
  const loggedIn = !!user;
  element('online-form').hidden = loggedIn;
  element('online-signed-in').hidden = !loggedIn;
  element('online-register-name-row').hidden = !registerMode;
  element('online-account-submit').textContent = registerMode ? 'Criar conta' : 'Entrar';
  element('online-auth-toggle').textContent = registerMode ? 'Já tenho conta' : 'Criar conta';
  element('online-user-label').textContent = loggedIn ? ('Conectado: ' + user!.nickname) : '';
  element('online-account-status').textContent = message || (loggedIn
    ? 'Seu próximo jogo poderá participar do ranking online.'
    : 'Jogue offline livremente ou entre para publicar pontuações.');
  (element('online-account-submit') as HTMLButtonElement).disabled = busy;
  (element('online-auth-toggle') as HTMLButtonElement).disabled = busy;
}

async function authenticate(): Promise<void> {
  if (busy || !navigator.onLine) {
    notify('Sem internet. Sua partida local continua disponível.');
    return;
  }
  const email = element<HTMLInputElement>('online-email').value.trim().toLowerCase();
  const password = element<HTMLInputElement>('online-password').value;
  const nickname = normalizeNickname(element<HTMLInputElement>('online-nickname').value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 12) {
    notify('Informe um e-mail válido e uma senha de pelo menos 12 caracteres.');
    return;
  }
  busy = true;
  renderAccount();
  try {
    const info = await request<{ accessToken: string }>(
      registerMode ? '/api/v1/auth/register' : '/api/v1/auth/login',
      { method: 'POST', body: registerMode ? { email, password, nickname } : { email, password } }
    );
    token = info.accessToken;
    sessionStorage.setItem(SESSION_KEY, token);
    user = await request<User>('/api/v1/me', { auth: token });
    element<HTMLInputElement>('online-password').value = '';
    notify('Conta conectada! Inicie uma nova partida para enviar pontuações.');
    renderAccount();
    await refreshLeaderboard();
  } catch (error) {
    clearAccount();
    const status = typeof error === 'object' && error && 'status' in error ? error.status : null;
    notify(status === 409 ? 'Este e-mail já possui uma conta.' :
      status === 401 ? 'E-mail ou senha incorretos.' :
      status === 429 ? 'Muitas tentativas. Tente novamente mais tarde.' :
      'Não foi possível conectar. Seus dados locais permanecem salvos.');
  } finally {
    busy = false;
    renderAccount();
  }
}

async function restoreAccount(): Promise<void> {
  const saved = sessionStorage.getItem(SESSION_KEY);
  if (!saved || !navigator.onLine) return;
  token = saved;
  try {
    user = await request<User>('/api/v1/me', { auth: saved });
    renderAccount();
  } catch (error) {
    if (isUnauthorized(error)) clearAccount();
    else notify('A conexão online está indisponível. Você ainda pode jogar offline.');
  }
}

function renderOnlineScores(): void {
  const list = element('online-leaderboard');
  list.replaceChildren();
  if (!onlineScores.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Ainda não há pontuações online.';
    list.appendChild(empty);
    return;
  }
  for (const [index, score] of onlineScores.entries()) {
    const row = document.createElement('div');
    row.className = 'p3-online-score-row';
    const rank = document.createElement('span');
    rank.textContent = String(index + 1).padStart(2, '0');
    const name = document.createElement('strong');
    name.textContent = (score.nickname || 'PLAYER').slice(0, 16);
    const points = document.createElement('span');
    points.textContent = Number(score.score).toLocaleString('pt-BR');
    row.append(rank, name, points);
    list.appendChild(row);
  }
}

async function refreshLeaderboard(): Promise<void> {
  if (isFetchingScores) return;
  if (!navigator.onLine) {
    element('online-leaderboard-status').textContent = 'Offline: ranking online indisponível.';
    return;
  }
  isFetchingScores = true;
  element('online-leaderboard-status').textContent = 'Atualizando ranking...';
  try {
    const mode = element<HTMLSelectElement>('online-ranking-mode').value;
    onlineScores = await request<OnlineRow[]>('/api/v1/leaderboard?mode=' + encodeURIComponent(mode) + '&limit=10');
    element('online-leaderboard-status').textContent = 'Ranking online atualizado';
    renderOnlineScores();
  } catch {
    element('online-leaderboard-status').textContent = 'Sem conexão com o ranking. Seu ranking local permanece disponível.';
  } finally {
    isFetchingScores = false;
  }
}

function startOnlineRun(mode: OnlineMode): void {
  session = null;
  if (!token || !user || !navigator.onLine) return;
  const runToken = token;
  const runPromise: Promise<string | null> = request<RunReply>('/api/v1/runs', {
    method: 'POST', auth: runToken, body: { mode }
  }).then(data => data.runId).catch(error => {
    if (isUnauthorized(error)) clearAccount();
    else notify('Esta partida será apenas local: não foi possível iniciar a sessão online.');
    return null;
  });
  session = { token: runToken, mode, runPromise, moves: 0, lines: 0, combo: 0, perfectClear: false, closed: false };
}

async function sendFinalScore(game: Session, score: number): Promise<void> {
  const runId = await game.runPromise;
  if (!runId || !token || token !== game.token || !navigator.onLine) return;
  const payload = createScorePayload(runId, game, score);
  if (!payload) return;
  try {
    await request('/api/v1/scores', { method: 'POST', auth: game.token, body: payload });
    notify('Pontuação enviada ao ranking online!');
    await refreshLeaderboard();
  } catch (error) {
    if (isUnauthorized(error)) {
      clearAccount();
      notify('Sua sessão expirou. Entre novamente; a pontuação local foi preservada.');
    } else {
      notify('Não foi possível enviar a pontuação. Ela continua salva no ranking local.');
    }
  }
}

function installAccountUI(): void {
  const menu = document.querySelector('.phase3-menu-card');
  const localPanel = document.querySelector('.phase3-leaderboard-panel');
  if (!menu || document.getElementById('online-panel')) return;

  const panel = document.createElement('section');
  panel.id = 'online-panel';
  panel.className = 'phase3-panel p3-online-panel';
  panel.setAttribute('aria-label', 'Conta e ranking online');
  panel.hidden = true;
  panel.innerHTML = [
    '<div class="p3-online-titlebar"><div class="phase3-section-title">Conta e ranking online</div>',
    '<button type="button" id="online-account-close" aria-label="Fechar conta online">Fechar</button></div>',
    '<p id="online-account-status" class="p3-online-status" role="status" aria-live="polite"></p>',
    '<div id="online-form">',
    '  <div class="p3-online-fields">',
    '    <label>E-mail<input id="online-email" type="email" autocomplete="email" maxlength="254" placeholder="voce@exemplo.com"></label>',
    '    <label>Senha<input id="online-password" type="password" autocomplete="current-password" minlength="12" maxlength="128" placeholder="Mínimo 12 caracteres"></label>',
    '    <label id="online-register-name-row" hidden>Apelido público<input id="online-nickname" maxlength="16" autocomplete="nickname" placeholder="PLAYER"></label>',
    '  </div>',
    '  <div class="p3-online-actions">',
    '    <button id="online-account-submit" type="button">Entrar</button>',
    '    <button id="online-auth-toggle" type="button">Criar conta</button>',
    '  </div>',
    '</div>',
    '<div id="online-signed-in" hidden>',
    '  <p id="online-user-label"></p>',
    '  <button id="online-logout" type="button">Sair da conta</button>',
    '</div>',
    '<div class="p3-online-heading">',
    '  <label for="online-ranking-mode">Ranking global</label>',
    '  <select id="online-ranking-mode" aria-label="Modo do ranking">',
    '    <option value="classic">Classic</option><option value="zen">Zen</option>',
    '    <option value="hardcore">Hardcore</option><option value="daily">Daily</option>',
    '  </select>',
    '  <button id="online-ranking-refresh" type="button">Atualizar</button>',
    '</div>',
    '<p id="online-leaderboard-status" class="p3-online-status" aria-live="polite"></p>',
    '<div id="online-leaderboard" class="p3-online-scores"></div>',
    '<p class="p3-online-note">O progresso, XP e skins continuam salvos neste dispositivo. ',
    'Para entrar no ranking online, faça login e inicie uma nova partida conectado à internet.</p>'
  ].join('');
  if (localPanel) localPanel.insertAdjacentElement('afterend', panel);
  else menu.append(panel);

  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.id = 'online-account-open';
  openButton.className = 'phase3-action p3-online-open';
  openButton.textContent = 'ONLINE';
  openButton.setAttribute('aria-label', 'Abrir conta e ranking online');
  openButton.setAttribute('aria-controls', 'online-panel');
  openButton.setAttribute('aria-expanded', 'false');
  menu.querySelector('.phase3-actions')?.appendChild(openButton);
  const togglePanel = (open: boolean) => {
    panel.hidden = !open;
    openButton.setAttribute('aria-expanded', String(open));
    if (open) void refreshLeaderboard();
  };
  openButton.addEventListener('click', () => togglePanel(panel.hidden));
  element('online-account-close').addEventListener('click', () => togglePanel(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.stopPropagation();
      togglePanel(false);
    }
  });

  element<HTMLInputElement>('online-nickname').value =
    normalizeNickname(element<HTMLInputElement>('phase3-nickname').value || 'PLAYER');
  element('online-account-submit').addEventListener('click', () => { void authenticate(); });
  element('online-auth-toggle').addEventListener('click', () => {
    registerMode = !registerMode;
    renderAccount();
  });
  element('online-logout').addEventListener('click', () => {
    clearAccount();
    notify('Você saiu da conta. O progresso local não foi alterado.');
  });
  element('online-ranking-refresh').addEventListener('click', () => { void refreshLeaderboard(); });
  element('online-ranking-mode').addEventListener('change', () => { void refreshLeaderboard(); });
  element('online-password').addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); void authenticate(); }
  });
  window.addEventListener('online', () => { void restoreAccount(); void refreshLeaderboard(); });
  window.addEventListener('offline', () => {
    element('online-leaderboard-status').textContent = 'Offline: ranking online indisponível.';
  });
  renderAccount();
  renderOnlineScores();
  void restoreAccount();
  void refreshLeaderboard();
}

export function setupOnlineFeatures(engine: GameEngine): void {
  installAccountUI();
  window.addEventListener('blohsh:game-start', event => {
    const mode = (event as CustomEvent<{ mode: OnlineMode }>).detail?.mode;
    if (mode) startOnlineRun(mode);
  });
  engine.on('piecePlaced', event => {
    if (session && !session.closed) session.moves += Math.max(0, event.detail.amount);
  });
  engine.on('linesCleared', event => {
    if (session && !session.closed) {
      session.lines += Math.max(0, event.detail.amount);
      session.combo = Math.max(session.combo, engine.getState().combo);
    }
  });
  engine.on('perfectClear', () => {
    if (session && !session.closed) session.perfectClear = true;
  });
  engine.on('gameOver', event => {
    const finished = session;
    if (!finished || finished.closed) return;
    finished.closed = true;
    session = null;
    void sendFinalScore(finished, event.detail.score);
  });
}
