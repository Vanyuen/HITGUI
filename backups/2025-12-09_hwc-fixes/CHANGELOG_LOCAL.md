# 本地存档 2025-12-09

## 存档说明

本次存档包含热温冷(HWC)正选批量预测功能的3个关键Bug修复。

## 修复内容

### 1. 同现排除模式配置读取修复

- **问题**: 用户选择"排除3码组合"，但系统始终使用2码组合格式
- **根因**: 后端读取 `coOccurrence.mode`（不存在），导致始终默认 `combo_2`
- **修复**: 改为读取 `coOccurrence.historical.combo2/combo3/combo4` 布尔值
- **位置**: `src/server/server.js` line ~16156-16200
- **修复代码**:
```javascript
// ⭐ 2025-12-09修复: 正确读取用户选择的组合类型
const historicalConfig = exclusionConditions.coOccurrence.historical;
let doCombo2 = historicalConfig?.combo2 || false;
let doCombo3 = historicalConfig?.combo3 || false;
let doCombo4 = historicalConfig?.combo4 || false;

// 向后兼容：如果有旧版 mode 字段
if (!historicalConfig && exclusionConditions.coOccurrence.mode) {
    const oldMode = exclusionConditions.coOccurrence.mode;
    doCombo2 = oldMode === 'combo_2' || oldMode === 'all';
    doCombo3 = oldMode === 'combo_3' || oldMode === 'all';
    doCombo4 = oldMode === 'combo_4' || oldMode === 'all';
}
```

### 2. 推算期同现排除支持

- **问题**: 推算期（未开奖期号）无法查询同现数据，导致排除失败
- **根因**: 推算期在数据库中无记录，`issueToIdMap.get(targetIssue)` 返回 undefined
- **修复**: 使用 `baseIssue` 的 ID 作为查询依据
- **位置**: `src/server/server.js` line ~16156-16200
- **修复代码**:
```javascript
// ⭐ 2025-12-09修复: 推算期支持 - 使用baseIssue的ID
const targetIssueIDForCoOcc = this.issueToIdMap.get(targetIssue.toString());
const baseIssueIDForCoOcc = this.issueToIdMap.get(baseIssue?.toString());
const effectiveBaseIDForCoOcc = targetIssueIDForCoOcc
    ? (targetIssueIDForCoOcc - 1)
    : baseIssueIDForCoOcc;
```

### 3. top_hit 模式详情收集修复

- **问题**: 已开奖期号的排除详情显示"未记录详细原因"，但推算期有详细原因
- **根因**: `top_hit` 模式在运行时只收集最近N期的详情，其他期号无详情数据
- **修复**: `top_hit` 模式运行时收集所有期号详情，保存时再根据命中情况筛选
- **位置**: `src/server/server.js` line 16634-16638
- **修复代码**:
```javascript
} else if (detailsMode === 'top_hit') {
    // ⭐ 2025-12-09修复: top_hit模式需要收集所有期号的详情
    // 因为只有任务完成后才知道哪些期号命中最多，保存时再根据命中情况筛选
    issuesBatch.forEach(issue => collectDetailsForIssues.add(issue.toString()));
    log(`📝 [${this.sessionId}] 排除详情模式: top_hit - 运行时收集所有${issuesBatch.length}期详情，保存时按命中筛选`);
}
```

## 存档文件列表

```
backups/2025-12-09_hwc-fixes/
├── src/
│   └── server/
│       └── server.js      # 包含所有修复的服务端文件
└── CHANGELOG_LOCAL.md     # 本变更记录
```

## 测试验证

修复后应验证以下场景：

1. **同现排除格式**: 选择"排除3码组合"时，排除详情应显示 `2-10-32` 格式
2. **推算期数据**: 推算期应有非零的排除数据
3. **历史期详情**: 所有历史期号都应有详细排除原因（非"未记录详细原因"）

## 回滚方法

如需回滚，将备份文件复制回原位置：
```cmd
copy E:\HITGUI\backups\2025-12-09_hwc-fixes\src\server\server.js E:\HITGUI\src\server\server.js
```

---
存档时间: 2025-12-09
