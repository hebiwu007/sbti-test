# SBTI 项目 — 10项未完成功能执行计划

> 定时任务 ID: 57f0a7a2-27a4-4892-b7b4-1b4c78a04199
> 触发时间: 2026-04-15 01:00 CST (UTC 2026-04-14 17:00)
> 执行模式: isolated session, 按 Phase 顺序，完成一个再下一个

---

## ⛑️ 断点续传机制

**进度文件**: `/root/.openclaw/workspace-Coding/github/sbti-test/PROGRESS.md`

每个 Phase 开始前写入状态，完成后更新。如果任务中途失败（网络、OOM、模型错误等），
恢复时读取 PROGRESS.md 找到断点继续执行。

### 进度文件格式
```markdown
# SBTI 执行进度
last_updated: 2026-04-15 01:23:45 CST
next_phase: 5
completed: [1, 2, 3, 4]
skipped: []
errors: []
```

### 恢复策略
1. **读取 PROGRESS.md** → 找到 `next_phase` 值
2. **跳过已完成的 Phase** → 检查 git log 确认已 commit
3. **从 next_phase 开始继续执行**
4. **如果 PROGRESS.md 不存在** → 从 Phase 1 开始（首次执行）

### 兜底方案
如果 cron 任务彻底失败无法恢复（例如模型服务宕机），处理方式：
- 每个 Phase 完成后立即 `git commit`（不等到最后统一 push）
- 已 commit 的代码不会丢失
- 何总管醒来后可手动执行剩余 Phase
- 执行命令：`cat /root/.openclaw/workspace-Coding/github/sbti-test/PROGRESS.md` 查看进度

---

## Phase 1: 冷启动模拟数据 ⏱️ ~15min

**设计要求**: "首页初始测试人数用模拟数据过渡"

**实现方案**:
- 修改 `app.js` 中 `loadGlobalCount()` / 首页渲染逻辑
- 当 API 返回的 total < 1000 时，显示 (total + 5000) 作为过渡数据
- 添加注释标记 `// TODO: remove when real data > 5000`
- 同步修改 Worker `/api/count` 可返回一个基准偏移量

**验证**:
- `curl https://sbti-test-53g.pages.dev` 首页显示合理人数
- `curl https://sbti-api.hebiwu007.workers.dev/api/count` 返回正确数据

**Git commit**: `feat: add cold-start mock data for test count display`

---

## Phase 2: 分享卡片添加二维码 ⏱️ ~20min

**设计要求**: "Canvas 生成精美分享卡片，包含二维码"

**实现方案**:
- 在 `index.html` 中引入 qrcode.js CDN（轻量级 QR 库）
- 修改 `shareResult()` 函数中的 Canvas 绘制逻辑
- 在卡片底部区域绘制分享链接的二维码
- 调整布局：人格描述区域上移，腾出二维码空间
- 二维码内容: `https://sbti-test-53g.pages.dev/?ref={personality_code}`

**验证**:
- `node -e "console.log('QR lib check')"` 确认 CDN 可用
- 本地检查 Canvas 绘制逻辑无误

**Git commit**: `feat: add QR code to share card`

---

## Phase 3: 结果历史对比 ⏱️ ~25min

**设计要求**: "结果有效期：显示最近一次 + 历史对比"

**实现方案**:
- localStorage 存储历史结果: `sbti_history` = `[{code, pattern, date, matchScore}, ...]`
- 最多保留最近 5 次结果
- 结果页添加"历史对比"区域（如有历史记录）
- 显示：本次 vs 上次的人格变化、维度变化箭头
- 如果人格相同显示"稳定的 {code}"，不同则显示变化

**修改文件**:
- `app.js`: 新增 `saveToHistory()`, `showHistoryComparison()` 函数
- `i18n.js`: 新增历史对比相关翻译 key

**验证**:
- 检查语法: `node --check app.js`（注意 app.js 是浏览器端，需手动验证逻辑）
- 确认 localStorage 存储格式正确

**Git commit**: `feat: add result history comparison`

---

