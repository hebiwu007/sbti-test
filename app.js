// app.js - SBTI Personality Test Application

// State
let questions = [];
let personalities = [];
let currentQuestion = 0;
let answers = {};
let lang = localStorage.getItem('sbti_lang') || 'zh';
let testCount = 0;

// Dimension mapping (matching questions.json)
const dimensionOrder = [
  'self_esteem',      // Q1
  'self_esteem',      // Q2
  'self_clarity',     // Q3
  'self_clarity',     // Q4
  'core_values',      // Q5
  'attachment_security', // Q6
  'emotional_investment', // Q7
  'boundaries',       // Q8
  'attachment_security', // Q9
  'boundaries',       // Q10
  'worldview',        // Q11
  'rules_flexibility',// Q12
  'sense_of_purpose',// Q13
  'rules_flexibility',// Q14
  'worldview',        // Q15
  'motivation',       // Q16
  'decision_style',   // Q17
  'execution',        // Q18
  'execution',        // Q19
  'decision_style',   // Q20
  'social_initiative',// Q21
  'interpersonal_boundaries', // Q22
  'expression',       // Q23
  'social_initiative',// Q24
  'expression'       // Q25
];

// Model mapping
const modelMap = {
  self_esteem: 'self',
  self_clarity: 'self',
  core_values: 'self',
  attachment_security: 'emotional',
  emotional_investment: 'emotional',
  boundaries: 'emotional',
  worldview: 'attitude',
  rules_flexibility: 'attitude',
  sense_of_purpose: 'attitude',
  motivation: 'action',
  decision_style: 'action',
  execution: 'action',
  social_initiative: 'social',
  interpersonal_boundaries: 'social',
  expression: 'social'
};

// Model colors
const modelColors = {
  self: '#8B5CF6',      // Purple
  emotional: '#EC4899', // Pink
  attitude: '#10B981',  // Green
  action: '#F59E0B',    // Amber
  social: '#3B82F6'     // Blue
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  initApp();
});

async function loadData() {
  try {
    const [qRes, pRes] = await Promise.all([
      fetch('questions.json'),
      fetch('personalities.json')
    ]);
    questions = (await qRes.json()).questions;
    personalities = (await pRes.json()).personalities;
    
    // Load test count
    testCount = parseInt(localStorage.getItem('sbti_test_count') || '0');
  } catch (e) {
    console.error('Failed to load data:', e);
  }
}

function initApp() {
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
    <div class="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-purple-50 to-white">
      <div class="text-center max-w-md mx-auto">
        <h1 class="text-4xl font-bold text-purple-600 mb-4">${t('app_title')}</h1>
        <p class="text-xl text-gray-600 mb-8">${t('app_subtitle')}</p>
        <button onclick="startQuiz()" class="px-8 py-4 bg-purple-600 text-white rounded-full text-lg font-medium hover:bg-purple-700 transition shadow-lg hover:shadow-xl transform hover:-translate-y-1">
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
  currentQuestion = 0;
  answers = {};
  renderQuiz();
}

// Render quiz page
function renderQuiz() {
  const app = document.getElementById('app');
  const q = questions[currentQuestion];
  const progress = ((currentQuestion + 1) / questions.length) * 100;
  
  app.innerHTML = `
    <div class="min-h-screen flex flex-col bg-gradient-to-b from-purple-50 to-white">
      <!-- Progress bar -->
      <div class="w-full h-1 bg-gray-200">
        <div class="h-full bg-purple-500 transition-all duration-300" style="width: ${progress}%"></div>
      </div>
      
      <!-- Question -->
      <div class="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div class="w-full max-w-md">
          <p class="text-purple-500 font-medium mb-4">
            ${t('question_prefix')}${currentQuestion + 1}${t('question_suffix')}
          </p>
          <h2 class="text-2xl font-bold text-gray-800 mb-8 text-center">
            ${lang === 'zh' ? q.text_zh : q.text_en}
          </h2>
          
          <div class="space-y-3">
            ${q.options.map((opt, i) => `
              <button onclick="selectAnswer(${currentQuestion}, '${opt.value}')" 
                class="w-full p-4 text-left border-2 rounded-xl transition-all duration-200 hover:border-purple-400 hover:bg-purple-50 ${answers[currentQuestion] === opt.value ? 'border-purple-500 bg-purple-100' : 'border-gray-200 bg-white'}"
                style="${answers[currentQuestion] === opt.value ? 'border-color: #8B5CF6' : ''}">
                <span class="inline-block w-8 h-8 rounded-full bg-purple-100 text-purple-600 font-bold text-center leading-8 mr-3">${opt.key}</span>
                <span class="text-gray-700">${lang === 'zh' ? opt.text_zh : opt.text_en}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </div>
      
      <!-- Navigation -->
      <div class="p-4 flex justify-between max-w-md mx-auto w-full">
        <button onclick="prevQuestion()" ${currentQuestion === 0 ? 'disabled' : ''} 
          class="px-6 py-3 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">
          ${t('prev_btn')}
        </button>
        <button onclick="nextQuestion()" ${!answers[currentQuestion] ? 'disabled' : ''}
          class="px-6 py-3 rounded-full bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed">
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
  renderQuiz();
}

