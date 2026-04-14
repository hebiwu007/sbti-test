// app.js - SBTI Personality Test Application

// State
let questions = [];
let personalities = [];
let currentQuestion = 0;
let answers = {};
let lang = localStorage.getItem('sbti_lang') || 'zh';
let testCount = 0;
let questionOrder = []; // 保存题目顺序
let currentPersonality = null; // 当前匹配的人格结果

// Dimension mapping (matching questions.json)
const dimensionOrder = [
  'self_esteem', 'self_esteem', 'self_clarity', 'self_clarity', 'core_values',
  'attachment_security', 'emotional_investment', 'boundaries', 'attachment_security', 'boundaries',
  'worldview', 'rules_flexibility', 'sense_of_purpose', 'rules_flexibility', 'worldview',
  'motivation', 'decision_style', 'execution', 'execution', 'decision_style',
  'social_initiative', 'interpersonal_boundaries', 'expression', 'social_initiative', 'expression'
];

// Model colors
const modelColors = {
  self: '#8B5CF6',
  emotional: '#EC4899',
  attitude: '#10B981',
  action: '#F59E0B',
  social: '#3B82F6'
};

// Personality avatars (abstract emoji representation)
const personalityAvatars = {
  'CTRL': '🎯',   // The Controller
  'BOSS': '👑',   // The Boss
  'SHIT': '😒',   // The Cynic
  'PEACE': '🕊️',  // The Peacemaker
  'HHHH': '🔥',   // Gigilord
  'COMF': '🛋️',   // Comfort Seeker
  'BORN': '🌟',   // Natural Born Star
  'FREE': '🕊️',   // The Free Spirit
  'WORK': '💼',   // The Worker
  'DEEP': '🌌',   // The Deep Thinker
  'LOVE': '❤️',   // The Lover
  'CARE': '🤗',   // The Caretaker
  'DRAM': '🎭',   // The Drama Queen/King
  'WILD': '🐆',   // The Wild Child
  'SHY': '🌱',    // The Shy One
  'HERO': '🦸',   // The Hero
  'SAFE': '🛡️',   // The Safety Guard
  'MESS': '🌀',   // The Messy One
  'QUIT': '⏸️',   // The Quitter
  'LAZY': '🦥',   // The Lazy One
  'OVER': '⚡',   // Overachiever
  'PERF': '✨',   // The Perfectionist
  'FAKE': '🎭',   // The Fake One
  'REAL': '💎',   // The Real Deal
  'SMUG': '😏',   // The Smug One
  'MOOD': '🌧️',   // Mood Swinger
  'CHAD': '💪',   // The Chad
  'DADA': '🎨',   // The Dadaist
  'DRUNK': '🍺',  // The Drunk One
};

// Get avatar for personality code
function getPersonalityAvatar(code) {
  return personalityAvatars[code] || '🧩';
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

// Get current MBTI selection
function getSelectedMBTI() {
  return localStorage.getItem('sbti_mbti') || null;
}

// Set MBTI selection
function setSelectedMBTI(mbti) {
  if (mbti) {
    localStorage.setItem('sbti_mbti', mbti);
  } else {
    localStorage.removeItem('sbti_mbti');
  }
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
      }
    } catch (e) {}
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
  renderLanding();
}

// Language toggle
function toggleLang() {
  lang = lang === 'zh' ? 'en' : 'zh';
  localStorage.setItem('sbti_lang', lang);
  render();
}

// Get translation
function t(key) {
  return i18n[lang][key] || key;
}

