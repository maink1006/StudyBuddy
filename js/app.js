'use strict';

const STORAGE_KEY = 'studyBuddyCherryGrove_v1';
const DEFAULT_STATE = {
  xp: 0,
  coins: 25,
  dailyGoal: 120,
  tasks: [],
  sessions: [],
  achievements: [],
  lastStudyDate: null,
  currentStreak: 0,
  ownedDecor: ['lantern'],
  activeDecor: 'lantern',
  settings: { music: false, sfx: true, volume: 0.28 },
  timer: { mode: 'focus', duration: 25, remaining: 1500, running: false, endAt: null, subject: 'Quiet study time', finished: false }
};

const DECORATIONS = [
  { id: 'lantern', name: 'Cherry lantern', icon: '🏮', price: 0, note: 'A warm little glow' },
  { id: 'bookshelf', name: 'Oak bookshelf', icon: '📚', price: 18, note: 'Room for new ideas' },
  { id: 'blossom', name: 'Blossom vase', icon: '🌸', price: 24, note: 'A little spring indoors' },
  { id: 'cat', name: 'Window cat', icon: '🐈', price: 35, note: 'A quiet study buddy' },
  { id: 'cake', name: 'Sweet berry cake', icon: '🍰', price: 28, note: 'A well-earned treat' },
  { id: 'crystal', name: 'Amethyst crystal', icon: '💎', price: 45, note: 'A spark of inspiration' }
];

const ACHIEVEMENTS = [
  { id: 'first_focus', name: 'First Steps', icon: '🌱', description: 'Complete your first focus session.', condition: s => s.sessions.length >= 1 },
  { id: 'focus_5', name: 'Getting in the Flow', icon: '⏳', description: 'Complete 5 focus sessions.', condition: s => s.sessions.length >= 5 },
  { id: 'focus_10', name: 'Quietly Consistent', icon: '🪴', description: 'Complete 10 focus sessions.', condition: s => s.sessions.length >= 10 },
  { id: 'task_1', name: 'Quest Accepted', icon: '📜', description: 'Complete your first task.', condition: s => s.tasks.some(t => t.completed) },
  { id: 'task_10', name: 'Quest Keeper', icon: '🧭', description: 'Complete 10 tasks.', condition: s => s.tasks.filter(t => t.completed).length >= 10 },
  { id: 'streak_3', name: 'Three-Day Bloom', icon: '🌸', description: 'Study on 3 consecutive days.', condition: s => s.currentStreak >= 3 },
  { id: 'level_5', name: 'Village Regular', icon: '🏡', description: 'Reach level 5.', condition: s => getLevelInfo(s.xp).level >= 5 },
  { id: 'xp_500', name: 'A Thousand Little Steps', icon: '✨', description: 'Collect 500 XP.', condition: s => s.xp >= 500 }
];

let state = loadState();
let currentPage = 'home';
let taskFilter = 'all';
let toastTimer = null;
let timerInterval = null;

