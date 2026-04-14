// i18n.js - Language pack for SBTI Personality Test
const i18n = {
  zh: {
    // Landing page
    app_title: "SBTI 人格测试",
    app_subtitle: "发现真实的你",
    start_btn: "开始测试",
    test_count_prefix: "已有",
    test_count_suffix: "人完成测试",
    privacy_link: "隐私政策",
    
    // Quiz page
    question_prefix: "第",
    question_suffix: "题",
    progress_label: "进度",
    next_btn: "下一题",
    prev_btn: "上一题",
    finish_btn: "完成测试",
    
    // Result page
    your_type: "你是",
    dimension_analysis: "维度分析",
    strengths: "优势",
    blind_spots: "盲点",
    share_btn: "分享结果",
    restart_btn: "再次测试",
    match_score: "匹配度",
    
    // MBTI
    mbti_cross: "MBTI × SBTI 交叉解读",
    not_selected: "未选择",
    clear_selection: "清除选择",
    view_intersection: "查看交叉解读",
    share_with_mbti: "分享带MBTI的结果",
    detailed_analysis: "详细解读",
    detailed_title: "详细人格解读",
    suitable_careers: "适合职业",
    celebrity_examples: "名人代表",
    compatibility: "人格兼容性",
    growth_tips: "成长建议",
    good_with: "相处良好",
    challenge_with: "需要磨合",
    
    // Radar chart
    dimensions: {
      self_esteem: "自我价值感",
      self_clarity: "自我认知",
      core_values: "核心价值观",
      attachment_security: "依恋安全感",
      emotional_investment: "情感投入",
      boundaries: "边界感",
      worldview: "世界观",
      rules_flexibility: "规则灵活性",
      sense_of_purpose: "目标感",
      motivation: "内驱力",
      decision_style: "决策风格",
      execution: "执行力",
      social_initiative: "社交主动性",
      interpersonal_boundaries: "人际边界",
      expression: "自我表达"
    },
    
    // Models
    models: {
      self: "自我维度",
      emotional: "情感维度",
      attitude: "态度维度",
      action: "行动维度",
      social: "社交维度"
    },
    
    // Privacy
    privacy_title: "隐私政策",
    privacy_content: "我们非常重视您的隐私...",
    delete_data: "删除我的数据",
    delete_confirm: "确定要删除所有数据吗？",
    delete_success: "数据已删除",
    
    // Common
    loading: "加载中...",
    error: "出错了，请重试",
    confirm: "确认",
    cancel: "取消",
    close: "关闭",
    lang_toggle: "EN"
  },
  
  en: {
    // Landing page
    app_title: "SBTI Personality Test",
    app_subtitle: "Discover Your True Self",
    start_btn: "Start Test",
    test_count_prefix: "",
    test_count_suffix: " people completed",
    privacy_link: "Privacy Policy",
    
    // Quiz page
    question_prefix: "Question",
    question_suffix: "",
    progress_label: "Progress",
    next_btn: "Next",
    prev_btn: "Previous",
    finish_btn: "Finish",
    
    // Result page
    your_type: "You are",
    dimension_analysis: "Dimension Analysis",
    strengths: "Strengths",
    blind_spots: "Blind Spots",
    share_btn: "Share Result",
    restart_btn: "Test Again",
    match_score: "Match Rate",
    
    // MBTI
    mbti_cross: "MBTI × SBTI Intersection",
    not_selected: "Not selected",
    clear_selection: "Clear selection",
    view_intersection: "View intersection",
    share_with_mbti: "Share with MBTI",
    detailed_analysis: "Detailed Analysis",
    detailed_title: "Detailed Personality Analysis",
    suitable_careers: "Suitable Careers",
    celebrity_examples: "Celebrity Examples",
    compatibility: "Compatibility",
    growth_tips: "Growth Tips",
    good_with: "Good with",
    challenge_with: "Challenge with",
    
    // Radar chart
    dimensions: {
      self_esteem: "Self Esteem",
      self_clarity: "Self Clarity",
      core_values: "Core Values",
      attachment_security: "Attachment Security",
      emotional_investment: "Emotional Investment",
      boundaries: "Boundaries",
      worldview: "Worldview",
      rules_flexibility: "Rules Flexibility",
      sense_of_purpose: "Sense of Purpose",
      motivation: "Motivation",
      decision_style: "Decision Style",
      execution: "Execution",
      social_initiative: "Social Initiative",
      interpersonal_boundaries: "Interpersonal Boundaries",
      expression: "Self Expression"
    },
    
    // Models
    models: {
      self: "Self",
      emotional: "Emotional",
      attitude: "Attitude",
      action: "Action",
      social: "Social"
    },
    
    // Privacy
    privacy_title: "Privacy Policy",
    privacy_content: "We take your privacy very seriously...",
    delete_data: "Delete My Data",
    delete_confirm: "Are you sure you want to delete all data?",
    delete_success: "Data deleted",
    
    // Common
    loading: "Loading...",
    error: "Something went wrong, please try again",
    confirm: "Confirm",
    cancel: "Cancel",
    close: "Close",
    lang_toggle: "中文"
  }
};

// Helper to get current language
function getLang() {
  return localStorage.getItem('sbti_lang') || 'zh';
}

// Helper to get translation
function t(key) {
  const lang = getLang();
  return i18n[lang][key] || key;
}

// Helper to get dimension name
function getDimensionName(dimension) {
  const lang = getLang();
  return i18n[lang].dimensions[dimension] || dimension;
}

// Helper to get model name
function getModelName(model) {
  const lang = getLang();
  return i18n[lang].models[model] || model;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { i18n, t, getLang, getDimensionName, getModelName };
}