// Render landing page
function renderLanding() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-cream to-white">
      <div class="text-center max-w-md mx-auto">
        <h1 class="text-4xl md:text-5xl font-bold text-purple-600 mb-4">${t('app_title')}</h1>
        <p class="text-xl md:text-2xl text-gray-600 mb-8">${t('app_subtitle')}</p>
        <button onclick="startQuiz()" class="px-8 py-4 md:px-10 md:py-5 bg-purple-600 text-white rounded-full text-lg md:text-xl font-medium hover:bg-purple-700 transition shadow-lg hover:shadow-xl transform hover:-translate-y-1 active:scale-95">
          ${t('start_btn')}
        </button>
        <p class="mt-6 text-gray-500 text-sm">
          ${t('test_count_prefix')}<span class="font-bold text-purple-500">${testCount.toLocaleString()}</span>${t('test_count_suffix')}
        </p>
        <a href="privacy.html" class="mt-4 inline-block text-gray-400 hover:text-purple-500 text-sm">${t('privacy_link')}</a>
      </div>
      <button onclick="toggleLang()" class="fixed top-4 right-4 px-3 py-1 border border-purple-300 rounded-full text-purple-500 hover:bg-purple-50 text-sm">
        ${lang === 'zh' ? 'EN' : '中文'}
      </button>
    </div>
  `;
}

// Start quiz
function startQuiz() {
  // 从保存的进度恢复或从0开始
  if (Object.keys(answers).length === 0) {
    currentQuestion = 0;
    answers = {};
  }
  renderQuiz();
}

// Render quiz page
function renderQuiz() {
  const app = document.getElementById('app');
  // 使用乱序后的题目
  const qIndex = questionOrder[currentQuestion];
  const q = questions[qIndex];
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  
  app.innerHTML = `
    <div class="min-h-screen flex flex-col bg-gradient-to-b from-cream to-white">
      <div class="w-full h-1 bg-gray-200">
        <div class="h-full bg-purple-500 transition-all duration-300" style="width: ${progress}%"></div>
      </div>
      <div class="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div class="w-full max-w-md">
          <p class="text-purple-500 font-medium mb-4 text-base md:text-lg">
            ${t('question_prefix')}${currentQuestion + 1}${t('question_suffix')}
          </p>
          <h2 class="text-2xl md:text-3xl font-bold text-gray-800 mb-8 text-center">
            ${lang === 'zh' ? q.text_zh : q.text_en}
          </h2>
          <div class="space-y-3">
            ${q.options.map((opt, i) => `
              <button onclick="selectAnswer(${currentQuestion}, '${opt.value}')" 
                class="w-full p-5 md:p-4 text-left border-2 rounded-2xl md:rounded-xl transition-all duration-200 hover:border-purple-400 hover:bg-purple-50 active:scale-[0.98] ${answers[currentQuestion] === opt.value ? 'border-purple-500 bg-purple-100' : 'border-gray-200 bg-white'}"
                style="${answers[currentQuestion] === opt.value ? 'border-color: #8B5CF6' : ''}">
                <span class="inline-block w-10 h-10 md:w-8 md:h-8 rounded-full bg-purple-100 text-purple-600 font-bold text-center leading-10 md:leading-8 mr-3 text-lg md:text-base">${opt.key}</span>
                <span class="text-gray-700 text-base md:text-lg">${lang === 'zh' ? opt.text_zh : opt.text_en}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="p-4 flex justify-between max-w-md mx-auto w-full">
        <button onclick="prevQuestion()" ${currentQuestion === 0 ? 'disabled' : ''} 
          class="px-6 py-3 md:px-8 md:py-4 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-base md:text-lg">
          ${t('prev_btn')}
        </button>
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

// Select answer
function selectAnswer(qIndex, value) {
  answers[qIndex] = value;
  saveProgress();
  renderQuiz();
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
function showHiddenQuestion() {
  const app = document.getElementById('app');
  const hiddenQ = {
    text_zh: "周末深夜独处时，你通常会？",
    text_en: "What do you usually do alone on weekend late nights?",
    options: [
      { key: "A", text_zh: "看书、学习、做自己的事", text_en: "Read, study, do my own thing" },
      { key: "B", text_zh: "刷手机、追剧、放松一下", text_en: "Scroll phone, binge shows, relax" },
      { key: "C", text_zh: "约朋友喝酒/聚会 🍺", text_en: "Meet friends for drinks/party 🍺" }
    ]
  };
  
  app.innerHTML = `
    <div class="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-cream to-white">
      <div class="w-full max-w-md">
        <h2 class="text-xl font-bold text-gray-800 mb-8 text-center">
          ${lang === 'zh' ? hiddenQ.text_zh : hiddenQ.text_en}
        </h2>
        <div class="space-y-3">
          ${hiddenQ.options.map((opt, i) => `
            <button onclick="handleHiddenAnswer(${i})" 
              class="w-full p-4 text-left border-2 border-gray-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition">
              <span class="text-gray-700">${lang === 'zh' ? opt.text_zh : opt.text_en}</span>
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// Handle hidden answer
function handleHiddenAnswer(optionIndex) {
  if (optionIndex === 2) {
    calculateResult(true);
  } else {
    calculateResult(false);
  }
  clearProgress();
}

// Calculate result
function calculateResult(isDrunk) {
  let result;
  
  if (isDrunk) {
    result = personalities.find(p => p.code === 'DRUNK');
  } else {
    const userPattern = calculateUserPattern();
    let minDistance = Infinity;
    let matchedPersonality = null;
    
    for (const p of personalities) {
      if (p.code === 'DRUNK') continue;
      const distance = calculateDistance(userPattern, p.pattern);
      if (distance < minDistance) {
        minDistance = distance;
        matchedPersonality = p;
      }
    }
    result = matchedPersonality;
  }
  
  currentPersonality = result;
  testCount++;
  localStorage.setItem('sbti_test_count', testCount.toString());
  renderResult(result);
}

// Calculate user pattern
function calculateUserPattern() {
  const dimCounts = {};
  
  for (let i = 0; i < 25; i++) {
    const dim = dimensionOrder[i];
    const value = answers[i];
    if (!dimCounts[dim]) dimCounts[dim] = { H: 0, M: 0, L: 0 };
    if (value) dimCounts[dim][value]++;
  }
  
  return dimensionOrder.map(dim => {
    const counts = dimCounts[dim];
    if (!counts) return 'M';
    if (counts.H >= counts.M && counts.H >= counts.L) return 'H';
    if (counts.L >= counts.M && counts.L >= counts.H) return 'L';
    return 'M';
  }).join('');
}

// Calculate Manhattan distance
function calculateDistance(pattern1, pattern2) {
  let distance = 0;
  for (let i = 0; i < pattern1.length; i++) {
    if (pattern1[i] !== pattern2[i]) {
      const v1 = pattern1[i] === 'H' ? 2 : (pattern1[i] === 'L' ? 0 : 1);
      const v2 = pattern2[i] === 'H' ? 2 : (pattern2[i] === 'L' ? 0 : 1);
      distance += Math.abs(v1 - v2);
    }
  }
  return distance;
}

// Render result
function renderResult(personality) {
  const app = document.getElementById('app');
  const avatar = getPersonalityAvatar(personality.code);
  
  app.innerHTML = `
    <div class="min-h-screen bg-gradient-to-b from-cream to-white overflow-auto">
      <div class="max-w-md mx-auto px-4 py-8">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-20 h-20 rounded-full text-3xl mb-4" style="background-color: ${personality.color}20; border: 2px solid ${personality.color}">
            ${avatar}
          </div>
          <p class="text-purple-500 font-medium mb-2">${t('your_type')}</p>
          <h1 class="text-5xl font-bold mb-2" style="color: ${personality.color}">${personality.code}</h1>
          <h2 class="text-2xl text-gray-700 mb-2">${lang === 'zh' ? personality.name_zh : personality.name_en}</h2>
          <p class="text-lg text-gray-500">${lang === 'zh' ? personality.tagline_zh : personality.tagline_en}</p>
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
        
        <!-- MBTI 交叉解读 -->
        <div class="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <h3 class="text-lg font-bold text-gray-800 mb-4 text-center">${t('mbti_cross') || 'MBTI × SBTI 交叉解读'}</h3>
          <p class="text-gray-600 text-sm mb-4 text-center">选择你的MBTI类型，获取专属解读（可选）</p>
          
          <div class="mb-4">
            <div class="text-sm text-gray-500 mb-2">当前选择：</div>
            <div id="selectedMbti" class="text-lg font-medium">
              ${getSelectedMBTI() ? `<span class="px-3 py-1 rounded-full text-white" style="background-color: ${mbtiDescriptions[getSelectedMBTI()]?.color || '#8B5CF6'}">
                ${getSelectedMBTI()} - ${lang === 'zh' ? mbtiDescriptions[getSelectedMBTI()]?.zh : mbtiDescriptions[getSelectedMBTI()]?.en}
              </span>` : t('not_selected') || '未选择'}
            </div>
          </div>
          
          <div class="grid grid-cols-4 gap-2 mb-4">
            ${mbtiTypes.map(mbti => {
              const desc = mbtiDescriptions[mbti];
              const isSelected = getSelectedMBTI() === mbti;
              return `
                <button 
                  onclick="selectMBTI('${mbti}')"
                  class="px-2 py-2 rounded-lg text-sm font-medium transition-all ${isSelected ? 'ring-2 ring-offset-1' : 'hover:bg-gray-100'}"
                  style="${isSelected ? `background-color: ${desc.color}20; color: ${desc.color}; border-color: ${desc.color}` : 'background-color: #F9FAFB; color: #4B5563;'}"
                >
                  ${mbti}
                </button>
              `;
            }).join('')}
          </div>
          
          <div class="text-center">
            <button onclick="clearMBTI()" class="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 text-sm">
              ${t('clear_selection') || '清除选择'}
            </button>
            <button onclick="showMBTIIntersection()" class="ml-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm" ${getSelectedMBTI() ? '' : 'disabled style="opacity: 0.5; cursor: not-allowed"'}>
              ${t('view_intersection') || '查看交叉解读'}
            </button>
          </div>
        </div>
        
        <div class="flex gap-4 mb-8">
          <button onclick="shareResult()" class="flex-1 py-3 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition">${t('share_btn')}</button>
          <button onclick="restartQuiz()" class="flex-1 py-3 border-2 border-purple-300 text-purple-600 rounded-full font-medium hover:bg-purple-50 transition">${t('restart_btn')}</button>
        </div>
        <a href="privacy.html" class="block text-center text-gray-400 hover:text-purple-500 text-sm mb-4">${t('privacy_link')}</a>
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
  
  // Data polygon
  const values = pattern.split('').map(v => v === 'H' ? 3 : (v === 'M' ? 2 : 1));
  
  ctx.beginPath();
  ctx.strokeStyle = '#8B5CF6';
  ctx.lineWidth = 2;
  ctx.fillStyle = '#8B5CF640';
  
  for (let i = 0; i < 15; i++) {
    const angle = (i * 24 - 90) * Math.PI / 180;
    const r = (values[i] / 3) * radius;
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
    const r = (values[i] / 3) * radius;
    const x = centerX + Math.cos(angle) * r;
    const y = centerY + Math.sin(angle) * r;
    
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#8B5CF6';
    ctx.fill();
  }
}

// Share result - generate share card image
function shareResult() {
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
  
  // 2. 顶部装饰元素
  ctx.fillStyle = personality.color || '#8B5CF6';
  ctx.beginPath();
  ctx.arc(540, 300, 120, 0, Math.PI * 2);
  ctx.fill();
  
  // 人格代码（大字体）
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 140px Inter, sans-serif';
  ctx.textAlign = 'center';
  
  // 绘制头像（在代码左边）
  ctx.font = 'bold 100px Inter, sans-serif';
  ctx.fillText(avatar, 440, 340);
  
  // 绘制人格代码
  ctx.fillText(personality.code, 640, 340);
  
  // 3. 人格名称
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 72px Inter, sans-serif';
  ctx.fillText(lang === 'zh' ? personality.name_zh : personality.name_en, 540, 550);
  
  // 4. 标签线
  ctx.fillStyle = '#6B7280';
  ctx.font = '48px Inter, sans-serif';
  const tagline = lang === 'zh' ? personality.tagline_zh : personality.tagline_en;
  ctx.fillText(tagline, 540, 650);
  
  // 4.5 MBTI信息（如果有）
  if (selectedMBTI && mbtiDesc) {
    ctx.fillStyle = mbtiDesc.color || '#8B5CF6';
    ctx.font = 'bold 56px Inter, sans-serif';
    const mbtiText = `${selectedMBTI} × ${personality.code}`;
    ctx.fillText(mbtiText, 540, 720);
    
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '36px Inter, sans-serif';
    const mbtiDescText = lang === 'zh' ? mbtiDesc.zh : mbtiDesc.en;
    ctx.fillText(mbtiDescText, 540, 780);
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
    link.download = `${filename}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    alert(lang === 'zh' ? '图片已下载' : 'Image downloaded');
  }
}

// Restart quiz
function restartQuiz() {
  currentQuestion = 0;
  answers = {};
  clearProgress();
  shuffleQuestions();
  renderLanding();
}

// MBTI selection functions
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
  if (!mbti) {
    alert(lang === 'zh' ? '请先选择MBTI类型' : 'Please select MBTI type first');
    return;
  }
  
  const personality = currentPersonality || findMatchedPersonality();
  if (!personality) return;
  
  // 生成交叉解读
  const intersectionText = generateMBTIIntersection(personality.code, mbti);
  
  // 显示模态框
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-auto">
      <div class="p-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-xl font-bold text-gray-800">${personality.code} × ${mbti}</h3>
          <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
        
        <div class="mb-6">
          <div class="flex items-center justify-center space-x-4 mb-4">
            <div class="text-4xl">${getPersonalityAvatar(personality.code)}</div>
            <div class="text-3xl text-gray-300">×</div>
            <div class="px-3 py-1 rounded-full text-white text-lg" style="background-color: ${mbtiDescriptions[mbti]?.color || '#8B5CF6'}">
              ${mbti}
            </div>
          </div>
          <p class="text-gray-700 leading-relaxed">${intersectionText}</p>
        </div>
        
        <div class="text-center">
          <button onclick="shareResultWithMBTI()" class="px-6 py-3 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition">
            ${t('share_with_mbti') || '分享带MBTI的结果'}
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// Generate MBTI × SBTI intersection text (simplified version)
function generateMBTIIntersection(sbtiCode, mbtiType) {
  // 简化版本：使用模板生成
  const personality = personalities.find(p => p.code === sbtiCode);
  const mbtiDesc = mbtiDescriptions[mbtiType];
  
  if (!personality || !mbtiDesc) {
    return lang === 'zh' ? '无法生成交叉解读' : 'Cannot generate intersection analysis';
  }
  
  const sbtiName = lang === 'zh' ? personality.name_zh : personality.name_en;
  const mbtiName = lang === 'zh' ? mbtiDesc.zh : mbtiDesc.en;
  
  if (lang === 'zh') {
    return `你的 ${sbtiName} 人格与 ${mbtiName} (${mbtiType}) 的组合展现出独特特质：\n\n` +
           `作为 ${sbtiName}，你 ${personality.desc_zh.substring(0, 80)}... \n\n` +
           `当 ${sbtiName} 的特质与 ${mbtiName} 的思维方式相遇，你既能 ${personality.strengths_zh[0]?.toLowerCase() || '展现优势'}，` +
           `又需要留意 ${personality.blind_spots_zh[0]?.toLowerCase() || '潜在盲点'}。这种组合让你在保持 ${sbtiName} 本质的同时，` +
           `融入了 ${mbtiName} 的独特视角。`;
  } else {
    return `Your ${sbtiName} personality combined with ${mbtiName} (${mbtiType}) shows unique traits:\n\n` +
           `As a ${sbtiName}, you ${personality.desc_en.substring(0, 80)}... \n\n` +
           `When ${sbtiName} traits meet ${mbtiName} thinking style, you can ${personality.strengths_en[0]?.toLowerCase() || 'show strengths'} ` +
           `while being mindful of ${personality.blind_spots_en[0]?.toLowerCase() || 'potential blind spots'}. This combination allows you to maintain ` +
           `your ${sbtiName} essence while incorporating the unique perspective of ${mbtiName}.`;
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
}// Cloudflare Pages native GitHub integration - Tue Apr 14 11:14:35 AM CST 2026