// Previous question
function prevQuestion() {
  if (currentQuestion > 0) {
    currentQuestion--;
    renderQuiz();
  }
}

// Next question
function nextQuestion() {
  if (!answers[currentQuestion]) return;
  
  if (currentQuestion < questions.length - 1) {
    currentQuestion++;
    renderQuiz();
  } else {
    // Check hidden question trigger
    showHiddenQuestion();
  }
}

// Show hidden question (Q26)
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
    <div class="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-purple-50 to-white">
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

// Handle hidden question answer
function handleHiddenAnswer(optionIndex) {
  // Option C (index 2) triggers DRUNK personality
  if (optionIndex === 2) {
    calculateResult(true);
  } else {
    calculateResult(false);
  }
}

// Calculate result
function calculateResult(isDrunk) {
  let result;
  
  if (isDrunk) {
    result = personalities.find(p => p.code === 'DRUNK');
  } else {
    // Calculate user pattern
    const userPattern = calculateUserPattern();
    
    // Find closest personality using Manhattan distance
    let minDistance = Infinity;
    let matchedPersonality = null;
    
    for (const p of personalities) {
      if (p.code === 'DRUNK') continue; // Skip hidden personality
      
      const distance = calculateDistance(userPattern, p.pattern);
      if (distance < minDistance) {
        minDistance = distance;
        matchedPersonality = p;
      }
    }
    
    result = matchedPersonality;
  }
  
  // Update test count
  testCount++;
  localStorage.setItem('sbti_test_count', testCount.toString());
  
  // Show result
  renderResult(result);
}

// Calculate user 15-dimension pattern
function calculateUserPattern() {
  // Count H/M/L for each dimension
  const dimCounts = {};
  
  for (let i = 0; i < 25; i++) {
    const dim = dimensionOrder[i];
    const value = answers[i];
    
    if (!dimCounts[dim]) {
      dimCounts[dim] = { H: 0, M: 0, L: 0 };
    }
    if (value) {
      dimCounts[dim][value]++;
    }
  }
  
  // Convert to pattern string
  const pattern = dimensionOrder.map(dim => {
    const counts = dimCounts[dim];
    if (!counts) return 'M';
    if (counts.H >= counts.M && counts.H >= counts.L) return 'H';
    if (counts.L >= counts.M && counts.L >= counts.H) return 'L';
    return 'M';
  });
  
  return pattern.join('');
}

// Calculate Manhattan distance
function calculateDistance(pattern1, pattern2) {
  let distance = 0;
  for (let i = 0; i < pattern1.length; i++) {
    if (pattern1[i] !== pattern2[i]) {
      // H->L or L->H = 2, H->M or L->M = 1
      const v1 = pattern1[i] === 'H' ? 2 : (pattern1[i] === 'L' ? 0 : 1);
      const v2 = pattern2[i] === 'H' ? 2 : (pattern2[i] === 'L' ? 0 : 1);
      distance += Math.abs(v1 - v2);
    }
  }
  return distance;
}

