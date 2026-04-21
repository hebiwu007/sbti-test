// app.js - SBTI Personality Test Application
// Cache-bust: 2026-04-17T22:00:00+08:00

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

// 带超时的fetch封装
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
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

// 带重试的fetch
async function fetchWithRetry(url, options = {}, timeoutMs = 8000, retries = 1) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetchWithTimeout(url, options, timeoutMs);
      if (res.status === 503 && i < retries) {
        await new Promise(r => setTimeout(r, 500 * (i + 1)));
        continue;
      }
      return res;
    } catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }
}

// 获取每日测试数据
async function fetchDailyMy() {
  try {
    const res = await fetchWithTimeout(`${API_BASE}/api/daily/my?guest_code=${encodeURIComponent(getGuestCode())}`, {}, 8000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('fetchDailyMy error:', e);
    return { answers: {}, streak: 0, last_date: null };
  }
}

// 获取历史记录
async function fetchHistory() {
  const data = await fetchUserData(true);
  return data.history || [];
}

// 获取测试次数（个人）
async function fetchTestCount() {
  const data = await fetchUserData(true);
  return data.user_data?.test_count || 0;
}

// 加载全局测试计数
async function loadGlobalCount() {
  try {
    const res = await fetchWithRetry(`${API_BASE}/api/count`, {}, 5000, 1);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    
    testCount = data.total || 0;
    const countEl = document.getElementById('global-count');
    if (countEl) {
      countEl.textContent = testCount.toLocaleString();
    }
    return testCount;
  } catch (e) {
    console.error('loadGlobalCount error:', e);
    const cached = parseInt(localStorage.getItem('sbti_test_count') || '0');
    testCount = cached;
    const countEl = document.getElementById('global-count');
    if (countEl) {
      countEl.textContent = cached.toLocaleString();
    }
    return cached;
  }
}

// Dimension mapping (matching questions.json)
// 15 dimensions (sbti.ai aligned)
const dimensionOrder = [
  'S1', 'S2', 'S3',
  'E1', 'E2', 'E3',
  'A1', 'A2', 'A3',
  'Ac1', 'Ac2', 'Ac3',
  'So1', 'So2', 'So3'
];

// Model colors
const modelColors = {
  S: '#8B5CF6',  // 自我模型
  E: '#EC4899',  // 情感模型
  A: '#10B981',  // 态度模型
  Ac: '#F59E0B', // 行动驱力模型
  So: '#3B82F6'  // 社交模型
};

// Dimension to model mapping (defined below at showTypeDetail)

// Dimension metadata (sbti.ai aligned)
const dimensionMeta = {
  'S1': {name_zh: 'S1 自尊自信', name_en: 'S1 Self Esteem', model: 'S'},
  'S2': {name_zh: 'S2 自我清晰度', name_en: 'S2 Self Clarity', model: 'S'},
  'S3': {name_zh: 'S3 核心价值', name_en: 'S3 Core Values', model: 'S'},
  'E1': {name_zh: 'E1 依恋安全感', name_en: 'E1 Attachment Security', model: 'E'},
  'E2': {name_zh: 'E2 情感投入度', name_en: 'E2 Emotional Investment', model: 'E'},
  'E3': {name_zh: 'E3 边界与依赖', name_en: 'E3 Boundaries', model: 'E'},
  'A1': {name_zh: 'A1 世界观倾向', name_en: 'A1 Worldview', model: 'A'},
  'A2': {name_zh: 'A2 规则与灵活度', name_en: 'A2 Rules Flexibility', model: 'A'},
  'A3': {name_zh: 'A3 人生意义感', name_en: 'A3 Sense of Purpose', model: 'A'},
  'Ac1': {name_zh: 'Ac1 动机导向', name_en: 'Ac1 Motivation', model: 'Ac'},
  'Ac2': {name_zh: 'Ac2 决策风格', name_en: 'Ac2 Decision Style', model: 'Ac'},
  'Ac3': {name_zh: 'Ac3 执行模式', name_en: 'Ac3 Execution', model: 'Ac'},
  'So1': {name_zh: 'So1 社交主动性', name_en: 'So1 Social Initiative', model: 'So'},
  'So2': {name_zh: 'So2 人际边界感', name_en: 'So2 Interpersonal Boundaries', model: 'So'},
  'So3': {name_zh: 'So3 表达与真实度', name_en: 'So3 Expression', model: 'So'}
};

// Convert 15-char pattern to radar values (1:1 mapping now)
function patternToRadarValues(pattern) {
  return pattern.split('').map(v => v === 'H' ? 3 : (v === 'M' ? 2 : 1));
}

// Convert numeric radar value back to label
function radarValueToLabel(val) {
  return val >= 3 ? 'H' : (val >= 2 ? 'M' : 'L');
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
        // 恢复题目顺序，如果没有则重新生成
        if (data.questionOrder && data.questionOrder.length > 0) {
          questionOrder = data.questionOrder;
        } else {
          shuffleQuestions();
        }
        // 清理无效进度：已完成全部题目则重置
        if (currentQuestion >= questions.length || currentQuestion < 0) {
          currentQuestion = 0;
          answers = {};
          questionOrder = [];
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
    questionOrder,
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

// Clear progress
function clearProgress() {
  localStorage.removeItem('sbti_progress');
  questionOrder = [];
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
  // Force SW update on every page load
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'FORCE_UPDATE' });
  }
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

// Language toggle
// Track current page for language toggle
let currentPage = 'landing';
let currentPageParams = null;

function toggleLang() {
  lang = lang === 'zh' ? 'en' : 'zh';
  localStorage.setItem('sbti_lang', lang);
  
  // Re-render current page based on tracked state
  switch(currentPage) {
    case 'landing':
      renderLanding();
      break;
    case 'quiz':
      renderQuiz();
      break;
    case 'result':
      const personality = currentPersonality || findMatchedPersonality();
      if (personality) renderResult(personality);
      else renderLanding();
      break;
    case 'typeGuide':
      showTypeGuide(currentPageParams);
      break;
    case 'leaderboard':
      showLeaderboard(currentPageParams?.period, currentPageParams?.region);
      break;
    case 'typeRankings':
      showTypeRankings(currentPageParams);
      break;
    case 'userProfile':
      showUserProfile();
      break;
    case 'dailyQuiz':
      showDailyQuiz();
      break;
    default:
      renderLanding();
  }
}

// Get translation
function t(key) {
  return i18n[lang][key] || key;
}

// Render landing page
// 通用右上角用户按钮 - 所有页面通用
function getUserHeaderHTML(backBtn = '', title = '') {
  const user = JSON.parse(localStorage.getItem('sbti_user') || 'null');
  const userBtn = user
    ? `<button onclick="showUserProfile()" class="flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-50 hover:bg-purple-100 transition" title="@${user.username}">
        <span class="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center text-sm">${user.avatar || '👤'}</span>
        <span class="text-sm font-medium text-purple-700 max-w-[72px] truncate">${user.nickname || user.username}</span>
      </button>`
    : `<button onclick="showLoginModal()" class="flex items-center gap-1 px-3 py-1.5 rounded-full border border-purple-200 text-sm text-purple-500 hover:bg-purple-50 transition">👤 ${lang === 'zh' ? '登录' : 'Login'}</button>`;
  return `<div class="flex items-center justify-between mb-4">${backBtn}<span class="text-lg font-bold text-gray-800">${title}</span>${userBtn}</div>`;
}

function renderLanding(refCode) {
  currentPage = 'landing';
  currentPageParams = refCode || null;
  
  const app = document.getElementById('app');
  
  // Build referral preview if coming from share link
  let refPreview = '';
  if (refCode) {
    const refP = personalities.find(p => p.code === refCode);
    if (refP) {
      const emojiMap = {'CTRL':'🎯','BOSS':'👑','SHIT':'😒','PEACE':'🕊️','CARE':'🤗','LONE':'🐺','FUN':'🎉','DEEP':'🌌','REAL':'💎','GHOST':'👻','WARM':'☀️','EDGE':'🗡️','SAGE':'🧙','WILD':'🐆','COOL':'😎','SOFT':'🍬','SHARP':'⚡','DREAM':'💭','LOGIC':'🤖','SPARK':'✨','FLOW':'🌊','ROOT':'🌳','SKY':'☁️','FREE':'🦋','DARK':'🌑','STAR':'⭐','ECHO':'🔊'};
      const emoji = emojiMap[refCode] || '💫';
      const name = lang === 'zh' ? refP.name_zh : refP.name_en;
      const tagline = lang === 'zh' ? refP.tagline_zh : refP.tagline_en;
      refPreview = `
        <div class="bg-white rounded-2xl p-4 shadow-lg mb-6 border-2" style="border-color:${refP.color}40">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-full flex items-center justify-center text-2xl" style="background:${refP.color}20;border:2px solid ${refP.color}">${emoji}</div>
            <div class="text-left">
              <div class="text-sm text-gray-500">${lang === 'zh' ? '你的朋友获得了' : 'Your friend got'}</div>
              <div class="font-bold text-lg" style="color:${refP.color}">${refCode} — ${name}</div>
              <div class="text-sm text-gray-400">${tagline}</div>
            </div>
          </div>
        </div>`;
    }
  }
  
  // Check if user has history for showing history button
  const localHistory = JSON.parse(localStorage.getItem('sbti_history') || '[]');
  const hasHistory = localHistory.length > 0 || (_userDataCache?.history?.length > 0);
  
  app.innerHTML = `
    <div class="min-h-screen flex flex-col items-center px-4 bg-gradient-to-b from-cream to-white pb-8">
      <div class="text-center max-w-md mx-auto w-full pt-8">
        ${getUserHeaderHTML('', '')}
        ${refPreview}
        <h1 class="text-4xl md:text-5xl font-bold text-purple-600 mb-2">${t('app_title')}</h1>
        <p class="text-lg md:text-xl text-gray-500 mb-6">${t('app_subtitle')}</p>
        
        <!-- Hero CTA -->
        <button onclick="startQuiz()" class="w-full px-8 py-4 md:px-10 md:py-5 bg-purple-600 text-white rounded-full text-lg md:text-xl font-medium hover:bg-purple-700 transition shadow-lg hover:shadow-xl transform hover:-translate-y-1 active:scale-95 mb-3">
          ${t('start_btn')}
        </button>
        <p class="mb-6 text-gray-400 text-sm">
          ${t('test_count_prefix')}<span class="font-bold text-purple-500" id="global-count">${testCount.toLocaleString()}</span>${t('test_count_suffix')}
        </p>
        
        <!-- Feature Grid -->
        <div class="grid grid-cols-2 gap-3 mb-6">
          <button onclick="showTypeGuide()" class="flex flex-col items-center p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100">
            <span class="text-3xl mb-2">📖</span>
            <span class="font-medium text-gray-700 text-sm">${t('type_guide')}</span>
            <span class="text-xs text-gray-400 mt-1">${personalities.length} ${t('type_guide_count')}</span>
          </button>
          <button onclick="showDailyQuiz()" class="flex flex-col items-center p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100">
            <span class="text-3xl mb-2">🎯</span>
            <span class="font-medium text-gray-700 text-sm">${t('daily_quiz')}</span>
            <span class="text-xs text-gray-400 mt-1">${lang === 'zh' ? '每日一题' : 'Daily question'}</span>
          </button>
          <button onclick="showLeaderboard()" class="flex flex-col items-center p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100">
            <span class="text-3xl mb-2">🏆</span>
            <span class="font-medium text-gray-700 text-sm">${t('leaderboard')}</span>
            <span class="text-xs text-gray-400 mt-1">${lang === 'zh' ? '全球排名' : 'Global rank'}</span>
          </button>
          <button onclick="showComparison()" class="flex flex-col items-center p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100">
            <span class="text-3xl mb-2">👥</span>
            <span class="font-medium text-gray-700 text-sm">${lang === 'zh' ? '人格对比' : 'Compare'}</span>
            <span class="text-xs text-gray-400 mt-1">${lang === 'zh' ? '与好友对比' : 'Compare w/ friends'}</span>
          </button>
          <button onclick="${hasHistory ? 'showHistoryComparison()' : 'startQuiz()'}" class="flex flex-col items-center p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100 ${!hasHistory ? 'opacity-60' : ''}">
            <span class="text-3xl mb-2">📊</span>
            <span class="font-medium text-gray-700 text-sm">${t('history_compare') || (lang === 'zh' ? '历史对比' : 'History')}</span>
            <span class="text-xs text-gray-400 mt-1">${hasHistory ? (lang === 'zh' ? '查看变化' : 'View changes') : (lang === 'zh' ? '先测一次' : 'Test first')}</span>
          </button>
          <button onclick="showMBTIIntersection()" class="flex flex-col items-center p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100">
            <span class="text-3xl mb-2">🧠</span>
            <span class="font-medium text-gray-700 text-sm">${t('mbti_cross')}</span>
            <span class="text-xs text-gray-400 mt-1">MBTI × SBTI</span>
          </button>
          <button onclick="showUserProfile()" class="flex flex-col items-center p-4 bg-white rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100">
            <span class="text-3xl mb-2">👤</span>
            <span class="font-medium text-gray-700 text-sm">${lang === 'zh' ? '我的' : 'Profile'}</span>
            <span class="text-xs text-gray-400 mt-1">${lang === 'zh' ? '数据管理' : 'My data'}</span>
          </button>
        </div>
        
        <!-- Bottom links -->
        <a href="privacy.html" class="inline-block text-gray-400 hover:text-purple-500 text-sm">${t('privacy_link')}</a>
        <p class="text-xs text-gray-300 mt-3 leading-relaxed">${lang === 'zh' ? '⚠️ 本测试仅供娱乐，别拿它当诊断、面试、相亲、分手、招魂、算命或人生判决书。你可以笑，但别太当真。基于五大模型十五维度交叉计算，结果仅供参考与娱乐。' : '⚠️ For entertainment only. Don\'t use it for diagnosis, job interviews, dating, breakups, séances, fortune telling, or life sentences. You can laugh, but don\'t take it too seriously.'}</p>
      </div>
      <div class="fixed top-4 right-4">
        <button onclick="toggleLang()" class="px-3 py-1 border border-purple-300 rounded-full text-purple-500 hover:bg-purple-50 text-sm">
          ${lang === 'zh' ? 'EN' : '中文'}
        </button>
      </div>
    </div>
  `;
  // Load global test count with cold-start mock data
  loadGlobalCount();
}

// Get today's date string in local timezone (YYYY-MM-DD)
// Show personality type guide (sbti.ai/types style)
async function showTypeGuide(filterCode) {
  currentPage = 'typeGuide';
  currentPageParams = filterCode || null;
  
  const app = document.getElementById('app');
  
  // 确保 personalities 数据已加载
  if (!personalities || personalities.length === 0) {
    app.innerHTML = `
      <div class="min-h-screen bg-gradient-to-b from-cream to-white flex items-center justify-center">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p class="text-gray-600">${lang === 'zh' ? '加载中...' : 'Loading...'}</p>
        </div>
      </div>
    `;
    // 等待数据加载
    await loadData();
    // 重新渲染
    showTypeGuide(filterCode);
    return;
  }
  
  if (filterCode) {
    // Show detail for a specific type
    showTypeDetail(filterCode);
    return;
  }
  
  // Sort: NORMAL_TYPES first (by code), then HHHH, then DRUNK
  const sorted = [...personalities].sort((a, b) => {
    if (a.code === 'DRUNK') return 1;
    if (b.code === 'DRUNK') return -1;
    if (a.code === 'HHHH') return 1;
    if (b.code === 'HHHH') return -1;
    return a.code.localeCompare(b.code);
  });
  
  app.innerHTML = `
    <div class="min-h-screen bg-gradient-to-b from-cream to-white">
      <div class="max-w-lg mx-auto px-4 py-6">
        ${getUserHeaderHTML(`<button onclick="renderLanding()" class="text-purple-600 mr-2">←</button>`, t('type_guide'))}
        <div class="text-center mb-6">
          <h1 class="text-2xl font-bold text-purple-600 mb-2">${t('type_guide_subtitle')}</h1>
          <p class="text-sm text-gray-500">${t('type_guide_desc')}</p>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          ${sorted.map(p => {
            const emoji = personalityAvatars[p.code] || '🧩';
            const name = lang === 'zh' ? p.name_zh : p.name_en;
            const intro = lang === 'zh' ? p.tagline_zh : p.tagline_en;
            const pattern = p.pattern || '';
            // Dimension mini bar
            const dims = pattern.split('').slice(0, 15);
            const dimBar = dims.map(v => {
              const c = v === 'H' ? '#8B5CF6' : (v === 'M' ? '#A78BFA' : '#DDD6FE');
              return `<span style="display:inline-block;width:8px;height:14px;background:${c};border-radius:2px;"></span>`;
            }).join('');
            return `
              <button onclick="showTypeGuide('${p.code}')" class="bg-white rounded-2xl p-3 shadow-sm hover:shadow-md transition border border-gray-100 text-left group">
                <div class="flex items-center gap-2 mb-2">
                  <div class="w-10 h-10 rounded-full flex items-center justify-center text-xl" style="background:${p.color}20;border:2px solid ${p.color}">
                    ${emoji}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-bold text-sm" style="color:${p.color}">${p.code}</div>
                    <div class="text-xs text-gray-600 truncate">${name}</div>
                  </div>
                </div>
                <div class="text-xs text-gray-400 mb-2 line-clamp-1">${intro}</div>
                <div class="flex gap-0.5">${dimBar}</div>
              </button>`;
          }).join('')}
        </div>
        <button onclick="toggleLang()" class="fixed top-4 right-4 px-3 py-1 border border-purple-300 rounded-full text-purple-500 hover:bg-purple-50 text-sm">
          ${lang === 'zh' ? 'EN' : '中文'}
        </button>
      </div>
    </div>
  `;
}

// Show detail for a specific personality type
function showTypeDetail(code) {
  const p = personalities.find(pp => pp.code === code);
  if (!p) { showTypeGuide(); return; }
  
  const app = document.getElementById('app');
  const emoji = personalityAvatars[p.code] || '🧩';
  const name = lang === 'zh' ? p.name_zh : p.name_en;
  const intro = lang === 'zh' ? p.tagline_zh : p.tagline_en;
  const desc = lang === 'zh' ? p.desc_zh : p.desc_en;
  const pattern = p.pattern || '';
  const dims = pattern.split('').slice(0, 15);
  
  // Dimension details
  const dimDetails = dimensionOrder.map((dim, i) => {
    const level = dims[i] || 'M';
    const meta = dimensionMeta[dim];
    const modelColor = getModelForDim(dim);
    const levelColor = level === 'H' ? '#8B5CF6' : (level === 'M' ? '#A78BFA' : '#DDD6FE');
    const levelText = level === 'H' ? (lang === 'zh' ? '高' : 'High') : (level === 'M' ? (lang === 'zh' ? '中' : 'Mid') : (lang === 'zh' ? '低' : 'Low'));
    // Get dimension name from i18n instead of hardcoded Chinese
    const dimNames = {
      'S1': lang === 'zh' ? '自尊自信' : 'Self Esteem',
      'S2': lang === 'zh' ? '自我清晰度' : 'Self Clarity',
      'S3': lang === 'zh' ? '核心价值' : 'Core Values',
      'E1': lang === 'zh' ? '依恋安全感' : 'Attachment Security',
      'E2': lang === 'zh' ? '情感投入度' : 'Emotional Investment',
      'E3': lang === 'zh' ? '边界与依赖' : 'Boundaries',
      'A1': lang === 'zh' ? '世界观倾向' : 'Worldview',
      'A2': lang === 'zh' ? '规则与灵活度' : 'Rules Flexibility',
      'A3': lang === 'zh' ? '人生意义感' : 'Sense of Purpose',
      'Ac1': lang === 'zh' ? '动机导向' : 'Motivation',
      'Ac2': lang === 'zh' ? '决策风格' : 'Decision Style',
      'Ac3': lang === 'zh' ? '执行模式' : 'Execution',
      'So1': lang === 'zh' ? '社交主动性' : 'Social Initiative',
      'So2': lang === 'zh' ? '人际边界感' : 'Interpersonal Boundaries',
      'So3': lang === 'zh' ? '表达与真实度' : 'Expression'
    };
    const dimName = dimNames[dim] || dim;
    const modelNames = {
      'S': lang === 'zh' ? '自我' : 'Self',
      'E': lang === 'zh' ? '情感' : 'Emotional',
      'A': lang === 'zh' ? '态度' : 'Attitude',
      'Ac': lang === 'zh' ? '行动' : 'Action',
      'So': lang === 'zh' ? '社交' : 'Social'
    };
    const modelName = modelNames[meta.model] || meta.model;
    return `
      <div class="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
        <div class="w-16 text-xs font-medium" style="color:${modelColor}">${modelName}</div>
        <div class="flex-1">
          <div class="text-xs text-gray-500">${dimName}</div>
        </div>
        <div class="flex items-center gap-1">
          <span class="inline-block w-8 h-5 rounded-full text-xs font-bold flex items-center justify-center text-white" style="background:${levelColor}">${level}</span>
          <span class="text-xs text-gray-400">${levelText}</span>
        </div>
      </div>`;
  }).join('');
  
  // Strengths and blind spots
  const strengths = (lang === 'zh' ? p.strengths_zh : p.strengths_en) || [];
  const blindSpots = (lang === 'zh' ? p.blind_spots_zh : p.blind_spots_en) || [];
  
  app.innerHTML = `
    <div class="min-h-screen bg-gradient-to-b from-cream to-white">
      <div class="max-w-md mx-auto px-4 py-6">
        ${getUserHeaderHTML(`<button onclick="showTypeGuide()" class="text-purple-600 mr-2">←</button>`, p.code)}
        
        <!-- Type header -->
        <div class="text-center mb-6">
          <div class="inline-flex items-center justify-center w-20 h-20 rounded-full text-3xl mb-4" style="background-color: ${p.color}20; border: 2px solid ${p.color}">
            ${emoji}
          </div>
          <h1 class="text-4xl font-bold mb-1" style="color: ${p.color}">${p.code}</h1>
          <h2 class="text-xl text-gray-700 mb-2">${name}</h2>
          <p class="text-base text-gray-500 italic">\"${intro}\"</p>
        </div>
        
        <!-- Description -->
        <div class="bg-white rounded-2xl p-5 shadow-lg mb-4">
          <h3 class="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wide">${t('type_desc')}</h3>
          <p class="text-gray-700 leading-relaxed text-sm">${desc}</p>
        </div>
        
        <!-- Dimensions -->
        <div class="bg-white rounded-2xl p-5 shadow-lg mb-4">
          <h3 class="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wide">${t('type_pattern')}</h3>
          <div class="flex gap-1 mb-4 justify-center">
            ${dims.map(v => {
              const c = v === 'H' ? '#8B5CF6' : (v === 'M' ? '#A78BFA' : '#DDD6FE');
              return `<span style="display:inline-block;width:20px;height:32px;background:${c};border-radius:4px;"></span>`;
            }).join('<span style="width:4px;display:inline-block;"></span>')}
          </div>
          <div class="space-y-0">
            ${dimDetails}
          </div>
        </div>
        
        <!-- Strengths and Blind spots -->
        ${strengths.length || blindSpots.length ? `
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div class="bg-white rounded-2xl p-4 shadow-lg">
            <h4 class="font-bold text-green-600 mb-3 text-sm">${t('strengths')}</h4>
            <ul class="space-y-2">
              ${strengths.map(s => `<li class="text-gray-600 text-xs">✓ ${s}</li>`).join('')}
            </ul>
          </div>
          <div class="bg-white rounded-2xl p-4 shadow-lg">
            <h4 class="font-bold text-red-500 mb-3 text-sm">${t('blind_spots')}</h4>
            <ul class="space-y-2">
              ${blindSpots.map(s => `<li class="text-gray-600 text-xs">✗ ${s}</li>`).join('')}
            </ul>
          </div>
        </div>` : ''}
        
        <button onclick="startQuiz()" class="w-full py-3 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition mb-3">
          ${lang === 'zh' ? '测测我的SBTI' : 'Take the Test'}
        </button>
      </div>
      <button onclick="toggleLang()" class="fixed top-4 right-4 px-3 py-1 border border-purple-300 rounded-full text-purple-500 hover:bg-purple-50 text-sm">
        ${lang === 'zh' ? 'EN' : '中文'}
      </button>
    </div>
  `;
}

// Helper: get model color for dimension
function getModelForDim(dim) {
  if (dim.startsWith('Ac')) return modelColors.Ac;
  if (dim.startsWith('So')) return modelColors.So;
  if (dim.startsWith('S')) return modelColors.S;
  if (dim.startsWith('E')) return modelColors.E;
  if (dim.startsWith('A')) return modelColors.A;
  return '#8B5CF6';
}

function getLocalDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Show daily quiz
async function showDailyQuiz() {
  currentPage = 'dailyQuiz';
  currentPageParams = null;
  
  // 显示加载模态框
  const loadingModal = document.createElement('div');
  loadingModal.id = 'dailyQuizLoading';
  loadingModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
  loadingModal.innerHTML = `
    <div class="bg-white rounded-2xl p-8 text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
      <p class="text-gray-600">${lang === 'zh' ? '加载中...' : 'Loading...'}</p>
    </div>
  `;
  document.body.appendChild(loadingModal);

  try {
    // 获取今日题目ID（基于本地日期）
    const today = getLocalDate();
    const todaySeed = parseInt(today.replace(/-/g, '')) % questions.length;
    const dailyQuestion = questions[todaySeed];
    
    // 获取用户今日答案
    let dailyAnswers = JSON.parse(localStorage.getItem('sbti_daily_answers') || '{}');
    let localStreak = parseInt(localStorage.getItem('sbti_daily_streak') || '0');
    
    // 异步从数据库获取最新每日数据（不阻塞渲染）
    fetchDailyMy().then(dailyData => {
      if (dailyData.answers && Object.keys(dailyData.answers).length > 0) {
        localStorage.setItem('sbti_daily_answers', JSON.stringify(dailyData.answers));
        dailyAnswers = dailyData.answers;
      }
      if (dailyData.streak) {
        localStorage.setItem('sbti_daily_streak', dailyData.streak.toString());
        localStreak = dailyData.streak;
      }
    }).catch(() => {});
    
    const todayAnswer = dailyAnswers[today];
    
    // 获取真实统计数据（带 fallback 和超时）
    let stats;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时
      
      const res = await fetch(`${API_BASE}/api/daily/stats?date=${today}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      const data = await res.json();
      if (data.distribution && data.distribution.length > 0) {
        stats = {
          total: data.total || 0,
          distribution: data.distribution.map(d => ({
            option: d.answer, count: d.count, percent: 0
          })),
          streak: localStreak
        };
      } else {
        stats = {
          total: data.total || 0,
          distribution: [
            { option: 'A', count: 0, percent: 0 },
            { option: 'B', count: 0, percent: 0 },
            { option: 'C', count: 0, percent: 0 }
          ],
          streak: localStreak
        };
      }
    } catch (e) {
      // 使用本地缓存或空数据
      stats = {
        total: 0,
        distribution: [
          { option: 'A', count: 0, percent: 0 },
          { option: 'B', count: 0, percent: 0 },
          { option: 'C', count: 0, percent: 0 }
        ],
        streak: localStreak
      };
    }
    
    // 计算百分比
    const totalCount = stats.distribution.reduce((sum, d) => sum + d.count, 0);
    stats.distribution.forEach(d => {
      d.percent = totalCount > 0 ? Math.round((d.count / totalCount) * 100) : 0;
    });
    
    // 移除加载模态框
    const loadingEl = document.getElementById('dailyQuizLoading');
    if (loadingEl) loadingEl.remove();
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto';
    modal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-auto">
      <div class="p-6">
        <div class="flex justify-between items-center mb-6">
          <div>
            <h2 class="text-2xl font-bold text-purple-600">${t('daily_quiz')}</h2>
            <p class="text-gray-500 text-sm mt-1">${today}</p>
          </div>
          <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 text-2xl">
            ✕
          </button>
        </div>
        
        ${todayAnswer ? `
          <!-- 已参与 -->
          <div class="mb-6">
            <!-- 显示今日题目 -->
            <div class="bg-gray-50 rounded-xl p-4 mb-4">
              <p class="text-gray-800 font-medium">${lang === 'en' && dailyQuestion.text_en ? dailyQuestion.text_en : dailyQuestion.text}</p>
            </div>
            <div class="bg-green-50 border border-green-200 rounded-xl p-5 mb-4">
              <div class="flex items-center">
                <div class="text-green-500 text-2xl mr-3">✓</div>
                <div>
                  <h3 class="font-bold text-green-700">${t('already_answered')}</h3>
                  <p class="text-green-600 text-sm">${lang === 'zh' ? '你的答案' : 'Your answer'}: <span class="font-bold">${(() => { const opts = lang === 'en' && dailyQuestion.options_en ? dailyQuestion.options_en : dailyQuestion.options; const ansVal = Number(todayAnswer) || todayAnswer; const ansIdx = opts.findIndex(o => Number(o.value) === Number(ansVal)); return (ansIdx >= 0 ? 'ABC'[ansIdx] : String(todayAnswer)) + '. ' + (opts.find(o => Number(o.value) === Number(ansVal))?.label || ''); })()}</span></p>
                </div>
              </div>
            </div>
          </div>
        ` : `
          <!-- 今日题目 -->
          <div class="mb-6">
            <h3 class="text-lg font-bold text-gray-800 mb-4">${t('daily_quiz_title')}</h3>
            <p class="text-gray-700 leading-relaxed mb-6">${lang === 'en' && dailyQuestion.text_en ? dailyQuestion.text_en : dailyQuestion.text}</p>
            
            <div class="space-y-3 mb-6">
              ${(lang === 'en' && dailyQuestion.options_en ? dailyQuestion.options_en : dailyQuestion.options).map((opt, idx) => `
                <button 
                  onclick="selectDailyOption(this, ${opt.value})"
                  data-option="${opt.value}"
                  class="w-full p-4 border-2 border-gray-200 rounded-xl text-left hover:border-purple-400 hover:bg-purple-50 transition flex items-center justify-between"
                >
                  <div>
                    <div class="font-medium text-gray-800">${'ABC'[idx] || (idx+1)}. ${opt.label}</div>
                  </div>
                  <div class="w-6 h-6 rounded-full border-2 border-gray-300 daily-opt-circle"></div>
                </button>
              `).join('')}
              <button id="dailySubmitBtn" onclick="submitSelectedDaily('${today}')" disabled class="w-full py-3 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition mt-4 disabled:opacity-50 disabled:cursor-not-allowed">${lang === 'zh' ? '提交答案' : 'Submit Answer'}</button>
            </div>
          </div>
        `}
        
        <!-- 统计数据 -->
        <div class="bg-gray-50 rounded-xl p-5 mb-4">
          <h3 class="font-bold text-gray-800 mb-4">${t('daily_stats')}</h3>
          
          <div class="space-y-4">
            <div>
              <div class="flex justify-between text-sm text-gray-600 mb-1">
                <span>${t('total_participants')}</span>
                <span class="font-bold">${stats.total} ${t('people_answered')}</span>
              </div>
            </div>
            
            <div>
              <div class="flex justify-between text-sm text-gray-600 mb-2">
                <span>${t('streak_days')}</span>
                <span class="font-bold text-purple-600">${stats.streak}</span>
              </div>
            </div>
            
            <div>
              <h4 class="text-sm font-medium text-gray-600 mb-2">${t('answer_distribution')}</h4>
              <div class="space-y-2">
                ${stats.distribution.map(d => {
                  const opts = lang === 'en' && dailyQuestion.options_en ? dailyQuestion.options_en : dailyQuestion.options;
                  const opt = opts.find(o => Number(o.value) === Number(d.option));
                  const optText = opt ? opt.label : String(d.option);
                  const optIdx = opt ? opts.indexOf(opt) : -1;
                  const optLetter = optIdx >= 0 ? 'ABC'[optIdx] : String(d.option);
                  const optColor = optIdx === 0 ? 'bg-blue-500' : optIdx === 1 ? 'bg-green-500' : 'bg-purple-500';
                  return `
                  <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${optColor}">${optLetter}</div>
                    <div class="flex-1">
                      <div class="text-xs text-gray-700 mb-1">${optText}</div>
                      <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div class="h-full rounded-full ${optColor}" style="width: ${d.percent}%"></div>
                      </div>
                    </div>
                    <div class="w-12 text-right text-sm font-medium text-gray-600">${d.percent}%</div>
                  </div>`;
                }).join('')}
              </div>
            </div>
          </div>
        </div>
        
        <div class="text-center space-y-3">
          <button 
            onclick="this.closest('.fixed').remove()"
            class="w-full px-6 py-3 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition"
          >
            ${todayAnswer ? t('close') : t('cancel')}
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  } catch (e) {
    // 移除加载模态框
    const loadingEl = document.getElementById('dailyQuizLoading');
    if (loadingEl) loadingEl.remove();
    
    console.error('Daily quiz error:', e);
    
    // 显示错误提示
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl max-w-md w-full p-6 text-center">
        <div class="text-4xl mb-4">⚠️</div>
        <h2 class="text-xl font-bold text-gray-800 mb-2">${lang === 'zh' ? '加载失败' : 'Loading Failed'}</h2>
        <p class="text-gray-500 mb-6">${lang === 'zh' ? '每日一测加载失败，请稍后重试' : 'Failed to load daily quiz, please try again later'}</p>
        <button onclick="this.closest('.fixed').remove()" class="w-full py-3 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition">${lang === 'zh' ? '关闭' : 'Close'}</button>
      </div>
    `;
    document.body.appendChild(modal);
  }
}

// Show trend analysis modal
function showTrendAnalysis() {
  try {
    const dailyAnswers = JSON.parse(localStorage.getItem('sbti_daily_answers') || '{}');
    const dates = Object.keys(dailyAnswers).sort();
    
    if (dates.length < 7) {
      alert(lang === 'zh' ? `需要至少7天数据才能生成趋势分析（当前${dates.length}天）` : `Need at least 7 days of data (currently ${dates.length})`);
      return;
    }
    
    // 计算每日的模型维度倾向（简化版：基于选项映射到维度）
    const dailyPatterns = dates.map(date => {
      const answer = dailyAnswers[date];
      // 简化映射：A=H(高), B=M(中), C=L(低)
      const valueMap = { 'A': 2, 'B': 1, 'C': 0 };
      return {
        date,
        value: valueMap[answer] ?? 1,
        answer
      };
    });
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-auto">
        <div class="p-6">
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold text-purple-600">${lang === 'zh' ? '📈 30天趋势分析' : '📈 30-Day Trend'}</h2>
            <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
          </div>
          
          <div class="mb-4">
            <p class="text-sm text-gray-500">${lang === 'zh' ? '已连续参与' : 'Streak'}: <span class="font-bold text-purple-600">${dates.length}</span> ${lang === 'zh' ? '天' : 'days'}</p>
          </div>
          
          <!-- 趋势图表 -->
          <div class="bg-gray-50 rounded-xl p-4 mb-4">
            <canvas id="trendChart" width="300" height="150" class="w-full"></canvas>
          </div>
          
          <!-- 统计摘要 -->
          <div class="grid grid-cols-3 gap-3 mb-4">
            <div class="text-center p-3 bg-blue-50 rounded-lg">
              <div class="text-2xl font-bold text-blue-600">${dailyPatterns.filter(d => d.answer === 'A').length}</div>
              <div class="text-xs text-blue-700">${lang === 'zh' ? '选A天数' : 'A Days'}</div>
            </div>
            <div class="text-center p-3 bg-green-50 rounded-lg">
              <div class="text-2xl font-bold text-green-600">${dailyPatterns.filter(d => d.answer === 'B').length}</div>
              <div class="text-xs text-green-700">${lang === 'zh' ? '选B天数' : 'B Days'}</div>
            </div>
            <div class="text-center p-3 bg-purple-50 rounded-lg">
              <div class="text-2xl font-bold text-purple-600">${dailyPatterns.filter(d => d.answer === 'C').length}</div>
              <div class="text-xs text-purple-700">${lang === 'zh' ? '选C天数' : 'C Days'}</div>
            </div>
          </div>
          
          <!-- 最近7天记录 -->
          <div class="space-y-2 max-h-40 overflow-y-auto">
            <h3 class="font-bold text-gray-700 text-sm">${lang === 'zh' ? '最近记录' : 'Recent'}</h3>
            ${dailyPatterns.slice(-7).reverse().map(d => `
              <div class="flex justify-between text-sm py-1 border-b border-gray-100">
                <span class="text-gray-500">${d.date}</span>
                <span class="font-medium ${d.answer === 'A' ? 'text-blue-600' : d.answer === 'B' ? 'text-green-600' : 'text-purple-600'}">${d.answer}</span>
              </div>
            `).join('')}
          </div>
          
          <button onclick="this.closest('.fixed').remove()" class="w-full mt-4 py-3 bg-purple-600 text-white rounded-full font-medium">${lang === 'zh' ? '关闭' : 'Close'}</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    // 绘制趋势图
    setTimeout(() => drawTrendChart(dailyPatterns), 100);
  } catch (e) {
    console.error('Trend analysis error:', e);
    alert(lang === 'zh' ? '无法加载趋势分析' : 'Cannot load trend analysis');
  }
}

// Draw trend chart
function drawTrendChart(dailyPatterns) {
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  
  const width = rect.width;
  const height = rect.height;
  const padding = 30;
  
  // 清空画布
  ctx.clearRect(0, 0, width, height);
  
  // 绘制网格线
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 2; i++) {
    const y = padding + (height - 2 * padding) * i / 2;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }
  
  // 绘制数据线
  if (dailyPatterns.length > 1) {
    ctx.strokeStyle = '#8B5CF6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    dailyPatterns.forEach((d, i) => {
      const x = padding + (width - 2 * padding) * i / (dailyPatterns.length - 1);
      const y = padding + (height - 2 * padding) * (2 - d.value) / 2;
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // 绘制数据点
    dailyPatterns.forEach((d, i) => {
      const x = padding + (width - 2 * padding) * i / (dailyPatterns.length - 1);
      const y = padding + (height - 2 * padding) * (2 - d.value) / 2;
      
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = d.answer === 'A' ? '#3B82F6' : d.answer === 'B' ? '#10B981' : '#8B5CF6';
      ctx.fill();
    });
  }
  
  // 绘制标签
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  
  // X轴标签（显示最近7天的日期）
  const recentDates = dailyPatterns.slice(-7);
  recentDates.forEach((d, i) => {
    const x = padding + (width - 2 * padding) * (dailyPatterns.length - 7 + i) / (dailyPatterns.length - 1 || 1);
    const dateStr = d.date.slice(5); // MM-DD
    ctx.fillText(dateStr, x, height - 10);
  });
  
  // Y轴标签
  ctx.textAlign = 'right';
  ctx.fillText('A', padding - 5, padding + 3);
  ctx.fillText('B', padding - 5, padding + (height - 2 * padding) / 2 + 3);
  ctx.fillText('C', padding - 5, height - padding + 3);
}

// Submit daily answer
// Select daily quiz option (UI only)
let selectedDailyOption = null;
function selectDailyOption(btn, key) {
  // Reset all buttons
  const buttons = btn.parentElement.querySelectorAll('button[data-option]');
  buttons.forEach(b => {
    b.classList.remove('border-purple-500', 'bg-purple-50');
    b.classList.add('border-gray-200');
    b.querySelector('.daily-opt-circle').classList.remove('bg-purple-500', 'border-purple-500');
    b.querySelector('.daily-opt-circle').classList.add('border-gray-300');
  });
  // Highlight selected
  btn.classList.remove('border-gray-200');
  btn.classList.add('border-purple-500', 'bg-purple-50');
  btn.querySelector('.daily-opt-circle').classList.remove('border-gray-300');
  btn.querySelector('.daily-opt-circle').classList.add('bg-purple-500', 'border-purple-500');
  selectedDailyOption = key;
  // Enable submit button
  document.getElementById('dailySubmitBtn').disabled = false;
}

// Submit selected daily answer
async function submitSelectedDaily(date) {
  if (!selectedDailyOption) return;
  await submitDailyAnswer(date, selectedDailyOption);
  selectedDailyOption = null;
}

async function submitDailyAnswer(date, answer) {
  // 保存答案本地
  const dailyAnswers = JSON.parse(localStorage.getItem('sbti_daily_answers') || '{}');
  dailyAnswers[date] = answer;
  localStorage.setItem('sbti_daily_answers', JSON.stringify(dailyAnswers));
  
  // 更新连续天数
  const streak = parseInt(localStorage.getItem('sbti_daily_streak') || '0');
  const lastDate = localStorage.getItem('sbti_daily_last_date');
  const today = getLocalDate();
  
  if (lastDate === today) {
    // 今天已经提交过，不增加
  } else if (lastDate && isConsecutiveDay(lastDate, today)) {
    localStorage.setItem('sbti_daily_streak', (streak + 1).toString());
  } else {
    localStorage.setItem('sbti_daily_streak', '1');
  }
  
  localStorage.setItem('sbti_daily_last_date', today);

  // 提交到 API（streak由服务端计算）
  try {
    await fetch(`${API_BASE}/api/daily/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quiz_date: date, answer, guest_code: getGuestCode() })
    });
    clearUserDataCache(); // 刷新缓存
  } catch (e) { /* silent */ }
  
  // 关闭模态框并重新打开
  const modal = document.querySelector('.fixed.inset-0.bg-black');
  if (modal) modal.remove();
  
  setTimeout(() => {
    showDailyQuiz();
  }, 300);
}

// Check if two dates are consecutive
function isConsecutiveDay(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}

// Start quiz
function startQuiz() {
  // 确保题目已加载
  if (!questions || questions.length === 0) {
    alert(lang === 'zh' ? '题目加载中，请稍后再试' : 'Questions loading, please try again');
    return;
  }
  // 每次点击开始测试，都从头开始（清除旧进度）
  currentQuestion = 0;
  answers = {};
  clearProgress();
  shuffleQuestions();
  renderQuiz();
}

// Render quiz page
function renderQuiz() {
  currentPage = 'quiz';
  currentPageParams = null;
  
  const app = document.getElementById('app');
  
  // 确保题目已加载
  if (!questions || questions.length === 0 || !questionOrder || questionOrder.length === 0) {
    app.innerHTML = `
      <div class="min-h-screen flex items-center justify-center bg-gradient-to-b from-cream to-white">
        <div class="text-center">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p class="text-gray-600">${lang === 'zh' ? '加载中...' : 'Loading...'}</p>
          <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-purple-600 text-white rounded-full text-sm">
            ${lang === 'zh' ? '刷新页面' : 'Refresh'}
          </button>
        </div>
      </div>
    `;
    return;
  }
  
  // 使用乱序后的题目
  const qIndex = questionOrder[currentQuestion];
  const q = questions[qIndex];
  
  // 确保题目存在
  if (!q) {
    console.error('Question not found:', { currentQuestion, qIndex, questionsLength: questions.length });
    alert(lang === 'zh' ? '题目加载失败，请刷新页面' : 'Failed to load question, please refresh');
    return;
  }
  
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  
  app.innerHTML = `
    <div class="min-h-screen flex flex-col bg-gradient-to-b from-cream to-white">
      <div class="w-full h-1 bg-gray-200">
        <div class="h-full bg-purple-500 transition-all duration-300" style="width: ${progress}%"></div>
      </div>
      <div class="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div class="w-full max-w-md">
          <p class="text-purple-500 font-medium mb-4 text-base md:text-lg">
            ${t('question_prefix')}${currentQuestion + 1}/${questions.length}
          </p>
          <h2 class="text-base md:text-lg font-medium text-gray-800 mb-6 text-center leading-relaxed">
            ${lang === 'en' && q.text_en ? q.text_en : q.text}
          </h2>
          <div class="space-y-2">
            ${(lang === 'en' && q.options_en ? q.options_en : q.options).map((opt, i) => `
              <button onclick="selectAnswer(${currentQuestion}, ${opt.value})" 
                class="w-full p-3 md:p-4 text-left border-2 rounded-xl transition-all duration-200 hover:border-purple-400 hover:bg-purple-50 active:scale-[0.98] ${answers[currentQuestion] == opt.value ? 'border-purple-500 bg-purple-100' : 'border-gray-200 bg-white'}"
                style="${answers[currentQuestion] == opt.value ? 'border-color: #8B5CF6' : ''}">
                <span class="text-gray-700 text-sm md:text-base">${opt.label}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="p-4 flex justify-between max-w-md mx-auto w-full">
        <div class="flex gap-2">
          <button onclick="renderLanding()" 
            class="px-4 py-3 md:px-6 md:py-4 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 text-base md:text-lg">
            ${lang === 'zh' ? '← 首页' : '← Home'}
          </button>
          <button onclick="prevQuestion()" ${currentQuestion === 0 ? 'disabled' : ''} 
            class="px-6 py-3 md:px-8 md:py-4 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-base md:text-lg">
            ${t('prev_btn')}
          </button>
        </div>
        <button onclick="nextQuestion()" ${!answers[currentQuestion] ? 'disabled' : ''}
          class="px-6 py-3 md:px-8 md:py-4 rounded-full bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-base md:text-lg">
          ${currentQuestion === questions.length - 1 ? t('finish_btn') : t('next_btn')}
        </button>
      </div>
      <button onclick="toggleLang()" class="fixed top-4 right-4 px-3 py-1 border border-purple-300 rounded-full text-purple-500 hover:bg-purple-50 text-sm">
        ${lang === 'zh' ? 'EN' : '中文'}
      </button>
    </div>
  `;
}

// Select answer (sbti.ai aligned: numeric value 1/2/3)
function selectAnswer(qIndex, value) {
  answers[qIndex] = Number(value);
  saveProgress();
  // 如果不是最后一题，自动跳转下一题
  if (currentQuestion < questions.length - 1) {
    setTimeout(() => {
      currentQuestion++;
      saveProgress();
      renderQuiz();
    }, 300);
  } else {
    // 最后一题：刷新当前状态显示选中效果
    renderQuiz();
  }
}

// Previous question
function prevQuestion() {
  if (currentQuestion > 0) {
    currentQuestion--;
    saveProgress();
    renderQuiz();
  }
}

// Next question
function nextQuestion() {
  if (!answers[currentQuestion]) return;
  
  if (currentQuestion < questions.length - 1) {
    currentQuestion++;
    saveProgress();
    renderQuiz();
  } else {
    showHiddenQuestion();
  }
}

// Show hidden question
// Drink gate state
let drinkGateAnswers = {};

function showHiddenQuestion() {
  const app = document.getElementById('app');
  drinkGateAnswers = {};
  const dq1 = {
    text: lang === 'zh' ? "您平时有什么爱好？" : "What are your usual hobbies?",
    options: lang === 'zh' ? [
      { label: "吃喝拉撒", value: 1 },
      { label: "艺术爱好", value: 2 },
      { label: "饮酒", value: 3 },
      { label: "健身", value: 4 }
    ] : [
      { label: "Eat, drink, sleep, repeat", value: 1 },
      { label: "Art & culture", value: 2 },
      { label: "Drinking", value: 3 },
      { label: "Fitness", value: 4 }
    ]
  };
  
  app.innerHTML = `
    <div class="min-h-screen flex flex-col bg-gradient-to-b from-cream to-white">
      <div class="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div class="w-full max-w-md">
          <p class="text-sm text-gray-400 mb-2 text-center">🎤 ${lang === 'zh' ? '附加题' : 'Bonus Question'}</p>
          <h2 class="text-base md:text-lg font-medium text-gray-800 mb-6 text-center leading-relaxed">
            ${dq1.text}
          </h2>
          <div class="space-y-2">
            ${dq1.options.map((opt, i) => `
              <button onclick="selectDrinkGate1(${opt.value})" id="dg1_opt_${opt.value}"
                class="w-full p-3 md:p-4 text-left border-2 border-gray-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition">
                <span class="text-gray-700 text-sm md:text-base">${opt.label}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="p-4 flex justify-center max-w-md mx-auto w-full">
        <button onclick="confirmDrinkGate1()" id="dg1_submit" disabled
          class="w-full px-6 py-3 rounded-full bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-base">
          ${lang === 'zh' ? '确认提交' : 'Submit'}
        </button>
      </div>
    </div>
  `;
}

function selectDrinkGate1(value) {
  drinkGateAnswers.drink_gate_q1 = value;
  // Update button styles
  const opts = document.querySelectorAll('[id^="dg1_opt_"]');
  opts.forEach(btn => {
    btn.className = btn.id === 'dg1_opt_' + value
      ? 'w-full p-3 md:p-4 text-left border-2 border-purple-500 bg-purple-100 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition'
      : 'w-full p-3 md:p-4 text-left border-2 border-gray-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition';
  });
  document.getElementById('dg1_submit').disabled = false;
}

function confirmDrinkGate1() {
  const value = drinkGateAnswers.drink_gate_q1;
  if (!value) return;
  if (value === 3) {
    showDrinkGateQ2();
  } else {
    calculateResult(false);
    clearProgress();
  }
}

// (drink gate handlers replaced by selectDrinkGate1/confirmDrinkGate1/selectDrinkGate2/confirmDrinkGate2)

function showDrinkGateQ2() {
  const app = document.getElementById('app');
  const dq2 = {
    text: lang === 'zh' ? "您对饮酒的态度是？" : "What's your attitude toward drinking?",
    options: lang === 'zh' ? [
      { label: "小酌怡情，喝不了太多。", value: 1 },
      { label: "我习惯将白酒灌在保温杯，当白开水喝，酒精令我信服。", value: 2 }
    ] : [
      { label: "A little sip is enough for me.", value: 1 },
      { label: "I keep liquor in my thermos like water. Alcohol makes me a believer.", value: 2 }
    ]
  };
  
  app.innerHTML = `
    <div class="min-h-screen flex flex-col bg-gradient-to-b from-cream to-white">
      <div class="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div class="w-full max-w-md">
          <p class="text-sm text-gray-400 mb-2 text-center">🎤 ${lang === 'zh' ? '附加题 2/2' : 'Bonus Question 2/2'}</p>
          <h2 class="text-base md:text-lg font-medium text-gray-800 mb-6 text-center leading-relaxed">
            ${dq2.text}
          </h2>
          <div class="space-y-2">
            ${dq2.options.map((opt, i) => `
              <button onclick="selectDrinkGate2(${opt.value})" id="dg2_opt_${opt.value}"
                class="w-full p-3 md:p-4 text-left border-2 border-gray-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition">
                <span class="text-gray-700 text-sm md:text-base">${opt.label}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="p-4 flex justify-center max-w-md mx-auto w-full">
        <button onclick="confirmDrinkGate2()" id="dg2_submit" disabled
          class="w-full px-6 py-3 rounded-full bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-base">
          ${lang === 'zh' ? '确认提交' : 'Submit'}
        </button>
      </div>
    </div>
  `;
}

function selectDrinkGate2(value) {
  drinkGateAnswers.drink_gate_q2 = value;
  const opts = document.querySelectorAll('[id^="dg2_opt_"]');
  opts.forEach(btn => {
    btn.className = btn.id === 'dg2_opt_' + value
      ? 'w-full p-3 md:p-4 text-left border-2 border-purple-500 bg-purple-100 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition'
      : 'w-full p-3 md:p-4 text-left border-2 border-gray-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition';
  });
  document.getElementById('dg2_submit').disabled = false;
}

function confirmDrinkGate2() {
  const value = drinkGateAnswers.drink_gate_q2;
  if (!value) return;
  calculateResult(value === 2);
  clearProgress();
}

// (handleDrinkGate2 replaced by selectDrinkGate2 + confirmDrinkGate2)

// Calculate result (sbti.ai aligned)
function calculateResult(isDrunk) {
  let result;
  let modeKicker = '';
  let badge = '';
  let sub = '';
  let isSpecial = false;
  let secondaryType = null;
  
  if (isDrunk) {
    // DRUNK - special trigger
    result = personalities.find(p => p.code === 'DRUNK');
    modeKicker = lang === 'zh' ? '隐藏人格已激活' : 'Hidden personality activated';
    badge = lang === 'zh' ? '匹配度 100% · 酒精异常因子已接管' : '100% Match · Alcohol anomaly factor engaged';
    sub = lang === 'zh' ? '乙醇亲和性过强，系统已直接跳过常规人格审判。' : 'Ethanol affinity too strong. System bypassed normal personality judgment.';
    isSpecial = true;
    result._matchScore = 100;
  } else {
    const userPattern = calculateUserPattern();
    const normalTypes = personalities.filter(p => p.code !== 'DRUNK' && p.code !== 'HHHH');
    
    // Calculate distance and exact matches for each type
    const ranked = normalTypes.map(p => {
      const distance = calculateDistance(userPattern, p.pattern);
      let exact = 0;
      for (let i = 0; i < userPattern.length; i++) {
        if (userPattern[i] === p.pattern[i]) exact++;
      }
      const similarity = Math.max(0, Math.round((1 - distance / 30) * 100));
      return { ...p, distance, exact, similarity, _matchScore: similarity };
    }).sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (b.exact !== a.exact) return b.exact - a.exact;
      return b.similarity - a.similarity;
    });
    
    const bestNormal = ranked[0];
    secondaryType = null;
    
    // HHHH fallback: if best match < 60%
    if (bestNormal.similarity < 60) {
      result = personalities.find(p => p.code === 'HHHH');
      modeKicker = lang === 'zh' ? '系统强制底底' : 'System Fallback';
      badge = lang === 'zh' ? `标准人格库最高匹配仅 ${bestNormal.similarity}%` : `Max match in standard types: ${bestNormal.similarity}%`;
      sub = lang === 'zh' ? '标准人格库对你的脑回路集体罢工了，于是系统把你强制分配给了 HHHH。' : 'The standard personality database went on strike for your brain circuits, so the system assigned you HHHH.';
      isSpecial = true;
      secondaryType = bestNormal;
      result._matchScore = bestNormal.similarity;
    } else {
      result = bestNormal;
      modeKicker = lang === 'zh' ? '你的主类型' : 'Your Primary Type';
      badge = lang === 'zh' ? `匹配度 ${result.similarity}% · 精准命中 ${result.exact}/15 维` : `Match ${result.similarity}% · ${result.exact}/15 dims exact`;
      sub = lang === 'zh' ? '维度命中度较高，当前结果可视为你的第一人格画像。' : 'High dimension match. This can be considered your primary personality profile.';
    }
  }
  
  // Store metadata on result
  result._modeKicker = modeKicker;
  result._badge = badge;
  result._sub = sub;
  result._isSpecial = isSpecial;
  result._secondaryType = secondaryType;
  
  currentPersonality = result;
  testCount++;
  localStorage.setItem('sbti_test_count', testCount.toString());
  
  // 保存到历史记录
  saveToHistory(result, calculateUserPattern());
  
  renderResult(result);
}

// 保存结果到历史记录
function saveToHistory(personality, userPattern) {
  try {
    // 先保存到本地（即时）
    const history = JSON.parse(localStorage.getItem('sbti_history') || '[]');
    const entry = {
      code: personality.code,
      pattern: userPattern,
      matchScore: personality._matchScore || 0,
      date: new Date().toISOString()
    };
    history.unshift(entry);
    if (history.length > 5) history.pop();
    localStorage.setItem('sbti_history', JSON.stringify(history));
    
    // 异步同步到数据库
    saveTestHistory(
      personality.code,
      userPattern,
      personality._matchScore || 0,
      getSelectedMBTI(),
      null
    ).catch(e => console.error('saveTestHistory error:', e));
  } catch (e) {
    console.error('Failed to save history:', e);
  }
}

// Calculate user pattern (sbti.ai aligned: numeric sum per dimension)
function calculateUserPattern() {
  // answers[i] = numeric value (1, 2, or 3)
  // Each dimension has 2 questions, sum them (range 2-6)
  // <=3 → L, ==4 → M, >=5 → H
  const dimScores = {};
  
  for (let i = 0; i < questionOrder.length; i++) {
    const qIdx = questionOrder[i];
    const q = questions[qIdx];
    if (q && q.dim) {
      if (!dimScores[q.dim]) dimScores[q.dim] = 0;
      dimScores[q.dim] += Number(answers[i] || 0);
    }
  }
  
  return dimensionOrder.map(dim => {
    const score = dimScores[dim] || 0;
    if (score <= 3) return 'L';
    if (score === 4) return 'M';
    return 'H'; // >=5
  }).join('');
}

// Calculate Manhattan distance (sbti.ai aligned: 15-char pattern, max distance = 30)
function calculateDistance(pattern1, pattern2) {
  const v = c => c === 'H' ? 3 : (c === 'L' ? 1 : 2);
  let distance = 0;
  for (let i = 0; i < pattern1.length; i++) {
    distance += Math.abs(v(pattern1[i]) - v(pattern2[i]));
  }
  return distance;
}

// Submit result to leaderboard API
async function submitToLeaderboard(personality) {
  // 去重：同一测试结果不重复提交
  const lastSubmitId = localStorage.getItem('sbti_last_submit_id');
  const currentId = personality.code + '_' + (personality._matchScore || '') + '_' + Math.round(Date.now() / 60000); // 1分钟内去重
  if (lastSubmitId === currentId) return;
  localStorage.setItem('sbti_last_submit_id', currentId);
  try {
    const mbti = localStorage.getItem('sbti_mbti') || null;
    const pattern = calculateUserPattern();
    await fetch(`${API_BASE}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personality_code: personality.code,
        mbti_type: mbti,
        language: lang,
        pattern: pattern,
        match_score: personality._matchScore || null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null
      })
    });
  } catch (e) { /* silent fail */ }
}

// Fetch leaderboard data
async function fetchLeaderboard(period = 'all', region = '') {
  try {
    let url = `${API_BASE}/api/leaderboard?period=${period}&limit=27`;
    if (region) url += `&region=${region}`;
    const res = await fetch(url);
    return await res.json();
  } catch (e) { return null; }
}

function renderResult(personality) {
  currentPage = 'result';
  currentPageParams = null;
  
  // Submit to leaderboard (async, non-blocking)
  submitToLeaderboard(personality);
  const app = document.getElementById('app');
  const avatar = getPersonalityAvatar(personality.code);
  
  app.innerHTML = `
    <div class="min-h-screen bg-gradient-to-b from-cream to-white overflow-auto">
      <div class="max-w-md mx-auto px-4 py-8">
        ${getUserHeaderHTML(`<button onclick="renderLanding()" class="text-purple-600 mr-2">←</button>`, lang === 'zh' ? '测试结果' : 'Result')}
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-20 h-20 rounded-full text-3xl mb-4" style="background-color: ${personality.color}20; border: 2px solid ${personality.color}">
            ${avatar}
          </div>
          <p class="text-purple-500 font-medium mb-2">${t('your_type')}</p>
          <h1 class="text-5xl font-bold mb-2" style="color: ${personality.color}">${getPersonalityAvatar(personality.code)} ${personality.code}</h1>
          <h2 class="text-2xl text-gray-700 mb-2">${lang === 'zh' ? personality.name_zh : personality.name_en}</h2>
          <p class="text-lg text-gray-500">${lang === 'zh' ? personality.tagline_zh : personality.tagline_en}</p>
          ${personality._matchScore ? `<p class=\"mt-2 text-sm font-medium text-purple-500\">${t('match_score')}: ${personality._matchScore}%</p>` : ''}
        </div>
        <div class="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <p class="text-gray-700 leading-relaxed text-center">
            ${lang === 'zh' ? personality.desc_zh : personality.desc_en}
          </p>
        </div>
        <div class="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <h3 class="text-lg font-bold text-gray-800 mb-4 text-center">${t('dimension_analysis')}</h3>
          <canvas id="radarChart" class="w-full"></canvas>
        </div>
        <div class="grid grid-cols-2 gap-4 mb-6">
          <div class="bg-white rounded-2xl p-4 shadow-lg">
            <h4 class="font-bold text-green-600 mb-3">${t('strengths')}</h4>
            <ul class="space-y-2">
              ${(lang === 'zh' ? personality.strengths_zh : personality.strengths_en).map(s => `<li class="text-gray-600 text-sm">✓ ${s}</li>`).join('')}
            </ul>
          </div>
          <div class="bg-white rounded-2xl p-4 shadow-lg">
            <h4 class="font-bold text-red-500 mb-3">${t('blind_spots')}</h4>
            <ul class="space-y-2">
              ${(lang === 'zh' ? personality.blind_spots_zh : personality.blind_spots_en).map(s => `<li class="text-gray-600 text-sm">✗ ${s}</li>`).join('')}
            </ul>
          </div>
        </div>
        
        <!-- 历史对比区域 -->
        ${showHistoryComparisonHTML(personality)}
        
        <!-- MBTI × SBTI 交叉解读入口 -->
        <div class="bg-white rounded-2xl p-4 shadow-lg mb-6 text-center">
          <button onclick="showMBTIIntersection()" class="w-full py-3 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition text-lg">
            ${t('mbti_cross') || 'MBTI × SBTI 交叉解读'}
          </button>
        </div>
        
        <div class="space-y-3 mb-8">
          <button onclick="shareResult()" class="w-full py-3 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition">${t('share_card')}</button>
          <button onclick="copyShareLink()" class="w-full py-3 border-2 border-purple-400 text-purple-600 rounded-full font-medium hover:bg-purple-50 transition">${t('share_link')}</button>
          <button onclick="showDetailedAnalysis()" class="w-full py-3 border-2 border-green-500 text-green-600 rounded-full font-medium hover:bg-green-50 transition">${t('detailed_analysis')}</button>
          <button onclick="showComparison()" class="w-full py-3 border-2 border-blue-500 text-blue-600 rounded-full font-medium hover:bg-blue-50 transition">${lang === 'zh' ? '👥 人格对比' : '👥 Compare'}</button>
          <button onclick="renderLanding()" class="w-full py-3 border-2 border-purple-300 text-purple-600 rounded-full font-medium hover:bg-purple-50 transition">${lang === 'zh' ? '🏠 返回首页' : '🏠 Back to Home'}</button>
        </div>
        <a href="privacy.html" class="block text-center text-gray-400 hover:text-purple-500 text-sm mb-4">${t('privacy_link')}</a>
        <p class="text-xs text-gray-300 text-center leading-relaxed mb-4">${lang === 'zh' ? '⚠️ 本测试仅供娱乐，别拿它当诊断、面试、相亲、分手、招魂、算命或人生判决书。你可以笑，但别太当真。基于五大模型十五维度交叉计算，结果仅供参考与娱乐。' : '⚠️ For entertainment only. Don\'t use it for diagnosis, job interviews, dating, breakups, séances, fortune telling, or life sentences. You can laugh, but don\'t take it too seriously.'}</p>
      </div>
      <button onclick="toggleLang()" class="fixed top-4 right-4 px-3 py-1 border border-purple-300 rounded-full text-purple-500 hover:bg-purple-50 text-sm">${lang === 'zh' ? 'EN' : '中文'}</button>
    </div>
  `;
  setTimeout(() => drawRadarChart(personality.pattern), 100);
}

// Draw radar chart
function drawRadarChart(pattern) {
  const canvas = document.getElementById('radarChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const radius = Math.min(centerX, centerY) - 40;
  
  const dimensions = [
    ['self_esteem', 'self_clarity', 'core_values'],
    ['attachment_security', 'emotional_investment', 'boundaries'],
    ['worldview', 'rules_flexibility', 'sense_of_purpose'],
    ['motivation', 'decision_style', 'execution'],
    ['social_initiative', 'interpersonal_boundaries', 'expression']
  ];
  
  const modelNames = ['self', 'emotional', 'attitude', 'action', 'social'];
  
  // Grid
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  for (let r = 1; r <= 3; r++) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * r / 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Axes and labels
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  for (let modelIdx = 0; modelIdx < 5; modelIdx++) {
    const modelDims = dimensions[modelIdx];
    const modelAngleStart = (modelIdx * 72 - 90) * Math.PI / 180;
    const angleStep = 72 * Math.PI / 180 / 3;
    
    for (let i = 0; i < 3; i++) {
      const angle = modelAngleStart + i * angleStep;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.stroke();
      
      const labelX = centerX + Math.cos(angle) * (radius + 20);
      const labelY = centerY + Math.sin(angle) * (radius + 20);
      const dimName = i18n[lang].dimensions[modelDims[i]] || modelDims[i];
      ctx.fillStyle = modelColors[modelNames[modelIdx]];
      ctx.fillText(dimName.substring(0, 6), labelX, labelY);
    }
  }
  
  // Convert 25-dimension pattern to 15-radar dimension values
  const radarValues = patternToRadarValues(pattern);
  
  // Data polygon
  ctx.beginPath();
  ctx.strokeStyle = '#8B5CF6';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#8B5CF640';
  
  for (let i = 0; i < 15; i++) {
    const angle = (i * 24 - 90) * Math.PI / 180;
    const r = (radarValues[i] / 3) * radius;
    const x = centerX + Math.cos(angle) * r;
    const y = centerY + Math.sin(angle) * r;
    
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  // Points
  for (let i = 0; i < 15; i++) {
    const angle = (i * 24 - 90) * Math.PI / 180;
    const r = (radarValues[i] / 3) * radius;
    const x = centerX + Math.cos(angle) * r;
    const y = centerY + Math.sin(angle) * r;
    
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#8B5CF6';
    ctx.fill();
  }
}

// 显示历史对比 HTML
function showHistoryComparisonHTML(currentPersonality) {
  try {
    const history = JSON.parse(localStorage.getItem('sbti_history') || '[]');
    if (history.length < 2) return ''; // 至少需要当前和上一次
    
    const lastResult = history[1]; // 上一次结果（当前是[0]）
    const current = history[0];
    
    const isSameType = current.code === lastResult.code;
    const comparisonText = isSameType 
      ? (lang === 'zh' ? `稳定的 ${current.code}` : `Stable ${current.code}`)
      : (lang === 'zh' ? `${lastResult.code} → ${current.code}` : `${lastResult.code} → ${current.code}`);
    
    const matchDiff = (current.matchScore || 0) - (lastResult.matchScore || 0);
    const diffArrow = matchDiff > 0 ? '↑' : (matchDiff < 0 ? '↓' : '→');
    const diffColor = matchDiff > 0 ? 'text-green-500' : (matchDiff < 0 ? 'text-red-500' : 'text-gray-500');
    
    return `
      <div class="bg-white rounded-2xl p-4 shadow-lg mb-6">
        <h3 class="text-lg font-bold text-gray-800 mb-3 text-center">${lang === 'zh' ? '📊 与上次对比' : '📊 vs Last Time'}</h3>
        <div class="flex items-center justify-between mb-3">
          <div class="text-center flex-1">
            <p class="text-sm text-gray-500">${lang === 'zh' ? '上次' : 'Last'}</p>
            <p class="font-bold text-lg">${lastResult.code}</p>
            <p class="text-xs text-gray-400">${lastResult.matchScore?.toFixed(1) || 0}%</p>
          </div>
          <div class="text-2xl text-gray-400">→</div>
          <div class="text-center flex-1">
            <p class="text-sm text-gray-500">${lang === 'zh' ? '本次' : 'Current'}</p>
            <p class="font-bold text-lg" style="color: ${currentPersonality.color}">${current.code}</p>
            <p class="text-xs" style="color: ${currentPersonality.color}">${current.matchScore?.toFixed(1) || 0}%</p>
          </div>
        </div>
        <p class="text-center text-sm ${diffColor}">
          ${comparisonText} · ${lang === 'zh' ? '匹配度' : 'Match'} ${diffArrow} ${Math.abs(matchDiff).toFixed(1)}%
        </p>
        ${!isSameType ? `<p class="text-center text-xs text-gray-400 mt-2">${lang === 'zh' ? '人格类型发生变化' : 'Personality type changed'}</p>` : ''}
      </div>
    `;
  } catch (e) {
    console.error('showHistoryComparisonHTML error:', e);
    return '';
  }
}

// Show history comparison modal (detailed view)

// Lazy-load QRCode.js library on demand
function loadQRCode() {
  return new Promise((resolve, reject) => {
    if (window.QRCode) { resolve(); return; }
    const script = document.createElement('script');
    script.src = '/js/qrcode.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load QRCode.js'));
    document.head.appendChild(script);
  });
}

async function shareResult() {
  // 获取当前人格结果
  const personality = currentPersonality || findMatchedPersonality();
  if (!personality) {
    alert(lang === 'zh' ? '暂无测试结果' : 'No test result yet');
    return;
  }
  
  // 获取人格头像
  const avatar = getPersonalityAvatar(personality.code);
  
  // 获取MBTI选择
  const selectedMBTI = getSelectedMBTI();
  const mbtiDesc = selectedMBTI ? mbtiDescriptions[selectedMBTI] : null;
  
  // 生成 9:16 分享卡片图片 (1080x1920)
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  
  // 添加 roundRect 方法支持
  if (!ctx.roundRect) {
    ctx.roundRect = function(x, y, width, height, radius) {
      if (radius === 0) {
        this.rect(x, y, width, height);
      } else {
        this.moveTo(x + radius, y);
        this.lineTo(x + width - radius, y);
        this.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.lineTo(x + width, y + height - radius);
        this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.lineTo(x + radius, y + height);
        this.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.lineTo(x, y + radius);
        this.quadraticCurveTo(x, y, x + radius, y);
      }
    };
  }
  
  // 1. 背景 - 奶油白渐变
  const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
  gradient.addColorStop(0, '#FFF8F0'); // 奶油白
  gradient.addColorStop(1, '#FFFFFF'); // 纯白
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1920);
  
  // 2. 顶部装饰元素 - 头像圆形背景
  ctx.fillStyle = personality.color || '#8B5CF6';
  ctx.beginPath();
  ctx.arc(540, 260, 90, 0, Math.PI * 2);
  ctx.fill();
  
  // 绘制头像 emoji
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '80px serif';
  ctx.textAlign = 'center';
  ctx.fillText(avatar, 540, 285);
  
  // 人格代码（大字体）
  ctx.fillStyle = personality.color || '#8B5CF6';
  ctx.font = 'bold 120px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(personality.code, 540, 430);
  
  // 3. 人格名称
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 64px Inter, sans-serif';
  ctx.fillText(lang === 'zh' ? personality.name_zh : personality.name_en, 540, 520);
  
  // 4. 标签线
  ctx.fillStyle = '#6B7280';
  ctx.font = '44px Inter, sans-serif';
  const tagline = lang === 'zh' ? personality.tagline_zh : personality.tagline_en;
  ctx.fillText(tagline, 540, 590);
  
  // 4.5 MBTI信息（如果有）
  if (selectedMBTI && mbtiDesc) {
    ctx.fillStyle = mbtiDesc.color || '#8B5CF6';
    ctx.font = 'bold 52px Inter, sans-serif';
    const mbtiText = `${selectedMBTI} × ${personality.code}`;
    ctx.fillText(mbtiText, 540, 660);
    
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '34px Inter, sans-serif';
    const mbtiDescText = lang === 'zh' ? mbtiDesc.zh : mbtiDesc.en;
    ctx.fillText(mbtiDescText, 540, 710);
  }
  
  // 5. 描述卡片
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0,0,0,0.08)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 10;
  ctx.beginPath();
  ctx.roundRect(100, 750, 880, 500, 40);
  ctx.fill();
  
  // 重置阴影
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  
  // 描述文本
  ctx.fillStyle = '#4B5563';
  ctx.font = '40px Inter, sans-serif';
  ctx.textAlign = 'left';
  const desc = lang === 'zh' ? personality.desc_zh : personality.desc_en;
  wrapText(ctx, desc, 150, 850, 780, 52);
  
  // 6. 优势/盲点区域
  ctx.fillStyle = '#F9FAFB';
  ctx.beginPath();
  ctx.roundRect(100, 1300, 420, 300, 30);
  ctx.fill();
  
  ctx.fillStyle = '#F9FAFB';
  ctx.beginPath();
  ctx.roundRect(560, 1300, 420, 300, 30);
  ctx.fill();
  
  // 优势标题
  ctx.fillStyle = '#10B981';
  ctx.font = 'bold 40px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(lang === 'zh' ? '优势' : 'Strengths', 310, 1380);
  
  // 盲点标题
  ctx.fillStyle = '#EF4444';
  ctx.font = 'bold 40px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(lang === 'zh' ? '盲点' : 'Blind Spots', 770, 1380);
  
  // 优势列表
  ctx.fillStyle = '#374151';
  ctx.font = '36px Inter, sans-serif';
  ctx.textAlign = 'left';
  const strengths = lang === 'zh' ? personality.strengths_zh : personality.strengths_en;
  strengths.slice(0, 3).forEach((s, i) => {
    ctx.fillText(`✓ ${s}`, 140, 1450 + i * 50);
  });
  
  // 盲点列表
  const blindSpots = lang === 'zh' ? personality.blind_spots_zh : personality.blind_spots_en;
  blindSpots.slice(0, 3).forEach((s, i) => {
    ctx.fillText(`✗ ${s}`, 600, 1450 + i * 50);
  });
  
  // 7. 底部信息
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '36px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('sbti-test.pages.dev', 540, 1780);
  
  // 7.5 二维码区域 (lazy-load QRCode.js)
  try {
    await loadQRCode();
  } catch(e) {
    console.warn('QRCode.js load failed, skipping QR generation');
  }
  if (window.QRCode) {
    const qrContainer = document.createElement('div');
    qrContainer.style.display = 'none';
    document.body.appendChild(qrContainer);
    
    const qrCode = new QRCode(qrContainer, {
      text: `${window.location.origin}/?ref=${personality.code}`,
      width: 120,
      height: 120,
      colorDark: '#374151',
      colorLight: '#FFFFFF',
      correctLevel: QRCode.CorrectLevel.L
    });
    
    // 获取二维码 canvas 并绘制到分享卡片
    const qrCanvas = qrContainer.querySelector('canvas');
    if (qrCanvas) {
      ctx.drawImage(qrCanvas, 480, 1820, 120, 120);
    } else {
      // 如果没有 canvas，尝试 img
      const qrImg = qrContainer.querySelector('img');
      if (qrImg) {
        ctx.drawImage(qrImg, 480, 1820, 120, 120);
      }
    }
    document.body.removeChild(qrContainer);
  }
  
  // 8. 生成图片并复制到剪贴板
  canvas.toBlob(blob => {
    if (navigator.clipboard && window.ClipboardItem) {
      navigator.clipboard.write([new ClipboardItem({'image/png': blob})]).then(() => {
        alert(lang === 'zh' ? '分享图片已复制到剪贴板' : 'Share image copied to clipboard');
      }).catch(() => {
        downloadImage(canvas);
      });
    } else {
      downloadImage(canvas);
    }
  });
  
  // 文本换行辅助函数（支持中英文）
  function wrapText(context, text, x, y, maxWidth, lineHeight) {
    // 中文按字符分割，英文按单词分割
    const isChinese = /[\u4e00-\u9fff]/g.test(text);
    const segments = isChinese ? text.split('') : text.split(' ');
    let line = '';
    let lineCount = 0;
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const testLine = line + segment + (isChinese ? '' : ' ');
      const metrics = context.measureText(testLine);
      
      if (metrics.width > maxWidth && line !== '') {
        context.fillText(line, x, y + (lineCount * lineHeight));
        line = segment;
        lineCount++;
        if (lineCount > 6) break; // 最多6行
      } else {
        line = testLine;
      }
    }
    
    if (line.trim() !== '' && lineCount <= 6) {
      context.fillText(line, x, y + (lineCount * lineHeight));
    }
  }
  
  // 下载图片备用方案
  function downloadImage(canvas) {
    const link = document.createElement('a');
    let filename = `SBTI-${personality.code}`;
    if (selectedMBTI) {
      filename += `-${selectedMBTI}`;
    }
    // Use JPEG for download (smaller file size) with 0.92 quality
    link.download = `${filename}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();
    alert(lang === 'zh' ? '图片已下载' : 'Image downloaded');
  }
}

// Generate share text from templates
function getShareText(personality) {
  const templates = t('share_templates');
  const template = templates[Math.floor(Math.random() * templates.length)];
  const url = `${window.location.origin}/?ref=${personality.code}`;
  const name = lang === 'zh' ? personality.name_zh : personality.name_en;
  const tagline = lang === 'zh' ? personality.tagline_zh : personality.tagline_en;
  const desc = (lang === 'zh' ? personality.desc_zh : personality.desc_en).substring(0, 40);
  return template
    .replace(/{prefix}/g, t('share_text_prefix'))
    .replace(/{suffix}/g, t('share_text_suffix'))
    .replace(/{code}/g, personality.code)
    .replace(/{name}/g, name)
    .replace(/{tagline}/g, tagline)
    .replace(/{desc}/g, desc)
    .replace(/{url}/g, url);
}

// Copy share link with personality code
function copyShareLink() {
  const personality = currentPersonality || findMatchedPersonality();
  if (!personality) return;
  const text = getShareText(personality);
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(t('share_copied'));
    }).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

// Native share (mobile)
function shareNative() {
  const personality = currentPersonality || findMatchedPersonality();
  if (!personality) return;
  const url = `${window.location.origin}/?ref=${personality.code}`;
  const title = t('share_title');
  const text = getShareText(personality);
  
  if (navigator.share) {
    navigator.share({ title, text, url }).catch(() => {});
  } else {
    copyShareLink();
  }
}

// Toast notification
function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'fixed top-20 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg z-50 text-sm font-medium';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 1500);
  setTimeout(() => toast.remove(), 2000);
}

// Fallback copy
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
  showToast(t('share_copied'));
}

// Restart quiz
// Go back to home page from any sub-page
function goHomeFromLeaderboard() {
  const personality = currentPersonality || findMatchedPersonality();
  if (personality) {
    renderResult(personality);
  } else {
    renderLanding();
  }
}

function backToResult() {
  const personality = currentPersonality || findMatchedPersonality();
  if (personality) {
    renderResult(personality);
  } else {
    renderLanding();
  }
}

function restartQuiz() {
  currentQuestion = 0;
  answers = {};
  clearProgress();
  shuffleQuestions();
  renderLanding();
}

// MBTI selection functions
// Do MBTI cross analysis from home page (no prior test result needed)
function doMBTICrossFromHome() {
  const personality = currentPersonality || findMatchedPersonality();
  const selectedBtn = document.querySelector('.mbti-type-btn[data-selected="1"]');
  const mbti = selectedBtn ? selectedBtn.dataset.type : null;
  if (!mbti) {
    alert(lang === 'zh' ? '请先选择MBTI类型' : 'Please select MBTI type');
    return;
  }
  let sbtiCode;
  if (personality) {
    sbtiCode = personality.code;
  } else {
    const sel = document.getElementById('mbtiSbtiSelect');
    sbtiCode = sel ? sel.value : 'CTRL';
  }
  const text = generateMBTIIntersection(sbtiCode, mbti);
  const p = personalities.find(pp => pp.code === sbtiCode);
  const modal = document.querySelector('.fixed.inset-0');
  if (modal) modal.remove();
  const resultModal = document.createElement('div');
  resultModal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto';
  resultModal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-auto">
      <div class="p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-purple-600">${sbtiCode} × ${mbti}</h2>
          <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
        </div>
        <div class="bg-purple-50 rounded-xl p-4 mb-4 text-sm leading-relaxed whitespace-pre-line text-gray-700">${text}</div>
        ${!personality ? `<button onclick="this.closest('.fixed').remove();startQuiz()" class="w-full py-3 border-2 border-purple-400 text-purple-600 rounded-full font-medium">${lang === 'zh' ? '测测我的SBTI' : 'Take SBTI test'}</button>` : ''}
      </div>
    </div>`;
  document.body.appendChild(resultModal);
}

// Direct compare — view any personality info without test result
function doDirectCompare() {
  const code = (document.getElementById('compareCodeDirect')?.value || '').toUpperCase().trim();
  const p = personalities.find(pp => pp.code === code && pp.code !== 'DRUNK');
  if (!p) {
    alert(lang === 'zh' ? '未找到该人格类型，请检查代码' : 'Personality not found, check the code');
    return;
  }
  const modal = document.querySelector('.fixed.inset-0');
  if (modal) modal.remove();
  // Show personality detail
  currentPersonality = p;
  showDetailedAnalysis();
}

function selectMBTI(mbti) {
  setSelectedMBTI(mbti);
  // 重新渲染结果页面以更新选择状态
  const personality = currentPersonality || findMatchedPersonality();
  if (personality) {
    renderResult(personality);
  }
}

function clearMBTI() {
  setSelectedMBTI(null);
  // 重新渲染结果页面
  const personality = currentPersonality || findMatchedPersonality();
  if (personality) {
    renderResult(personality);
  }
}

function showMBTIIntersection() {
  const mbti = getSelectedMBTI();
  const personality = currentPersonality || findMatchedPersonality();
  
  // 如果没有SBTI结果，提示用户先测试
  if (!personality) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl max-w-md w-full p-6 text-center">
        <div class="text-4xl mb-4">📝</div>
        <h2 class="text-xl font-bold text-gray-800 mb-2">${lang === 'zh' ? '需要先完成测试' : 'Test Required'}</h2>
        <p class="text-gray-500 mb-6">${lang === 'zh' ? 'MBTI × SBTI 交叉解读需要你先完成SBTI测试获得自己的人格类型' : 'MBTI × SBTI intersection analysis requires you to complete the SBTI test first'}</p>
        <button onclick="this.closest('.fixed').remove();startQuiz()" class="w-full py-3 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition mb-3">${lang === 'zh' ? '开始测试' : 'Start Test'}</button>
        <button onclick="this.closest('.fixed').remove()" class="w-full py-3 border-2 border-gray-200 text-gray-600 rounded-full font-medium">${lang === 'zh' ? '稍后再说' : 'Later'}</button>
      </div>
    `;
    document.body.appendChild(modal);
    return;
  }
  
  // Show MBTI selector modal from landing page
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto';
  
  const mbtiTypes = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'];
  const mbtiGroups = [
    { label: 'Analysts', types: ['INTJ','INTP','ENTJ','ENTP'] },
    { label: 'Diplomats', types: ['INFJ','INFP','ENFJ','ENFP'] },
    { label: 'Sentinels', types: ['ISTJ','ISFJ','ESTJ','ESFJ'] },
    { label: 'Explorers', types: ['ISTP','ISFP','ESTP','ESFP'] }
  ];
  
  modal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-auto">
      <div class="p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-purple-600">${t('mbti_cross')}</h2>
          <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
        </div>
        ${!personality ? `<p class="text-gray-500 text-sm mb-4">${lang === 'zh' ? '先完成测试获得你的SBTI类型，或直接查看任意组合' : 'Take the test first, or explore any combination'}</p>` : `<p class="text-gray-500 text-sm mb-4">${lang === 'zh' ? '你的SBTI: ' + personality.code + ' — ' + personality.name_zh : 'Your SBTI: ' + personality.code + ' — ' + personality.name_en}</p>`}
        ${!personality ? `
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">${lang === 'zh' ? '选择SBTI人格' : 'Select SBTI type'}</label>
          <select id="mbtiSbtiSelect" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none">
            ${personalities.filter(p => p.code !== 'DRUNK').map(p => `<option value="${p.code}">${p.code} — ${lang === 'zh' ? p.name_zh : p.name_en}</option>`).join('')}
          </select>
        </div>` : ''}
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">${lang === 'zh' ? '选择你的MBTI类型' : 'Select your MBTI type'}</label>
          <div class="space-y-3">
            ${mbtiGroups.map(g => `
              <div>
                <div class="text-xs text-gray-400 mb-1">${g.label}</div>
                <div class="grid grid-cols-4 gap-2">
                  ${g.types.map(type => `
                    <button onclick="document.querySelectorAll('.mbti-type-btn').forEach(b=>{b.classList.remove('bg-purple-600','text-white','border-purple-600');b.dataset.selected='';});this.classList.add('bg-purple-600','text-white','border-purple-600');this.dataset.selected='1'" data-type="${type}" class="mbti-type-btn px-2 py-2 border-2 border-gray-200 rounded-lg text-sm font-medium hover:border-purple-400 transition ${mbti === type ? 'bg-purple-600 text-white border-purple-600' : ''}" ${mbti === type ? 'data-selected="1"' : ''}>${type}</button>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        <button onclick="doMBTICrossFromHome()" class="w-full py-3 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition">${lang === 'zh' ? '查看交叉解读' : 'View Intersection'}</button>
        <div class="mt-3 text-center">
          <a href="https://www.16personalities.com/ch" target="_blank" rel="noopener" class="text-sm text-purple-400 hover:text-purple-600 underline">${lang === 'zh' ? '🤔 不知道你的MBTI？点击免费测试 →' : '🤔 Don\'t know your MBTI? Take free test →'}</a>
        </div>
        ${!personality ? `<button onclick="this.closest('.fixed').remove();startQuiz()" class="w-full py-3 mt-2 border-2 border-purple-400 text-purple-600 rounded-full font-medium">${lang === 'zh' ? '先测SBTI' : 'Take SBTI test'}</button>` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return;
}

// Generate MBTI × SBTI intersection text (simplified version)
// MBTI cognitive functions for deeper analysis
const mbtiFunctions = {
  'INTJ': { dominant: 'Ni', auxiliary: 'Te', tertiary: 'Fi', inferior: 'Se', focus: '战略远见', focusEn: 'strategic vision' },
  'INTP': { dominant: 'Ti', auxiliary: 'Ne', tertiary: 'Si', inferior: 'Fe', focus: '逻辑探索', focusEn: 'logical exploration' },
  'ENTJ': { dominant: 'Te', auxiliary: 'Ni', tertiary: 'Se', inferior: 'Fi', focus: '效率执行', focusEn: 'efficient execution' },
  'ENTP': { dominant: 'Ne', auxiliary: 'Ti', tertiary: 'Fe', inferior: 'Si', focus: '创新开拓', focusEn: 'innovative exploration' },
  'INFJ': { dominant: 'Ni', auxiliary: 'Fe', tertiary: 'Ti', inferior: 'Se', focus: '深度洞察', focusEn: 'deep insight' },
  'INFP': { dominant: 'Fi', auxiliary: 'Ne', tertiary: 'Si', inferior: 'Te', focus: '价值驱动', focusEn: 'value-driven creativity' },
  'ENFJ': { dominant: 'Fe', auxiliary: 'Ni', tertiary: 'Se', inferior: 'Ti', focus: '感染引导', focusEn: 'inspiring leadership' },
  'ENFP': { dominant: 'Ne', auxiliary: 'Fi', tertiary: 'Te', inferior: 'Si', focus: '热情创造', focusEn: 'passionate creation' },
  'ISTJ': { dominant: 'Si', auxiliary: 'Te', tertiary: 'Fi', inferior: 'Ne', focus: '踏实可靠', focusEn: 'reliable steadiness' },
  'ISFJ': { dominant: 'Si', auxiliary: 'Fe', tertiary: 'Ti', inferior: 'Ne', focus: '温暖守护', focusEn: 'warm protection' },
  'ESTJ': { dominant: 'Te', auxiliary: 'Si', tertiary: 'Ne', inferior: 'Fi', focus: '组织管理', focusEn: 'organized management' },
  'ESFJ': { dominant: 'Fe', auxiliary: 'Si', tertiary: 'Ne', inferior: 'Ti', focus: '和谐关怀', focusEn: 'harmonious care' },
  'ISTP': { dominant: 'Ti', auxiliary: 'Se', tertiary: 'Ni', inferior: 'Fe', focus: '精准实操', focusEn: 'precise action' },
  'ISFP': { dominant: 'Fi', auxiliary: 'Se', tertiary: 'Ni', inferior: 'Te', focus: '感官审美', focusEn: 'sensory aesthetics' },
  'ESTP': { dominant: 'Se', auxiliary: 'Ti', tertiary: 'Fe', inferior: 'Ni', focus: '即时行动', focusEn: 'immediate action' },
  'ESFP': { dominant: 'Se', auxiliary: 'Fi', tertiary: 'Te', inferior: 'Ni', focus: '活力表现', focusEn: 'vibrant expression' }
};

function generateMBTIIntersection(sbtiCode, mbtiType) {
  const personality = personalities.find(p => p.code === sbtiCode);
  const mbtiDesc = mbtiDescriptions[mbtiType];
  const mbtiFunc = mbtiFunctions[mbtiType];
  
  if (!personality || !mbtiDesc || !mbtiFunc) {
    return lang === 'zh' ? '无法生成交叉解读' : 'Cannot generate intersection analysis';
  }
  
  const sbtiName = lang === 'zh' ? personality.name_zh : personality.name_en;
  const mbtiName = lang === 'zh' ? mbtiDesc.zh : mbtiDesc.en;
  const dominantFn = mbtiFunc.dominant;
  const auxiliaryFn = mbtiFunc.auxiliary;
  
  if (lang === 'zh') {
    return `你的 ${sbtiName} × ${mbtiName} (${mbtiType}) 交叉解读：\n\n` +
           `🧠 认知功能核心：${dominantFn}（主导）+ ${auxiliaryFn}（辅助）\n` +
           `这意味着你的底层思维模式以「${mbtiFunc.focus}」为核心驱动力。\n\n` +
           `🔍 与 SBTI 的共鸣：\n` +
           `作为 ${sbtiName}，你 ${personality.desc_zh.substring(0, 60)}... \n` +
           `${dominantFn === 'Ni' || dominantFn === 'Ne' ? '你的直觉功能让你在行为模式上具有前瞻性和创造性，与' + sbtiName + '的特质高度共鸣。' : ''}` +
           `${dominantFn === 'Ti' || dominantFn === 'Te' ? '你的思维功能让你在决策时注重逻辑和效率，这强化了' + sbtiName + '的核心优势。' : ''}` +
           `${dominantFn === 'Fi' || dominantFn === 'Fe' ? '你的情感功能让你在人际关系中具有深度的同理心，丰富了' + sbtiName + '的表达方式。' : ''}` +
           `${dominantFn === 'Si' || dominantFn === 'Se' ? '你的感知功能让你脚踏实地，为' + sbtiName + '的特质提供了稳定的现实基础。' : ''}\n\n` +
           `⚡ 独特优势：\n` +
           `${sbtiName} 的「${personality.strengths_zh[0] || '核心优势'}」与 ${mbtiName} 的「${mbtiFunc.focus}」相结合，\n` +
           `创造出一种既注重深层行为动机、又具备${mbtiFunc.focus}能力的独特人格。\n\n` +
           `💡 成长建议：\n` +
           `留意 ${mbtiName} 的盲点（${mbtiFunc.inferior} 功能较弱）对 ${sbtiName} 模式的影响。\n` +
           `${personality.blind_spots_zh[0] ? '同时关注：「' + personality.blind_spots_zh[0] + '」这一潜在盲区。' : '保持自我觉察，在优势与盲点之间找到平衡。'}`;
  } else {
    return `Your ${sbtiName} × ${mbtiName} (${mbtiType}) Intersection Analysis:\n\n` +
           `🧠 Cognitive Core: ${dominantFn} (dominant) + ${auxiliaryFn} (auxiliary)\n` +
           `Your underlying thinking pattern is driven by "${mbtiFunc.focusEn}".\n\n` +
           `🔍 Resonance with SBTI:\n` +
           `As a ${sbtiName}, you ${personality.desc_en.substring(0, 60)}... \n` +
           `${dominantFn === 'Ni' || dominantFn === 'Ne' ? 'Your intuitive function gives you foresight and creativity in behavioral patterns, highly resonating with ' + sbtiName + ' traits.' : ''}` +
           `${dominantFn === 'Ti' || dominantFn === 'Te' ? 'Your thinking function emphasizes logic and efficiency in decisions, reinforcing ' + sbtiName + '\'s core strengths.' : ''}` +
           `${dominantFn === 'Fi' || dominantFn === 'Fe' ? 'Your feeling function provides deep empathy in relationships, enriching ' + sbtiName + '\'s expression.' : ''}` +
           `${dominantFn === 'Si' || dominantFn === 'Se' ? 'Your sensing function keeps you grounded, providing a stable foundation for ' + sbtiName + ' traits.' : ''}\n\n` +
           `⚡ Unique Strength:\n` +
           `${sbtiName}'s "${personality.strengths_en[0] || 'core strength'}" combined with ${mbtiName}'s "${mbtiFunc.focusEn}"\n` +
           `creates a unique personality that values both deep behavioral motives and ${mbtiFunc.focusEn} capabilities.\n\n` +
           `💡 Growth Tips:\n` +
           `Be mindful of ${mbtiName}'s blind spots (weaker ${mbtiFunc.inferior} function) and their impact on your ${sbtiName} pattern.\n` +
           `${personality.blind_spots_en[0] ? 'Also watch out for: "' + personality.blind_spots_en[0] + '" as a potential blind spot.' : 'Maintain self-awareness and balance between strengths and blind spots.'}`;
  }
}

// Share with MBTI
function shareResultWithMBTI() {
  if (!getSelectedMBTI()) {
    alert(lang === 'zh' ? '请先选择MBTI类型' : 'Please select MBTI type first');
    return;
  }
  
  // 关闭模态框
  const modal = document.querySelector('.fixed.inset-0.bg-black');
  if (modal) modal.remove();
  
  // 调用分享函数（已自动包含MBTI信息）
  shareResult();
}

// Show detailed personality analysis
// Show ranking submit form
function showRankingSubmit() {
  const personality = currentPersonality || findMatchedPersonality();
  if (!personality) return;
  const avatar = getPersonalityAvatar(personality.code);
  const user = JSON.parse(localStorage.getItem('sbti_user') || 'null');
  // 已登录用户自动使用用户名，无需填写昵称
  const defaultNickname = user ? (user.nickname || user.username) : (localStorage.getItem('sbti_ranking_nickname') || '');
  const existingGuestCode = getGuestCode();

  const modal = document.createElement('div');
  modal.id = 'rankingModal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-md w-full overflow-auto max-h-[90vh]">
      <div class="p-6">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-gray-800">${t('submit_to_ranking')}</h2>
          <button onclick="document.getElementById('rankingModal').remove()" class="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
        </div>
        <div class="flex items-center gap-3 mb-4 p-3 rounded-xl" style="background:${personality.color}10;border:2px solid ${personality.color}">
          <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg" style="background:${personality.color}20;border:2px solid ${personality.color}">${avatar}</div>
          <div>
            <div class="font-bold" style="color:${personality.color}">${personality.code} — ${lang === 'zh' ? personality.name_zh : personality.name_en}</div>
            <div class="text-sm text-gray-500">${personality._matchScore ? t('match_score') + ': ' + personality._matchScore + '%' : ''}</div>
          </div>
        </div>
        <p class="text-gray-500 text-sm mb-4">${t('submit_ranking_desc')}</p>
        ${existingGuestCode ? `<div class="bg-green-50 rounded-xl p-3 mb-4 text-sm text-green-700">✅ ${t('your_guest_code')}: <strong>${existingGuestCode}</strong></div>` : ''}
        <div class="space-y-3">
          ${user ? `<div class="bg-purple-50 rounded-xl p-3 text-sm text-purple-700">👤 ${lang === 'zh' ? '已登录为' : 'Logged in as'}: <strong>${user.nickname || user.username}</strong></div>` : `<div>
            <label class="block text-sm font-medium text-gray-700 mb-1">${t('ranking_nickname')} *</label>
            <input id="rankingNickname" type="text" maxlength="16" value="${defaultNickname}" placeholder="${lang === 'zh' ? '2-16个字符' : '2-16 characters'}" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none text-lg">
          </div>`}
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">${t('ranking_signature')}</label>
            <input id="rankingSignature" type="text" maxlength="50" placeholder="${lang === 'zh' ? '一句话介绍自己' : 'Describe yourself in one line'}" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none">
          </div>
        </div>
        <div id="rankingError" class="text-red-500 text-sm mt-2 hidden"></div>
        <button onclick="doSubmitRanking()" class="w-full mt-4 py-3 bg-amber-500 text-white rounded-full font-medium hover:bg-amber-600 transition text-lg">${t('ranking_submit_btn')}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// Actually submit ranking
async function doSubmitRanking() {
  const personality = currentPersonality || findMatchedPersonality();
  if (!personality) return;
  const user = JSON.parse(localStorage.getItem('sbti_user') || 'null');
  // 已登录用户自动使用用户名，未登录需要填写昵称
  let nickname;
  const nicknameInput = document.getElementById('rankingNickname');
  if (user) {
    nickname = user.nickname || user.username;
  } else if (nicknameInput) {
    nickname = nicknameInput.value.trim();
  } else {
    nickname = '';
  }
  const signature = document.getElementById('rankingSignature').value.trim();
  const errEl = document.getElementById('rankingError');

  if (!nickname || nickname.length < 1) {
    errEl.textContent = t('nickname_required');
    errEl.classList.remove('hidden');
    return;
  }
  if (nickname.length > 16) {
    errEl.textContent = t('nickname_too_long');
    errEl.classList.remove('hidden');
    return;
  }

  try {
    // 检查网络连接
    if (!navigator.onLine) {
      errEl.textContent = lang === 'zh' ? '无网络连接，请检查网络' : 'No network connection';
      errEl.classList.remove('hidden');
      return;
    }
    
    const mbti = localStorage.getItem('sbti_mbti') || null;
    console.log('Submitting ranking:', { nickname, personality_code: personality.code });
    
    const res = await fetchWithTimeout(
      `${API_BASE}/api/ranking/submit`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname,
          personality_code: personality.code,
          match_score: personality._matchScore || null,
          mbti_type: mbti,
          signature: signature || null,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null
        })
      },
      15000 // 15秒超时
    );
    
    console.log('Ranking submit response status:', res.status);
    const data = await res.json();
    console.log('Ranking submit response data:', data);
    if (data.success) {
      localStorage.setItem('sbti_ranking_nickname', nickname);
      // guest_code已由getGuestCode()生成，API可能返回新的（排行榜的guest_code），保持一致
      if (data.guest_code) {
        localStorage.setItem('sbti_guest_code', data.guest_code);
      }
      // 同步昵称到数据库
      updateUserData({ nickname }).catch(() => {});
      clearUserDataCache();
      const modal = document.getElementById('rankingModal');
      if (modal) modal.querySelector('.bg-white').innerHTML = `
        <div class="p-6 text-center">
          <div class="text-5xl mb-4">🎉</div>
          <h3 class="text-xl font-bold text-gray-800 mb-2">${t('ranking_success')}</h3>
          <div class="bg-purple-50 rounded-xl p-4 mb-4">
            <p class="text-sm text-gray-500">${t('your_guest_code')}</p>
            <p class="text-2xl font-bold text-purple-600 font-mono">${data.guest_code}</p>
          </div>
          <div class="bg-amber-50 rounded-xl p-4 mb-4">
            <p class="text-sm text-gray-500">${t('your_rank')}</p>
            <p class="text-2xl font-bold text-amber-600"># ${data.rank}</p>
          </div>
          <p class="text-gray-400 text-sm mb-4">${lang === 'zh' ? '请保存临时码，凭此码可查看排名' : 'Save your guest code to check your rank later'}</p>
          <button onclick="document.getElementById('rankingModal').remove();backToResult()" class="w-full py-3 border-2 border-purple-400 text-purple-600 rounded-full font-medium hover:bg-purple-50 transition mb-2">${lang === 'zh' ? '← 返回结果页' : '← Back to Result'}</button>
          <button onclick="document.getElementById('rankingModal').remove();showTypeRankings('${personality.code}')" class="w-full py-3 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition">${t('view_type_ranking')}</button>
        </div>
      `;
    } else {
      errEl.textContent = data.error || (lang === 'zh' ? '提交失败' : 'Submit failed');
      errEl.classList.remove('hidden');
    }
  } catch (e) {
    console.error('Ranking submit error:', e);
    console.error('Error name:', e.name);
    console.error('Error message:', e.message);
    let errorMsg = lang === 'zh' ? '网络错误，请检查网络连接后重试' : 'Network error, please check connection and retry';
    if (e.message === 'Request timeout') {
      errorMsg = lang === 'zh' ? '请求超时，请稍后重试' : 'Request timeout, please retry later';
    } else if (e.name === 'TypeError') {
      errorMsg = lang === 'zh' ? '网络连接失败，请检查网络' : 'Network connection failed, please check network';
    }
    errEl.textContent = errorMsg;
    errEl.classList.remove('hidden');
  }
}

// Show rankings by personality type
async function showTypeRankings(typeCode) {
  currentPage = 'typeRankings';
  currentPageParams = typeCode;
  
  const personality = currentPersonality || findMatchedPersonality();
  const app = document.getElementById('app');
  const p = personalities.find(p => p.code === typeCode);
  const emojiMap = {'CTRL':'🎯','BOSS':'👑','SHIT':'😒','PEACE':'🕊️','CARE':'🤗','LONE':'🐺','FUN':'🎉','DEEP':'🌌','REAL':'💎','GHOST':'👻','WARM':'☀️','EDGE':'🗡️','SAGE':'🧙','WILD':'🐆','COOL':'😎','SOFT':'🍬','SHARP':'⚡','DREAM':'💭','LOGIC':'🤖','SPARK':'✨','FLOW':'🌊','ROOT':'🌳','SKY':'☁️','FREE':'🦋','DARK':'🌑','STAR':'⭐','ECHO':'🔊'};
  const emoji = emojiMap[typeCode] || '💫';
  const color = p ? p.color : '#8B5CF6';
  const name = p ? (lang === 'zh' ? p.name_zh : p.name_en) : typeCode;

  app.innerHTML = `
    <div class="min-h-screen bg-gradient-to-b from-cream to-white overflow-auto">
      <div class="max-w-md mx-auto px-4 py-8">
        <div class="flex items-center mb-6">
          <button onclick="showLeaderboard()" class="text-purple-600 mr-3">←</button>
          <div class="flex-1 flex items-center gap-2">
            <div class="w-8 h-8 rounded-full flex items-center justify-center" style="background:${color}20;border:2px solid ${color}">${emoji}</div>
            <h1 class="text-xl font-bold" style="color:${color}">${emoji} ${typeCode} — ${name}</h1>
          </div>
          ${(() => { const u = JSON.parse(localStorage.getItem('sbti_user') || 'null'); return u ? `<button onclick="showUserProfile()" class="flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-50 hover:bg-purple-100 transition" title="@${u.username}"><span class="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center text-sm">${u.avatar || '👤'}</span><span class="text-sm font-medium text-purple-700 max-w-[72px] truncate">${u.nickname || u.username}</span></button>` : `<button onclick="showLoginModal()" class="flex items-center gap-1 px-3 py-1.5 rounded-full border border-purple-200 text-sm text-purple-500 hover:bg-purple-50 transition">👤 ${lang === 'zh' ? '登录' : 'Login'}</button>`; })()}
        </div>
        <div id="type-rank-list" class="space-y-3">
          <div class="text-center py-8 text-gray-400">Loading...</div>
        </div>
        <button onclick="backToResult()" class="w-full mt-6 py-3 border-2 border-purple-400 text-purple-600 rounded-full font-medium hover:bg-purple-50 transition">${lang === 'zh' ? '← 返回结果页' : '← Back to Result'}</button>
      </div>
      <button onclick="toggleLang()" class="fixed top-4 right-4 px-3 py-1 border border-purple-300 rounded-full text-purple-500 hover:bg-purple-50 text-sm">${lang === 'zh' ? 'EN' : '中文'}</button>
    </div>
  `;

  try {
    const res = await fetch(`${API_BASE}/api/rankings?type=${typeCode}&limit=50`);
    const data = await res.json();
    const list = document.getElementById('type-rank-list');
    const myGuestCode = localStorage.getItem('sbti_guest_code');
    // 获取用户信息（已登录显示用户名，否则显示guest_code）
    const userStr = localStorage.getItem('sbti_user');
    const user = userStr ? JSON.parse(userStr) : null;
    const myDisplayName = user?.nickname || user?.username || myGuestCode || '';

    if (!data.rankings || !data.rankings.length) {
      list.innerHTML = `<div class="text-center py-8 text-gray-400">${lang === 'zh' ? '暂无排名数据' : 'No rankings yet'}</div>`;
      return;
    }

    const medals = ['🥇','🥈','🥉'];
    list.innerHTML = data.rankings.map((r, i) => {
      const isMe = myGuestCode && r.guest_code === myGuestCode;
      const medal = i < 3 ? medals[i] : `<span class="text-gray-400">${i + 1}</span>`;
      // 显示"我的"标识：已登录显示用户名，否则显示(You)
      const myLabel = isMe ? (user ? ` (${myDisplayName})` : ' (You)') : '';
      return `
        <div class="bg-white rounded-xl p-4 shadow-sm ${isMe ? 'ring-2 ring-purple-500 ring-offset-2' : ''}">
          <div class="flex items-center gap-3">
            <div class="text-xl w-8 text-center">${medal}</div>
            <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg" style="background:${color}20;border:2px solid ${color}">${emoji}</div>
            <div class="flex-1 min-w-0">
              <div class="font-bold ${isMe ? 'text-purple-600' : 'text-gray-800'} truncate">${emoji} ${r.nickname}${myLabel}</div>
              <div class="text-sm text-gray-500 truncate">${r.signature || (r.mbti_type || '')}</div>
            </div>
            <div class="text-right flex-shrink-0">
              <div class="font-bold text-amber-600">${r.match_score ? r.match_score + '%' : '-'}</div>
              <div class="text-xs text-gray-400">${t('match_score')}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    document.getElementById('type-rank-list').innerHTML = '<div class="text-center py-8 text-red-400">Error loading rankings</div>';
  }
}

// Show Leaderboard
async function showLeaderboard(period = 'all', region = '') {
  currentPage = 'leaderboard';
  currentPageParams = { period, region };
  
  const app = document.getElementById('app');
  const emojiMap = {'CTRL':'🎯','BOSS':'👑','SHIT':'😒','PEACE':'🕊️','CARE':'🤗','LONE':'🐺','FUN':'🎉','DEEP':'🌌','REAL':'💎','GHOST':'👻','WARM':'☀️','EDGE':'🗡️','SAGE':'🧙','WILD':'🐆','COOL':'😎','SOFT':'🍬','SHARP':'⚡','DREAM':'💭','LOGIC':'🤖','SPARK':'✨','FLOW':'🌊','ROOT':'🌳','SKY':'☁️','FREE':'🦋','DARK':'🌑','STAR':'⭐','ECHO':'🔊'};

  app.innerHTML = `
    <div class="min-h-screen bg-gradient-to-b from-cream to-white overflow-auto">
      <div class="max-w-md mx-auto px-4 py-8">
        <div class="flex items-center mb-6">
          <button onclick="renderLanding()" class="text-purple-600 mr-3">←</button>
          <h1 class="text-2xl font-bold text-gray-800 flex-1">${t('leaderboard_title')}</h1>
          ${(() => { const u = JSON.parse(localStorage.getItem('sbti_user') || 'null'); return u ? `<button onclick="showUserProfile()" class="flex items-center gap-1.5 px-2 py-1 rounded-full bg-purple-50 hover:bg-purple-100 transition" title="@${u.username}"><span class="w-6 h-6 rounded-full bg-purple-200 flex items-center justify-center text-sm">${u.avatar || '👤'}</span><span class="text-sm font-medium text-purple-700 max-w-[72px] truncate">${u.nickname || u.username}</span></button>` : `<button onclick="showLoginModal()" class="flex items-center gap-1 px-3 py-1.5 rounded-full border border-purple-200 text-sm text-purple-500 hover:bg-purple-50 transition">👤 ${lang === 'zh' ? '登录' : 'Login'}</button>`; })()}
        </div>

        <!-- Stats cards -->
        <div class="grid grid-cols-2 gap-4 mb-6">
          <div class="bg-white rounded-xl p-4 shadow text-center">
            <div class="text-2xl font-bold text-purple-600" id="lb-total">-</div>
            <div class="text-sm text-gray-500">${t('total_tests')}</div>
          </div>
          <div class="bg-white rounded-xl p-4 shadow text-center">
            <div class="text-2xl font-bold text-green-600" id="lb-today">-</div>
            <div class="text-sm text-gray-500">${t('tests_today')}</div>
          </div>
        </div>

        <!-- Period tabs -->
        <div class="flex gap-2 mb-3 overflow-x-auto">
          ${['all','month','week','today'].map(p => `
            <button onclick="showLeaderboard('${p}', '${region}')" class="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${p === period ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}">
              ${t('period_' + p)}
            </button>
          `).join('')}
        </div>

        <!-- Region filter -->
        <div class="flex gap-2 mb-6 overflow-x-auto">
          ${[{key:'',label:t('region_all')},{key:'asia',label:t('region_asia')},{key:'europe',label:t('region_europe')},{key:'americas',label:t('region_americas')},{key:'oceania',label:t('region_oceania')}].map(r => `
            <button onclick="showLeaderboard('${period}', '${r.key}')" class="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${r.key === region ? 'bg-green-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}">
              ${r.label}
            </button>
          `).join('')}
        </div>

  <!-- Leaderboard list -->
        <div id="lb-list" class="space-y-3">
          <div class="text-center py-12">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto mb-3"></div>
            <p class="text-gray-400">${lang === 'zh' ? '加载中...' : 'Loading...'}</p>
          </div>
        </div>
      </div>
      <button onclick="toggleLang()" class="fixed top-4 right-4 px-3 py-1 border border-purple-300 rounded-full text-purple-500 hover:bg-purple-50 text-sm">${lang === 'zh' ? 'EN' : '中文'}</button>
    </div>
  `;

  // Fetch data
  const [stats, lbData] = await Promise.all([
    fetch(`${API_BASE}/api/count`).then(r => r.json()).catch(() => ({total: 0, today: 0})),
    fetchLeaderboard(period, region)
  ]);

  document.getElementById('lb-total').textContent = (stats.total || 0).toLocaleString();
  document.getElementById('lb-today').textContent = (stats.today || 0).toLocaleString();

  const list = document.getElementById('lb-list');
  if (!lbData || !lbData.leaderboard.length) {
    list.innerHTML = '<div class="text-center py-8 text-gray-400">No data yet</div>';
    return;
  }

  const total = lbData.total || 1;
  const medals = ['🥇','🥈','🥉'];

  list.innerHTML = lbData.leaderboard.map((item, i) => {
    const p = personalities.find(p => p.code === item.personality_code);
    const emoji = emojiMap[item.personality_code] || '💫';
    const name = p ? (lang === 'zh' ? p.name_zh : p.name_en) : item.personality_code;
    const color = p ? p.color : '#8B5CF6';
    const pct = ((item.count / total) * 100).toFixed(1);
    const medal = i < 3 ? medals[i] : `<span class="text-gray-400">${i + 1}</span>`;
    const barW = Math.max(5, (item.count / lbData.leaderboard[0].count) * 100);

    return `
      <div class="bg-white rounded-xl p-4 shadow-sm">
        <div class="flex items-center gap-3">
          <div class="text-xl w-8 text-center">${medal}</div>
          <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg" style="background:${color}20;border:2px solid ${color}">${emoji}</div>
          <div class="flex-1">
            <div class="font-bold" style="color:${color}">${emoji} ${item.personality_code} <span class="text-sm font-normal opacity-80">${name}</span></div>
          </div>
          <div class="text-right">
            <div class="font-bold text-gray-800">${item.count}</div>
            <div class="text-xs text-gray-400">${pct}%</div>
          </div>
        </div>
        <div class="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div class="h-full rounded-full" style="width:${barW}%;background:${color}"></div>
        </div>
        <button onclick="showTypeRankings('${item.personality_code}')" class="mt-2 text-xs font-medium" style="color:${color}">${t('view_type_ranking')} →</button>
      </div>
    `;
  }).join('');
}

function showDetailedAnalysis() {
  const personality = currentPersonality || findMatchedPersonality();
  if (!personality) return;
  
  // 获取详细数据（硬编码示例）
  const details = getPersonalityDetails(personality.code);
  
  // 显示模态框
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
      <div class="p-6">
        <div class="flex justify-between items-center mb-6">
          <div>
            <h2 class="text-2xl font-bold text-gray-800">${t('detailed_title')}</h2>
            <div class="flex items-center space-x-3 mt-2">
              <div class="text-3xl">${getPersonalityAvatar(personality.code)}</div>
              <div>
                <h3 class="text-xl font-bold" style="color: ${personality.color}">${personality.code} - ${lang === 'zh' ? personality.name_zh : personality.name_en}</h3>
                <p class="text-gray-500">${lang === 'zh' ? personality.tagline_zh : personality.tagline_en}</p>
              </div>
            </div>
          </div>
          <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 text-2xl">
            ✕
          </button>
        </div>
        
        <div class="space-y-6">
          <!-- 核心描述 -->
          <div class="bg-gradient-to-r from-cream to-white p-5 rounded-xl border border-purple-100">
            <h4 class="font-bold text-lg text-gray-800 mb-3">${t('detailed_title')}</h4>
            <p class="text-gray-700 leading-relaxed">${lang === 'zh' ? personality.desc_zh : personality.desc_en}</p>
          </div>
          
          <!-- 优势/盲点 -->
          <div class="grid md:grid-cols-2 gap-4">
            <div class="bg-white border border-green-100 rounded-xl p-5">
              <h4 class="font-bold text-lg text-green-600 mb-3">${t('strengths')}</h4>
              <ul class="space-y-2">
                ${(lang === 'zh' ? personality.strengths_zh : personality.strengths_en).map(s => `
                  <li class="flex items-start">
                    <span class="text-green-500 mr-2">✓</span>
                    <span class="text-gray-700">${s}</span>
                  </li>
                `).join('')}
              </ul>
            </div>
            <div class="bg-white border border-red-100 rounded-xl p-5">
              <h4 class="font-bold text-lg text-red-500 mb-3">${t('blind_spots')}</h4>
              <ul class="space-y-2">
                ${(lang === 'zh' ? personality.blind_spots_zh : personality.blind_spots_en).map(s => `
                  <li class="flex items-start">
                    <span class="text-red-500 mr-2">✗</span>
                    <span class="text-gray-700">${s}</span>
                  </li>
                `).join('')}
              </ul>
            </div>
          </div>
          
          <!-- 十五维度详解 -->
          ${(function() {
            const userPattern = calculateUserPattern();
            const dims = userPattern.split('');
            const models = [
              { key: 'S', prefix: 'S', label_zh: '自我模型', label_en: 'Self Model', color: modelColors.S, dims: ['S1','S2','S3'] },
              { key: 'E', prefix: 'E', label_zh: '情感模型', label_en: 'Emotional Model', color: modelColors.E, dims: ['E1','E2','E3'] },
              { key: 'A', prefix: 'A', label_zh: '态度模型', label_en: 'Attitude Model', color: modelColors.A, dims: ['A1','A2','A3'] },
              { key: 'Ac', prefix: 'Ac', label_zh: '行动驱力模型', label_en: 'Action Model', color: modelColors.Ac, dims: ['Ac1','Ac2','Ac3'] },
              { key: 'So', prefix: 'So', label_zh: '社交模型', label_en: 'Social Model', color: modelColors.So, dims: ['So1','So2','So3'] }
            ];
            return `<div class="bg-white border border-gray-200 rounded-xl p-5">
              <h4 class="font-bold text-lg text-gray-800 mb-4">${lang === 'zh' ? '🔬 十五维度详解' : '🔬 15 Dimensions'}</h4>
              <div class="space-y-4">
                ${models.map(model => {
                  const modelDimDetails = model.dims.map(dim => {
                    const idx = dimensionOrder.indexOf(dim);
                    const level = dims[idx] || 'M';
                    const meta = dimensionMeta[dim];
                    const barColor = level === 'H' ? model.color : (level === 'M' ? model.color + '80' : model.color + '30');
                    const levelText = level === 'H' ? (lang === 'zh' ? '高' : 'High') : (level === 'M' ? (lang === 'zh' ? '中' : 'Mid') : (lang === 'zh' ? '低' : 'Low'));
                    return `<div class="flex items-center gap-3">
                      <div class="w-20 text-xs font-medium text-gray-600 shrink-0">${lang === 'zh' ? meta.name_zh.split(' ').slice(1).join(' ') : meta.name_en.split(' ').slice(1).join(' ')}</div>
                      <div class="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all" style="width:${level === 'H' ? '90%' : (level === 'M' ? '55%' : '20%')};background:${barColor}"></div>
                      </div>
                      <div class="w-8 text-xs font-bold text-right" style="color:${model.color}">${levelText}</div>
                    </div>`;
                  }).join('');
                  return `<div>
                    <div class="flex items-center gap-2 mb-2">
                      <span class="w-3 h-3 rounded-full" style="background:${model.color}"></span>
                      <span class="text-sm font-bold" style="color:${model.color}">${lang === 'zh' ? model.label_zh : model.label_en}</span>
                    </div>
                    <div class="pl-5 space-y-1.5">${modelDimDetails}</div>
                  </div>`;
                }).join('')}
              </div>
              <div class="mt-4 pt-3 border-t border-gray-100 text-center">
                <span class="text-xs text-gray-400">Pattern: ${userPattern}</span>
              </div>
            </div>`;
          })()}
          
          <!-- 适合职业 -->
          <div class="bg-white border border-blue-100 rounded-xl p-5">
            <h4 class="font-bold text-lg text-blue-600 mb-3">${t('suitable_careers')}</h4>
            <div class="flex flex-wrap gap-2">
              ${details.careers.map(career => `
                <span class="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">${career}</span>
              `).join('')}
            </div>
          </div>
          
          <!-- 名人代表 -->
          <div class="bg-white border border-yellow-100 rounded-xl p-5">
            <h4 class="font-bold text-lg text-yellow-600 mb-3">${t('celebrity_examples')}</h4>
            <div class="space-y-3">
              ${details.celebrities.map(celeb => `
                <div class="flex items-center space-x-3">
                  <div class="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">${celeb.emoji}</div>
                  <div>
                    <div class="font-medium text-gray-800">${celeb.name}</div>
                    <div class="text-sm text-gray-500">${celeb.description}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          
          <!-- 兼容性 -->
          <div class="bg-white border border-purple-100 rounded-xl p-5">
            <h4 class="font-bold text-lg text-purple-600 mb-3">${t('compatibility')}</h4>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <div class="text-sm text-gray-500 mb-1">${t('good_with') || '相处良好'}</div>
                <div class="space-y-1">
                  ${details.compatibility.good.map(code => {
                    const p = personalities.find(p => p.code === code);
                    return p ? `
                      <div class="flex items-center space-x-2">
                        <div class="w-6 h-6 rounded-full flex items-center justify-center text-sm" style="background-color: ${p.color}20">${getPersonalityAvatar(code)}</div>
                        <span class="text-gray-700 text-sm">${p.code}</span>
                      </div>
                    ` : '';
                  }).join('')}
                </div>
              </div>
              <div>
                <div class="text-sm text-gray-500 mb-1">${t('challenge_with') || '需要磨合'}</div>
                <div class="space-y-1">
                  ${details.compatibility.challenge.map(code => {
                    const p = personalities.find(p => p.code === code);
                    return p ? `
                      <div class="flex items-center space-x-2">
                        <div class="w-6 h-6 rounded-full flex items-center justify-center text-sm" style="background-color: ${p.color}20">${getPersonalityAvatar(code)}</div>
                        <span class="text-gray-700 text-sm">${p.code}</span>
                      </div>
                    ` : '';
                  }).join('')}
                </div>
              </div>
            </div>
          </div>
          
          <!-- 成长建议 -->
          <div class="bg-white border border-green-100 rounded-xl p-5">
            <h4 class="font-bold text-lg text-green-600 mb-3">${t('growth_tips')}</h4>
            <ul class="space-y-3">
              ${details.growthTips.map((tip, index) => `
                <li class="flex items-start">
                  <div class="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center mr-3 flex-shrink-0">${index + 1}</div>
                  <div class="text-gray-700">${tip}</div>
                </li>
              `).join('')}
            </ul>
          </div>
          
          <div class="text-center pt-4">
            <button onclick="shareResult()" class="px-6 py-3 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition">
              ${t('share_btn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// Get personality details (hardcoded for now)
// Get personality details (hardcoded for now)
function getPersonalityDetails(code) {
  // 为每个人格类型定义独特的详细数据
  const detailsMap = {
    'CTRL': {
      careers: {
        zh: ['项目经理', '团队领导', '创业家', '运营总监', '战略顾问'],
        en: ['Project Manager', 'Team Leader', 'Entrepreneur', 'Operations Director', 'Strategic Consultant']
      },
      celebrities: [
        { emoji: '👑', name_zh: '史蒂夫·乔布斯', name_en: 'Steve Jobs', desc_zh: '苹果创始人，完美主义者', desc_en: 'Apple founder, perfectionist' },
        { emoji: '🦅', name_zh: '埃隆·马斯克', name_en: 'Elon Musk', desc_zh: '特斯拉CEO，创新冒险家', desc_en: 'Tesla CEO, innovation adventurer' },
        { emoji: '🛡️', name_zh: '安格拉·默克尔', name_en: 'Angela Merkel', desc_zh: '德国前总理，稳健领导者', desc_en: 'Former German Chancellor, steady leader' }
      ],
      compatibility: {
        good: ['PEACE', 'CARE', 'WORK'],
        challenge: ['SHIT', 'DRAM', 'WILD']
      },
      growthTips: {
        zh: ['学会适度放手，信任他人', '关注过程而不仅仅是结果', '培养倾听能力，避免独断', '接受自己的不完美', '平衡工作与生活'],
        en: ['Learn to let go moderately, trust others', 'Focus on process, not just results', 'Develop listening skills, avoid arbitrariness', 'Accept your imperfections', 'Balance work and life']
      }
    },
    'ATM-er': {
      careers: {
        zh: ['财务顾问', '银行经理', '慈善家', '社会工作者', '人力资源'],
        en: ['Financial Advisor', 'Bank Manager', 'Philanthropist', 'Social Worker', 'Human Resources']
      },
      celebrities: [
        { emoji: '💰', name_zh: '沃伦·巴菲特', name_en: 'Warren Buffett', desc_zh: '投资大师，慈善家', desc_en: 'Investment guru, philanthropist' },
        { emoji: '🎁', name_zh: '比尔·盖茨', name_en: 'Bill Gates', desc_zh: '微软创始人，慈善家', desc_en: 'Microsoft founder, philanthropist' },
        { emoji: '💝', name_zh: '奥普拉·温弗瑞', name_en: 'Oprah Winfrey', desc_zh: '脱口秀主持人，慈善家', desc_en: 'Talk show host, philanthropist' }
      ],
      compatibility: {
        good: ['MUM', 'CARE', 'PEACE'],
        challenge: ['SHIT', 'FAKE', 'WILD']
      },
      growthTips: {
        zh: ['学会说"不"，保护自己的时间', '不要过度牺牲自己', '建立健康的边界', '学会接受他人的帮助', '关注自己的需求'],
        en: ['Learn to say "no", protect your time', "Don't over-sacrifice yourself", 'Establish healthy boundaries', 'Learn to accept help from others', 'Focus on your own needs']
      }
    },
    'Dior-s': {
      careers: {
        zh: ['自由职业者', '艺术家', '作家', '哲学家', '游戏设计师'],
        en: ['Freelancer', 'Artist', 'Writer', 'Philosopher', 'Game Designer']
      },
      celebrities: [
        { emoji: '🛋️', name_zh: '第欧根尼', name_en: 'Diogenes', desc_zh: '古希腊哲学家，犬儒学派', desc_en: 'Ancient Greek philosopher, Cynic school' },
        { emoji: '🎨', name_zh: '鲍勃·迪伦', name_en: 'Bob Dylan', desc_zh: '音乐人，诺贝尔文学奖得主', desc_en: 'Musician, Nobel laureate in literature' },
        { emoji: '📚', name_zh: '村上春树', name_en: 'Haruki Murakami', desc_zh: '日本作家，超现实主义', desc_en: 'Japanese writer, surrealist' }
      ],
      compatibility: {
        good: ['OJBK', 'MALO', 'ZZZZ'],
        challenge: ['BOSS', 'CTRL', 'GOGO']
      },
      growthTips: {
        zh: ['找到真正热爱的事情', '设定小目标逐步前进', '不要过度逃避现实', '培养自律习惯', '接受适度的挑战'],
        en: ['Find what you truly love', 'Set small goals and progress gradually', "Don't over-escape reality", 'Develop self-discipline habits', 'Accept moderate challenges']
      }
    },
    'BOSS': {
      careers: {
        zh: ['CEO', '企业家', '投资人', '管理顾问', '政治领袖'],
        en: ['CEO', 'Entrepreneur', 'Investor', 'Management Consultant', 'Political Leader']
      },
      celebrities: [
        { emoji: '👔', name_zh: '杰克·韦尔奇', name_en: 'Jack Welch', desc_zh: '通用电气前CEO', desc_en: 'Former GE CEO' },
        { emoji: '🏢', name_zh: '杰夫·贝索斯', name_en: 'Jeff Bezos', desc_zh: '亚马逊创始人', desc_en: 'Amazon founder' },
        { emoji: '💼', name_zh: '董明珠', name_en: 'Dong Mingzhu', desc_zh: '格力电器董事长', desc_en: 'Gree Electric Chairman' }
      ],
      compatibility: {
        good: ['CTRL', 'WORK', 'SHARP'],
        challenge: ['Dior-s', 'OJBK', 'ZZZZ']
      },
      growthTips: {
        zh: ['学会倾听下属的声音', '不要过度追求完美', '培养同理心', '接受失败是成功的一部分', '平衡工作与生活'],
        en: ['Learn to listen to subordinates', "Don't over-pursue perfection", 'Develop empathy', 'Accept failure as part of success', 'Balance work and life']
      }
    },
    'THAN-K': {
      careers: {
        zh: ['心理咨询师', '社工', '教师', '护士', '志愿者'],
        en: ['Psychologist', 'Social Worker', 'Teacher', 'Nurse', 'Volunteer']
      },
      celebrities: [
        { emoji: '🙏', name_zh: '特蕾莎修女', name_en: 'Mother Teresa', desc_zh: '慈善家，和平使者', desc_en: 'Philanthropist, peacemaker' },
        { emoji: '🌟', name_zh: '尼克·胡哲', name_en: 'Nick Vujicic', desc_zh: '励志演说家', desc_en: 'Motivational speaker' },
        { emoji: '💐', name_zh: '戴安娜王妃', name_en: 'Princess Diana', desc_zh: '慈善天使', desc_en: 'Charitable angel' }
      ],
      compatibility: {
        good: ['MUM', 'CARE', 'PEACE'],
        challenge: ['SHIT', 'CYN', 'WILD']
      },
      growthTips: {
        zh: ['学会表达自己的需求', '不要过度牺牲自己', '建立健康的边界', '接受冲突是生活的一部分', '培养自信'],
        en: ['Learn to express your needs', "Don't over-sacrifice yourself", 'Establish healthy boundaries', 'Accept conflict as part of life', 'Build self-confidence']
      }
    },
    'OH-NO': {
      careers: {
        zh: ['风险分析师', '安全工程师', '审计师', '保险精算师', '质量控制'],
        en: ['Risk Analyst', 'Safety Engineer', 'Auditor', 'Actuary', 'Quality Control']
      },
      celebrities: [
        { emoji: '😱', name_zh: '伍迪·艾伦', name_en: 'Woody Allen', desc_zh: '导演，焦虑大师', desc_en: 'Director, anxiety master' },
        { emoji: '📊', name_zh: '本杰明·格雷厄姆', name_en: 'Benjamin Graham', desc_zh: '价值投资之父', desc_en: 'Father of value investing' },
        { emoji: '🔍', name_zh: '夏洛克·福尔摩斯', name_en: 'Sherlock Holmes', desc_zh: '虚构侦探，细节控', desc_en: 'Fictional detective, detail-oriented' }
      ],
      compatibility: {
        good: ['THIN-K', 'LOGIC', 'SAFE'],
        challenge: ['GOGO', 'MALO', 'WILD']
      },
      growthTips: {
        zh: ['学会放松，不要过度焦虑', '接受不确定性是生活的一部分', '培养冒险精神', '不要过度控制', '学会信任他人'],
        en: ['Learn to relax, avoid over-anxiety', 'Accept uncertainty as part of life', 'Develop a spirit of adventure', "Don't over-control", 'Learn to trust others']
      }
    },
    'GOGO': {
      careers: {
        zh: ['销售', '运动员', '探险家', '急救人员', '创业者'],
        en: ['Sales', 'Athlete', 'Explorer', 'Emergency Responder', 'Entrepreneur']
      },
      celebrities: [
        { emoji: '🏃', name_zh: '尤塞恩·博尔特', name_en: 'Usain Bolt', desc_zh: '短跑之王', desc_en: 'Sprint king' },
        { emoji: '🚀', name_zh: '理查德·布兰森', name_en: 'Richard Branson', desc_zh: '维珍集团创始人，冒险家', desc_en: 'Virgin Group founder, adventurer' },
        { emoji: '⚡', name_zh: '埃隆·马斯克', name_en: 'Elon Musk', desc_zh: '行动派创新者', desc_en: 'Action-oriented innovator' }
      ],
      compatibility: {
        good: ['BOSS', 'CTRL', 'SPARK'],
        challenge: ['OH-NO', 'THIN-K', 'ZZZZ']
      },
      growthTips: {
        zh: ['三思而后行', '培养耐心', '学会规划', '不要冲动决策', '考虑长期后果'],
        en: ['Think before you act', 'Develop patience', 'Learn to plan', "Don't make impulsive decisions", 'Consider long-term consequences']
      }
    },
    'SEXY': {
      careers: {
        zh: ['演员', '模特', '主持人', '公关', '时尚设计师'],
        en: ['Actor', 'Model', 'Host', 'PR Specialist', 'Fashion Designer']
      },
      celebrities: [
        { emoji: '💋', name_zh: '玛丽莲·梦露', name_en: 'Marilyn Monroe', desc_zh: '好莱坞性感女神', desc_en: 'Hollywood sex symbol' },
        { emoji: '🌟', name_zh: '碧昂丝', name_en: 'Beyoncé', desc_zh: '流行天后', desc_en: 'Pop queen' },
        { emoji: '✨', name_zh: '詹姆斯·迪恩', name_en: 'James Dean', desc_zh: '叛逆偶像', desc_en: 'Rebel icon' }
      ],
      compatibility: {
        good: ['LOVE-R', 'CHARM', 'STAR'],
        challenge: ['MONK', 'SOLO', 'DEAD']
      },
      growthTips: {
        zh: ['培养内在美', '不要过度依赖外表', '建立深度关系', '学会独处', '发展多元兴趣'],
        en: ['Develop inner beauty', "Don't over-rely on appearance", 'Build deep relationships', 'Learn to be alone', 'Develop diverse interests']
      }
    },
    'LOVE-R': {
      careers: {
        zh: ['诗人', '音乐家', '婚礼策划', '情侣顾问', '艺术家'],
        en: ['Poet', 'Musician', 'Wedding Planner', 'Relationship Coach', 'Artist']
      },
      celebrities: [
        { emoji: '💕', name_zh: '莎士比亚', name_en: 'William Shakespeare', desc_zh: '爱情诗圣', desc_en: 'Bard of love' },
        { emoji: '🎵', name_zh: '约翰·列侬', name_en: 'John Lennon', desc_zh: '披头士成员，爱与和平', desc_en: 'Beatles member, love and peace' },
        { emoji: '🌹', name_zh: '罗密欧', name_en: 'Romeo', desc_zh: '经典浪漫主义者', desc_en: 'Classic romantic' }
      ],
      compatibility: {
        good: ['SEXY', 'MUM', 'WARM'],
        challenge: ['MONK', 'DEAD', 'LOGIC']
      },
      growthTips: {
        zh: ['学会理性思考', '不要过度理想化', '建立现实边界', '培养独立性', '接受爱情的不完美'],
        en: ['Learn rational thinking', "Don't over-idealize", 'Establish realistic boundaries', 'Develop independence', 'Accept imperfection in love']
      }
    },
    'MUM': {
      careers: {
        zh: ['护士', '教师', '社工', '心理咨询师', '营养师'],
        en: ['Nurse', 'Teacher', 'Social Worker', 'Psychologist', 'Nutritionist']
      },
      celebrities: [
        { emoji: '🤱', name_zh: '弗洛伦斯·南丁格尔', name_en: 'Florence Nightingale', desc_zh: '现代护理学创始人', desc_en: 'Founder of modern nursing' },
        { emoji: '📖', name_zh: '玛丽亚·蒙台梭利', name_en: 'Maria Montessori', desc_zh: '教育家', desc_en: 'Educator' },
        { emoji: '💝', name_zh: '特蕾莎修女', name_en: 'Mother Teresa', desc_zh: '慈善家', desc_en: 'Philanthropist' }
      ],
      compatibility: {
        good: ['THAN-K', 'CARE', 'WARM'],
        challenge: ['SHIT', 'FUCK', 'WILD']
      },
      growthTips: {
        zh: ['学会照顾自己', '不要过度付出', '建立健康边界', '学会说"不"', '关注自己的需求'],
        en: ['Learn to take care of yourself', "Don't over-give", 'Establish healthy boundaries', 'Learn to say "no"', 'Focus on your own needs']
      }
    },
    'FAKE': {
      careers: {
        zh: ['演员', '间谍', '谈判专家', '公关', '政治家'],
        en: ['Actor', 'Spy', 'Negotiator', 'PR Specialist', 'Politician']
      },
      celebrities: [
        { emoji: '🎭', name_zh: '丹尼尔·戴-刘易斯', name_en: 'Daniel Day-Lewis', desc_zh: '方法派演技大师', desc_en: 'Method acting master' },
        { emoji: '🕵️', name_zh: '詹姆斯·邦德', name_en: 'James Bond', desc_zh: '虚构间谍，多重身份', desc_en: 'Fictional spy, multiple identities' },
        { emoji: '🎪', name_zh: '大卫·布莱恩', name_en: 'David Blaine', desc_zh: '魔术师，表演大师', desc_en: 'Magician, performance master' }
      ],
      compatibility: {
        good: ['CHARM', 'STAR', 'SPARK'],
        challenge: ['REAL', 'DEEP', 'AUTH']
      },
      growthTips: {
        zh: ['寻找真实的自我', '建立真诚关系', '减少伪装', '培养自我认同', '接受不完美'],
        en: ['Find your true self', 'Build genuine relationships', 'Reduce pretense', 'Develop self-identity', 'Accept imperfection']
      }
    },
    'OJBK': {
      careers: {
        zh: ['自由职业者', '顾问', '调解员', '瑜伽教练', '心理咨询师'],
        en: ['Freelancer', 'Consultant', 'Mediator', 'Yoga Instructor', 'Psychologist']
      },
      celebrities: [
        { emoji: '☯️', name_zh: '老子', name_en: 'Laozi', desc_zh: '道家创始人，无为而治', desc_en: 'Founder of Taoism, wu wei' },
        { emoji: '🧘', name_zh: '达赖喇嘛', name_en: 'Dalai Lama', desc_zh: '藏传佛教领袖', desc_en: 'Tibetan Buddhist leader' },
        { emoji: '🌊', name_zh: '艾伦·瓦茨', name_en: 'Alan Watts', desc_zh: '哲学家，禅宗传播者', desc_en: 'Philosopher, Zen popularizer' }
      ],
      compatibility: {
        good: ['Dior-s', 'ZZZZ', 'PEACE'],
        challenge: ['BOSS', 'CTRL', 'GOGO']
      },
      growthTips: {
        zh: ['培养主见', '学会表达真实想法', '设定个人目标', '不要过度随波逐流', '建立自我价值感'],
        en: ['Develop opinions', 'Learn to express true thoughts', 'Set personal goals', "Don't over-follow the crowd", 'Build self-worth']
      }
    },
    'MALO': {
      careers: {
        zh: ['喜剧演员', '游戏主播', '创意总监', '玩具设计师', '漫画家'],
        en: ['Comedian', 'Game Streamer', 'Creative Director', 'Toy Designer', 'Cartoonist']
      },
      celebrities: [
        { emoji: '🐒', name_zh: '罗宾·威廉姆斯', name_en: 'Robin Williams', desc_zh: '喜剧天才', desc_en: 'Comedy genius' },
        { emoji: '🎮', name_zh: ' PewDiePie', name_en: 'PewDiePie', desc_zh: '游戏主播', desc_en: 'Game streamer' },
        { emoji: '🤪', name_zh: '金·凯瑞', name_en: 'Jim Carrey', desc_zh: '喜剧演员', desc_en: 'Comedian' }
      ],
      compatibility: {
        good: ['JOKE-R', 'WOC!', 'FUN'],
        challenge: ['MONK', 'THIN-K', 'DEAD']
      },
      growthTips: {
        zh: ['学会承担责任', '培养专注力', '建立长期目标', '不要过度逃避', '学会严肃对待事情'],
        en: ['Learn to take responsibility', 'Develop focus', 'Set long-term goals', "Don't over-escape", 'Learn to take things seriously']
      }
    },
    'JOKE-R': {
      careers: {
        zh: ['喜剧演员', '脱口秀主持人', '编剧', '播客主持人', '广告创意'],
        en: ['Comedian', 'Talk Show Host', 'Screenwriter', 'Podcast Host', 'Ad Creative']
      },
      celebrities: [
        { emoji: '🤡', name_zh: '查理·卓别林', name_en: 'Charlie Chaplin', desc_zh: '喜剧大师', desc_en: 'Comedy master' },
        { emoji: '😂', name_zh: '路易·C·K', name_en: 'Louis C.K.', desc_zh: '脱口秀演员', desc_en: 'Stand-up comedian' },
        { emoji: '🎤', name_zh: '乔治·卡林', name_en: 'George Carlin', desc_zh: '喜剧演员，社会批评家', desc_en: 'Comedian, social critic' }
      ],
      compatibility: {
        good: ['MALO', 'WOC!', 'FUN'],
        challenge: ['MONK', 'DEAD', 'THIN-K']
      },
      growthTips: {
        zh: ['学会表达真实情感', '不要过度用幽默掩饰', '建立深度关系', '培养自我认知', '接受脆弱'],
        en: ['Learn to express true emotions', "Don't over-use humor to hide", 'Build deep relationships', 'Develop self-awareness', 'Accept vulnerability']
      }
    },
    'WOC!': {
      careers: {
        zh: ['评论员', '博主', '记者', '脱口秀演员', '社交媒体经理'],
        en: ['Commentator', 'Blogger', 'Journalist', 'Stand-up Comedian', 'Social Media Manager']
      },
      celebrities: [
        { emoji: '😮', name_zh: '乔恩·斯图尔特', name_en: 'Jon Stewart', desc_zh: '政治评论员', desc_en: 'Political commentator' },
        { emoji: '📢', name_zh: '比尔·马赫', name_en: 'Bill Maher', desc_zh: '脱口秀主持人', desc_en: 'Talk show host' },
        { emoji: '🔥', name_zh: '乔丹·彼得森', name_en: 'Jordan Peterson', desc_zh: '心理学家，直言不讳', desc_en: 'Psychologist, outspoken' }
      ],
      compatibility: {
        good: ['SHIT', 'JOKE-R', 'REAL'],
        challenge: ['FAKE', 'PEACE', 'OJBK']
      },
      growthTips: {
        zh: ['学会控制情绪', '培养同理心', '避免过度冲动', '学会倾听', '建立深度思考'],
        en: ['Learn to control emotions', 'Develop empathy', 'Avoid over-impulsiveness', 'Learn to listen', 'Build deep thinking']
      }
    },
    'THIN-K': {
      careers: {
        zh: ['哲学家', '科学家', '研究员', '战略顾问', '数据分析师'],
        en: ['Philosopher', 'Scientist', 'Researcher', 'Strategic Consultant', 'Data Analyst']
      },
      celebrities: [
        { emoji: '🧠', name_zh: '阿尔伯特·爱因斯坦', name_en: 'Albert Einstein', desc_zh: '物理学家，思想家', desc_en: 'Physicist, thinker' },
        { emoji: '📚', name_zh: '伊曼努尔·康德', name_en: 'Immanuel Kant', desc_zh: '哲学家', desc_en: 'Philosopher' },
        { emoji: '🔬', name_zh: '卡尔·萨根', name_en: 'Carl Sagan', desc_zh: '天文学家，科普作家', desc_en: 'Astronomer, science popularizer' }
      ],
      compatibility: {
        good: ['LOGIC', 'DEEP', 'SAGE'],
        challenge: ['GOGO', 'MALO', 'WOC!']
      },
      growthTips: {
        zh: ['学会行动', '不要过度思考', '培养决策能力', '接受不完美', '学会信任直觉'],
        en: ['Learn to act', "Don't over-think", 'Develop decision-making skills', 'Accept imperfection', 'Learn to trust intuition']
      }
    },
    'SHIT': {
      careers: {
        zh: ['记者', '评论员', '审计师', '律师', '研究员'],
        en: ['Journalist', 'Commentator', 'Auditor', 'Lawyer', 'Researcher']
      },
      celebrities: [
        { emoji: '😒', name_zh: '乔治·卡林', name_en: 'George Carlin', desc_zh: '喜剧演员，社会批评家', desc_en: 'Comedian, social critic' },
        { emoji: '📺', name_zh: '乔恩·斯图尔特', name_en: 'Jon Stewart', desc_zh: '政治评论员', desc_en: 'Political commentator' },
        { emoji: '🎭', name_zh: '路易·C·K', name_en: 'Louis C.K.', desc_zh: '喜剧演员，直言不讳', desc_en: 'Comedian, outspoken' }
      ],
      compatibility: {
        good: ['REAL', 'DEEP', 'AUTH'],
        challenge: ['FAKE', 'PEACE', 'OJBK']
      },
      growthTips: {
        zh: ['学会看到积极面', '不要过度批评', '培养同理心', '接受不完美', '学会放松'],
        en: ['Learn to see the positive', "Don't over-criticize", 'Develop empathy', 'Accept imperfection', 'Learn to relax']
      }
    },
    'ZZZZ': {
      careers: {
        zh: ['自由职业者', '夜班工作者', '作家', '程序员', '研究员'],
        en: ['Freelancer', 'Night Shift Worker', 'Writer', 'Programmer', 'Researcher']
      },
      celebrities: [
        { emoji: '💤', name_zh: '加菲猫', name_en: 'Garfield', desc_zh: '懒惰的猫，享受生活', desc_en: 'Lazy cat, enjoys life' },
        { emoji: '🛌', name_zh: '奥斯卡·王尔德', name_en: 'Oscar Wilde', desc_zh: '作家，享乐主义者', desc_en: 'Writer, hedonist' },
        { emoji: '😴', name_zh: '荷马·辛普森', name_en: 'Homer Simpson', desc_zh: '动画角色，懒人代表', desc_en: 'Cartoon character, lazy icon' }
      ],
      compatibility: {
        good: ['Dior-s', 'OJBK', 'DEAD'],
        challenge: ['BOSS', 'CTRL', 'GOGO']
      },
      growthTips: {
        zh: ['建立时间管理习惯', '设定明确截止日期', '培养自律', '学会分解任务', '找到内在动力'],
        en: ['Build time management habits', 'Set clear deadlines', 'Develop self-discipline', 'Learn to break down tasks', 'Find intrinsic motivation']
      }
    },
    'POOR': {
      careers: {
        zh: ['研究员', '专家顾问', '技术专家', '档案管理员', '博物馆策展人'],
        en: ['Researcher', 'Expert Consultant', 'Technical Specialist', 'Archivist', 'Museum Curator']
      },
      celebrities: [
        { emoji: '🔍', name_zh: '居里夫人', name_en: 'Marie Curie', desc_zh: '物理学家，专注研究', desc_en: 'Physicist, focused researcher' },
        { emoji: '📖', name_zh: 'J·K·罗琳', name_en: 'J.K. Rowling', desc_zh: '作家，专注创作', desc_en: 'Writer, focused creator' },
        { emoji: '🎯', name_zh: '史蒂夫·沃兹尼亚克', name_en: 'Steve Wozniak', desc_zh: '苹果联合创始人，技术专家', desc_en: 'Apple co-founder, tech expert' }
      ],
      compatibility: {
        good: ['THIN-K', 'LOGIC', 'DEEP'],
        challenge: ['GOGO', 'MALO', 'SEXY']
      },
      growthTips: {
        zh: ['拓展视野', '学会合作', '培养社交技能', '接受多元观点', '平衡专精与广博'],
        en: ['Broaden horizons', 'Learn to collaborate', 'Develop social skills', 'Accept diverse perspectives', 'Balance depth and breadth']
      }
    },
    'MONK': {
      careers: {
        zh: ['僧侣', '哲学家', '作家', '冥想教练', '图书管理员'],
        en: ['Monk', 'Philosopher', 'Writer', 'Meditation Coach', 'Librarian']
      },
      celebrities: [
        { emoji: '🧘', name_zh: '释迦牟尼', name_en: 'Siddhartha Gautama', desc_zh: '佛教创始人', desc_en: 'Founder of Buddhism' },
        { emoji: '📿', name_zh: '一行禅师', name_en: 'Thich Nhat Hanh', desc_zh: '禅宗大师', desc_en: 'Zen master' },
        { emoji: '🏔️', name_zh: '赫尔曼·黑塞', name_en: 'Hermann Hesse', desc_zh: '作家，寻求内心平静', desc_en: 'Writer, seeker of inner peace' }
      ],
      compatibility: {
        good: ['DEAD', 'SAGE', 'PEACE'],
        challenge: ['SEXY', 'LOVE-R', 'GOGO']
      },
      growthTips: {
        zh: ['学会适度社交', '培养情感表达', '不要过度疏离', '建立亲密关系', '接受世俗生活'],
        en: ['Learn moderate socializing', 'Develop emotional expression', "Don't over-distance", 'Build intimate relationships', 'Accept secular life']
      }
    },
    'IMSB': {
      careers: {
        zh: ['学生', '初级职员', '助理', '实习生', '自由职业者'],
        en: ['Student', 'Junior Staff', 'Assistant', 'Intern', 'Freelancer']
      },
      celebrities: [
        { emoji: '🤔', name_zh: '查理·布朗', name_en: 'Charlie Brown', desc_zh: '漫画角色，自我怀疑', desc_en: 'Comic character, self-doubting' },
        { emoji: '📚', name_zh: ' Holden Caulfield', name_en: 'Holden Caulfield', desc_zh: '《麦田守望者》主角', desc_en: 'Protagonist of Catcher in the Rye' },
        { emoji: '🎭', name_zh: '哈姆雷特', name_en: 'Hamlet', desc_zh: '莎士比亚角色，犹豫不决', desc_en: 'Shakespeare character, indecisive' }
      ],
      compatibility: {
        good: ['MUM', 'CARE', 'WARM'],
        challenge: ['BOSS', 'CTRL', 'GOGO']
      },
      growthTips: {
        zh: ['建立自信', '学会做决定', '不要过度自我批评', '培养行动力', '接受不完美'],
        en: ['Build confidence', 'Learn to make decisions', "Don't over-self-criticize", 'Develop action skills', 'Accept imperfection']
      }
    },
    'SOLO': {
      careers: {
        zh: ['作家', '艺术家', '程序员', '研究员', '独立工作者'],
        en: ['Writer', 'Artist', 'Programmer', 'Researcher', 'Independent Worker']
      },
      celebrities: [
        { emoji: '🥀', name_zh: '艾米莉·狄金森', name_en: 'Emily Dickinson', desc_zh: '诗人，隐居生活', desc_en: 'Poet, reclusive life' },
        { emoji: '🎨', name_zh: '弗里达·卡罗', name_en: 'Frida Kahlo', desc_zh: '画家，独立艺术家', desc_en: 'Painter, independent artist' },
        { emoji: '📖', name_zh: 'J·D·塞林格', name_en: 'J.D. Salinger', desc_zh: '作家，隐居', desc_en: 'Writer, recluse' }
      ],
      compatibility: {
        good: ['MONK', 'DEAD', 'THIN-K'],
        challenge: ['SEXY', 'LOVE-R', 'MUM']
      },
      growthTips: {
        zh: ['学会信任他人', '建立社交联系', '不要过度封闭', '培养亲密关系', '接受帮助'],
        en: ['Learn to trust others', 'Build social connections', "Don't over-isolate", 'Develop intimate relationships', 'Accept help']
      }
    },
    'FUCK': {
      careers: {
        zh: ['摇滚歌手', '街头艺术家', '活动家', '自由职业者', '创业者'],
        en: ['Rock Singer', 'Street Artist', 'Activist', 'Freelancer', 'Entrepreneur']
      },
      celebrities: [
        { emoji: '🤘', name_zh: '科特·柯本', name_en: 'Kurt Cobain', desc_zh: '涅槃乐队主唱', desc_en: 'Nirvana frontman' },
        { emoji: '🔥', name_zh: '帕蒂·史密斯', name_en: 'Patti Smith', desc_zh: '朋克教母', desc_en: 'Godmother of punk' },
        { emoji: '⚡', name_zh: '切·格瓦拉', name_en: 'Che Guevara', desc_zh: '革命家', desc_en: 'Revolutionary' }
      ],
      compatibility: {
        good: ['WILD', 'REBEL', 'FREE'],
        challenge: ['MONK', 'PEACE', 'OJBK']
      },
      growthTips: {
        zh: ['学会控制冲动', '培养责任感', '建立长期目标', '学会合作', '接受规则'],
        en: ['Learn to control impulses', 'Develop responsibility', 'Set long-term goals', 'Learn to collaborate', 'Accept rules']
      }
    },
    'DEAD': {
      careers: {
        zh: ['哲学家', '作家', '僧侣', '图书管理员', '博物馆管理员'],
        en: ['Philosopher', 'Writer', 'Monk', 'Librarian', 'Museum Curator']
      },
      celebrities: [
        { emoji: '💀', name_zh: '叔本华', name_en: 'Arthur Schopenhauer', desc_zh: '哲学家，悲观主义', desc_en: 'Philosopher, pessimist' },
        { emoji: '📚', name_zh: '卡夫卡', name_en: 'Franz Kafka', desc_zh: '作家，存在主义', desc_en: 'Writer, existentialist' },
        { emoji: '🌑', name_zh: '太宰治', name_en: 'Osamu Dazai', desc_zh: '作家，人间失格', desc_en: 'Writer, No Longer Human' }
      ],
      compatibility: {
        good: ['MONK', 'SOLO', 'SAGE'],
        challenge: ['GOGO', 'SEXY', 'LOVE-R']
      },
      growthTips: {
        zh: ['寻找生活意义', '建立社交联系', '培养兴趣爱好', '接受帮助', '学会表达情感'],
        en: ['Find meaning in life', 'Build social connections', 'Develop hobbies', 'Accept help', 'Learn to express emotions']
      }
    },
    'IMFW': {
      careers: {
        zh: ['学生', '初级职员', '助理', '客服', '实习生'],
        en: ['Student', 'Junior Staff', 'Assistant', 'Customer Service', 'Intern']
      },
      celebrities: [
        { emoji: '🌱', name_zh: '小王子', name_en: 'The Little Prince', desc_zh: '童话角色，纯真脆弱', desc_en: 'Fairy tale character, innocent and fragile' },
        { emoji: '🦋', name_zh: '弗吉尼亚·伍尔夫', name_en: 'Virginia Woolf', desc_zh: '作家，敏感细腻', desc_en: 'Writer, sensitive and delicate' },
        { emoji: '💧', name_zh: '林黛玉', name_en: 'Lin Daiyu', desc_zh: '红楼梦角色，多愁善感', desc_en: 'Dream of the Red Chamber character, melancholic' }
      ],Details(code) {
  // 为每个人格类型定义独特的详细数据
  const detailsMap = {
    'CTRL': {
      careers: {
        zh: ['项目经理', '团队领导', '创业家', '运营总监', '战略顾问'],
        en: ['Project Manager', 'Team Leader', 'Entrepreneur', 'Operations Director', 'Strategic Consultant']
      },
      celebrities: [
        { emoji: '👑', name_zh: '史蒂夫·乔布斯', name_en: 'Steve Jobs', desc_zh: '苹果创始人，完美主义者', desc_en: 'Apple founder, perfectionist' },
        { emoji: '🦅', name_zh: '埃隆·马斯克', name_en: 'Elon Musk', desc_zh: '特斯拉CEO，创新冒险家', desc_en: 'Tesla CEO, innovation adventurer' },
        { emoji: '🛡️', name_zh: '安格拉·默克尔', name_en: 'Angela Merkel', desc_zh: '德国前总理，稳健领导者', desc_en: 'Former German Chancellor, steady leader' }
      ],
      compatibility: {
        good: ['PEACE', 'CARE', 'WORK'],
        challenge: ['SHIT', 'DRAM', 'WILD']
      },
      growthTips: {
        zh: ['学会适度放手，信任他人', '关注过程而不仅仅是结果', '培养倾听能力，避免独断', '接受自己的不完美', '平衡工作与生活'],
        en: ['Learn to let go moderately, trust others', 'Focus on process, not just results', 'Develop listening skills, avoid arbitrariness', 'Accept your imperfections', 'Balance work and life']
      }
    },
    'PEACE': {
      careers: {
        zh: ['人力资源', '心理咨询师', '社工', '教师', '调解员'],
        en: ['Human Resources', 'Psychologist', 'Social Worker', 'Teacher', 'Mediator']
      },
      celebrities: [
        { emoji: '🕊️', name_zh: '特蕾莎修女', name_en: 'Mother Teresa', desc_zh: '慈善家，和平使者', desc_en: 'Philanthropist, peacemaker' },
        { emoji: '🌸', name_zh: '达赖喇嘛', name_en: 'Dalai Lama', desc_zh: '精神领袖，和平倡导者', desc_en: 'Spiritual leader, peace advocate' },
        { emoji: '🕊️', name_zh: '马丁·路德·金', name_en: 'Martin Luther King Jr.', desc_zh: '民权运动领袖', desc_en: 'Civil rights leader' }
      ],
      compatibility: {
        good: ['CARE', 'WORK', 'DEEP'],
        challenge: ['SHIT', 'DRAM', 'WILD']
      },
      growthTips: {
        zh: ['学会表达自己的需求', '不要过度牺牲自己', '建立健康的边界', '接受冲突是生活的一部分', '培养自信'],
        en: ['Learn to express your needs', "Don't over-sacrifice yourself", 'Establish healthy boundaries', 'Accept conflict as part of life', 'Build self-confidence']
      }
    },
    'SHIT': {
      careers: {
        zh: ['记者', '评论员', '审计师', '律师', '研究员'],
        en: ['Journalist', 'Commentator', 'Auditor', 'Lawyer', 'Researcher']
      },
      celebrities: [
        { emoji: '😒', name_zh: '乔治·卡林', name_en: 'George Carlin', desc_zh: '喜剧演员，社会批评家', desc_en: 'Comedian, social critic' },
        { emoji: '📺', name_zh: '乔恩·斯图尔特', name_en: 'Jon Stewart', desc_zh: '政治评论员', desc_en: 'Political commentator' },
        { emoji: '🎭', name_zh: '路易·C·K', name_en: 'Louis C.K.', desc_zh: '喜剧演员，直言不讳', desc_en: 'Comedian, outspoken' }
      ],
      compatibility: {
        good: ['REAL', 'DEEP', 'QUIT'],
        challenge: ['FAKE', 'DRAM', 'WILD']
      },
      growthTips: {
        zh: ['学会看到事物的积极面', '不要过度批评他人', '培养同理心', '接受不完美', '学会放松'],
        en: ['Learn to see the positive side', "Don't over-criticize others", 'Develop empathy', 'Accept imperfection', 'Learn to relax']
      }
    }
  };
  
  // 返回对应人格的数据，如果没有则返回默认数据
  return detailsMap[code] || detailsMap['CTRL'];
}

// Render (for language toggle)
function render() {
  const app = document.getElementById('app');
  if (!app) return;
  
  if (Object.keys(answers).length === 0) {
    renderLanding();
  } else if (document.querySelector('.bg-white.rounded-2xl.p-6.shadow-lg')) {
    const matched = findMatchedPersonality();
    if (matched) renderResult(matched);
  } else {
    renderQuiz();
  }
}

// Find matched personality
function findMatchedPersonality() {
  const userPattern = calculateUserPattern();
  let minDistance = Infinity;
  let matched = null;
  
  for (const p of personalities) {
    if (p.code === 'DRUNK') continue;
    const distance = calculateDistance(userPattern, p.pattern);
    if (distance < minDistance) {
      minDistance = distance;
      matched = p;
    }
  }
  return matched;
}

// Show personality comparison
function showComparison() {
  // Only allow comparison if user has actually completed a test
  const hasTestResult = currentPersonality || (JSON.parse(localStorage.getItem('sbti_history') || '[]').length > 0);
  if (!hasTestResult) {
    // No test result yet — must take test first
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
    modal.innerHTML = `<div class="bg-white rounded-2xl max-w-md w-full p-6 text-center relative">
      <button onclick="this.closest('.fixed').remove()" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl">✕</button>
      <div class="text-5xl mb-4">🔍</div>
      <h2 class="text-xl font-bold text-gray-800 mb-2">${lang === 'zh' ? '你还没有测试结果' : 'No test result yet'}</h2>
      <p class="text-gray-500 mb-6">${lang === 'zh' ? '需要先完成测试，才能进行人格对比。\n测出你的人格后，就可以和朋友对比了！' : 'You need to complete the test first before comparing.\nOnce you know your personality, you can compare with friends!'}</p>
      <button onclick="this.closest('.fixed').remove();startQuiz()" class="w-full py-3 bg-purple-500 text-white rounded-full font-medium hover:bg-purple-600 transition">${lang === 'zh' ? '🚀 立即测试' : '🚀 Take the test now'}</button>
      <button onclick="this.closest('.fixed').remove()" class="w-full py-3 mt-3 border-2 border-gray-300 text-gray-500 rounded-full font-medium hover:bg-gray-50 transition">${lang === 'zh' ? '返回' : 'Go back'}</button>
    </div>`;
    document.body.appendChild(modal);
    return;
  }
  
  const personality = currentPersonality || findMatchedPersonality();
  let friendCode = '';
  
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto';
  
  const renderModal = () => {
    const friendPersonality = personalities.find(p => p.code === friendCode.toUpperCase());
    const isValidCode = friendPersonality && friendPersonality.code !== 'DRUNK';
    
    modal.innerHTML = `
      <div class="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-auto">
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-2xl font-bold text-blue-600">${t('compare_title')}</h2>
            <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600 text-2xl">
              ✕
            </button>
          </div>
          
          <div class="space-y-6">
            <!-- 输入框 -->
            <div>
              <label class="block text-gray-700 mb-2">${t('enter_friend_code')}</label>
              <div class="flex space-x-2">
                <input 
                  id="compareInput"
                  type="text" 
                  value="${friendCode}"
                  class="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                  placeholder="例如: CTRL, BOSS, SHIT"
                  maxlength="5"
                />
                <button 
                  id="compareBtn"
                  class="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition"
                >
                  ${t('compare_btn')}
                </button>
              </div>
            </div>
            
            ${!isValidCode ? `
              <div class="text-center py-8">
                <div class="text-gray-400 text-4xl mb-4">🔍</div>
                <p class="text-gray-500">${t('no_comparison')}</p>
              </div>
            ` : `
              <!-- 对比结果 -->
              <div class="space-y-6">
                <!-- 人格信息 -->
                <div class="grid grid-cols-2 gap-4">
                  <div class="text-center p-4 border border-purple-200 rounded-xl">
                    <div class="text-3xl mb-2">${getPersonalityAvatar(personality.code)}</div>
                    <div class="font-bold text-lg" style="color: ${personality.color}">${personality.code} <span class="text-sm font-normal">${lang === 'zh' ? personality.name_zh : personality.name_en}</span></div>
                    <div class="text-gray-600 text-sm">${t('your_pattern')}</div>
                  </div>
                  <div class="text-center p-4 border border-blue-200 rounded-xl">
                    <div class="text-3xl mb-2">${getPersonalityAvatar(friendPersonality.code)}</div>
                    <div class="font-bold text-lg" style="color: ${friendPersonality.color}">${friendPersonality.code} <span class="text-sm font-normal">${lang === 'zh' ? friendPersonality.name_zh : friendPersonality.name_en}</span></div>
                    <div class="text-gray-600 text-sm">${t('friend_pattern')}</div>
                  </div>
                </div>
                
                <!-- 相似度分析 -->
                <div class="bg-gray-50 rounded-xl p-5">
                  <h3 class="font-bold text-gray-800 mb-4">${t('dimension_differences')}</h3>
                  
                  <div class="space-y-4">
                    ${(() => {
                      const yourPattern = personality.pattern;
                      const friendPattern = friendPersonality.pattern;
                      
                      // 计算雷达维度相似度
                      const yourRadarValues = patternToRadarValues(yourPattern);
                      const friendRadarValues = patternToRadarValues(friendPattern);
                      
                      let sameCount = 0;
                      let diffCount = 0;
                      
                      for (let i = 0; i < yourRadarValues.length; i++) {
                        const yourLabel = radarValueToLabel(yourRadarValues[i]);
                        const friendLabel = radarValueToLabel(friendRadarValues[i]);
                        if (yourLabel === friendLabel) sameCount++;
                        else diffCount++;
                      }
                      
                      const similarity = Math.round((sameCount / yourRadarValues.length) * 100);
                      let similarityLevel = '';
                      let similarityColor = '';
                      
                      if (similarity >= 80) {
                        similarityLevel = t('high_similarity');
                        similarityColor = 'text-green-600';
                      } else if (similarity >= 60) {
                        similarityLevel = t('medium_similarity');
                        similarityColor = 'text-yellow-600';
                      } else {
                        similarityLevel = t('low_similarity');
                        similarityColor = 'text-red-600';
                      }
                      
                      return `
                        <div class="text-center mb-4">
                          <div class="text-4xl font-bold ${similarityColor} mb-2">${similarity}%</div>
                          <div class="text-gray-600">${similarityLevel}</div>
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4 text-center">
                          <div class="p-3 bg-green-50 rounded-lg">
                            <div class="text-2xl font-bold text-green-600">${sameCount}</div>
                            <div class="text-sm text-green-700">${lang === 'zh' ? '相同维度' : 'Same Dims'}</div>
                          </div>
                          <div class="p-3 bg-red-50 rounded-lg">
                            <div class="text-2xl font-bold text-red-600">${diffCount}</div>
                            <div class="text-sm text-red-700">${lang === 'zh' ? '不同维度' : 'Diff Dims'}</div>
                          </div>
                        </div>
                      `;
                    })()}
                  </div>
                </div>
                
                <!-- 维度对比详情 -->
                <div class="bg-white border border-gray-200 rounded-xl p-5">
                  <h3 class="font-bold text-gray-800 mb-4">${t('dimension_differences')} (15${lang === 'zh' ? '维度' : ' Dims'})</h3>
                  
                  <div class="space-y-2 max-h-60 overflow-y-auto pr-2">
                    ${(() => {
                      const dimensionNames = i18n[lang].dimensions || {};
                      const yourPattern = personality.pattern;
                      const friendPattern = friendPersonality.pattern;
                      // Use radar dimensions and values
                      const yourRadarValues = patternToRadarValues(yourPattern);
                      const friendRadarValues = patternToRadarValues(friendPattern);
                      
                      return dimensionOrder.map((dim, index) => {
                        const yourValue = radarValueToLabel(yourRadarValues[index]);
                        const friendValue = radarValueToLabel(friendRadarValues[index]);
                        const isSame = yourValue === friendValue;
                        const dimName = dimensionNames[dim] || dim;
                        
                        const valueLabels = { 'H': '高', 'M': '中', 'L': '低' };
                        const valueLabelsEn = { 'H': 'High', 'M': 'Medium', 'L': 'Low' };
                        const valueMap = lang === 'zh' ? valueLabels : valueLabelsEn;
                        
                        return `
                          <div class="flex items-center justify-between p-2 ${isSame ? 'bg-green-50' : 'bg-red-50'} rounded">
                            <div class="flex-1">
                              <div class="text-sm text-gray-600">${dimName}</div>
                            </div>
                            <div class="flex items-center space-x-4">
                              <div class="text-sm font-medium ${isSame ? 'text-green-700' : 'text-red-700'}">
                                ${valueMap[yourValue] || yourValue}
                              </div>
                              <div class="text-gray-400">→</div>
                              <div class="text-sm font-medium ${isSame ? 'text-green-700' : 'text-red-700'}">
                                ${valueMap[friendValue] || friendValue}
                              </div>
                            </div>
                          </div>
                        `;
                      }).join('');
                    })()}
                  </div>
                </div>
                
                <div class="text-center">
                  <button 
                    onclick="generateComparisonCard('${friendPersonality.code}')"
                    class="px-6 py-3 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition"
                  >
                    ${t('generate_compare_card')}
                  </button>
                </div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
    
    // 绑定事件
    setTimeout(() => {
      const input = document.getElementById('compareInput');
      const btn = document.getElementById('compareBtn');
      if (input) {
        input.addEventListener('input', (e) => {
          e.target.value = e.target.value.toUpperCase();
          friendCode = e.target.value;
          // Don't re-render modal on every keystroke — just update the variable
        });
        // Focus the input after modal renders
        input.focus();
      }
      if (btn) {
        btn.addEventListener('click', () => {
          if (friendCode) {
            const fp = personalities.find(p => p.code === friendCode.toUpperCase());
            if (!fp || fp.code === 'DRUNK') {
              alert(lang === 'zh' ? '请输入有效的SBTI代码（27种人格之一）' : 'Please enter a valid SBTI code (one of 27 personalities)');
            } else {
              // Valid code — re-render to show comparison result
              renderModal();
            }
          }
        });
      }
    }, 0);
  };
  
  renderModal();
  document.body.appendChild(modal);
}

// Generate comparison card
async function generateComparisonCard(friendCode) {
  const personality = currentPersonality || findMatchedPersonality();
  if (!personality) return;
  
  const friendPersonality = personalities.find(p => p.code === friendCode.toUpperCase());
  if (!friendPersonality) return;
  
  // 关闭对比模态框
  const existingModal = document.querySelector('.fixed.inset-0.bg-black');
  if (existingModal) existingModal.remove();
  
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  
  if (!ctx.roundRect) {
    ctx.roundRect = function(x, y, width, height, radius) {
      if (radius === 0) { this.rect(x, y, width, height); }
      else {
        this.moveTo(x + radius, y);
        this.lineTo(x + width - radius, y);
        this.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.lineTo(x + width, y + height - radius);
        this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.lineTo(x + radius, y + height);
        this.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.lineTo(x, y + radius);
        this.quadraticCurveTo(x, y, x + radius, y);
      }
    };
  }
  
  // 计算相似度（基于雷达维度）
  const yourRadarValues = patternToRadarValues(personality.pattern);
  const friendRadarValues = patternToRadarValues(friendPersonality.pattern);
  
  let sameCount = 0;
  for (let i = 0; i < yourRadarValues.length; i++) {
    const yourLabel = radarValueToLabel(yourRadarValues[i]);
    const friendLabel = radarValueToLabel(friendRadarValues[i]);
    if (yourLabel === friendLabel) sameCount++;
  }
  const similarity = Math.round((sameCount / yourRadarValues.length) * 100);
  let simColor = similarity >= 80 ? '#10B981' : (similarity >= 60 ? '#F59E0B' : '#EF4444');
  
  // 背景
  const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
  gradient.addColorStop(0, '#FFF8F0');
  gradient.addColorStop(1, '#FFFFFF');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1080, 1920);
  
  // 标题
  ctx.fillStyle = '#8B5CF6';
  ctx.font = 'bold 60px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(lang === 'zh' ? 'SBTI 人格对比' : 'SBTI Comparison', 540, 120);
  
  // 左侧人格
  ctx.fillStyle = personality.color || '#8B5CF6';
  ctx.beginPath();
  ctx.arc(270, 350, 100, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 80px Inter, sans-serif';
  ctx.fillText(personality.code, 270, 380);
  ctx.fillStyle = '#374151';
  ctx.font = '40px Inter, sans-serif';
  ctx.fillText(lang === 'zh' ? personality.name_zh : personality.name_en, 270, 500);
  
  // VS
  ctx.fillStyle = '#8B5CF6';
  ctx.font = 'bold 72px Inter, sans-serif';
  ctx.fillText('VS', 540, 380);
  
  // 右侧人格
  ctx.fillStyle = friendPersonality.color || '#3B82F6';
  ctx.beginPath();
  ctx.arc(810, 350, 100, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 80px Inter, sans-serif';
  ctx.fillText(friendPersonality.code, 810, 380);
  ctx.fillStyle = '#374151';
  ctx.font = '40px Inter, sans-serif';
  ctx.fillText(lang === 'zh' ? friendPersonality.name_zh : friendPersonality.name_en, 810, 500);
  
  // 相似度圆环
  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 20;
  ctx.beginPath();
  ctx.arc(540, 720, 120, 0, Math.PI * 2);
  ctx.stroke();
  
  ctx.strokeStyle = simColor;
  ctx.lineWidth = 20;
  ctx.beginPath();
  ctx.arc(540, 720, 120, -Math.PI / 2, -Math.PI / 2 + (similarity / 100) * Math.PI * 2);
  ctx.stroke();
  
  ctx.fillStyle = simColor;
  ctx.font = 'bold 72px Inter, sans-serif';
  ctx.fillText(similarity + '%', 540, 740);
  ctx.fillStyle = '#6B7280';
  ctx.font = '32px Inter, sans-serif';
  ctx.fillText(lang === 'zh' ? '相似度' : 'Similarity', 540, 790);
  
  // 维度对比条
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 40px Inter, sans-serif';
  ctx.fillText(lang === 'zh' ? '维度对比' : 'Dimension Comparison', 540, 900);
  
  const dimensionNames = i18n[lang].dimensions || {};
  
  // yourRadarValues and friendRadarValues are already declared above
  
  dimensionOrder.slice(0, 10).forEach((dim, index) => {
    const y = 960 + index * 60;
    const yourVal = radarValueToLabel(yourRadarValues[index]);
    const friendVal = radarValueToLabel(friendRadarValues[index]);
    const isSame = yourVal === friendVal;
    const dimName = (dimensionNames[dim] || dim).substring(0, 6);
    
    // 维度名称
    ctx.fillStyle = '#6B7280';
    ctx.font = '28px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(dimName, 100, y);
    
    // 你的值
    ctx.fillStyle = isSame ? '#10B981' : personality.color || '#8B5CF6';
    ctx.font = 'bold 28px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(yourVal, 440, y);
    
    // 分隔
    ctx.fillStyle = '#D1D5DB';
    ctx.fillText('|', 540, y);
    
    // 朋友值
    ctx.fillStyle = isSame ? '#10B981' : friendPersonality.color || '#3B82F6';
    ctx.fillText(friendVal, 640, y);
    
    // 状态图标
    ctx.fillStyle = isSame ? '#10B981' : '#EF4444';
    ctx.textAlign = 'left';
    ctx.font = '28px Inter, sans-serif';
    ctx.fillText(isSame ? '✓' : '✗', 750, y);
  });
  
  // 底部
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '36px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('sbti-test.pages.dev', 540, 1750);
  ctx.fillText(lang === 'zh' ? `${personality.code} × ${friendPersonality.code} 人格对比` : `${personality.code} × ${friendPersonality.code} Comparison`, 540, 1820);
  
  // 二维码 (lazy-load)
  if (window.QRCode || (await loadQRCode().catch(() => null), window.QRCode)) {
    const qrContainer = document.createElement('div');
    qrContainer.style.display = 'none';
    document.body.appendChild(qrContainer);
    new QRCode(qrContainer, {
      text: `${window.location.origin}/?ref=${personality.code}`,
      width: 100,
      height: 100,
      colorDark: '#374151',
      colorLight: '#FFFFFF',
      correctLevel: QRCode.CorrectLevel.L
    });
    const qrCanvas = qrContainer.querySelector('canvas');
    if (qrCanvas) {
      ctx.drawImage(qrCanvas, 490, 1860, 100, 100);
    }
    document.body.removeChild(qrContainer);
  }
  
  // 复制或下载
  canvas.toBlob(blob => {
    if (navigator.clipboard && window.ClipboardItem) {
      navigator.clipboard.write([new ClipboardItem({'image/png': blob})]).then(() => {
        alert(lang === 'zh' ? '对比卡片已复制到剪贴板' : 'Comparison card copied to clipboard');
      }).catch(() => {
        const link = document.createElement('a');
        link.download = `SBTI-compare-${personality.code}-${friendPersonality.code}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.92);
        link.click();
      });
    } else {
      const link = document.createElement('a');
      link.download = `SBTI-compare-${personality.code}-${friendPersonality.code}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.92);
      link.click();
    }
  });
}

// 显示历史对比
function showHistoryComparison() {
  try {
    const history = JSON.parse(localStorage.getItem('sbti_history') || '[]');
    if (history.length < 2) {
      alert(lang === 'zh' ? '历史记录不足，需要至少2次测试记录' : 'Not enough history, need at least 2 test records');
      return;
    }
    
    const current = history[0];
    const previous = history[1];
    const currentPersona = personalities.find(p => p.code === current.code);
    const previousPersona = personalities.find(p => p.code === previous.code);
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto';
    
    const formatDate = (iso) => {
      const d = new Date(iso);
      return d.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US');
    };
    
    const isSamePersonality = current.code === previous.code;
    
    modal.innerHTML = `
      <div class="bg-white rounded-2xl max-w-md w-full p-6 max-h-[80vh] overflow-auto">
        <h2 class="text-xl font-bold text-gray-800 mb-4 text-center">${lang === 'zh' ? '历史对比' : 'History Comparison'}</h2>
        
        <div class="flex justify-between items-center mb-4">
          <div class="text-center">
            <div class="text-sm text-gray-500 mb-1">${lang === 'zh' ? '上次' : 'Previous'}</div>
            <div class="text-3xl font-bold" style="color: ${previousPersona?.color || '#8B5CF6'}">${previous.code}</div>
            <div class="text-sm text-gray-600">${previousPersona ? (lang === 'zh' ? previousPersona.name_zh : previousPersona.name_en) : ''}</div>
            <div class="text-xs text-gray-400">${formatDate(previous.date)}</div>
          </div>
          <div class="text-center">
            <div class="text-2xl">${isSamePersonality ? '✓' : '→'}</div>
            <div class="text-sm text-gray-500 mt-2">${isSamePersonality ? (lang === 'zh' ? '稳定的' : 'Stable') : (lang === 'zh' ? '变化了' : 'Changed')}</div>
          </div>
          <div class="text-center">
            <div class="text-sm text-gray-500 mb-1">${lang === 'zh' ? '本次' : 'Current'}</div>
            <div class="text-3xl font-bold" style="color: ${currentPersona?.color || '#8B5CF6'}">${current.code}</div>
            <div class="text-sm text-gray-600">${currentPersona ? (lang === 'zh' ? currentPersona.name_zh : currentPersona.name_en) : ''}</div>
            <div class="text-xs text-gray-400">${formatDate(current.date)}</div>
          </div>
        </div>
        
        ${!isSamePersonality && currentPersona && previousPersona ? `
          <div class="bg-gray-50 rounded-xl p-4 mb-4">
            <h3 class="font-bold text-gray-700 mb-2">${lang === 'zh' ? '维度变化' : 'Dimension Changes'}</h3>
            ${generateDimensionDiff(current.pattern, previous.pattern).map(dim => `
              <div class="flex justify-between text-sm py-1">
                <span class="text-gray-600">${dim.name}</span>
                <span class="${dim.change > 0 ? 'text-green-600' : dim.change < 0 ? 'text-red-600' : 'text-gray-500'}">
                  ${dim.change > 0 ? '↑' : dim.change < 0 ? '↓' : '→'} ${dim.from} → ${dim.to}
                </span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        
        <div class="flex justify-between text-sm text-gray-500 mb-4">
          <span>${lang === 'zh' ? '上次匹配度' : 'Previous Score'}: ${previous.matchScore}%</span>
          <span>${lang === 'zh' ? '本次匹配度' : 'Current Score'}: ${current.matchScore}%</span>
        </div>
        
        <button onclick="this.closest('.fixed').remove()" class="w-full py-3 bg-purple-600 text-white rounded-full">
          ${lang === 'zh' ? '关闭' : 'Close'}
        </button>
      </div>
    `;
    
    document.body.appendChild(modal);
  } catch (e) {
    console.error('History comparison error:', e);
    alert(lang === 'zh' ? '无法加载历史记录' : 'Cannot load history');
  }
}

// 生成维度差异
function generateDimensionDiff(currentPattern, previousPattern) {
  const dims = [
    ['self_esteem', 'self_clarity', 'core_values'],
    ['emotional_reg', 'stress_handling', 'conflict_style'],
    ['social_energy', 'communication', 'relationship_style'],
    ['adaptability', 'change_acceptance', 'risk_tolerance'],
    ['goal_orientation', 'motivation', 'work_style'],
    ['learning_style', 'curiosity', 'knowledge_value'],
    ['decision_making', 'planning', 'habit_formation'],
    ['leadership', 'team_role', 'authority'],
    ['time_preference', 'patience', 'consistency']
  ];
  
  const dimNames = {
    self_esteem: '自尊水平', self_clarity: '自我认知', core_values: '核心价值观',
    emotional_reg: '情绪调节', stress_handling: '抗压能力', conflict_style: '冲突处理',
    social_energy: '社交能量', communication: '沟通风格', relationship_style: '关系模式',
    adaptability: '适应能力', change_acceptance: '变化接受', risk_tolerance: '风险承受',
    goal_orientation: '目标导向', motivation: '动机类型', work_style: '工作风格',
    learning_style: '学习风格', curiosity: '好奇心', knowledge_value: '知识价值',
    decision_making: '决策方式', planning: '规划能力', habit_formation: '习惯养成',
    leadership: '领导力', team_role: '团队角色', authority: '权威态度',
    time_preference: '时间偏好', patience: '耐心', consistency: '一致性'
  };
  
  const changes = [];
  for (const dimGroup of dims) {
    for (const dim of dimGroup) {
      if (currentPattern[dim] !== previousPattern[dim]) {
        changes.push({
          name: dimNames[dim] || dim,
          from: previousPattern[dim],
          to: currentPattern[dim],
          change: currentPattern[dim] === 'H' ? 1 : currentPattern[dim] === 'L' ? -1 : 0
        });
      }
    }
  }
  return changes.slice(0, 5);
}

// Cloudflare Pages native GitHub integration - Tue Apr 14 11:14:35 AM CST 2026

// ============ User Profile / Data Management ============
function showUserProfile() {
  currentPage = 'userProfile';
  currentPageParams = null;
  
  const personality = currentPersonality || findMatchedPersonality();
  const mbti = getSelectedMBTI();
  const guestCode = getGuestCode();
  const nickname = localStorage.getItem('sbti_ranking_nickname') || '';
  
  // 先用缓存或默认值立即渲染页面，不阻塞
  const cachedData = _userDataCache || { user_data: {}, history: [], daily: { answers: {}, streak: 0, last_date: null } };
  const userData = cachedData;
  
  // 后台异步刷新数据（不阻塞页面渲染）
  fetchUserData(false).then(freshData => {
    if (freshData && JSON.stringify(freshData) !== JSON.stringify(cachedData)) {
      // 数据有变化，重新渲染
      _renderUserProfileContent(freshData, personality, mbti, guestCode, nickname);
    }
  }).catch(() => {});
  
  _renderUserProfileContent(userData, personality, mbti, guestCode, nickname);
}

// 实际渲染“我的”页面（可被异步刷新调用）
function _renderUserProfileContent(userData, personality, mbti, guestCode, nickname) {
  const history = userData.history.length > 0
    ? userData.history.map(h => ({ code: h.personality_code, pattern: h.pattern, matchScore: h.match_score, date: h.created_at }))
    : JSON.parse(localStorage.getItem('sbti_history') || '[]');
  const dailyAnswers = userData.daily.answers || JSON.parse(localStorage.getItem('sbti_daily_answers') || '{}');
  const dailyStreak = userData.daily.streak || parseInt(localStorage.getItem('sbti_daily_streak') || '0');
  const dailyCount = Object.keys(dailyAnswers).length;
  const loggedInUser = JSON.parse(localStorage.getItem('sbti_user') || 'null');

  const app = document.getElementById('app');
  const emojiMap = {'CTRL':'🎯','BOSS':'👑','SHIT':'😒','PEACE':'🕊️','CARE':'🤗','LONE':'🐺','FUN':'🎉','DEEP':'🌌','REAL':'💎','GHOST':'👻','WARM':'☀️','EDGE':'🗡️','SAGE':'🧙','WILD':'🐆','COOL':'😎','SOFT':'🍬','SHARP':'⚡','DREAM':'💭','LOGIC':'🤖','SPARK':'✨','FLOW':'🌊','ROOT':'🌳','SKY':'☁️','FREE':'🦋','DARK':'🌑','STAR':'⭐','ECHO':'🔊'};

  // Stats calculation
  const totalTests = history.length;
  const personalityCounts = {};
  history.forEach(h => {
    personalityCounts[h.code] = (personalityCounts[h.code] || 0) + 1;
  });
  const topPersonality = Object.entries(personalityCounts).sort((a,b) => b[1] - a[1])[0];

  app.innerHTML = `
    <div class="min-h-screen bg-gradient-to-b from-cream to-white overflow-auto">
      <div class="max-w-md mx-auto px-4 py-8">
        <div class="flex items-center mb-6">
          <button onclick="renderLanding()" class="text-purple-600 mr-3">←</button>
          <h1 class="text-2xl font-bold text-gray-800">${lang === 'zh' ? '我的' : 'Profile'}</h1>
        </div>

        <!-- Login / User Card -->
        ${loggedInUser ? `
        <div class="bg-white rounded-2xl p-5 shadow-lg mb-6">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-full bg-purple-100 flex items-center justify-center text-2xl">${loggedInUser.avatar || '👤'}</div>
            <div class="flex-1">
              <div class="font-bold text-lg text-gray-800">${loggedInUser.nickname || loggedInUser.username}</div>
              <div class="text-sm text-gray-400">@${loggedInUser.username}</div>
            </div>
            <button onclick="doLogout()" class="text-sm text-red-400 hover:text-red-600">${lang === 'zh' ? '退出' : 'Logout'}</button>
          </div>
        </div>
        ` : `
        <div class="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <div class="text-center mb-4">
            <div class="text-5xl mb-2">👤</div>
            <p class="text-gray-500 text-sm">${lang === 'zh' ? '登录后可跨设备同步数据' : 'Login to sync data across devices'}</p>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <button onclick="showLoginModal()" class="py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition">${lang === 'zh' ? '登录' : 'Login'}</button>
            <button onclick="showRegisterModal()" class="py-3 border-2 border-purple-400 text-purple-600 rounded-xl font-medium hover:bg-purple-50 transition">${lang === 'zh' ? '注册' : 'Register'}</button>
          </div>
        </div>
        `}

        <!-- Stats Grid -->
        <div class="grid grid-cols-3 gap-3 mb-6">
          <div class="bg-white rounded-xl p-4 shadow text-center">
            <div class="text-2xl font-bold text-purple-600">${totalTests}</div>
            <div class="text-xs text-gray-500">${lang === 'zh' ? '总测试' : 'Tests'}</div>
          </div>
          <div class="bg-white rounded-xl p-4 shadow text-center">
            <div class="text-2xl font-bold text-green-600">${dailyCount}</div>
            <div class="text-xs text-gray-500">${lang === 'zh' ? '每日一测' : 'Daily'}</div>
          </div>
          <div class="bg-white rounded-xl p-4 shadow text-center">
            <div class="text-2xl font-bold text-orange-600">${dailyStreak}</div>
            <div class="text-xs text-gray-500">${lang === 'zh' ? '连续天数' : 'Streak'}</div>
          </div>
        </div>

        <!-- MBTI -->
        <div class="bg-white rounded-2xl p-4 shadow-lg mb-6">
          <h3 class="font-bold text-gray-800 mb-3">${lang === 'zh' ? '我的 MBTI' : 'My MBTI'}</h3>
          <div class="mb-3">
            ${mbti ? `
            <div class="flex items-center justify-between mb-3">
              <span class="text-lg font-bold text-purple-600">${mbti} - ${lang === 'zh' ? (mbtiDescriptions[mbti]?.zh || '') : (mbtiDescriptions[mbti]?.en || '')}</span>
              <button onclick="clearMBTI();showUserProfile()" class="text-sm text-gray-400 hover:text-red-400">✕</button>
            </div>
            ` : `
            <p class="text-sm text-gray-400 mb-3">${lang === 'zh' ? '选择你的MBTI类型（可选）' : 'Select your MBTI type (optional)'}</p>
            `}
            <div class="grid grid-cols-4 gap-1.5 mb-3">
              ${mbtiTypes.map(type => {
                const selected = mbti === type;
                const desc = mbtiDescriptions[type];
                return `<button onclick="setSelectedMBTI('${type}');showUserProfile()" class="py-1.5 rounded-lg text-xs font-medium transition-all ${selected ? 'ring-2 ring-offset-1' : 'hover:bg-gray-100'}" style="${selected ? `background-color: ${desc?.color || '#8B5CF6'}20; color: ${desc?.color || '#8B5CF6'}; border-color: ${desc?.color || '#8B5CF6'}` : 'background-color: #F9FAFB; color: #4B5563;'}">${type}</button>`;
              }).join('')}
            </div>
          </div>
          <div class="flex gap-2">
            <a href="https://www.16personalities.com/ch" target="_blank" rel="noopener" class="flex-1 py-2 text-center border border-purple-300 text-purple-500 rounded-lg text-sm hover:bg-purple-50">${lang === 'zh' ? '🔗 去测试MBTI' : '🔗 Take MBTI test'}</a>
            <button onclick="showMBTIIntersection()" class="flex-1 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700" ${mbti ? '' : 'disabled style="opacity: 0.5"'}>${lang === 'zh' ? '查看交叉解读' : 'Cross Analysis'}</button>
          </div>
        </div>

        <!-- History -->
        ${history.length > 0 ? `
        <div class="bg-white rounded-2xl p-4 shadow-lg mb-6">
          <h3 class="font-bold text-gray-800 mb-3">${lang === 'zh' ? '测试历史' : 'Test History'}</h3>
          <div class="space-y-2 max-h-60 overflow-y-auto">
            ${history.slice().reverse().slice(0, 10).map(h => {
              const hp = personalities.find(p => p.code === h.code);
              const he = emojiMap[h.code] || '🧩';
              return `
                <div class="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                  <span class="text-xl">${he}</span>
                  <div class="flex-1">
                    <span class="font-medium" style="color:${hp ? hp.color : '#666'}">${h.code}</span>
                    <span class="text-xs text-gray-400 ml-2">${h.date || ''}</span>
                  </div>
                  ${h.score ? `<span class="text-sm text-gray-500">${h.score}%</span>` : ''}
                </div>`;
            }).join('')}
          </div>
          ${topPersonality ? `
          <div class="mt-3 pt-3 border-t border-gray-100 text-sm text-gray-500">
            ${lang === 'zh' ? `最常获得: <strong>${topPersonality[0]}</strong> (${topPersonality[1]}次)` : `Most frequent: <strong>${topPersonality[0]}</strong> (${topPersonality[1]}x)`}
          </div>` : ''}
        </div>
        ` : `
        <div class="bg-white rounded-2xl p-6 shadow-lg mb-6 text-center">
          <p class="text-gray-400">${lang === 'zh' ? '暂无测试历史' : 'No test history'}</p>
          <button onclick="startQuiz()" class="mt-3 px-6 py-2 bg-purple-600 text-white rounded-full">${lang === 'zh' ? '开始测试' : 'Start Test'}</button>
        </div>
        `}

        <!-- Data Management -->
        <div class="bg-white rounded-2xl p-4 shadow-lg mb-6">
          <h3 class="font-bold text-gray-800 mb-3">${lang === 'zh' ? '数据管理' : 'Data Management'}</h3>
          <div class="space-y-3">
            <button onclick="deleteAllData()" class="w-full py-3 border-2 border-red-300 text-red-500 rounded-xl font-medium hover:bg-red-50 transition">
              ${lang === 'zh' ? '🗑 清除所有数据' : '🗑 Delete all data'}
            </button>
            <button onclick="exportMyData()" class="w-full py-3 border-2 border-gray-300 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition">
              ${lang === 'zh' ? '📦 导出我的数据' : '📦 Export my data'}
            </button>
          </div>
        </div>

        <button onclick="renderLanding()" class="w-full py-3 border-2 border-purple-400 text-purple-600 rounded-full font-medium hover:bg-purple-50 transition">${lang === 'zh' ? '← 返回首页' : '← Back to Home'}</button>
      </div>
      <button onclick="toggleLang()" class="fixed top-4 right-4 px-3 py-1 border border-purple-300 rounded-full text-purple-500 hover:bg-purple-50 text-sm">${lang === 'zh' ? 'EN' : '中文'}</button>
    </div>
  `;
}

// Delete all data (server + local)
async function deleteAllData() {
  // 第1次确认 - 明确列出将删除的数据类型
  const confirmed1 = confirm(lang === 'zh'
    ? `⚠️ 确定删除所有数据？\n\n将删除：排行榜、每日一测、测试历史及本地数据。\n\n此操作不可恢复。`
    : `⚠️ Delete ALL data?\n\nThis will remove: Rankings, Daily quiz, Test history & Local data.\n\nThis cannot be undone.`);
  if (!confirmed1) return;

  // 第2次确认
  const confirmed2 = confirm(lang === 'zh'
    ? '🔴 最后确认：数据将永久删除，无法找回。确定继续？'
    : '🔴 Final warning: Data will be permanently deleted. Continue?');
  if (!confirmed2) return;

  let serverDeleted = null;
  let localDeleted = 0;

  // 1. Delete server data
  try {
    const guestCode = getGuestCode();
    const res = await fetch(`${API_BASE}/api/data`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guest_code: guestCode })
    });
    const data = await res.json();
    if (data.success) {
      serverDeleted = data.deleted || {};
    }
  } catch (e) {
    // Server unreachable — continue to clear local
  }

  // 2. Clear local data
  clearUserDataCache();
  const sbtiKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('sbti_')) sbtiKeys.push(key);
  }
  sbtiKeys.forEach(k => localStorage.removeItem(k));
  localDeleted = sbtiKeys.length;

  // 3. Show detailed result
  let msg = '';
  if (lang === 'zh') {
    msg = '✅ 所有数据已清除\n\n';
    msg += '【服务器数据】\n';
    if (serverDeleted) {
      msg += `• 排行榜记录: ${serverDeleted.rankings || 0} 条\n`;
      msg += `• 每日一测记录: ${serverDeleted.daily_quiz || 0} 条\n`;
      msg += `• 测试历史: ${serverDeleted.history || 0} 条\n`;
    } else {
      msg += '• 无服务器数据或已清除\n';
    }
    msg += `\n【本地数据】\n`;
    msg += `• 已清除 ${localDeleted} 条本地记录`;
  } else {
    msg = '✅ All data cleared\n\n';
    msg += '[Server]\n';
    if (serverDeleted) {
      msg += `• Rankings: ${serverDeleted.rankings || 0}\n`;
      msg += `• Daily quiz: ${serverDeleted.daily_quiz || 0}\n`;
      msg += `• History: ${serverDeleted.history || 0}\n`;
    } else {
      msg += '• No server data or already cleared\n';
    }
    msg += `\n[Local]\n`;
    msg += `• ${localDeleted} local record(s) removed`;
  }

  alert(msg);
  renderLanding();
}

// Export user data as TXT
function exportMyData() {
  const lines = [];
  lines.push('=== SBTI 用户数据导出 ===');
  lines.push('导出时间: ' + new Date().toLocaleString());
  lines.push('');
  
  // 基本信息
  const user = JSON.parse(localStorage.getItem('sbti_user') || 'null');
  if (user) {
    lines.push('【账号信息】');
    lines.push('用户名: ' + (user.username || ''));
    lines.push('昵称: ' + (user.nickname || ''));
    lines.push('');
  }
  
  // SBTI 结果
  const personality = currentPersonality || findMatchedPersonality();
  if (personality) {
    lines.push('【当前SBTI结果】');
    lines.push('类型: ' + personality.code);
    lines.push('名称: ' + (lang === 'zh' ? personality.name_zh : personality.name_en));
    if (personality._matchScore) lines.push('匹配度: ' + personality._matchScore + '%');
    lines.push('');
  }
  
  // MBTI
  const mbti = getSelectedMBTI();
  if (mbti) {
    lines.push('【MBTI类型】');
    lines.push(mbti);
    lines.push('');
  }
  
  // 统计
  const history = JSON.parse(localStorage.getItem('sbti_history') || '[]');
  const dailyAnswers = JSON.parse(localStorage.getItem('sbti_daily_answers') || '{}');
  const dailyStreak = localStorage.getItem('sbti_daily_streak') || '0';
  lines.push('【统计数据】');
  lines.push('总测试次数: ' + history.length);
  lines.push('每日一测参与: ' + Object.keys(dailyAnswers).length);
  lines.push('连续天数: ' + dailyStreak);
  const guestCode = localStorage.getItem('sbti_guest_code');
  if (guestCode) lines.push('临时码: ' + guestCode);
  const nickname = localStorage.getItem('sbti_ranking_nickname');
  if (nickname) lines.push('排行榜昵称: ' + nickname);
  lines.push('');
  
  // 测试历史
  if (history.length > 0) {
    lines.push('【测试历史】');
    history.slice().reverse().forEach((h, i) => {
      lines.push((i+1) + '. ' + h.code + (h.date ? ' (' + h.date + ')' : '') + (h.score ? ' 匹配度:' + h.score + '%' : ''));
    });
    lines.push('');
  }
  
  // 每日一测记录
  const dailyKeys = Object.keys(dailyAnswers);
  if (dailyKeys.length > 0) {
    lines.push('【每日一测记录】');
    dailyKeys.sort().reverse().forEach(k => {
      lines.push(k + ': ' + JSON.stringify(dailyAnswers[k]));
    });
    lines.push('');
  }
  
  lines.push('--- Generated by SBTI Test ---');
  
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a');
  link.download = `sbti-data-${new Date().toISOString().slice(0,10)}.txt`;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
}

// ============ Auth UI ============
function showLoginModal() {
  const modal = document.createElement('div');
  modal.id = 'authModal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-md w-full p-6">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold text-gray-800">${lang === 'zh' ? '登录' : 'Login'}</h2>
        <button onclick="document.getElementById('authModal').remove()" class="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
      </div>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">${lang === 'zh' ? '用户名' : 'Username'}</label>
          <input id="loginUsername" type="text" maxlength="32" placeholder="${lang === 'zh' ? '输入用户名' : 'Enter username'}" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">${lang === 'zh' ? '密码' : 'Password'}</label>
          <input id="loginPassword" type="password" maxlength="64" placeholder="${lang === 'zh' ? '输入密码' : 'Enter password'}" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none">
        </div>
        <div id="loginError" class="text-red-500 text-sm hidden"></div>
        <button onclick="doLogin()" class="w-full py-3 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition">${lang === 'zh' ? '登录' : 'Login'}</button>
        <p class="text-center text-sm text-gray-400">${lang === 'zh' ? '没有账号？' : 'No account?'} <button onclick="document.getElementById('authModal').remove();showRegisterModal()" class="text-purple-500 hover:underline">${lang === 'zh' ? '注册一个' : 'Register'}</button></p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function showRegisterModal() {
  const modal = document.createElement('div');
  modal.id = 'authModal';
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-md w-full p-6">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold text-gray-800">${lang === 'zh' ? '注册' : 'Register'}</h2>
        <button onclick="document.getElementById('authModal').remove()" class="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
      </div>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">${lang === 'zh' ? '用户名' : 'Username'}</label>
          <input id="regUsername" type="text" maxlength="32" placeholder="${lang === 'zh' ? '2-32个字符' : '2-32 characters'}" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">${lang === 'zh' ? '昵称' : 'Nickname'}</label>
          <input id="regNickname" type="text" maxlength="16" placeholder="${lang === 'zh' ? '显示名称（可选）' : 'Display name (optional)'}" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">${lang === 'zh' ? '密码' : 'Password'}</label>
          <input id="regPassword" type="password" maxlength="64" placeholder="${lang === 'zh' ? '至少4位' : 'Min 4 characters'}" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">${lang === 'zh' ? '确认密码' : 'Confirm Password'}</label>
          <input id="regPassword2" type="password" maxlength="64" placeholder="${lang === 'zh' ? '再次输入密码' : 'Re-enter password'}" class="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none">
        </div>
        <div id="regError" class="text-red-500 text-sm hidden"></div>
        <button onclick="doRegister()" class="w-full py-3 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition">${lang === 'zh' ? '注册' : 'Register'}</button>
        <p class="text-center text-sm text-gray-400">${lang === 'zh' ? '已有账号？' : 'Have an account?'} <button onclick="document.getElementById('authModal').remove();showLoginModal()" class="text-purple-500 hover:underline">${lang === 'zh' ? '去登录' : 'Login'}</button></p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  if (!username || !password) {
    errEl.textContent = lang === 'zh' ? '请输入用户名和密码' : 'Username and password required';
    errEl.classList.remove('hidden');
    return;
  }
  // 显示加载状态
  const btn = document.querySelector('#authModal button[onclick="doLogin()"]');
  const originalText = btn?.textContent || (lang === 'zh' ? '登录' : 'Login');
  if (btn) {
    btn.disabled = true;
    btn.textContent = lang === 'zh' ? '登录中...' : 'Logging in...';
  }
  
  // 检查网络连接
  if (!navigator.onLine) {
    errEl.textContent = lang === 'zh' ? '无网络连接，请检查网络' : 'No network connection';
    errEl.classList.remove('hidden');
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
    return;
  }
  
  try {
    console.log('Logging in user:', username);
    const res = await fetchWithTimeout(
      `${API_BASE}/api/auth/login`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      },
      15000 // 15秒超时
    );
    console.log('Login response status:', res.status);
    const data = await res.json();
    console.log('Login response data:', data);
    if (data.success) {
      localStorage.setItem('sbti_user', JSON.stringify(data.user));
      localStorage.setItem('sbti_token', data.token);
      // Link existing guest code to account
      const guestCode = localStorage.getItem('sbti_guest_code');
      if (guestCode) {
        fetch(`${API_BASE}/api/auth/link-guest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: data.user.id, guest_code: guestCode })
        }).catch(() => {});
      }
      document.getElementById('authModal')?.remove();
      showToast(lang === 'zh' ? '登录成功！' : 'Logged in!');
      showUserProfile();
    } else {
      errEl.textContent = data.error || (lang === 'zh' ? '登录失败' : 'Login failed');
      errEl.classList.remove('hidden');
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
  } catch (e) {
    console.error('Login error:', e);
    // 详细的错误日志
    console.error('Error name:', e.name);
    console.error('Error message:', e.message);
    let errorMsg = lang === 'zh' ? '网络错误，请检查网络连接后重试' : 'Network error, please check connection and retry';
    if (e.message === 'Request timeout') {
      errorMsg = lang === 'zh' ? '请求超时，请稍后重试' : 'Request timeout, please retry later';
    } else if (e.name === 'TypeError') {
      errorMsg = lang === 'zh' ? '网络连接失败，请检查网络' : 'Network connection failed, please check network';
    }
    errEl.textContent = errorMsg;
    errEl.classList.remove('hidden');
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

async function doRegister() {
  const username = document.getElementById('regUsername').value.trim();
  const nickname = document.getElementById('regNickname').value.trim();
  const password = document.getElementById('regPassword').value;
  const password2 = document.getElementById('regPassword2').value;
  const errEl = document.getElementById('regError');
  if (!username || !password) {
    errEl.textContent = lang === 'zh' ? '请填写用户名和密码' : 'Username and password required';
    errEl.classList.remove('hidden');
    return;
  }
  if (password !== password2) {
    errEl.textContent = lang === 'zh' ? '两次密码不一致' : 'Passwords do not match';
    errEl.classList.remove('hidden');
    return;
  }
  if (password.length < 4) {
    errEl.textContent = lang === 'zh' ? '密码至少4位' : 'Password min 4 characters';
    errEl.classList.remove('hidden');
    return;
  }
  // 显示加载状态
  const btn = document.querySelector('#authModal button[onclick="doRegister()"]');
  const originalText = btn?.textContent || (lang === 'zh' ? '注册' : 'Register');
  if (btn) {
    btn.disabled = true;
    btn.textContent = lang === 'zh' ? '注册中...' : 'Registering...';
  }
  
  // 检查网络连接
  if (!navigator.onLine) {
    errEl.textContent = lang === 'zh' ? '无网络连接，请检查网络' : 'No network connection';
    errEl.classList.remove('hidden');
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
    return;
  }
  
  try {
    console.log('Registering user:', username);
    const res = await fetchWithTimeout(
      `${API_BASE}/api/auth/register`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, nickname: nickname || username })
      },
      15000 // 15秒超时
    );
    console.log('Register response status:', res.status);
    const data = await res.json();
    console.log('Register response data:', data);
    if (data.success) {
      localStorage.setItem('sbti_user', JSON.stringify(data.user));
      localStorage.setItem('sbti_token', data.token);
      document.getElementById('authModal')?.remove();
      showToast(lang === 'zh' ? '注册成功！' : 'Registered!');
      showUserProfile();
    } else {
      errEl.textContent = data.error || (lang === 'zh' ? '注册失败' : 'Registration failed');
      errEl.classList.remove('hidden');
      if (btn) {
        btn.disabled = false;
        btn.textContent = originalText;
      }
    }
  } catch (e) {
    console.error('Register error:', e);
    // 详细的错误日志
    console.error('Error name:', e.name);
    console.error('Error message:', e.message);
    console.error('Error stack:', e.stack);
    let errorMsg = lang === 'zh' ? '网络错误，请检查网络连接后重试' : 'Network error, please check connection and retry';
    if (e.message === 'Request timeout') {
      errorMsg = lang === 'zh' ? '请求超时，请稍后重试' : 'Request timeout, please retry later';
    } else if (e.name === 'TypeError') {
      errorMsg = lang === 'zh' ? '网络连接失败，请检查网络' : 'Network connection failed, please check network';
    }
    errEl.textContent = errorMsg;
    errEl.classList.remove('hidden');
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }
}

function doLogout() {
  const confirmed = confirm(lang === 'zh' ? '确定退出登录？' : 'Logout?');
  if (!confirmed) return;
  localStorage.removeItem('sbti_user');
  localStorage.removeItem('sbti_token');
  showToast(lang === 'zh' ? '已退出' : 'Logged out');
  showUserProfile();
}

// Initialize app - 移除重复的 loadData 调用，只在 DOMContentLoaded 中初始化一次
// 注意：loadData 已在上方 DOMContentLoaded 事件中调用
