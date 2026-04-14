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
  
  app.innerHTML = `
    <div class="min-h-screen bg-gradient-to-b from-cream to-white overflow-auto">
      <div class="max-w-md mx-auto px-4 py-8">
        <div class="text-center mb-8">
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
  ctx.fillText(personality.code, 540, 340);
  
  // 3. 人格名称
  ctx.fillStyle = '#374151';
  ctx.font = 'bold 72px Inter, sans-serif';
  ctx.fillText(lang === 'zh' ? personality.name_zh : personality.name_en, 540, 550);
  
  // 4. 标签线
  ctx.fillStyle = '#6B7280';
  ctx.font = '48px Inter, sans-serif';
  const tagline = lang === 'zh' ? personality.tagline_zh : personality.tagline_en;
  ctx.fillText(tagline, 540, 650);
  
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
    link.download = `SBTI-${personality.code}.png`;
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
