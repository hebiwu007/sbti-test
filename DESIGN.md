# SBTI 人格测试 — 项目设计文档 v2.0

> **更新日期**: 2026-04-18 | **状态**: 已发布  
> **线上地址**: https://sbti.solutions  
> **GitHub**: hebiwu007/sbti-test  
> **原设计文档**: 飞书文档 `WPLhd8BwnogcnSxOMmuciW9vnl3`

---

## 一、产品定位

SBTI（Self-Behavioral Type Indicator）是一款趣味人格测试产品。  
对标 sbti.ai 和 sbti.dev，采用二创增强路线：保留原版五大模型、十五维度、27+1 种人格体系，新增 MBTI 交叉解读、排行榜、每日一测、对比分享等增强功能。

**Slogan**: "发现你的隐藏人格"

### 目标用户
- 18-30 岁，社交媒体活跃，对自我探索感兴趣的年轻人
- 主要面向中国用户（技术选型避免使用被墙服务）

---

## 二、核心体系：五大模型 × 十五维度

| 模型 | 维度1 | 维度2 | 维度3 |
|------|-------|-------|-------|
| **Self 自我 (S)** | S1 自尊与自信 | S2 自我清晰度 | S3 核心价值观 |
| **Emotional 情感 (E)** | E1 依恋安全感 | E2 情感投入度 | E3 边界与依赖 |
| **Attitude 态度 (A)** | A1 世界观倾向 | A2 规则与灵活性 | A3 目标感 |
| **Action Drive 行动 (Ac)** | Ac1 动机导向 | Ac2 决策风格 | Ac3 执行模式 |
| **Social 社交 (So)** | So1 社交主动性 | So2 人际边界 | So3 表达与真实性 |

### 计分逻辑
- 每个维度有 2 道题目，共 30 道主测试题
- 每题 3 个选项，value 为 1/2/3（对应 L/M/H）
- 每个维度的分数 = 两道题的 value 之和
- 分数映射：2→L, 3-4→M, 5-6→H
- 15 个维度生成 15 位模式串（如 HHM-HMH-LHH-HMM-HHM）
- 与 27 种人格的维度模式计算曼哈顿距离，匹配距离最小的人格类型
- 额外 2 道隐藏人格触发题（drink_gate），检测饮酒相关回答触发 DRUNK 隐藏人格

---

## 三、题目设计（30 题标准版 + 2 题隐藏触发）

**30 道主测试题**：每模型 6 题（每维度 2 题），题目顺序随机打乱  
**2 道隐藏触发题**：不计入主测试评分，仅用于 DRUNK 隐藏人格判定

题目风格：情境选择型 + 行为偏好型 + 自我认知型，融合网络流行语和幽默表达。

详细题目数据见 `questions.json`。

---

## 四、28 种人格类型（27 + 1 隐藏）

- 27 种标准人格 + 1 个隐藏人格（DRUNK）
- 每种人格有独立的中英文名称、核心描述、优势、盲点、职业建议、名人代表
- 详细人格数据见 `personalities.json`

### 匹配算法
1. 计算用户 15 个维度的 H/M/L 得分
2. 生成 15 位模式串
3. 与 27 种人格的维度模式计算曼哈顿距离
4. 匹配距离最小的人格类型
5. 隐藏人格：drink_gate 触发时直接跳过标准匹配

---

## 五、功能模块（已全部完成）

### 5.1 核心测试流程 ✅
- 逐题展示（每题一屏），进度条显示
- 题目顺序随机打乱
- 测试完成后显示人格匹配结果 + 匹配度百分比
- 15 维度雷达图（Canvas 绘制）

### 5.2 MBTI × SBTI 交叉解读 ✅
- 用户可选择自己的 MBTI 类型
- 16 MBTI × 27 SBTI = 432 种组合
- 每种组合动态生成专属解读文案

### 5.3 全球排行榜 ✅
- 用户可提交结果到排行榜（输入昵称 + 签名）
- 按人格类型分类展示，同类型按匹配度排序
- 支持按地区筛选（基于 timezone）
- 游客临时码机制（SBTI-XXXXX）

### 5.4 每日一测 ✅
- 每天一道情境题
- 连续天数追踪
- 30 天趋势分析（Canvas 折线图）

### 5.5 对比功能 ✅
- 输入朋友的 SBTI 人格代码
- 对比 15 维度差异 + 相似度百分比
- 雷达图叠加对比

### 5.6 分享卡片 ✅
- Canvas 生成精美分享卡片（竖屏 9:16）
- 包含人格头像 + 描述 + 二维码
- 支持下载 PNG / 复制到剪贴板 / 原生分享

### 5.7 历史对比 ✅
- localStorage 存储最近 5 次测试历史
- 结果页显示本次 vs 上次的人格变化

### 5.8 人格图鉴 ✅
- 28 种人格的独立解读页面
- 包含：描述、优势、盲点、职业建议、名人代表、兼容性

### 5.9 用户系统 ✅
- 游客模式（自动生成 guest_code）+ 注册登录
- 游客可使用全部功能，登录用户支持云端数据同步

### 5.10 数据删除 ✅
- 服务端数据删除（DELETE /api/data）
- 本地数据清除
- 二次确认机制 + 删除明细展示

