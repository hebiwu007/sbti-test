# SBTI 执行进度 - 数据库迁移
last_updated: 2026-04-16 00:24 CST
next_phase: 2
completed: [1]
skipped: []
errors: []
skip_reasons: {}

# Phase 1-8: 数据库迁移任务 (2026-04-16)
# ============================================

## Phase 1: Worker API - 新增数据库表 + 6个API端点
- 修改 worker/index.js
- 新增 user_data 表 + test_history 表
- 新增 /api/user/data GET/PUT
- 新增 /api/history GET/POST
- 新增 /api/daily/my-answers GET

## Phase 2: 前端 - 数据访问层重构
- 创建统一的 API 封装函数（fetchUserdata, saveHistory 等）
- 替换所有 localStorage 读写为 API 调用
- 保留 sbti_lang + sbti_guest_code 在本地

## Phase 3: 前端 - 页面功能适配
- 适配 showDailyQuiz() - 从API获取每日答案
- 适配 showLeaderboard() - 无变化（已走API）
- 适配 showUserProfile() - 从API获取用户数据
- 适配 showHistoryComparison() - 从API获取历史
- 适配 showLoginModal() - 登录后同步guest_code数据

## Phase 4: 语法测试 + Worker部署
- node -c app.js
- node -c worker/index.js
- 部署Worker

## Phase 5: 提交推送 + 线上验证
- git commit + push
- 验证线上功能
- 通知何总管
