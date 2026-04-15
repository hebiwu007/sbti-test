#!/bin/bash
# SBTI 定时任务 - 通过OpenClaw触发AI编码会话
# 北京时间 2026-04-16 01:00 (UTC 2026-04-15 17:00)

set -uo pipefail

OPENCLAW="/root/.nvm/versions/node/v22.22.0/bin/openclaw"
LOG_DIR="/root/.openclaw/workspace-Coding/github/sbti-test/scripts"
LOG_FILE="$LOG_DIR/phase-trigger.log"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] SBTI定时任务触发" >> "$LOG_FILE"

# 触发AI会话来执行编码任务
# 使用 coding-agent 模式，直接在项目目录执行
cd /root/.openclaw/workspace-Coding/github/sbti-test

# 先确保代码最新
git pull origin master 2>&1 >> "$LOG_FILE" || true

# 构建AI任务指令
TASK="你是小码，留学博士何总管的数字员工。现在执行SBTI项目的定时编码任务。

项目目录: /root/.openclaw/workspace-Coding/github/sbti-test
主要文件: app.js (约3185行)
线上地址: https://sbti-test-53g.pages.dev/
GitHub: hebiwu007/sbti-test (推送到 hebiwu remote)

## 执行流程

1. 读取 PROGRESS.md 获取断点位置
2. 按Phase顺序逐个执行（Phase 22-28是代码修改）

### Phase 22: MBTI选择/测试/回填 (我的页面)
在showUserProfile()函数中，允许用户选择MBTI类型或点击去测试。测试后自动回填到sbti_mbti_type。

### Phase 23: 导出数据格式改为TXT
当前exportMyData()导出JSON，改为用户友好的TXT纯文本格式。

### Phase 24: 测试页面自动跳转
选择答案后延迟500ms自动跳转下一题。最后一题(第25题)需要点击按钮提交。

### Phase 25: 题号进度显示
在测试页面显示 \"17/25\" 格式的题号进度，加进度条。

### Phase 26: 结果页面交叉解读按钮合并
MBTI×SBTI交叉解读只保留一个按钮，点击弹出交叉解读模态框。

### Phase 27: 结果页面对比按钮文字确认
确认对比按钮显示为\"人格对比\"(中文)/\"Compare\"(英文)。

### Phase 28: 结果页面返回首页修复
确保返回首页功能正常，清除测试状态回到renderLanding()。

### Phase 29: 全面测试
- node -c app.js 语法检查
- curl验证线上页面和API
- 检查括号平衡和代码完整性

### Phase 30: 提交部署通知
- git add -A && git commit
- git push hebiwu master
- 等待部署完成
- 通过飞书通知何总管完成

## 跟踪保障
- 每完成一个Phase，更新PROGRESS.md的next_phase值
- 如果某个Phase出错，记录到errors字段并继续下一个
- 最终汇总报告

## 重要
- Edit tool必须精确匹配文本（包括空格和换行符）
- 保持代码语法和括号平衡
- 修改前先read确认当前代码状态
- 不要修改未涉及的代码"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 任务已构建，长度: ${#TASK}" >> "$LOG_FILE"

# 使用Claude Code执行编码任务
# --print: 非交互模式
# --permission-mode bypassPermissions: 允许文件操作
cd /root/.openclaw/workspace-Coding/github/sbti-test
claude --print --permission-mode bypassPermissions "$TASK" >> "$LOG_FILE" 2>&1

EXIT_CODE=$?
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Claude Code退出码: $EXIT_CODE" >> "$LOG_FILE"

# 检查执行结果并发送通知
if [ $EXIT_CODE -eq 0 ]; then
  # 检查是否有新提交
  NEW_COMMITS=$(git log --oneline -5)
  
  $OPENCLAW message send --channel feishu \
    --target "ou_d0b593d01e05042cbd976ad57c46e3a9" \
    --message "✅ SBTI定时任务执行完成！

📊 最近提交:
${NEW_COMMITS}

📋 查看详细进度: PROGRESS.md
📁 执行日志: scripts/phase-trigger.log

请何总管查看线上效果: https://sbti-test-53g.pages.dev/" 2>/dev/null || true
else
  $OPENCLAW message send --channel feishu \
    --target "ou_d0b593d01e05042cbd976ad57c46e3a9" \
    --message "⚠️ SBTI定时任务执行异常

退出码: $EXIT_CODE
请查看日志: scripts/phase-trigger.log

断点续传: 下次执行将从PROGRESS.md记录的Phase继续" 2>/dev/null || true
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] 定时任务结束" >> "$LOG_FILE"