### 5.11 多语言 ✅
- 中文 / 英文双语
- 顶部语言切换按钮
- 所有 UI 文案使用 i18n 翻译

### 5.12 SEO + PWA ✅
- 52 个人格解读独立 HTML 页面（`personality/` 目录）
- sitemap.xml + robots.txt
- manifest.json + Service Worker
- Open Graph meta 标签

---

## 六、技术架构

### 6.1 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | HTML + 预构建 Tailwind CSS + 原生 JS |
| 算法 | 曼哈顿距离匹配 + Canvas API（雷达图/趋势图/分享卡片） |
| 后端 | Cloudflare Workers |
| 数据库 | Cloudflare D1（SQLite） |
| 部署 | Cloudflare Pages Direct Upload |

### 6.2 前端文件结构

```
├── index.html          # 主页面（SPA）
├── app.js              # 核心逻辑（4337行）
├── i18n.js             # 中英文翻译包
├── tailwind.min.css    # 预构建 CSS（不用CDN）
├── sw.js               # Service Worker（仅离线回退，不缓存）
├── manifest.json       # PWA 配置
├── _headers            # Cloudflare Pages 缓存控制
├── questions.json      # 题目数据（30+2题）
├── personalities.json  # 人格数据（27+1）
├── privacy.html        # 隐私政策页
├── robots.txt          # 搜索引擎配置
├── sitemap.xml         # 站点地图
└── personality/        # 52个SEO人格页面
    ├── ctrl.html
    ├── boss.html
    └── ...
```

### 6.3 Worker API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/submit` | POST | 提交测试结果 |
| `/api/count` | GET | 获取测试人数统计 |
| `/api/leaderboard` | GET | 排行榜（支持 region 参数） |
| `/api/ranking/submit` | POST | 提交排行榜 |
| `/api/rankings` | GET | 按类型查看排名 |
| `/api/stats` | GET | 数据统计（人格分布等） |
| `/api/daily/submit` | POST | 每日一测提交 |
| `/api/daily/stats` | GET | 每日统计 |
| `/api/register` | POST | 用户注册 |
| `/api/login` | POST | 用户登录 |
| `/api/user/data` | GET | 获取用户数据 |
| `/api/link-guest` | POST | 游客数据关联 |
| `/api/data` | DELETE | 删除用户数据 |
| `/api/init` | POST | 初始化数据库表 |

### 6.4 数据库表（D1）

- **users** — 登录用户信息
- **test_results** — 测试结果（关联 user_id 或 guest_code）
- **rankings** — 排行榜（昵称、匹配度、地区、签名）
- **daily_quiz** — 每日一测记录
- **user_settings** — 用户偏好设置
- **test_answers** — 答题详情

### 6.5 部署方案

- **方式**: Cloudflare Pages Direct Upload（`wrangler pages deploy`）
- **分支**: master
- **域名**: sbti.solutions（DNS CNAME → sbti-test-direct.pages.dev）
- **部署规范**: 每次部署同步更新 index.html 版本号 + SW 版本 + curl 验证

### 6.6 关键设计决策

| 决策 | 原因 |
|------|------|
| 预构建 CSS，不用 CDN | 中国用户访问 Tailwind CDN 被墙 |
| 不用 Google Fonts | 中国用户访问被墙 |
| SW 不缓存，仅离线回退 | 频繁更新场景下缓存导致"改了不生效" |
| Direct Upload 而非 GitHub 集成 | 避免 GitHub raw 文件截断问题 |
| 单文件 app.js (4337行) | 简单项目，避免多文件依赖管理 |

---

## 七、界面设计

### 配色
- **主色**: 柔和紫 #8B5CF6 + 奶油白 #FFF8F0
- **辅色**: 薄荷绿、珊瑚粉、天空蓝（用于人格标签）

### 核心页面
| 页面 | 设计重点 |
|------|----------|
| 首页 | 一句话 Hook + 开始按钮 + 已有测试人数 |
| 答题页 | 一题一屏 + 大字体 + 进度条 |
| 结果页 | 人格名称 + 标签 + 15维雷达图 + 匹配度 |
| 分享卡片 | 竖屏(9:16)，人格描述 + 二维码 |
| 排行榜 | 按人格类型分类，匹配度排序 |
| 对比页 | 双雷达图叠加 + 维度差异 |

---

## 八、复盘与经验（2026-04-17）

### 关键数据
- 开发周期：5 天（4.13-4.17）
- 代码量：4337 行（app.js）
- Bug 修复：25+ 个
- 返工占比：52%（约 26 小时）

### 四大返工问题
1. **缓存/部署不生效**（~5h）— DNS CNAME 指向错误 + production_branch 配置错误
2. **数据库设计返工**（~4h）— 没有 Schema First，边写边加
3. **中英文修改不全**（~2h）— 没有双语同时编写规范
4. **外部 CDN 被墙**（~2h）— 没有确认目标用户地域

### 协作规范
详见飞书文档：SBTI 项目流程规范（何总管 × 小码）

---

_本文档由小码于 2026-04-18 基于 v1.3 设计文档 + 项目实际最终状态更新归档。_
