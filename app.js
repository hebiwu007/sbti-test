// app.js - SBTI Personality Test Application - v20260417-5

// State
let questions = [];
let personalities = [];
let currentQuestion = 0;
let answers = {};
let lang = localStorage.getItem('sbti_lang') || 'zh';
let testCount = 0;
let questionOrder = []; // 保存题目顺序
let currentPersonality = null; // 当前匹配的人格结果

// ============ API Layer ============
const API_BASE = 'https://api.sbti.solutions';

// 获取或创建 guest_code（唯一保留在本地的标识）
function getGuestCode() {
  let code = localStorage.getItem('sbti_guest_code');
  if (!code) {
    code = 'SBTI-' + generateLocalGuestCode();
    localStorage.setItem('sbti_guest_code', code);
  }
  return code;
}

function generateLocalGuestCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// API 缓存
let _userDataCache = null;
let _userDataCacheTime = 0;
const CACHE_TTL = 30000; // 30秒缓存

// 获取用户所有数据（带缓存和超时）
async function fetchUserData(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && _userDataCache && (now - _userDataCacheTime) < CACHE_TTL) {
    return _userDataCache;
  }
  try {
    const res = await fetchWithRetry(
      `${API_BASE}/api/user/data?guest_code=${encodeURIComponent(getGuestCode())}`,
      {},
      8000 // 8秒超时
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    _userDataCache = data;
    _userDataCacheTime = now;
    return data;
  } catch (e) {
    console.error('fetchUserData error:', e);
    // 如果有缓存，返回缓存数据
    if (_userDataCache) return _userDataCache;
    // 否则返回默认值，不阻塞页面
    return { user_data: { test_count: 0 }, history: [], daily: { answers: {}, streak: 0, last_date: null } };
  }
}

function clearUserDataCache() {
  _userDataCache = null;
  _userDataCacheTime = 0;
}

// 更新用户设置
async function updateUserData(fields) {
  try {
    const res = await fetch(`${API_BASE}/api/user/data`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guest_code: getGuestCode(), ...fields })
    });
    clearUserDataCache();
    return await res.json();
  } catch (e) {
    console.error('updateUserData error:', e);
    return { success: false };
  }
}

