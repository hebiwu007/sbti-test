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
    share_card: "分享卡片",
    share_link: "复制链接",
    share_download: "保存图片",
    share_native: "更多分享",
    share_copied: "链接已复制！",
    share_image_saved: "图片已保存",
    share_title: "我的SBTI人格类型",
    share_text_prefix: "我的SBTI人格是",
    share_text_suffix: "，快来测测你的！",
    share_templates: [
      "{prefix} {code}（{name}）{suffix}\n{url}",
      "居然是{code}！{tagline}\n你也来试试 👉 {url}",
      "{code} - {name}\n{desc}\n测测你是哪个 → {url}",
      "这个人格测试太准了！我是{code}({name})\n{tagline}\n{url}"
    ],
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
    lang_toggle: "EN",
    
    // Daily Quiz
    daily_quiz: "每日一测",
    daily_quiz_title: "今日情境题",
    daily_quiz_desc: "每天一道情境题，了解你的选择倾向",
    submit_answer: "提交答案",
    already_answered: "今日已参与",
    daily_stats: "今日统计",
    answer_distribution: "答案分布",
    people_answered: "人已参与",
    view_your_answer: "查看我的答案",
    streak_days: "连续参与天数",
    total_participants: "总参与人数",
    
    // Comparison
    compare: "对比",
    compare_title: "人格对比",
    compare_with_friend: "与朋友对比",
    enter_friend_code: "输入朋友的SBTI代码",
    compare_btn: "开始对比",
    leaderboard: "全球排行榜",
    leaderboard_title: "SBTI 全球排行榜",
    total_tests: "总测试次数",
    tests_today: "今日测试",
    rank: "排名",
    type: "类型",
    count: "人数",
    percentage: "占比",
    period_all: "全部",
    period_month: "近30天",
    period_week: "近7天",
    period_today: "今天",
    region_all: "🌍 全球",
    region_asia: "🌏 亚洲",
    region_europe: "🌍 欧洲",
    region_americas: "🌎 美洲",
    region_oceania: "🌏 大洋洲",
    your_pattern: "你的模式",
    friend_pattern: "朋友模式",
    dimension_differences: "维度差异",
    high_similarity: "高度相似",
    medium_similarity: "中度相似",
    low_similarity: "差异较大",
    generate_compare_card: "生成对比卡片",
    no_comparison: "暂无对比数据",
    history_compare: "历史对比",

    // Ranking submit
    submit_to_ranking: "提交到排行榜",
    ranking_nickname: "昵称",
    ranking_signature: "一句话签名（选填）",
    ranking_submit_btn: "提交",
    ranking_success: "提交成功！",
    your_guest_code: "你的临时码",
    your_rank: "你在该类型的排名",
    view_type_ranking: "查看排名",
    submit_ranking_desc: "输入昵称提交到排行榜，凭临时码可查看排名",
    nickname_required: "请输入昵称",
    nickname_too_long: "昵称最多16个字符"
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
    share_card: "Share Card",
    share_link: "Copy Link",
    share_download: "Save Image",
    share_native: "More Options",
    share_copied: "Link copied!",
    share_image_saved: "Image saved",
    share_title: "My SBTI Personality Type",
    share_text_prefix: "My SBTI type is",
    share_text_suffix: ". Take the test to find yours!",
    share_templates: [
      "{prefix} {code} ({name}){suffix}\n{url}",
      "I got {code}! {tagline}\nTry it yourself 👉 {url}",
      "{code} - {name}\n{desc}\nTake the test → {url}",
      "This personality test is spot on! I'm {code} ({name})\n{tagline}\n{url}"
    ],
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
    lang_toggle: "中文",
    
    // Daily Quiz
    daily_quiz: "Daily Quiz",
    daily_quiz_title: "Today's Situation",
    daily_quiz_desc: "One question per day to understand your tendencies",
    submit_answer: "Submit Answer",
    already_answered: "Already participated today",
    daily_stats: "Today's Stats",
    answer_distribution: "Answer Distribution",
    people_answered: "people answered",
    view_your_answer: "View My Answer",
    streak_days: "Streak Days",
    total_participants: "Total Participants",
    
    // Comparison
    compare: "Compare",
    compare_title: "Personality Comparison",
    compare_with_friend: "Compare with Friend",
    enter_friend_code: "Enter friend's SBTI code",
    compare_btn: "Compare Now",
    leaderboard: "Leaderboard",
    leaderboard_title: "SBTI Global Leaderboard",
    total_tests: "Total Tests",
    tests_today: "Tests Today",
    rank: "Rank",
    type: "Type",
    count: "Count",
    percentage: "Percentage",
    period_all: "All Time",
    period_month: "Last 30 Days",
    period_week: "Last 7 Days",
    period_today: "Today",
    region_all: "🌍 Global",
    region_asia: "🌏 Asia",
    region_europe: "🌍 Europe",
    region_americas: "🌎 Americas",
    region_oceania: "🌏 Oceania",
    your_pattern: "Your Pattern",
    friend_pattern: "Friend's Pattern",
    dimension_differences: "Dimension Differences",
    high_similarity: "High Similarity",
    medium_similarity: "Medium Similarity",
    low_similarity: "Low Similarity",
    generate_compare_card: "Generate Comparison Card",
    no_comparison: "No comparison data",
    history_compare: "History Comparison",

    // Ranking submit
    submit_to_ranking: "Submit to Leaderboard",
    ranking_nickname: "Nickname",
    ranking_signature: "One-line signature (optional)",
    ranking_submit_btn: "Submit",
    ranking_success: "Submitted successfully!",
    your_guest_code: "Your guest code",
    your_rank: "Your rank in this type",
    view_type_ranking: "View Rankings",
    submit_ranking_desc: "Enter a nickname to join the leaderboard. Use your guest code to check your rank later.",
    nickname_required: "Please enter a nickname",
    nickname_too_long: "Nickname must be 16 characters or less"
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