## Phase 4: 30天趋势分析 ⏱️ ~25min

**设计要求**: "累计30天可生成个人趋势分析"

**实现方案**:
- 扩展 localStorage: `sbti_daily_history` = `{date: {answer, questionId}, ...}`
- 新增 `showTrendAnalysis()` 函数
- 当积累 ≥ 7 天数据时显示趋势：
  - 各模型维度倾向变化
  - 简易折线图（Canvas 绘制）
- 每日一测模态框底部添加"查看趋势"按钮

**修改文件**:
- `app.js`: 新增 `showTrendAnalysis()`, `drawTrendChart()` 函数
- `i18n.js`: 新增趋势分析翻译

**验证**:
- 检查新增函数逻辑完整性
- Canvas 绘图参数校验

**Git commit**: `feat: add 30-day daily quiz trend analysis`

---

## Phase 5: 懒加载 + 图片优化 ⏱️ ~15min

**设计要求**: "图片优化：懒加载 + 压缩"

**实现方案**:
- `index.html` 的 `<img>` 标签添加 `loading="lazy"`
- 分享卡片 Canvas 输出质量参数优化（`.toBlob('image/png', 0.8)`）
- personality 页面中图片资源添加 `loading="lazy"`
- 如果有背景图/装饰图，使用 IntersectionObserver 延迟加载

**验证**:
- 检查 HTML 中的 lazy 属性
- Canvas 输出参数正确

**Git commit**: `perf: add lazy loading and image compression`

---

## Phase 6: 数据统计接口 ⏱️ ~20min

**设计要求**: "数据统计：测试完成率、分享率、各人格分布"

**实现方案**:
- Worker 端: `/api/stats` 端点已存在，需补充统计内容
- 新增返回字段:
  - `personality_distribution`: 各人格数量占比
  - `completion_rate`: 完成测试的比例（基于开始/完成计数）
  - `mbti_cross_stats`: MBTI 交叉分布
- 前端: 暂不需要 UI，API 可供后台分析用

**修改文件**:
- `worker/index.js`: 增强 `handleStats()` 函数

**验证**:
- `curl https://sbti-api.hebiwu007.workers.dev/api/stats`
- 确认返回 JSON 格式正确

**Git commit**: `feat: enhance stats API with distribution data`

---

## Phase 7: 地区筛选（排行榜） ⏱️ ~30min

**设计要求**: "按地区/时间筛选"

**实现方案**:
- Worker: rankings 表已有 region 字段（未使用）
- 新增 `/api/leaderboard?region=XX` 参数
- 前端通过浏览器 `Intl.DateTimeFormat().resolvedOptions().timeZone` 获取时区
- 前端: 排行榜页添加地区筛选下拉框（全部/亚洲/欧洲/美洲等）
- 提交时自动携带 timezone 信息

**修改文件**:
- `worker/index.js`: leaderboard 查询添加 region WHERE 条件
- `app.js`: 排行榜 UI 添加筛选器，提交时携带 timezone
- `i18n.js`: 地区筛选翻译

**验证**:
- `curl "https://sbti-api.hebiwu007.workers.dev/api/leaderboard?region=Asia"`
- 确认筛选逻辑正确

**Git commit**: `feat: add region filter to leaderboard`

---

## Phase 8: 数据删除功能（服务端） ⏱️ ~20min

**设计要求**: "提供用户自助删除数据功能"

**实现方案**:
- Worker: 新增 `DELETE /api/data?guest_code=SBTI-XXXXX` 端点
- 根据 guest_code 删除 rankings 和 daily_quiz 中的关联记录
- 前端: privacy.html 中已有"删除我的数据"按钮（仅清 localStorage）
- 增强: 同时调用 API 删除服务端数据
- 删除成功后显示确认信息

**修改文件**:
- `worker/index.js`: 新增 `handleDataDelete()` 函数
- `privacy.html`: 增强 `deleteData()` 函数调用 API
- `app.js`: 无需修改

**验证**:
- `curl -X DELETE "https://sbti-api.hebiwu007.workers.dev/api/data?guest_code=SBTI-TEST1"`
- 确认返回正确状态

