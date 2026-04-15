// SBTI 人格匹配算法测试脚本
// 验证 calculateUserPattern 和 calculateDistance 的正确性

const dimensionOrder = [
  'self_esteem', 'self_esteem', 'self_clarity', 'self_clarity', 'core_values',
  'attachment_security', 'emotional_investment', 'boundaries', 'attachment_security', 'boundaries',
  'worldview', 'rules_flexibility', 'sense_of_purpose', 'rules_flexibility', 'worldview',
  'motivation', 'decision_style', 'execution', 'execution', 'decision_style',
  'social_initiative', 'interpersonal_boundaries', 'expression', 'social_initiative', 'expression'
];

// 测试用例 1: 全选 A (应该是全 H)
const testAnswersAllA = {};
for (let i = 0; i < 25; i++) {
  testAnswersAllA[i] = 'H';
}

// 测试用例 2: 全选 C (应该是全 L)
const testAnswersAllC = {};
for (let i = 0; i < 25; i++) {
  testAnswersAllC[i] = 'L';
}

// 测试用例 3: 全选 B (应该是全 M)
const testAnswersAllB = {};
for (let i = 0; i < 25; i++) {
  testAnswersAllB[i] = 'M';
}

// 测试用例 4: 混合选择
const testAnswersMixed = {
  0: 'H', 1: 'H', 2: 'M', 3: 'M', 4: 'H',
  5: 'H', 6: 'M', 7: 'L', 8: 'H', 9: 'L',
  10: 'H', 11: 'M', 12: 'H', 13: 'M', 14: 'H',
  15: 'H', 16: 'M', 17: 'H', 18: 'H', 19: 'M',
  20: 'H', 21: 'L', 22: 'H', 23: 'H', 24: 'M'
};

function calculateUserPattern(answers) {
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

function calculateMatchScore(distance) {
  return Math.max(0, Math.round((1 - distance / 50) * 1000) / 10);
}

// 运行测试
console.log('=== SBTI 人格匹配算法测试 ===\n');

console.log('测试 1: 全选 A (全 H)');
const pattern1 = calculateUserPattern(testAnswersAllA);
console.log('生成的 pattern:', pattern1);
console.log('期望: 全 H (HHHHH... 25个H)');
console.log('验证:', pattern1 === 'H'.repeat(25) ? '✅ 通过' : '❌ 失败');
console.log();

console.log('测试 2: 全选 C (全 L)');
const pattern2 = calculateUserPattern(testAnswersAllC);
console.log('生成的 pattern:', pattern2);
console.log('期望: 全 L (LLLLL... 25个L)');
console.log('验证:', pattern2 === 'L'.repeat(25) ? '✅ 通过' : '❌ 失败');
console.log();

console.log('测试 3: 全选 B (全 M)');
const pattern3 = calculateUserPattern(testAnswersAllB);
console.log('生成的 pattern:', pattern3);
console.log('期望: 全 M (MMMMM... 25个M)');
console.log('验证:', pattern3 === 'M'.repeat(25) ? '✅ 通过' : '❌ 失败');
console.log();

console.log('测试 4: 混合选择');
const pattern4 = calculateUserPattern(testAnswersMixed);
console.log('生成的 pattern:', pattern4);
console.log('期望: 每个维度取多数值');
console.log();

// 距离计算测试
console.log('=== 距离计算测试 ===\n');

console.log('测试 5: 相同 pattern 的距离');
const dist1 = calculateDistance('HHHHHHHHHHHHHHHHHHHHHHHHH', 'HHHHHHHHHHHHHHHHHHHHHHHHH');
console.log('HH... vs HH... 距离:', dist1);
console.log('期望: 0');
console.log('验证:', dist1 === 0 ? '✅ 通过' : '❌ 失败');
console.log();

console.log('测试 6: 完全相反 pattern 的距离');
const dist2 = calculateDistance('HHHHHHHHHHHHHHHHHHHHHHHHH', 'LLLLLLLLLLLLLLLLLLLLLLLLL');
console.log('HH... vs LL... 距离:', dist2);
console.log('期望: 50 (25 dims × 2)');
console.log('验证:', dist2 === 50 ? '✅ 通过' : '❌ 失败');
console.log();

console.log('测试 7: 匹配度计算');
const score1 = calculateMatchScore(0);
const score2 = calculateMatchScore(25);
const score3 = calculateMatchScore(50);
console.log('距离 0 的匹配度:', score1 + '% (期望: 100%)');
console.log('距离 25 的匹配度:', score2 + '% (期望: 50%)');
console.log('距离 50 的匹配度:', score3 + '% (期望: 0%)');
console.log('验证:', score1 === 100 && score2 === 50 && score3 === 0 ? '✅ 通过' : '❌ 失败');
console.log();

// 实际人格匹配测试
const personalities = [
  { code: 'CTRL', pattern: 'HHHHHMMHMHHLLLHHHMMHMHHMH' },
  { code: 'BOSS', pattern: 'HHHHHMLLMLHMMMHHHMMHLMHLH' },
  { code: 'PEACE', pattern: 'LLLLLMMHMHHLLLHHHMMHMHHMH' }
];

console.log('=== 实际人格匹配测试 ===\n');

// 模拟一个接近 CTRL 的答案模式
const ctrlLikeAnswers = {};
for (let i = 0; i < 25; i++) {
  // 80% 概率匹配 CTRL 的 pattern
  const target = personalities[0].pattern[i];
  const rand = Math.random();
  if (rand < 0.8) {
    ctrlLikeAnswers[i] = target;
  } else {
    // 随机其他值
    const others = target === 'H' ? ['M', 'L'] : (target === 'L' ? ['H', 'M'] : ['H', 'L']);
    ctrlLikeAnswers[i] = others[Math.floor(Math.random() * others.length)];
  }
}

const userPattern = calculateUserPattern(ctrlLikeAnswers);
console.log('模拟用户 pattern:', userPattern);

let minDistance = Infinity;
let matched = null;
for (const p of personalities) {
  const d = calculateDistance(userPattern, p.pattern);
  console.log(`与 ${p.code} 的距离:`, d);
  if (d < minDistance) {
    minDistance = d;
    matched = p;
  }
}
console.log('\n最匹配的人格:', matched.code);
console.log('匹配度:', calculateMatchScore(minDistance) + '%');

console.log('\n=== 测试完成 ===');