// 保存测试历史
async function saveTestHistory(personalityCode, pattern, matchScore, mbtiType, answersData) {
  try {
    const res = await fetch(`${API_BASE}/api/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guest_code: getGuestCode(),
        personality_code: personalityCode,
        pattern: pattern,
        match_score: matchScore,
        mbti_type: mbtiType || null,
        answers: answersData || null
      })
    });
    clearUserDataCache();
    return await res.json();
  } catch (e) {
    console.error('saveTestHistory error:', e);
    return { success: false };
  }
}

// 带重试的 fetch
async function fetchWithRetry(url, options = {}, timeout = 5000, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return res;
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}

// 带超时的 fetch
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return res;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw e;
  }
}

// 获取测试统计
async function fetchTestCount() {
  try {
    const res = await fetch(`${API_BASE}/api/count`);
    return await res.json();
  } catch (e) {
    return { total: 0, today: 0, ranked: 0 };
  }
}

// 获取排行榜
async function fetchLeaderboard(period = 'all', region = '') {
  try {
    let url = `${API_BASE}/api/leaderboard?period=${period}&limit=27`;
    if (region) url += `&region=${region}`;
    const res = await fetch(url);
    return await res.json();
  } catch (e) { return null; }
}

// Model colors
const modelColors = {
  S: '#8B5CF6',  // 自我模型
  E: '#EC4899',  // 情感模型
  A: '#10B981',  // 态度模型
  Ac: '#F59E0B', // 行动驱力模型
  So: '#3B82F6'  // 社交模型
};

// Dimension metadata (defined below at showTypeDetail)

// Dimension metadata (sbti.ai aligned)
const dimensionMeta = {
  'S1': {name: 'S1 自尊自信', model: 'S'},
  'S2': {name: 'S2 自我清晰度', model: 'S'},
  'S3': {name: 'S3 核心价值', model: 'S'},
  'E1': {name: 'E1 依恋安全感', model: 'E'},
  'E2': {name: 'E2 情感投入度', model: 'E'},
  'E3': {name: 'E3 边界与依赖', model: 'E'},
  'A1': {name: 'A1 世界观倾向', model: 'A'},
  'A2': {name: 'A2 规则与灵活度', model: 'A'},
  'A3': {name: 'A3 人生意义感', model: 'A'},
  'Ac1': {name: 'Ac1 动机导向', model: 'Ac'},
  'Ac2': {name: 'Ac2 决策风格', model: 'Ac'},
  'Ac3': {name: 'Ac3 执行模式', model: 'Ac'},
  'So1': {name: 'So1 社交主动性', model: 'So'},
  'So2': {name: 'So2 人际边界感', model: 'So'},
  'So3': {name: 'So3 表达与真实度', model: 'So'}
};

// Convert 15-char pattern to radar values (1:1 mapping now)
function patternToRadarValues(pattern) {
  return pattern.split('').map(v => v === 'H' ? 3 : (v === 'M' ? 2 : 1));
}

// Personality avatars (abstract emoji representation)
const personalityAvatars = {
  'CTRL': '🎯',   // 拿捏者
  'ATM-er': '🏧', // 送钱者
  'Dior-s': '🛋️', // 屌丝
  'BOSS': '👑',   // 领导者
  'THAN-K': '🙏', // 感恩者
  'OH-NO': '😱',  // 哦不人
  'GOGO': '🏃',   // 行者
  'SEXY': '💋',   // 尤物
  'LOVE-R': '💕', // 多情者
  'MUM': '🤱',    // 妈妈
  'FAKE': '🎭',   // 伪人
  'OJBK': '👌',   // 无所谓人
  'MALO': '🐒',   // 吗喽
  'JOKE-R': '🤡', // 小丑
  'WOC!': '😮',   // 握草人
  'THIN-K': '🧠', // 思考者
  'SHIT': '💩',   // 愤世者
  'ZZZZ': '💤',   // 装死者
  'POOR': '🥜',   // 贫困者
  'MONK': '🧘',   // 僧人
  'IMSB': '🤪',   // 傻者
  'SOLO': '🥀',   // 孤儿
  'FUCK': '😤',   // 草者
  'DEAD': '💀',   // 死者
  'IMFW': '🗑️',  // 废物
  'HHHH': '😄',   // 傻乐者
  'DRUNK': '🍺',  // 酒鬼
};

// Get avatar for personality code
function getPersonalityAvatar(code) {
  return personalityAvatars[code] || '🧩';
}

// Format personality display: emoji + code + name
function fmtPersonality(code, opts = {}) {
  const p = personalities.find(pp => pp.code === code);
  const emoji = personalityAvatars[code] || '🧩';
  const name = p ? (lang === 'zh' ? p.name_zh : p.name_en) : code;
  if (opts.short) return `${emoji} ${code}`;
  if (opts.nameOnly) return name;
  return `${emoji} ${code} ${name}`;
}

// Format personality as HTML badge
function fmtPersonalityHTML(code, extraClass = '') {
  const p = personalities.find(pp => pp.code === code);
  const emoji = personalityAvatars[code] || '🧩';
  const name = p ? (lang === 'zh' ? p.name_zh : p.name_en) : code;
  const color = p ? p.color : '#8B5CF6';
  return `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg ${extraClass}" style="background:${color}15;color:${color}">
    <span class="text-lg">${emoji}</span>
    <span class="font-bold text-sm">${code}</span>
    <span class="text-xs opacity-80">${name}</span>
  </span>`;
}

// MBTI types
const mbtiTypes = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP', // NT
  'INFJ', 'INFP', 'ENFJ', 'ENFP', // NF
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', // SJ
  'ISTP', 'ISFP', 'ESTP', 'ESFP'  // SP
];

// MBTI type descriptions
const mbtiDescriptions = {
  'INTJ': { zh: '建筑师', en: 'Architect', color: '#7C3AED' },
  'INTP': { zh: '逻辑学家', en: 'Logician', color: '#8B5CF6' },
  'ENTJ': { zh: '指挥官', en: 'Commander', color: '#6D28D9' },
  'ENTP': { zh: '辩论家', en: 'Debater', color: '#A78BFA' },
  'INFJ': { zh: '提倡者', en: 'Advocate', color: '#10B981' },
  'INFP': { zh: '调停者', en: 'Mediator', color: '#34D399' },
  'ENFJ': { zh: '主人公', en: 'Protagonist', color: '#059669' },
  'ENFP': { zh: '竞选者', en: 'Campaigner', color: '#A7F3D0' },
  'ISTJ': { zh: '物流师', en: 'Logistician', color: '#F59E0B' },
  'ISFJ': { zh: '守卫者', en: 'Defender', color: '#FBBF24' },
  'ESTJ': { zh: '总经理', en: 'Executive', color: '#D97706' },
  'ESFJ': { zh: '执政官', en: 'Consul', color: '#FDE68A' },
  'ISTP': { zh: '鉴赏家', en: 'Virtuoso', color: '#3B82F6' },
  'ISFP': { zh: '探险家', en: 'Adventurer', color: '#60A5FA' },
  'ESTP': { zh: '企业家', en: 'Entrepreneur', color: '#1D4ED8' },
  'ESFP': { zh: '表演者', en: 'Entertainer', color: '#93C5FD' }
};

// Get current MBTI selection (from cache or local fallback)
function getSelectedMBTI() {
  if (_userDataCache?.user_data?.mbti_type) return _userDataCache.user_data.mbti_type;
  return localStorage.getItem('sbti_mbti') || null;
}

// Set MBTI selection
function setSelectedMBTI(mbti) {
  if (mbti) {
    localStorage.setItem('sbti_mbti', mbti); // 本地缓存
  } else {
    localStorage.removeItem('sbti_mbti');
  }
  // 异步同步到数据库
  updateUserData({ mbti_type: mbti || null });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  checkSavedProgress();
  initApp();
});

// Load data
async function loadData() {
  try {
    const [qRes, pRes] = await Promise.all([
      fetch('questions.json'),
      fetch('personalities.json')
    ]);
    questions = (await qRes.json()).questions;
    personalities = (await pRes.json()).personalities;
    testCount = parseInt(localStorage.getItem('sbti_test_count') || '0');
    // 异步从数据库加载真实数据
    fetchUserData().then(data => {
      if (data.user_data?.test_count) {
        testCount = data.user_data.test_count;
        localStorage.setItem('sbti_test_count', testCount.toString());
      }
      // 同步 MBTI
      if (data.user_data?.mbti_type) {
        localStorage.setItem('sbti_mbti', data.user_data.mbti_type);
      }
    }).catch(() => {});
  } catch (e) {
    console.error('Failed to load data:', e);
  }
}

// Check saved progress
function checkSavedProgress() {
  const saved = localStorage.getItem('sbti_progress');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data.answers && Object.keys(data.answers).length > 0) {
        answers = data.answers;
        currentQuestion = data.currentQuestion || 0;
        // 清理无效进度：已完成全部题目则重置
        if (currentQuestion >= questions.length || currentQuestion < 0) {
          currentQuestion = 0;
          answers = {};
          localStorage.removeItem('sbti_progress');
        }
      }
    } catch (e) {
      localStorage.removeItem('sbti_progress');
    }
  }
}

// Save progress
function saveProgress() {
  localStorage.setItem('sbti_progress', JSON.stringify({
    answers,
    currentQuestion,
    timestamp: Date.now()
  }));
}

// Get user button HTML for top-right corner
function getUserButtonHTML() {
  const userStr = localStorage.getItem('sbti_user');
  const user = userStr ? JSON.parse(userStr) : null;
  
  if (user) {
    // 已登录：显示用户名
    const displayName = user.nickname || user.username;
    return `<button onclick="showUserProfile()" class="px-3 py-1 border border-purple-300 rounded-full text-purple-500 hover:bg-purple-50 text-sm flex items-center gap-1">
      <span>👤</span>
      <span class="max-w-[80px] truncate">${displayName}</span>
    </button>`;
  } else {
    // 未登录：显示默认图标
    return `<button onclick="showUserProfile()" class="px-3 py-1 border border-purple-300 rounded-full text-purple-500 hover:bg-purple-50 text-sm">👤</button>`;
  }
}

// Get user header HTML (for sub-pages)
function getUserHeaderHTML(backButton = '', title = '') {
  const userStr = localStorage.getItem('sbti_user');
  const user = userStr ? JSON.parse(userStr) : null;
  
  let userBtn = '';
  if (user) {
    const displayName = user.nickname || user.username;
    userBtn = `<button onclick="showUserProfile()" class="flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-50 hover:bg-purple-100 transition" title="@${user.username}">
      <span class="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center text-sm">${user.avatar || '👤'}</span>
      <span class="text-sm font-medium text-purple-700 max-w-[72px] truncate">${displayName}</span>
    </button>`;
  } else {
    userBtn = `<button onclick="showLoginModal()" class="flex items-center gap-1 px-3 py-1.5 rounded-full border border-purple-200 text-sm text-purple-500 hover:bg-purple-50 transition">👤 ${lang === 'zh' ? '登录' : 'Login'}</button>`;
  }
  
  return `<div class="flex items-center mb-6">${backButton}<h1 class="text-2xl font-bold text-gray-800 flex-1">${title}</h1>${userBtn}</div>`;
}

// Clear progress
function clearProgress() {
  localStorage.removeItem('sbti_progress');
}

// Shuffle questions
function shuffleQuestions() {
  questionOrder = [...Array(questions.length).keys()];
  for (let i = questionOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questionOrder[i], questionOrder[j]] = [questionOrder[j], questionOrder[i]];
  }
}

function initApp() {
  shuffleQuestions();
  // Check for share ref parameter
  const params = new URLSearchParams(window.location.search);
  const refCode = params.get('ref');
  if (refCode && personalities.find(p => p.code === refCode)) {
    renderLanding(refCode);
  } else {
    renderLanding();
  }
}