**Git commit**: `feat: add server-side data deletion API`

---

## Phase 9: 432种交叉解读文案优化 ⏱️ ~20min

**设计要求**: "每种组合生成专属解读文案"

**实现方案**:
- 当前 `generateMBTIIntersection()` 使用模板生成
- 优化：为每种 MBTI 类型（16种）添加与 SBTI 互动的深度描述
- 使用人格特质关键词 + MBTI 认知功能组合生成更有洞察力的文案
- 不需要 432 条独立文案，而是基于两个维度动态组合（质量提升）

**修改文件**:
- `app.js`: 重构 `generateMBTIIntersection()` 函数

**验证**:
- 检查生成的文案是否有实质内容（非空模板）

**Git commit**: `improve: enhance MBTI×SBTI intersection text generation`

---

## Phase 10: 自定义域名 ⏱️ ~15min

**设计要求**: "域名: sbti-test（如 sbti-test.com / sbti-test.online）"

**实现方案**:
- 通过 Cloudflare API 绑定自定义域名
- 先检查是否有可用域名
- 如无域名则记录待办，跳过此步
- 如有域名:
  - `curl -X POST "https://api.cloudflare.com/client/v4/accounts/{account_id}/pages/projects/sbti-test-53g/domains"`
  - 添加 DNS CNAME 记录

**验证**:
- 域名解析是否正确
- HTTPS 是否生效

**Git commit**: `chore: configure custom domain` (如有域名)

---

## ⚠️ 重要：每个 Phase 完成后的强制检查流程

**每个 Phase 编码完成后，必须执行以下检查，确认无误才能进入下一个 Phase：**

1. **代码审查**：检查新增/修改的代码逻辑是否正确、有无语法错误
2. **语法检查**：`node -e` 验证 JS 文件无语法问题
3. **功能自测**：模拟用户操作路径，确认新增功能可正常触发
4. **回归检查**：确认之前的 Phase 功能没有被破坏（重点检查：答题流程、结果计算、排行榜、分享、每日一测）
5. **API 验证**（如涉及 Worker）：`curl` 测试相关端点返回正确
6. **自动修复**：如发现任何问题，立即修复并重新检查
7. **只有确认全部通过后**，才能 `git commit` 并进入下一个 Phase

如果某个 Phase 检查发现问题且无法快速修复（>10分钟），记录问题到日志，跳过该 Phase，继续下一个。

---

## 🔴 Phase 11: 项目全面代码审查（从头到尾逐文件） ⏱️ ~30min

**目的**: 10个功能开发完后，对整个 SBTI 项目做一次完整的代码审查，确保代码质量。

### 审查清单

**前端文件逐一审查**:
1. `app.js` (~2240行) — 逐函数检查：
   - 变量声明和作用域正确
   - 事件监听无内存泄漏
   - 异步调用有错误处理
   - DOM 操作无空引用
   - Canvas 绘制参数有边界检查
   - localStorage 操作有 try-catch
2. `i18n.js` — 翻译完整性（中文/英文 key 对齐，无遗漏）
3. `index.html` — 结构完整，CDN 引用正确，meta 标签齐全
4. `privacy.html` — 数据删除功能完整
5. `personalities.json` — 28种人格数据完整，无空字段
6. `questions.json` — 25+1 题目数据完整

**Worker 文件审查**:
7. `worker/index.js` — 逐端点检查：
   - SQL 注入防护（参数化查询）
   - CORS 配置正确
   - 错误响应格式统一
   - D1 查询无语法错误
8. `worker/wrangler.toml` — 配置正确

**SEO/PWA 文件**:
9. `personality/` 目录 — 52个 HTML 页面抽样检查（5个以上）
10. `sitemap.xml` + `robots.txt` — 格式正确
11. `manifest.json` + `sw.js` — PWA 配置正确

**发现的问题立即修复，修复后重新审查。**

Git commit: `review: full project code audit and fixes`

---