const appContent = document.getElementById('app-content');
const toastElement = document.getElementById('toast');

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved) return clone(DEFAULT_STATE);
    return {
      ...clone(DEFAULT_STATE), ...saved,
      settings: { ...DEFAULT_STATE.settings, ...(saved.settings || {}) },
      timer: { ...DEFAULT_STATE.timer, ...(saved.timer || {}) },
      tasks: Array.isArray(saved.tasks) ? saved.tasks : [],
      sessions: Array.isArray(saved.sessions) ? saved.sessions : [],
      achievements: Array.isArray(saved.achievements) ? saved.achievements : [],
      ownedDecor: Array.isArray(saved.ownedDecor) ? saved.ownedDecor : ['lantern']
    };
  } catch (error) {
    console.warn('Could not read saved Study Buddy data.', error);
    return clone(DEFAULT_STATE);
  }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateShell();
}
function todayString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function getLevelInfo(xp) {
  const level = Math.floor(Math.max(0, xp) / 100) + 1;
  const current = Math.max(0, xp) % 100;
  const titles = ['Seedling', 'Sprout', 'Sapling', 'Blossom', 'Bloom Keeper', 'Grove Guardian', 'Cherry Sage'];
  return { level, current, next: 100, title: titles[Math.min(level - 1, titles.length - 1)] };
}
function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours ? `${hours}h ${mins}m` : `${mins}m`;
}
function formatDate(dateString) {
  if (!dateString) return 'No date';
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function showToast(message, sound = null) {
  toastElement.textContent = message;
  toastElement.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastElement.classList.remove('show'), 2600);
  if (sound) window.studyBuddyAudio.playSfx(sound);
}
function updateShell() {
  const levelInfo = getLevelInfo(state.xp);
  document.getElementById('coin-count').textContent = state.coins;
  document.getElementById('sidebar-level').textContent = `Level ${levelInfo.level} · ${levelInfo.title}`;
  document.getElementById('sidebar-xp-fill').style.width = `${levelInfo.current}%`;
  document.getElementById('sidebar-xp-text').textContent = `${levelInfo.current} / 100 XP`;
  document.getElementById('nav-task-count').textContent = state.tasks.filter(task => !task.completed).length;
  document.getElementById('sound-toggle').classList.toggle('sound-active', state.settings.music);
  document.getElementById('sound-toggle').textContent = state.settings.music ? '♫' : '♪';
  document.querySelectorAll('.nav-link[data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === currentPage));
  window.studyBuddyAudio.setOptions(state.settings);
}
function renderPage() {
  updateShell();
  const pageNames = { home: 'Cherry Grove', tasks: 'Quest Board', pomodoro: 'Focus Clearing', room: 'Little Cottage', achievements: 'Milestone Meadow', statistics: 'Study Journal', settings: 'Settings' };
  document.getElementById('current-location').textContent = pageNames[currentPage] || 'Cherry Grove';
  const renderers = { home: renderHome, tasks: renderTasks, pomodoro: renderPomodoro, room: renderRoom, achievements: renderAchievements, statistics: renderStatistics, settings: renderSettings };
  appContent.innerHTML = (renderers[currentPage] || renderHome)();
  if (currentPage === 'pomodoro') updateTimerDisplay();
}
function setPage(page) {
  if (!['home', 'tasks', 'pomodoro', 'room', 'achievements', 'statistics', 'settings'].includes(page)) return;
  currentPage = page;
  renderPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function getTodayMinutes() {
  return state.sessions.filter(session => session.date === todayString()).reduce((sum, session) => sum + Number(session.minutes || 0), 0);
}
function getTodayCompletedTasks() {
  return state.tasks.filter(task => task.completed && task.completedDate === todayString()).length;
}
function renderHeader(eyebrow, title, subtitle, right = '') {
  return `<div class="page-header"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${subtitle}</p></div>${right}</div>`;
}
function renderHome() {
  const level = getLevelInfo(state.xp);
  const todayMinutes = getTodayMinutes();
  const openTasks = state.tasks.filter(task => !task.completed).length;
  const completedTasks = state.tasks.filter(task => task.completed).length;
  const goalPercent = Math.min(100, Math.round(todayMinutes / Math.max(1, state.dailyGoal) * 100));
  const todayTasks = state.tasks.filter(task => task.dueDate === todayString()).slice(0, 3);
  const dailyDone = todayMinutes >= 25;
  return `
    <div class="welcome-row"><div><div class="eyebrow">A FRESH DAY IN THE GROVE</div><h1>Good day, little learner <span>🌸</span></h1><p>Take a breath. Small steps make a beautiful journey.</p></div><div class="date-chip">☀ ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div></div>
    <div class="stat-grid">
      <div class="stat-card"><div class="stat-card-top"><span>Focus time today</span><span class="stat-icon">◷</span></div><div class="stat-value">${formatMinutes(todayMinutes)}</div><div class="stat-note">A little progress every day</div></div>
      <div class="stat-card"><div class="stat-card-top"><span>Open quests</span><span class="stat-icon">📜</span></div><div class="stat-value">${openTasks}</div><div class="stat-note">${completedTasks} quests completed so far</div></div>
      <div class="stat-card"><div class="stat-card-top"><span>Your level</span><span class="stat-icon">🌱</span></div><div class="stat-value">Lv. ${level.level}</div><div class="stat-note">${level.title} · ${level.current}/100 XP</div></div>
      <div class="stat-card"><div class="stat-card-top"><span>Study streak</span><span class="stat-icon">🔥</span></div><div class="stat-value">${state.currentStreak} day${state.currentStreak === 1 ? '' : 's'}</div><div class="stat-note">Keep your little flame glowing</div></div>
    </div>
    <section class="hero-room">
      <div class="hero-copy"><div class="eyebrow">YOUR CHERRY GROVE RETREAT</div><h2>A quiet place to grow, one page at a time.</h2><p>Settle into your little corner beneath the cherry blossoms. Your next small victory is waiting.</p><div class="hero-actions"><button class="primary-button" data-page="pomodoro">Start a focus session →</button><button class="outline-button" data-page="room">Visit my room</button></div></div>
    </section>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-heading"><h3>Today's little quests</h3><button class="text-link" data-page="tasks">Quest board →</button></div>
        <div class="quest-meta"><span>Daily focus goal</span><b>${todayMinutes} / ${state.dailyGoal} min</b></div><div class="quest-progress"><span style="width:${goalPercent}%"></span></div>
        <div class="quest-meta"><span>${goalPercent}% of your daily goal</span><span>${dailyDone ? 'Blooming nicely ✿' : 'Keep going, gently'}</span></div>
        <div class="quest-row"><div class="quest-icon">🍃</div><div class="quest-info"><strong>Focus for 25 minutes</strong><small>${dailyDone ? 'Completed today · lovely work!' : 'Earn your first focus reward today'}</small></div><span class="quest-check ${dailyDone ? 'done' : ''}">${dailyDone ? '✓' : '·'}</span></div>
        ${todayTasks.length ? todayTasks.map(task => `<div class="quest-row"><div class="quest-icon">${task.completed ? '🌷' : '📖'}</div><div class="quest-info"><strong>${escapeHtml(task.title)}</strong><small>${task.completed ? 'Completed' : `${escapeHtml(task.subject || 'Personal study')} · ${formatDate(task.dueDate)}`}</small></div><button class="quest-check ${task.completed ? 'done' : ''}" data-action="complete-task" data-id="${task.id}" ${task.completed ? 'disabled' : ''}>${task.completed ? '✓' : '○'}</button></div>`).join('') : `<div class="empty-state"><div class="empty-icon">🪴</div><strong>No quests for today yet</strong><p>Add a tiny task to get started.</p></div>`}
      </section>
      <section class="panel companion-card"><img class="companion-image" src="assets/images/cat-companions.jpg" alt="A row of cats looking at the sky"><div class="companion-copy"><h3>Your quiet companions 🐈</h3><p>They may not do your homework, but they are excellent at keeping you company.</p><span class="companion-tag">✦ ${state.sessions.length ? `${state.sessions.length} focus sessions together` : 'Ready for your first study session'}</span></div></section>
    </div>`;
}
function renderTasks() {
  const filtered = state.tasks.filter(task => taskFilter === 'all' || (taskFilter === 'active' && !task.completed) || (taskFilter === 'done' && task.completed)).sort((a,b) => (a.completed - b.completed) || (a.dueDate || '').localeCompare(b.dueDate || ''));
  return `${renderHeader('QUEST BOARD', 'Your learning quests 📜', 'Turn big goals into small, manageable adventures.', '<div class="date-chip">✦ +8 XP for each completed quest</div>')}
    <section class="panel"><div class="panel-heading"><h3>Add a new quest</h3><span class="muted" style="font-size:9px">One step at a time</span></div>
      <form id="task-form"><div class="form-grid">
        <div class="field"><label for="task-title">QUEST NAME</label><input id="task-title" name="title" maxlength="90" placeholder="e.g. Review SQL joins" required></div>
        <div class="field"><label for="task-subject">SUBJECT</label><input id="task-subject" name="subject" maxlength="35" placeholder="e.g. Database"></div>
        <div class="field"><label for="task-date">DUE DATE</label><input id="task-date" name="dueDate" type="date" value="${todayString()}" required></div>
        <div class="field"><label for="task-priority">PRIORITY</label><select id="task-priority" name="priority"><option value="normal">Normal</option><option value="high">High</option><option value="low">Low</option></select></div>
      </div><div style="display:flex;justify-content:flex-end;margin-top:11px"><button class="primary-button" type="submit">＋ Add quest</button></div></form>
    </section>
    <section class="panel" style="margin-top:14px"><div class="panel-heading"><h3>Your quest log <span class="muted">(${state.tasks.length})</span></h3><span class="muted" style="font-size:9px">Completed quests award XP once</span></div>
      <div class="filter-row"><button class="filter-chip ${taskFilter === 'all' ? 'active' : ''}" data-filter="all">All (${state.tasks.length})</button><button class="filter-chip ${taskFilter === 'active' ? 'active' : ''}" data-filter="active">Active (${state.tasks.filter(t => !t.completed).length})</button><button class="filter-chip ${taskFilter === 'done' ? 'active' : ''}" data-filter="done">Completed (${state.tasks.filter(t => t.completed).length})</button></div>
      <div class="task-list">${filtered.length ? filtered.map(task => `<div class="task-item ${task.completed ? 'completed' : ''}"><button class="task-checkbox ${task.completed ? 'checked' : ''}" data-action="complete-task" data-id="${task.id}" aria-label="Complete task">${task.completed ? '✓' : ''}</button><div class="task-main"><strong>${escapeHtml(task.title)} <span class="priority ${escapeHtml(task.priority || 'normal')}">${escapeHtml(task.priority || 'normal')}</span></strong><small>${escapeHtml(task.subject || 'Personal')}${task.dueDate ? ` · Due ${formatDate(task.dueDate)}` : ''}${task.completed ? ` · Finished ${formatDate(task.completedDate)}` : ''}</small></div><div class="task-actions"><button data-action="delete-task" data-id="${task.id}" title="Delete quest" aria-label="Delete quest">✕</button></div></div>`).join('') : `<div class="empty-state"><div class="empty-icon">🌱</div><strong>${taskFilter === 'done' ? 'No completed quests yet' : 'Your quest book is still empty'}</strong><p>Add a quest above and begin your adventure.</p></div>`}</div>
    </section>`;
}
function renderPomodoro() {
  const timer = state.timer;
  return `${renderHeader('FOCUS CLEARING', 'A little focus goes a long way 🍵', 'Settle in, breathe slowly, and give one thing your attention.')}
    <div class="timer-layout">
      <section class="timer-card">
        <div class="timer-tabs"><button class="timer-tab ${timer.mode === 'focus' ? 'active' : ''}" data-action="timer-mode" data-mode="focus">Focus</button><button class="timer-tab ${timer.mode === 'break' ? 'active' : ''}" data-action="timer-mode" data-mode="break">Short break</button></div>
        <div class="timer-subject"><input id="timer-subject" value="${escapeHtml(timer.subject)}" maxlength="50" aria-label="What are you studying?" placeholder="What are you studying?"></div>
        <div class="timer-face" id="timer-display">${formatTimer(timer.remaining)}</div>
        <div class="timer-caption" id="timer-caption">${timer.running ? 'You are doing wonderfully. Stay in your flow.' : timer.finished ? 'Session complete — enjoy your little break.' : 'A peaceful session, just for you.'}</div>
        <div class="timer-ring"><span id="timer-progress" style="width:${timerProgress()}%"></span></div>
        <div class="timer-controls"><button class="soft-button" data-action="timer-reset">↺ Reset</button>${timer.running ? '<button class="primary-button" data-action="timer-pause">Ⅱ Pause</button>' : `<button class="primary-button" data-action="timer-start">▶ ${timer.mode === 'break' ? 'Start break' : (timer.remaining === timer.duration * 60 ? 'Start focus' : 'Resume')}</button>`}</div>
        <div class="duration-row" style="justify-content:center;margin-top:17px">${[15,25,30,45,60].map(value => `<button class="duration-chip ${timer.mode === 'focus' && timer.duration === value ? 'active' : ''}" data-action="timer-duration" data-duration="${value}" ${timer.running ? 'disabled' : ''}>${value} min</button>`).join('')}</div>
      </section>
      <aside class="timer-side">
        <div class="tip-card"><h3>🌸 A gentle reminder</h3><p>You don't need to finish everything today. Just begin with the next small step. Your future self will thank you.</p></div>
        <div class="panel"><div class="panel-heading"><h3>Today's focus</h3><span class="stat-icon">◷</span></div><div class="stat-value">${formatMinutes(getTodayMinutes())}</div><div class="quest-progress"><span style="width:${Math.min(100, getTodayMinutes() / Math.max(1,state.dailyGoal) * 100)}%"></span></div><div class="quest-meta"><span>Goal: ${state.dailyGoal} min</span><b>${Math.min(100, Math.round(getTodayMinutes() / Math.max(1,state.dailyGoal) * 100))}%</b></div></div>
        <div class="tip-card"><h3>🎁 Focus rewards</h3><p>Complete a focus session to earn XP and gems. Use your gems to make your cottage feel like home.</p></div>
      </aside>
    </div>`;
}
function formatTimer(seconds) { const safe = Math.max(0, Number(seconds) || 0); return `${String(Math.floor(safe / 60)).padStart(2,'0')}:${String(safe % 60).padStart(2,'0')}`; }
function timerProgress() { const total = Math.max(1, state.timer.duration * 60); return Math.min(100, Math.max(0, (1 - state.timer.remaining / total) * 100)); }
function updateTimerDisplay() {
  const display = document.getElementById('timer-display');
  if (display) display.textContent = formatTimer(state.timer.remaining);
  const progress = document.getElementById('timer-progress');
  if (progress) progress.style.width = `${timerProgress()}%`;
  const caption = document.getElementById('timer-caption');
  if (caption && state.timer.running) caption.textContent = state.timer.mode === 'focus' ? 'You are doing wonderfully. Stay in your flow.' : 'Rest your eyes and stretch a little.';
}
function renderRoom() {
  const active = DECORATIONS.find(item => item.id === state.activeDecor) || DECORATIONS[0];
  return `${renderHeader('YOUR LITTLE COTTAGE', 'A room that grows with you 🏡', 'Spend your gems on little things that make this place yours.')}
    <section class="room-banner"><div class="room-decoration">${active.icon}</div><div class="room-banner-copy"><div class="eyebrow" style="color:#f4c7d2">CHERRY GROVE · HOME</div><h2>Welcome to your quiet corner.</h2><p>${active.name} is keeping your room company.</p></div></section>
    <div class="room-sections"><section class="panel"><div class="panel-heading"><h3>Room inventory</h3><span class="muted" style="font-size:9px">${state.ownedDecor.length} owned</span></div><div class="shop-grid">${DECORATIONS.filter(item => state.ownedDecor.includes(item.id)).map(item => `<div class="shop-item"><div class="shop-art">${item.icon}</div><strong>${item.name}</strong><small>${item.id === state.activeDecor ? 'Currently displayed' : 'Ready to decorate'}</small><button class="soft-button button-small" data-action="select-decor" data-id="${item.id}" ${item.id === state.activeDecor ? 'disabled' : ''}>${item.id === state.activeDecor ? 'Selected' : 'Display'}</button></div>`).join('')}</div></section>
    <section class="panel"><div class="panel-heading"><h3>Little cottage shop</h3><span class="coin-pill"><span>✦</span><strong>${state.coins}</strong><small>GEMS</small></span></div><div class="shop-grid">${DECORATIONS.filter(item => !state.ownedDecor.includes(item.id)).map(item => `<div class="shop-item"><div class="shop-art">${item.icon}</div><strong>${item.name}</strong><small>${item.note}</small><button class="primary-button button-small" data-action="buy-decor" data-id="${item.id}">✦ ${item.price}</button></div>`).join('') || '<div class="empty-state" style="grid-column:1/-1;padding:15px"><strong>You collected everything!</strong><p>Your cottage is full of lovely things.</p></div>'}</div></section></div>`;
}
function renderAchievements() {
  const unlocked = state.achievements;
  return `${renderHeader('MILESTONE MEADOW', 'Every little win counts ✨', 'Your journey is made of small moments worth celebrating.', `<div class="date-chip">🏅 ${unlocked.length} / ${ACHIEVEMENTS.length} unlocked</div>`)}
    <div class="achievement-grid">${ACHIEVEMENTS.map(item => { const has = unlocked.includes(item.id); return `<article class="achievement-card ${has ? '' : 'locked'}"><div class="achievement-icon">${item.icon}</div><strong>${item.name}</strong><p>${item.description}</p><span class="unlocked-label">${has ? '✦ UNLOCKED' : '◇ LOCKED'}</span></article>`; }).join('')}</div>`;
}
function renderStatistics() {
  const sessions = state.sessions;
  const totalMinutes = sessions.reduce((sum, item) => sum + Number(item.minutes || 0), 0);
  const days = Array.from({ length: 7 }, (_, index) => { const d = new Date(); d.setDate(d.getDate() - (6 - index)); const date = todayString(d); return { date, label: d.toLocaleDateString('en-US', { weekday: 'short' }), minutes: sessions.filter(item => item.date === date).reduce((sum, item) => sum + Number(item.minutes || 0), 0) }; });
  const max = Math.max(30, ...days.map(day => day.minutes));
  const subjects = {};
  sessions.forEach(item => { const key = item.subject || 'Unsorted'; subjects[key] = (subjects[key] || 0) + Number(item.minutes || 0); });
  const subjectRows = Object.entries(subjects).sort((a,b) => b[1] - a[1]);
  return `${renderHeader('YOUR STUDY JOURNAL', 'Look how far you have grown 🌿', 'A little reflection on the time you have given yourself.')}
    <div class="stats-scenic-banner"><strong>Every little session plants a blossom.</strong></div>
    <div class="stats-kpis"><div class="stat-card"><div class="stat-card-top"><span>Total focus time</span><span class="stat-icon">◷</span></div><div class="stat-value">${formatMinutes(totalMinutes)}</div><div class="stat-note">Across ${sessions.length} focus sessions</div></div><div class="stat-card"><div class="stat-card-top"><span>Quests completed</span><span class="stat-icon">📜</span></div><div class="stat-value">${state.tasks.filter(t => t.completed).length}</div><div class="stat-note">Little promises kept</div></div><div class="stat-card"><div class="stat-card-top"><span>XP collected</span><span class="stat-icon">✦</span></div><div class="stat-value">${state.xp}</div><div class="stat-note">Level ${getLevelInfo(state.xp).level} · ${getLevelInfo(state.xp).title}</div></div></div>
    <div class="dashboard-grid"><section class="panel"><div class="panel-heading"><h3>Focus minutes · last 7 days</h3><span class="muted" style="font-size:9px">Daily view</span></div><div class="chart">${days.map(day => `<div class="chart-col"><b>${day.minutes || ''}</b><div class="chart-bar-wrap"><div class="chart-bar" style="height:${Math.max(day.minutes ? 4 : 0, day.minutes / max * 100)}%"></div></div><small>${day.label}</small></div>`).join('')}</div></section><section class="panel"><div class="panel-heading"><h3>Time by subject</h3></div>${subjectRows.length ? subjectRows.map(([name, minutes]) => `<div class="subject-row"><strong title="${escapeHtml(name)}">${escapeHtml(name)}</strong><div class="subject-track"><span style="width:${minutes / Math.max(1, ...subjectRows.map(item => item[1])) * 100}%"></span></div><small>${formatMinutes(minutes)}</small></div>`).join('') : '<div class="empty-state"><div class="empty-icon">📚</div><strong>Your study story starts here</strong><p>Complete a focus session to see your subjects.</p></div>'}</section></div>
    <section class="panel" style="margin-top:14px"><div class="panel-heading"><h3>Recent focus sessions</h3><span class="muted" style="font-size:9px">Latest first</span></div>${sessions.length ? sessions.slice().reverse().slice(0,8).map(item => `<div class="quest-row"><div class="quest-icon">🍵</div><div class="quest-info"><strong>${escapeHtml(item.subject || 'Quiet study time')}</strong><small>${formatDate(item.date)} · ${item.minutes} minutes</small></div><span class="companion-tag">+${item.xp || item.minutes} XP</span></div>`).join('') : '<div class="empty-state"><div class="empty-icon">🌸</div><strong>No sessions yet</strong><p>Your completed focus sessions will appear here.</p></div>'}</section>`;
}
function renderSettings() {
  return `${renderHeader('MAKE IT YOURS', 'A few cozy settings ⚙', 'Tune your little study world to feel just right.')}
    <div class="settings-grid"><section class="panel"><div class="panel-heading"><h3>Sound & ambience</h3><span class="stat-icon">♫</span></div>
      <div class="setting-row"><div><strong>Cherry Breeze ambience</strong><small>Original soft synthesized background music</small></div><input class="switch" type="checkbox" data-setting="music" ${state.settings.music ? 'checked' : ''}></div>
      <div class="setting-row"><div><strong>Sound effects</strong><small>Clicks, quest chimes and rewards</small></div><input class="switch" type="checkbox" data-setting="sfx" ${state.settings.sfx ? 'checked' : ''}></div>
      <div class="setting-row"><div><strong>Master volume</strong><small>${Math.round(state.settings.volume * 100)}%</small></div><input id="volume-control" type="range" min="0" max="100" value="${Math.round(state.settings.volume * 100)}" style="width:115px;accent-color:#c8798d"></div>
      <p class="muted" style="font-size:9px;line-height:1.5;margin:10px 0 0">Browsers require a click before audio can start. The ambience is generated in your browser and does not use extracted Minecraft music or sound files.</p>
    </section>
    <section class="panel"><div class="panel-heading"><h3>Study goals</h3><span class="stat-icon">🎯</span></div>
      <div class="field"><label for="daily-goal">DAILY FOCUS GOAL (MINUTES)</label><select id="daily-goal"><option value="60" ${state.dailyGoal === 60 ? 'selected' : ''}>60 minutes</option><option value="90" ${state.dailyGoal === 90 ? 'selected' : ''}>90 minutes</option><option value="120" ${state.dailyGoal === 120 ? 'selected' : ''}>120 minutes</option><option value="150" ${state.dailyGoal === 150 ? 'selected' : ''}>150 minutes</option><option value="180" ${state.dailyGoal === 180 ? 'selected' : ''}>180 minutes</option></select></div>
      <div class="spacer"></div><div class="setting-row"><div><strong>Current focus level</strong><small>${getLevelInfo(state.xp).title}</small></div><b>Lv. ${getLevelInfo(state.xp).level}</b></div>
    </section></div>
    <section class="panel" style="margin-top:14px"><div class="panel-heading"><h3>Your local save</h3><span class="companion-tag">🔒 This browser only</span></div><p class="muted" style="font-size:10px;line-height:1.6">Tasks, focus sessions, gems and decorations are stored in this browser using LocalStorage. Clearing browser data may erase your progress. Export/backup is not included in this first version.</p><button class="danger-button button-small" data-action="reset-data">Reset all Study Buddy data</button></section>`;
}

function addTask(formData) {
  const title = String(formData.get('title') || '').trim();
  if (!title) return;
  state.tasks.push({ id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), title, subject: String(formData.get('subject') || '').trim(), dueDate: String(formData.get('dueDate') || todayString()), priority: String(formData.get('priority') || 'normal'), completed: false, completedDate: null });
  saveState();
  showToast('A new quest has been added to your board. 🌱', 'task');
  renderPage();
}
function awardXp(amount, coins = 0) {
  const before = getLevelInfo(state.xp).level;
  state.xp += amount;
  state.coins += coins;
  const after = getLevelInfo(state.xp).level;
  if (after > before) {
    state.coins += 10;
    window.studyBuddyAudio.playSfx('level');
    showToast(`Level up! You are now level ${after}. +10 bonus gems! ✨`);
  }
  checkAchievements();
}
function checkAchievements() {
  for (const achievement of ACHIEVEMENTS) {
    if (!state.achievements.includes(achievement.id) && achievement.condition(state)) {
      state.achievements.push(achievement.id);
      state.coins += 5;
      showToast(`Achievement unlocked: ${achievement.name}! +5 gems 🏅`, 'reward');
    }
  }
}
function completeTask(id) {
  const task = state.tasks.find(item => String(item.id) === String(id));
  if (!task || task.completed) return;
  task.completed = true;
  task.completedDate = todayString();
  awardXp(8, 2);
  checkAchievements();
  saveState();
  showToast('Quest completed! +8 XP and +2 gems 🌷', 'task');
  renderPage();
}
function deleteTask(id) {
  state.tasks = state.tasks.filter(item => String(item.id) !== String(id));
  saveState();
  showToast('Quest removed from your board.');
  renderPage();
}
function buyDecoration(id) {
  const item = DECORATIONS.find(decor => decor.id === id);
  if (!item || state.ownedDecor.includes(id)) return;
  if (state.coins < item.price) { showToast('Not enough gems yet. Complete a focus session to earn more.'); return; }
  state.coins -= item.price;
  state.ownedDecor.push(id);
  state.activeDecor = id;
  saveState();
  showToast(`${item.name} added to your cottage! 🏡`, 'reward');
  renderPage();
}
function updateStreak() {
  const today = todayString();
  if (state.lastStudyDate === today) return;
  if (state.lastStudyDate) {
    const previous = new Date(`${state.lastStudyDate}T00:00:00`);
    previous.setDate(previous.getDate() + 1);
    state.currentStreak = todayString(previous) === today ? state.currentStreak + 1 : 1;
  } else {
    state.currentStreak = 1;
  }
  state.lastStudyDate = today;
}
function startTimer() {
  if (state.timer.running) return;
  const subjectInput = document.getElementById('timer-subject');
  if (subjectInput) state.timer.subject = subjectInput.value.trim() || 'Quiet study time';
  if (state.timer.remaining <= 0) state.timer.remaining = state.timer.duration * 60;
  state.timer.endAt = Date.now() + state.timer.remaining * 1000;
  state.timer.running = true;
  state.timer.finished = false;
  saveState();
  window.studyBuddyAudio.playSfx('click');
  ensureTimerInterval();
  renderPage();
}
function pauseTimer() {
  if (!state.timer.running) return;
  state.timer.remaining = Math.max(0, Math.ceil((state.timer.endAt - Date.now()) / 1000));
  state.timer.running = false;
  state.timer.endAt = null;
  saveState();
  renderPage();
}
function resetTimer() {
  state.timer.running = false;
  state.timer.endAt = null;
  state.timer.remaining = state.timer.duration * 60;
  state.timer.finished = false;
  saveState();
  renderPage();
}
function setTimerMode(mode) {
  if (state.timer.running) { showToast('Pause your timer before changing modes.'); return; }
  state.timer.mode = mode;
  state.timer.duration = mode === 'focus' ? 25 : 5;
  state.timer.remaining = state.timer.duration * 60;
  state.timer.finished = false;
  saveState();
  renderPage();
}
function setTimerDuration(minutes) {
  if (state.timer.running || state.timer.mode !== 'focus') return;
  state.timer.duration = minutes;
  state.timer.remaining = minutes * 60;
  state.timer.finished = false;
  saveState();
  renderPage();
}
function ensureTimerInterval() {
  if (timerInterval) return;
  timerInterval = window.setInterval(tickTimer, 250);
}
function tickTimer() {
  if (!state.timer.running || !state.timer.endAt) return;
  const remaining = Math.max(0, Math.ceil((state.timer.endAt - Date.now()) / 1000));
  if (remaining !== state.timer.remaining) {
    state.timer.remaining = remaining;
    const display = document.getElementById('timer-display');
    if (display) display.textContent = formatTimer(remaining);
    const progress = document.getElementById('timer-progress');
    if (progress) progress.style.width = `${timerProgress()}%`;
  }
  if (remaining <= 0) finishTimer();
}
function finishTimer() {
  if (!state.timer.running) return;
  const finishedMode = state.timer.mode;
  state.timer.running = false;
  state.timer.endAt = null;
  state.timer.remaining = 0;
  state.timer.finished = true;
  if (finishedMode === 'focus') {
    const minutes = state.timer.duration;
    const xp = Math.max(10, minutes);
    state.sessions.push({ id: Date.now(), subject: state.timer.subject || 'Quiet study time', minutes, date: todayString(), xp });
    updateStreak();
    awardXp(xp, Math.max(2, Math.floor(minutes / 5)));
    state.timer.mode = 'break';
    state.timer.duration = 5;
    state.timer.remaining = 300;
    saveState();
    window.studyBuddyAudio.playSfx('finish');
    showToast(`Focus complete! +${xp} XP and +${Math.max(2, Math.floor(minutes / 5))} gems. Time to rest. 🌸`);
  } else {
    state.timer.mode = 'focus';
    state.timer.duration = 25;
    state.timer.remaining = 1500;
    saveState();
    window.studyBuddyAudio.playSfx('finish');
    showToast('Break finished. Ready for another gentle focus session?');
  }
  renderPage();
}

// Navigation and action buttons.
document.addEventListener('click', event => {
  const pageButton = event.target.closest('[data-page]');
  if (pageButton) { setPage(pageButton.dataset.page); return; }
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) {
    const { action, id } = actionButton.dataset;
    if (action === 'complete-task') completeTask(id);
    if (action === 'delete-task') deleteTask(id);
    if (action === 'timer-start') startTimer();
    if (action === 'timer-pause') pauseTimer();
    if (action === 'timer-reset') resetTimer();
    if (action === 'timer-mode') setTimerMode(actionButton.dataset.mode);
    if (action === 'timer-duration') setTimerDuration(Number(actionButton.dataset.duration));
    if (action === 'buy-decor') buyDecoration(id);
    if (action === 'select-decor') { state.activeDecor = id; saveState(); renderPage(); showToast('Your cottage has a fresh little touch.'); }
    if (action === 'reset-data') {
      if (window.confirm('Reset all Study Buddy progress in this browser? This cannot be undone.')) {
        localStorage.removeItem(STORAGE_KEY);
        state = clone(DEFAULT_STATE);
        window.studyBuddyAudio.stopMusic();
        renderPage();
        showToast('Your study world has been reset.');
      }
    }
    return;
  }
  const filterButton = event.target.closest('[data-filter]');
  if (filterButton) { taskFilter = filterButton.dataset.filter; renderPage(); return; }
  if (event.target.closest('#sound-toggle')) {
    state.settings.music = !state.settings.music;
    if (state.settings.music) window.studyBuddyAudio.startMusic(); else window.studyBuddyAudio.stopMusic();
    saveState();
    showToast(state.settings.music ? 'Cherry Breeze ambience is on. ♫' : 'Ambient music paused.');
  }
});