// Render result page
function renderResult(personality) {
  const app = document.getElementById('app');
  
  app.innerHTML = `
    <div class="min-h-screen bg-gradient-to-b from-purple-50 to-white overflow-auto">
      <div class="max-w-md mx-auto px-4 py-8">
        <!-- Header -->
        <div class="text-center mb-8">
          <p class="text-purple-500 font-medium mb-2">${t('your_type')}</p>
          <h1 class="text-5xl font-bold mb-2" style="color: ${personality.color}">${personality.code}</h1>
          <h2 class="text-2xl text-gray-700 mb-2">${lang === 'zh' ? personality.name_zh : personality.name_en}</h2>
          <p class="text-lg text-gray-500">${lang === 'zh' ? personality.tagline_zh : personality.tagline_en}</p>
        </div>
        
        <!-- Description -->
        <div class="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <p class="text-gray-700 leading-relaxed text-center">
            ${lang === 'zh' ? personality.desc_zh : personality.desc_en}
          </p>
        </div>
        
        <!-- Radar Chart -->
        <div class="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <h3 class="text-lg font-bold text-gray-800 mb-4 text-center">${t('dimension_analysis')}</h3>
          <canvas id="radarChart" class="w-full"></canvas>
        </div>
        
        <!-- Strengths & Blind Spots -->
        <div class="grid grid-cols-2 gap-4 mb-6">
          <div class="bg-white rounded-2xl p-4 shadow-lg">
            <h4 class="font-bold text-green-600 mb-3">${t('strengths')}</h4>
            <ul class="space-y-2">
              ${(lang === 'zh' ? personality.strengths_zh : personality.strengths_en).map(s => `
                <li class="text-gray-600 text-sm">✓ ${s}</li>
              `).join('')}
            </ul>
          </div>
          <div class="bg-white rounded-2xl p-4 shadow-lg">
            <h4 class="font-bold text-red-500 mb-3">${t('blind_spots')}</h4>
            <ul class="space-y-2">
              ${(lang === 'zh' ? personality.blind_spots_zh : personality.blind_spots_en).map(s => `
                <li class="text-gray-600 text-sm">✗ ${s}</li>
              `).join('')}
            </ul>
          </div>
        </div>
        
        <!-- Actions -->
        <div class="flex gap-4 mb-8">
          <button onclick="shareResult()" class="flex-1 py-3 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition">
            ${t('share_btn')}
          </button>
          <button onclick="restartQuiz()" class="flex-1 py-3 border-2 border-purple-300 text-purple-600 rounded-full font-medium hover:bg-purple-50 transition">
            ${t('restart_btn')}
          </button>
        </div>
        
        <a href="privacy.html" class="block text-center text-gray-400 hover:text-purple-500 text-sm mb-4">${t('privacy_link')}</a>
      </div>
      
      <button onclick="toggleLang()" class="fixed top-4 right-4 px-3 py-1 border border-purple-300 rounded-full text-purple-500 hover:bg-purple-50 text-sm">
        ${lang === 'zh' ? 'EN' : '中文'}
      </button>
    </div>
  `;
  
  // Draw radar chart
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
  
  // Dimensions by model
  const dimensions = [
    ['self_esteem', 'self_clarity', 'core_values'],
    ['attachment_security', 'emotional_investment', 'boundaries'],
    ['worldview', 'rules_flexibility', 'sense_of_purpose'],
    ['motivation', 'decision_style', 'execution'],
    ['social_initiative', 'interpersonal_boundaries', 'expression']
  ];
  
  const modelNames = ['self', 'emotional', 'attitude', 'action', 'social'];
  
  // Draw grid
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  
  for (let r = 1; r <= 3; r++) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * r / 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  
  // Draw axes and labels
  let angleIndex = 0;
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
      
      // Draw axis line
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.stroke();
      
      // Draw label
      const labelX = centerX + Math.cos(angle) * (radius + 20);
      const labelY = centerY + Math.sin(angle) * (radius + 20);
      const dimName = i18n[lang].dimensions[modelDims[i]] || modelDims[i];
      ctx.fillStyle = modelColors[modelNames[modelIdx]];
      ctx.fillText(dimName.substring(0, 6), labelX, labelY);
      
      angleIndex++;
    }
  }
  
  // Draw data polygon
  const values = pattern.split('').map(v => v === 'H' ? 3 : (v === 'M' ? 2 : 1));
  
  ctx.beginPath();
  ctx.strokeStyle = personality.color;
  ctx.lineWidth = 2;
  ctx.fillStyle = personality.color + '40';
  
  for (let i = 0; i < 15; i++) {
    const angle = (i * 24 - 90) * Math.PI / 180;
    const r = (values[i] / 3) * radius;
    const x = centerX + Math.cos(angle) * r;
    const y = centerY + Math.sin(angle) * r;
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  // Draw data points
  for (let i = 0; i < 15; i++) {
    const angle = (i * 24 - 90) * Math.PI / 180;
    const r = (values[i] / 3) * radius;
    const x = centerX + Math.cos(angle) * r;
    const y = centerY + Math.sin(angle) * r;
    
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = personality.color;
    ctx.fill();
  }
}

// Share result (placeholder)
function shareResult() {
  // In a real app, this would generate a shareable image or link
  alert(lang === 'zh' ? '分享功能开发中...' : 'Share feature coming soon...');
}

// Restart quiz
function restartQuiz() {
  currentQuestion = 0;
  answers = {};
  renderLanding();
}

// Main render function (for language toggle)
function render() {
  // Re-render current page based on state
  const app = document.getElementById('app');
  if (!app) return;
  
  if (Object.keys(answers).length === 0) {
    renderLanding();
  } else if (document.querySelector('.bg-white.rounded-2xl.p-6.shadow-lg')) {
    // Result page - find personality
    const matched = findMatchedPersonality();
    if (matched) renderResult(matched);
  } else {
    renderQuiz();
  }
}

// Find matched personality for re-render
function findMatchedPersonality() {
  const isDrunk = answers[25] === 'C';
  if (isDrunk) return personalities.find(p => p.code === 'DRUNK');
  
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