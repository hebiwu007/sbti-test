const fs = require('fs');
const path = require('path');

// Load data
const personalities = require('./personalities.json').personalities;
const i18n = require('./i18n.js').i18n;

// Template for personality page
function generatePersonalityPage(personality, lang = 'zh') {
  const isZh = lang === 'zh';
  const name = isZh ? personality.name_zh : personality.name_en;
  const desc = isZh ? personality.desc_zh : personality.desc_en;
  const tagline = isZh ? personality.tagline_zh : personality.tagline_en;
  const strengths = isZh ? personality.strengths_zh : personality.strengths_en;
  const blindSpots = isZh ? personality.blind_spots_zh : personality.blind_spots_en;
  
  // Get other personalities for related links
  const relatedPersonalities = personalities
    .filter(p => p.code !== personality.code && p.code !== 'DRUNK')
    .slice(0, 6);
  
  // Calculate compatibility (simplified)
  const compatible = relatedPersonalities.slice(0, 3);
  const challenging = relatedPersonalities.slice(3, 6);
  
  // Emoji mapping for personality codes
  const emojiMap = {
    'CTRL': '🎯', 'BOSS': '👑', 'SHIT': '😒', 'PEACE': '🕊️',
    'CARE': '🤗', 'LONE': '🐺', 'FUN': '🎉', 'DEEP': '🌌',
    'REAL': '💎', 'GHOST': '👻', 'WARM': '☀️', 'EDGE': '🗡️',
    'SAGE': '🧙', 'WILD': '🐆', 'COOL': '😎', 'SOFT': '🍬',
    'SHARP': '⚡', 'DREAM': '💭', 'LOGIC': '🤖', 'SPARK': '✨',
    'FLOW': '🌊', 'ROOT': '🌳', 'SKY': '☁️', 'FREE': '🦋',
    'DARK': '🌑', 'STAR': '⭐', 'ECHO': '🔊', 'DRUNK': '🍺'
  };
  
  const emoji = emojiMap[personality.code] || '💫';
  
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${isZh ? 'SBTI' : 'SBTI'} ${personality.code} - ${name} | ${isZh ? '人格测试详细解读' : 'Personality Type Analysis'}</title>
  
  <!-- SEO Meta -->
  <meta name="description" content="${desc.substring(0, 150)}${desc.length > 150 ? '...' : ''}">
  <meta name="keywords" content="SBTI, ${personality.code}, ${name}, ${isZh ? '人格测试' : 'personality test'}, ${isZh ? '性格分析' : 'personality analysis'}, ${isZh ? '心理学' : 'psychology'}">
  <meta name="author" content="SBTI Test">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://sbti-test-53g.pages.dev/personality/${personality.code}${lang === 'zh' ? '' : '-en'}.html">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${personality.code} - ${name} | SBTI ${isZh ? '人格类型' : 'Personality Type'}">
  <meta property="og:description" content="${desc.substring(0, 120)}...">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://sbti-test-53g.pages.dev/personality/${personality.code}${lang === 'zh' ? '' : '-en'}.html">
  <meta property="og:image" content="https://sbti-test-53g.pages.dev/share-cards/${personality.code}.png">
  <meta property="og:site_name" content="SBTI ${isZh ? '人格测试' : 'Personality Test'}">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${personality.code} - ${name}">
  <meta name="twitter:description" content="${desc.substring(0, 120)}...">
  
  <!-- Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${personality.code} - ${name}",
    "description": "${desc.substring(0, 150)}",
    "author": {
      "@type": "Organization",
      "name": "SBTI Test"
    },
    "publisher": {
      "@type": "Organization",
      "name": "SBTI Test",
      "logo": {
        "@type": "ImageObject",
        "url": "https://sbti-test-53g.pages.dev/favicon.png"
      }
    },
    "datePublished": "2026-04-14",
    "dateModified": "2026-04-14",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": "https://sbti-test-53g.pages.dev/personality/${personality.code}${lang === 'zh' ? '' : '-en'}.html"
    }
  }
  </script>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            purple: {
              50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd',
              400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9',
              800: '#5b21b6', 900: '#4c1d95'
            },
            cream: '#FFF8F0'
          },
          fontFamily: { sans: ['Inter', 'Noto Sans SC', 'sans-serif'] }
        }
      }
    }
  </script>
  <style>
    * { -webkit-tap-highlight-color: transparent; }
    body {
      font-family: 'Inter', 'Noto Sans SC', sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .gradient-bg {
      background: linear-gradient(135deg, #FFF8F0 0%, #FFFFFF 100%);
    }
    .personality-card {
      background: linear-gradient(135deg, ${personality.color}20 0%, #FFFFFF 100%);
      border: 2px solid ${personality.color}40;
    }
  </style>
</head>
<body class="gradient-bg min-h-screen">
  <!-- Navigation -->
  <nav class="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
    <div class="max-w-6xl mx-auto px-4 py-3">
      <div class="flex justify-between items-center">
        <a href="${lang === 'zh' ? '/' : '/en'}" class="flex items-center space-x-2 text-purple-600 font-bold text-lg">
          <span>${isZh ? 'SBTI 人格测试' : 'SBTI Test'}</span>
        </a>
        <div class="flex space-x-4">
          <a href="${lang === 'zh' ? '/' : '/en'}" class="text-gray-600 hover:text-purple-600">${isZh ? '首页' : 'Home'}</a>
          <a href="${lang === 'zh' ? '/personality/' : '/personality-en/'}" class="text-gray-600 hover:text-purple-600">${isZh ? '所有人格' : 'All Types'}</a>
          <a href="${lang === 'zh' ? '#test' : '#test'}" class="bg-purple-600 text-white px-4 py-2 rounded-full hover:bg-purple-700">${isZh ? '开始测试' : 'Start Test'}</a>
        </div>
      </div>
    </div>
  </nav>

  <!-- Hero Section -->
  <header class="max-w-6xl mx-auto px-4 py-12">
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-32 h-32 rounded-full text-5xl mb-6" style="background-color: ${personality.color}20; border: 3px solid ${personality.color}">
        ${emoji}
      </div>
      <div class="mb-4">
        <span class="inline-block px-4 py-1 bg-purple-100 text-purple-600 rounded-full text-sm font-medium mb-2">${isZh ? 'SBTI 人格类型' : 'SBTI Personality Type'}</span>
        <h1 class="text-6xl font-bold mb-2" style="color: ${personality.color}">${personality.code}</h1>
        <h2 class="text-3xl text-gray-800">${name}</h2>
        <p class="text-xl text-gray-600 mt-2">${tagline}</p>
      </div>
    </div>
  </header>

  <!-- Main Content -->
  <main class="max-w-6xl mx-auto px-4 pb-16">
    <div class="grid lg:grid-cols-3 gap-8">
      <!-- Left Column -->
      <div class="lg:col-span-2 space-y-8">
        <!-- Personality Description -->
        <section class="bg-white rounded-2xl p-8 shadow-lg">
          <h3 class="text-2xl font-bold text-gray-800 mb-6">${isZh ? '人格描述' : 'Personality Description'}</h3>
          <div class="prose prose-lg max-w-none text-gray-700">
            <p class="text-lg leading-relaxed">${desc}</p>
          </div>
        </section>

        <!-- Strengths & Blind Spots -->
        <div class="grid md:grid-cols-2 gap-6">
          <section class="bg-white rounded-2xl p-6 shadow-lg">
            <div class="flex items-center mb-4">
              <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 mr-3">✓</div>
              <h3 class="text-xl font-bold text-green-600">${isZh ? '优势' : 'Strengths'}</h3>
            </div>
            <ul class="space-y-3">
              ${strengths.map(s => `<li class="flex items-start">
                <span class="text-green-500 mr-2">•</span>
                <span class="text-gray-700">${s}</span>
              </li>`).join('')}
            </ul>
          </section>

          <section class="bg-white rounded-2xl p-6 shadow-lg">
            <div class="flex items-center mb-4">
              <div class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 mr-3">✗</div>
              <h3 class="text-xl font-bold text-red-500">${isZh ? '盲点' : 'Blind Spots'}</h3>
            </div>
            <ul class="space-y-3">
              ${blindSpots.map(s => `<li class="flex items-start">
                <span class="text-red-500 mr-2">•</span>
                <span class="text-gray-700">${s}</span>
              </li>`).join('')}
            </ul>
          </section>
        </div>

        <!-- Dimension Analysis -->
        <section class="bg-white rounded-2xl p-8 shadow-lg">
          <h3 class="text-2xl font-bold text-gray-800 mb-6">${isZh ? '维度分析' : 'Dimension Analysis'}</h3>
          <div class="aspect-square max-w-md mx-auto">
            <canvas id="radarChart" class="w-full"></canvas>
          </div>
          <p class="text-gray-600 text-sm mt-4 text-center">${isZh ? '基于15个维度的SBTI分析模型' : 'Based on 15-dimension SBTI analysis model'}</p>
        </section>

        <!-- Compatibility -->
        <section class="bg-white rounded-2xl p-8 shadow-lg">
          <h3 class="text-2xl font-bold text-gray-800 mb-6">${isZh ? '人格兼容性' : 'Personality Compatibility'}</h3>
          <div class="grid md:grid-cols-2 gap-6">
            <div>
              <h4 class="font-bold text-green-600 mb-4">${isZh ? '相处良好' : 'Good With'}</h4>
              <div class="space-y-3">
                ${compatible.map(p => `
                  <a href="${lang === 'zh' ? '' : 'en/'}${p.code}.html" class="flex items-center p-3 bg-green-50 rounded-xl hover:bg-green-100 transition">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center mr-3" style="background-color: ${p.color}20">
                      ${emojiMap[p.code] || '💫'}
                    </div>
                    <div>
                      <div class="font-medium text-gray-800">${p.code}</div>
                      <div class="text-sm text-gray-600">${isZh ? p.name_zh : p.name_en}</div>
                    </div>
                  </a>
                `).join('')}
              </div>
            </div>
            <div>
              <h4 class="font-bold text-orange-500 mb-4">${isZh ? '需要磨合' : 'Challenge With'}</h4>
              <div class="space-y-3">
                ${challenging.map(p => `
                  <a href="${lang === 'zh' ? '' : 'en/'}${p.code}.html" class="flex items-center p-3 bg-orange-50 rounded-xl hover:bg-orange-100 transition">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center mr-3" style="background-color: ${p.color}20">
                      ${emojiMap[p.code] || '💫'}
                    </div>
                    <div>
                      <div class="font-medium text-gray-800">${p.code}</div>
                      <div class="text-sm text-gray-600">${isZh ? p.name_zh : p.name_en}</div>
                    </div>
                  </a>
                `).join('')}
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- Right Column -->
      <div class="space-y-8">
        <!-- Quick Facts -->
        <section class="bg-white rounded-2xl p-6 shadow-lg">
          <h3 class="text-xl font-bold text-gray-800 mb-4">${isZh ? '快速了解' : 'Quick Facts'}</h3>
          <div class="space-y-4">
            <div>
              <div class="text-sm text-gray-500">${isZh ? '人格代码' : 'Type Code'}</div>
              <div class="font-bold text-lg" style="color: ${personality.color}">${personality.code}</div>
            </div>
            <div>
              <div class="text-sm text-gray-500">${isZh ? '所属模型' : 'Primary Model'}</div>
              <div class="font-medium text-gray-800">${isZh ? getModelFromPattern(personality.pattern) : getModelFromPattern(personality.pattern)}</div>
            </div>
            <div>
              <div class="text-sm text-gray-500">${isZh ? '出现频率' : 'Frequency'}</div>
              <div class="font-medium text-gray-800">${isZh ? '中等' : 'Medium'}</div>
            </div>
          </div>
        </section>

        <!-- CTA -->
        <section class="personality-card rounded-2xl p-6 text-center">
          <div class="text-4xl mb-4">${emoji}</div>
          <h3 class="text-xl font-bold text-gray-800 mb-3">${isZh ? '你是' : 'Are you'} ${personality.code}?</h3>
          <p class="text-gray-600 mb-6">${isZh ? '完成测试确认你的SBTI人格类型' : 'Take the test to confirm your SBTI type'}</p>
          <a href="${lang === 'zh' ? '/' : '/en'}#test" class="inline-block w-full py-3 bg-white text-purple-600 font-bold rounded-full hover:bg-gray-50 transition">
            ${isZh ? '开始免费测试' : 'Start Free Test'}
          </a>
        </section>

        <!-- Related Types -->
        <section class="bg-white rounded-2xl p-6 shadow-lg">
          <h3 class="text-xl font-bold text-gray-800 mb-4">${isZh ? '相关人格' : 'Related Types'}</h3>
          <div class="space-y-3">
            ${relatedPersonalities.map(p => `
              <a href="${lang === 'zh' ? '' : 'en/'}${p.code}.html" class="flex items-center p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition">
                <div class="w-10 h-10 rounded-full flex items-center justify-center mr-3" style="background-color: ${p.color}20">
                  ${emojiMap[p.code] || '💫'}
                </div>
                <div class="flex-1">
                  <div class="font-medium text-gray-800">${p.code}</div>
                  <div class="text-sm text-gray-600">${isZh ? p.name_zh : p.name_en}</div>
                </div>
                <div class="text-gray-400">→</div>
              </a>
            `).join('')}
          </div>
        </section>

        <!-- Share -->
        <section class="bg-white rounded-2xl p-6 shadow-lg">
          <h3 class="text-xl font-bold text-gray-800 mb-4">${isZh ? '分享' : 'Share'}</h3>
          <div class="space-y-3">
            <button onclick="shareResult()" class="w-full py-3 bg-purple-600 text-white rounded-full font-medium hover:bg-purple-700 transition">
              ${isZh ? '生成分享卡片' : 'Generate Share Card'}
            </button>
            <button onclick="window.print()" class="w-full py-3 border-2 border-purple-300 text-purple-600 rounded-full font-medium hover:bg-purple-50 transition">
              ${isZh ? '打印此页' : 'Print This Page'}
            </button>
          </div>
        </section>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="bg-white border-t border-gray-200 py-8">
    <div class="max-w-6xl mx-auto px-4">
      <div class="flex flex-col md:flex-row justify-between items-center">
        <div class="mb-4 md:mb-0">
          <div class="text-purple-600 font-bold text-lg mb-2">SBTI ${isZh ? '人格测试' : 'Personality Test'}</div>
          <div class="text-gray-500 text-sm">© 2026 ${isZh ? '版权所有' : 'All rights reserved'}</div>
        </div>
        <div class="flex space-x-6">
          <a href="${lang === 'zh' ? '/privacy.html' : '/privacy-en.html'}" class="text-gray-600 hover:text-purple-600">${isZh ? '隐私政策' : 'Privacy'}</a>
          <a href="${lang === 'zh' ? '/personality/' : '/personality-en/'}" class="text-gray-600 hover:text-purple-600">${isZh ? '所有人格' : 'All Types'}</a>
          <a href="${lang === 'zh' ? '/' : '/en'}" class="text-gray-600 hover:text-purple-600">${isZh ? '首页' : 'Home'}</a>
        </div>
      </div>
    </div>
  </footer>

  <!-- Scripts -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script>
    // Determine model from pattern
    function getModelFromPattern(pattern) {
      const modelScores = [
        pattern.substring(0, 5),   // self model (questions 0-4)
        pattern.substring(5, 8),   // emotional model (questions 5-7)
        pattern.substring(8, 11),  // attitude model (questions 8-10)
        pattern.substring(11, 15), // action model (questions 11-14)
        pattern.substring(15, 20)  // social model (questions 15-19)
      ];
      
      const modelNames = ${isZh ? JSON.stringify(['自我维度', '情感维度', '态度维度', '行动维度', '社交维度']) : JSON.stringify(['Self Model', 'Emotional Model', 'Attitude Model', 'Action Model', 'Social Model'])};
      const scores = modelScores.map(p => {
        const hCount = (p.match(/H/g) || []).length;
        const lCount = (p.match(/L/g) || []).length;
        return hCount - lCount;
      });
      
      const maxScore = Math.max(...scores);
      return modelNames[scores.indexOf(maxScore)];
    }

    // Draw radar chart
    function drawRadarChart() {
      const canvas = document.getElementById('radarChart');
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      const pattern = "${personality.pattern}";
      
      // Convert pattern to radar values (simplified)
      const radarValues = pattern.split('').map(v => {
        if (v === 'H') return 3;
        if (v === 'M') return 2;
        return 1;
      }).slice(0, 15);
      
      const chart = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: ${isZh ? JSON.stringify([
            '自我价值感', '自我认知', '核心价值观',
            '依恋安全感', '情感投入', '边界感',
            '世界观', '规则灵活性', '目标感',
            '内驱力', '决策风格', '执行力',
            '社交主动性', '人际边界', '自我表达'
          ]) : JSON.stringify([
            'Self Esteem', 'Self Clarity', 'Core Values',
            'Attachment Security', 'Emotional Investment', 'Boundaries',
            'Worldview', 'Rules Flexibility', 'Sense of Purpose',
            'Motivation', 'Decision Style', 'Execution',
            'Social Initiative', 'Interpersonal Boundaries', 'Self Expression'
          ])},
          datasets: [{
            label: "${personality.code}",
            data: radarValues,
            backgroundColor: "${personality.color}40",
            borderColor: "${personality.color}",
            borderWidth: 2,
            pointBackgroundColor: "${personality.color}",
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          scales: {
            r: {
              angleLines: { color: '#E5E7EB' },
              grid: { color: '#E5E7EB' },
              pointLabels: { font: { size: 11 } },
              ticks: {
                display: false,
                max: 3,
                min: 1,
                stepSize: 1
              }
            }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }

    // Share function
    function shareResult() {
      if (navigator.share) {
        navigator.share({
          title: "${personality.code} - ${name}",
          text: "${desc.substring(0, 100)}...",
          url: window.location.href
        });
      } else {
        alert("${isZh ? '分享链接已复制到剪贴板' : 'Link copied to clipboard'}");
        navigator.clipboard.writeText(window.location.href);
      }
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', drawRadarChart);
  </script>
</body>
</html>`;
}

// Helper function to determine primary model from pattern
function getModelFromPattern(pattern) {
  // Simplified model detection based on pattern sections
  const modelScores = [
    pattern.substring(0, 5),   // self model (questions 0-4)
    pattern.substring(5, 8),   // emotional model (questions 5-7)
    pattern.substring(8, 11),  // attitude model (questions 8-10)
    pattern.substring(11, 15), // action model (questions 11-14)
    pattern.substring(15, 20)  // social model (questions 15-19)
  ];
  
  const modelNames = ['自我维度', '情感维度', '态度维度', '行动维度', '社交维度'];
  const scores = modelScores.map(p => {
    const hCount = (p.match(/H/g) || []).length;
    const lCount = (p.match(/L/g) || []).length;
    return hCount - lCount;
  });
  
  const maxScore = Math.max(...scores);
  return modelNames[scores.indexOf(maxScore)];
}

// Generate index page
function generateIndexPage(personalities, lang = 'zh') {
  const isZh = lang === 'zh';
  const title = isZh ? '所有SBTI人格类型 | 完整列表' : 'All SBTI Personality Types | Complete List';
  const description = isZh ? 
    '探索27种SBTI人格类型的完整列表，包括拿捏者(CTRL)、领导者(BOSS)、愤世者(SHIT)、和平主义者(PEACE)等。了解每种人格的特征、优势和盲点。' :
    'Explore the complete list of 27 SBTI personality types including The Controller(CTRL), The Boss(BOSS), The Cynic(SHIT), The Peacemaker(PEACE). Learn about each type\'s traits, strengths and blind spots.';
  
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://sbti-test-53g.pages.dev/personality/${lang === 'zh' ? '' : 'en/'}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            purple: { 50: '#f5f3ff', 500: '#8b5cf6', 600: '#7c3aed' },
            cream: '#FFF8F0'
          },
          fontFamily: { sans: ['Inter', 'Noto Sans SC', 'sans-serif'] }
        }
      }
    }
  </script>
</head>
<body class="bg-gradient-to-b from-cream to-white min-h-screen">
  <nav class="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
    <div class="max-w-6xl mx-auto px-4 py-3">
      <div class="flex justify-between items-center">
        <a href="${lang === 'zh' ? '/' : '/en'}" class="flex items-center space-x-2 text-purple-600 font-bold text-lg">
          <span>${isZh ? 'SBTI 人格测试' : 'SBTI Test'}</span>
        </a>
        <div class="flex space-x-4">
          <a href="${lang === 'zh' ? '/' : '/en'}" class="text-gray-600 hover:text-purple-600">${isZh ? '首页' : 'Home'}</a>
          <a href="${lang === 'zh' ? '#test' : '#test'}" class="bg-purple-600 text-white px-4 py-2 rounded-full hover:bg-purple-700">${isZh ? '开始测试' : 'Start Test'}</a>
        </div>
      </div>
    </div>
  </nav>

  <main class="max-w-6xl mx-auto px-4 py-12">
    <div class="text-center mb-12">
      <h1 class="text-4xl font-bold text-gray-800 mb-4">${isZh ? '所有SBTI人格类型' : 'All SBTI Personality Types'}</h1>
      <p class="text-gray-600 max-w-2xl mx-auto">${isZh ? 
        'SBTI包含5大模型、15个维度和27种主要人格类型（外加1种隐藏类型）。点击每种类型查看详细分析。' :
        'SBTI includes 5 major models, 15 dimensions, and 27 main personality types (plus 1 hidden type). Click each type for detailed analysis.'}</p>
    </div>

    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
      ${personalities.filter(p => p.code !== 'DRUNK').map(p => {
        const emojiMap = {
          'CTRL': '🎯', 'BOSS': '👑', 'SHIT': '😒', 'PEACE': '🕊️',
          'CARE': '🤗', 'LONE': '🐺', 'FUN': '🎉', 'DEEP': '🌌',
          'REAL': '💎', 'GHOST': '👻', 'WARM': '☀️', 'EDGE': '🗡️',
          'SAGE': '🧙', 'WILD': '🐆', 'COOL': '😎', 'SOFT': '🍬',
          'SHARP': '⚡', 'DREAM': '💭', 'LOGIC': '🤖', 'SPARK': '✨',
          'FLOW': '🌊', 'ROOT': '🌳', 'SKY': '☁️', 'FREE': '🦋',
          'DARK': '🌑', 'STAR': '⭐', 'ECHO': '🔊', 'DRUNK': '🍺'
        };
        const emoji = emojiMap[p.code] || '💫';
        const name = isZh ? p.name_zh : p.name_en;
        const tagline = isZh ? p.tagline_zh : p.tagline_en;
        
        return `
        <a href="${p.code}${lang === 'zh' ? '' : '-en'}.html" class="group">
          <div class="bg-white rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 h-full">
            <div class="flex items-start mb-4">
              <div class="w-16 h-16 rounded-full flex items-center justify-center text-2xl mr-4" style="background-color: ${p.color}20; border: 2px solid ${p.color}">
                ${emoji}
              </div>
              <div>
                <div class="font-bold text-xl mb-1" style="color: ${p.color}">${p.code}</div>
                <div class="font-medium text-gray-800">${name}</div>
                <div class="text-sm text-gray-500">${tagline}</div>
              </div>
            </div>
            <p class="text-gray-600 text-sm line-clamp-3">${isZh ? p.desc_zh.substring(0, 120) : p.desc_en.substring(0, 120)}...</p>
            <div class="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
              <span class="text-sm text-gray-500">${isZh ? '查看详情' : 'View Details'}</span>
              <span class="text-gray-400 group-hover:text-purple-600 transition">→</span>
            </div>
          </div>
        </a>`;
      }).join('')}
    </div>

    <div class="bg-white rounded-2xl p-8 shadow-lg">
      <h2 class="text-2xl font-bold text-gray-800 mb-6">${isZh ? '什么是SBTI？' : 'What is SBTI?'}</h2>
      <div class="prose prose-lg max-w-none text-gray-700">
        ${isZh ? `
        <p>SBTI（Self-Behavioral Type Indicator）是一种基于5大模型和15个维度的现代人格评估工具。与传统的MBTI不同，SBTI更关注个体在自我认知、情感管理、态度形成、行动执行和社交互动等实际行为层面的表现。</p>
        <p>通过25道情境选择题，SBTI能够识别出27种主要人格类型，每种类型都有独特的优势、盲点和发展建议。测试结果可以帮助个人更好地理解自己，改善人际关系，提升自我发展。</p>
        <p><strong>5大模型：</strong>自我维度、情感维度、态度维度、行动维度、社交维度</p>
        <p><strong>15个维度：</strong>每个模型包含3个具体维度，共计15个评估点</p>
        <p><strong>27+1人格：</strong>27种主要类型 + 1种隐藏特殊类型</p>
        ` : `
        <p>SBTI (Self-Behavioral Type Indicator) is a modern personality assessment tool based on 5 major models and 15 dimensions. Unlike traditional MBTI, SBTI focuses more on actual behavioral performance in areas like self-awareness, emotional management, attitude formation, action execution, and social interaction.</p>
        <p>Through 25 situational multiple-choice questions, SBTI can identify 27 main personality types, each with unique strengths, blind spots, and development suggestions. Test results can help individuals better understand themselves, improve relationships, and enhance personal growth.</p>
        <p><strong>5 Major Models:</strong> Self, Emotional, Attitude, Action, Social</p>
        <p><strong>15 Dimensions:</strong> Each model contains 3 specific dimensions, totaling 15 assessment points</p>
        <p><strong>27+1 Types:</strong> 27 main types + 1 hidden special type</p>
        `}
      </div>
      <div class="mt-8 text-center">
        <a href="${lang === 'zh' ? '/' : '/en'}#test" class="inline-block px-8 py-3 bg-purple-600 text-white rounded-full font-bold hover:bg-purple-700 transition">
          ${isZh ? '免费开始测试' : 'Start Free Test'}
        </a>
      </div>
    </div>
  </main>

  <footer class="bg-white border-t border-gray-200 py-8">
    <div class="max-w-6xl mx-auto px-4 text-center text-gray-500">
      <p>© 2026 SBTI ${isZh ? '人格测试' : 'Personality Test'}. ${isZh ? '版权所有' : 'All rights reserved'}.</p>
      <p class="mt-2 text-sm">${isZh ? '此内容仅供参考，不构成专业心理咨询' : 'This content is for reference only and does not constitute professional psychological counseling'}</p>
    </div>
  </footer>
</body>
</html>`;
}

// Main execution
console.log('Generating SBTI personality pages...');

// Generate Chinese pages
console.log('Generating Chinese pages...');
personalities.forEach(p => {
  if (p.code === 'DRUNK') return; // Skip hidden type
  
  const filename = `personalities/${p.code}.html`;
  const content = generatePersonalityPage(p, 'zh');
  fs.writeFileSync(filename, content, 'utf8');
  console.log(`  ✓ ${filename}`);
});

// Generate English pages
console.log('\nGenerating English pages...');
personalities.forEach(p => {
  if (p.code === 'DRUNK') return;
  
  const filename = `personalities/${p.code}-en.html`;
  const content = generatePersonalityPage(p, 'en');
  fs.writeFileSync(filename, content, 'utf8');
  console.log(`  ✓ ${filename}`);
});

// Generate index pages
console.log('\nGenerating index pages...');
const zhIndex = generateIndexPage(personalities, 'zh');
fs.writeFileSync('personalities/index.html', zhIndex, 'utf8');
console.log('  ✓ personalities/index.html (Chinese)');

const enIndex = generateIndexPage(personalities, 'en');
fs.writeFileSync('personalities/index-en.html', enIndex, 'utf8');
console.log('  ✓ personalities/index-en.html (English)');

console.log('\n✅ All personality pages generated successfully!');
console.log(`Total: ${personalities.length - 1} personalities × 2 languages = ${(personalities.length - 1) * 2} pages`);
console.log('Plus 2 index pages (total 58 pages)');