document.addEventListener('submit', event => {
  if (event.target.id === 'task-form') {
    event.preventDefault();
    addTask(new FormData(event.target));
  }
});

document.addEventListener('change', event => {
  const target = event.target;
  if (target.matches('[data-setting]')) {
    const setting = target.dataset.setting;
    state.settings[setting] = target.checked;
    if (setting === 'music') {
      if (target.checked) window.studyBuddyAudio.startMusic(); else window.studyBuddyAudio.stopMusic();
    }
    saveState();
    showToast(`${setting === 'music' ? 'Ambient music' : 'Sound effects'} ${target.checked ? 'enabled' : 'disabled'}.`);
    renderPage();
  }
  if (target.id === 'volume-control') {
    state.settings.volume = Number(target.value) / 100;
    window.studyBuddyAudio.setOptions(state.settings);
    saveState();
    renderPage();
  }
  if (target.id === 'daily-goal') {
    state.dailyGoal = Number(target.value);
    saveState();
    renderPage();
    showToast(`Daily focus goal set to ${state.dailyGoal} minutes.`);
  }
});

document.addEventListener('input', event => {
  if (event.target.id === 'timer-subject') state.timer.subject = event.target.value;
});

// Keep a timer accurate even when the browser tab is temporarily inactive.
if (state.timer.running && state.timer.endAt) {
  if (state.timer.endAt <= Date.now()) finishTimer();
  else ensureTimerInterval();
}
renderPage();