## 🔴 Phase 12: 全功能端到端测试 ⏱️ ~30min

**目的**: 模拟真实用户，从头到尾走完所有功能路径，确保交付质量。

### 测试用例

**A. 核心测试流程**:
1. 首页加载 → 显示测试人数（含模拟数据）→ 语言切换中/英 → 正常
2. 开始测试 → 25题逐一作答 → 进度条正常 → 隐藏题触发条件验证
3. 结果页 → 人格匹配正确 → 匹配度百分比显示 → 雷达图15维绘制正确
4. 详细人格解读 → 职业建议、名人代表、兼容性、成长建议 → 显示完整

**B. 排行榜系统**:
5. 匿名提交结果 → `POST /api/submit` → 返回成功
6. 提交昵称排名 → 输入昵称+签名 → `POST /api/ranking/submit` → 返回 guest_code
7. 查看排行榜 → `GET /api/leaderboard` → 人格热度排序正确
8. 按类型查看 → 点击某人格 → `GET /api/rankings?type=XXX` → 排名列表正确
9. 地区筛选 → 选择地区 → 排行榜过滤正确

**C. 分享功能**:
10. 生成分享卡片 → Canvas 绘制 → 含二维码 → 复制到剪贴板成功
11. 下载分享卡片 → PNG 文件正确
12. 原生分享 → 分享文案模板随机 → 内容格式正确
13. 复制分享链接 → 含 referral 参数

**D. 每日一测**:
14. 每日一测弹窗 → 随机题目 → 选择答案 → 提交成功
15. 连续天数计算正确 → `GET /api/daily/stats` → 统计数据正确
16. 趋势分析 → 积累数据后显示折线图

**E. 对比与历史**:
17. 对比功能 → 输入SBTI代码 → 维度差异显示 → 相似度百分比
18. 历史对比 → 多次测试后 → 显示人格变化趋势

**F. 数据与隐私**:
19. 数据删除 → `DELETE /api/data?guest_code=XXX` → 本地+服务端清除
20. 隐私政策页 → 内容完整，数据删除按钮可用

**G. SEO + PWA**:
21. 52个SEO页面 → 抽样 curl 5个页面 → 200 状态码，title 正确
22. sitemap.xml → 格式正确，URL 可访问
23. manifest.json → 图标、名称正确
24. Service Worker → 注册成功，离线缓存工作

**H. Worker API 全端点**:
25. `curl POST /api/submit` → 200
26. `curl GET /api/count` → 返回 total + today
27. `curl GET /api/leaderboard` → 返回排行榜
28. `curl POST /api/ranking/submit` → 返回 rank_id
29. `curl GET /api/rankings?type=CTRL` → 返回类型排名
30. `curl POST /api/daily/submit` → 返回成功
31. `curl GET /api/daily/stats?date=2026-04-15` → 返回统计
32. `curl DELETE /api/data?guest_code=SBTI-TEST` → 返回成功
33. `curl GET /api/stats` → 返回分布数据

**发现的问题记录到日志，立即修复，修复后重新测试该用例。**

Git commit: `test: full e2e testing and fixes`

---

## 🔴 Phase 13: 线上部署验证 ⏱️ ~15min

**目的**: 代码 push 到 GitHub 后，验证线上环境一切正常。

1. `git push origin master`
2. 等待 GitHub Actions 构建完成
3. 线上验证（`https://sbti-test-53g.pages.dev`）：
   - 首页加载正常
   - Worker API 所有端点正常
   - SEO 页面可访问
4. 如有问题 → 紧急修复 → 重新 push → 重新验证

---

## 最终交付步骤

1. **更新 MEMORY.md**: 新增已完成功能记录
2. **创建 memory/2026-04-15.md**: 完整执行日志
3. **飞书通知何总管**: 发送交付报告：
   - Phase 1-10 开发状态（✅/❌/⏭️）
   - Phase 11 代码审查发现的问题和修复
   - Phase 12 测试用例通过率（通过/总数）
   - Phase 13 线上验证结果
   - 最终交付物清单
   - 遗留问题（如有）

