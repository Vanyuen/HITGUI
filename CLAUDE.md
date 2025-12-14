# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

| Item | Value | Notes |
|------|-------|-------|
| **Server Port** | **3003** | ⚠️ FIXED - DO NOT change to 3001 |
| **API Base URL** | `http://localhost:3003` | Used by frontend |
| **Database** | MongoDB localhost:27017 | Database: `lottery` |
| **Fallback DB** | MongoDB Memory Server | Auto-activated if local fails |
| **Main Backend** | `src/server/server.js` | 14K+ lines |
| **Main Frontend** | `src/renderer/dlt-module.js` | 15K+ lines |

## Project Overview

HIT数据分析系统 (HIT Lottery Analysis System) is an Electron-based desktop application for analyzing Chinese lottery data, specifically 双色球 (SSQ - Double Color Ball) and 大乐透 (hit_dlts - Super Lotto). The app features historical data analysis, trend visualization, combination prediction, and Excel export capabilities.

## Development Commands

### Running the Application
```bash
npm start              # Production mode
npm run dev            # Development mode (with DevTools open)
```

### Building
```bash
npm run build          # Build for all platforms
npm run build:win      # Windows only
npm run build:mac      # macOS only
npm run build:linux    # Linux only
npm run pack           # Package without installer
```

### Server Management
```bash
# IMPORTANT: This project uses FIXED PORT 3003 (NOT 3001)
# Server always runs on port 3003
npm start              # Server automatically starts on port 3003

# Monitor tasks
node monitor-task.js
```

## Port Configuration (重要!)

**CRITICAL: This project uses FIXED PORT 3003**

- **Server Port**: http://localhost:3003 (固定端口，不可更改)
- **Frontend API Base URL**: `http://localhost:3003`
- **Common Mistake**: DO NOT use port 3001 - this will cause API connection failures
- **Verification**: Check browser console for API calls - they should all go to localhost:3003

If you see "暂无任务" (No tasks) in the task list, verify:
1. Server is running on port 3003 (check console logs)
2. Frontend API_BASE_URL points to http://localhost:3003
3. Database has task records in PredictionTask collection

## Architecture

### Multi-Process Architecture (Electron)

This is an Electron app with a classic multi-process architecture:

1. **Main Process** (`main.js`)
   - Creates BrowserWindow
   - Manages application lifecycle
   - Spawns Express server process
   - Handles database initialization via `src/database/config.js`
   - Creates application menu and IPC handlers

2. **Renderer Process** (`src/renderer/`)
   - `index.html` - Main UI entry point
   - `app.js` - 双色球 (SSQ) functionality
   - `dlt-module.js` - 大乐透 (hit_dlts) functionality
   - Communicates with backend via REST API

3. **Server Process** (`src/server/server.js`)
   - Express REST API server (**FIXED PORT: 3003**)
   - **CRITICAL**: Always runs on port 3003, NOT 3001
   - MongoDB connection management
   - All lottery analysis logic and data processing
   - Excel export generation with ExcelJS

4. **Preload Script** (`preload.js`)
   - Provides safe IPC bridge between main and renderer
   - Implements Context Isolation security

### Database Architecture

**Dual Database Strategy:**
- Primary: Attempts connection to local MongoDB (mongodb://127.0.0.1:27017/lottery)
- Fallback: MongoDB Memory Server with data persistence
- Manager: `src/database/config.js` (DatabaseManager class)

**Key Collections:**
- `HIT_UnionLotto` - 双色球历史数据
- `hit_dlts` - 大乐透历史数据 (2,792 records, periods 7001-25124)
- `hit_dlt_redcombinations` - 红球组合数据 (324,632 records for C(35,5))
- `hit_dlt_bluecombinations` - 蓝球组合数据 (66 records for C(12,2))
- `hit_dlt_redcombinationshotwarmcoldoptimizeds` - 热温冷比优化表 (2810 records)
- `hit_dlt_hwcpositivepredictiontasks` - 热温冷正选批量预测任务 (40 records)
- `hit_dlt_hwcpositivepredictiontaskresults` - 热温冷正选批量预测结果 (3853 records)
- `PredictionTask` - 预测任务
- `PredictionTaskResult` - 任务结果
- `DLTExclusionDetails` - 排除详情记录

**IMPORTANT - Mongoose Model to Collection Mapping (Updated 2025-12-13):**
Mongoose模型名与实际MongoDB集合名的映射关系（已在mongoose.model第三个参数中明确指定）：

| Mongoose模型变量 | 模型名 | 实际集合名 |
|-----------------|--------|-----------|
| `DLTComboFeatures` | HIT_DLT_ComboFeatures | `hit_dlt_combofeatures` |
| `DLTRedMissing` | HIT_DLT_Basictrendchart_redballmissing_history | `hit_dlt_basictrendchart_redballmissing_histories` |
| `DLTBlueMissing` | HIT_DLT_Basictrendchart_blueballmissing_history | `hit_dlt_basictrendchart_blueballmissing_histories` |
| `DLTRedCombinationsHotWarmColdOptimized` | HIT_DLT_RedCombinationsHotWarmColdOptimized | `hit_dlt_redcombinationshotwarmcoldoptimizeds` |
| `HwcPositivePredictionTask` | HIT_DLT_HwcPositivePredictionTask | `hit_dlt_hwcpositivepredictiontasks` |
| `HwcPositivePredictionTaskResult` | HIT_DLT_HwcPositivePredictionTaskResult | `hit_dlt_hwcpositivepredictiontaskresults` |

⚠️ **注意**: 如果定义新的Mongoose模型，必须在`mongoose.model()`的第三个参数中明确指定集合名，避免Mongoose自动转换导致的集合名不匹配问题。

**IMPORTANT - DLT Collection Names (Updated 2025-11-16):**
See `PLAN_C_COMPLETION_REPORT.md` for full details on the collection naming unification.
- ✅ Main data: `hit_dlts` (lowercase, plural)
- ✅ Red combinations: `hit_dlt_redcombinations` (lowercase, singular dlt)
- ✅ Blue combinations: `hit_dlt_bluecombinations` (lowercase, singular dlt)
- ❌ DO NOT use: `HIT_DLT`, `hit_dlt`, `DLT` (empty collections, deprecated)
- ❌ DO NOT use: `HIT_DLT_RedCombinations`, `HIT_DLT_BlueCombinations` (empty or duplicate)

**IMPORTANT - 走势图遗漏值集合 (Updated 2025-12-08):**
走势图功能依赖以下两个遗漏值集合，由"一键全量更新"生成：
- ✅ 前区遗漏值: `hit_dlt_basictrendchart_redballmissing_histories` (35个红球遗漏值)
- ✅ 后区遗漏值: `hit_dlt_basictrendchart_blueballmissing_histories` (12个蓝球遗漏值)
- ❌ DO NOT use: `hit_dlts_backup_missing_values` (旧备份，已废弃)

相关代码位置：
- Schema定义: `src/server/server.js:573` (DLTBlueMissing), `src/server/server.js:558` (DLTRedMissing)
- 走势图API: `GET /api/dlt/trendchart` (line 3219-3419)
- 全量更新: `generateUnifiedMissingTables()` (line 28280-28414)
- 数据状态监控: `/api/dlt/data-status` (line 27720-27800)

### Data Processing Pipeline

**大乐透 Combination Prediction System:**

1. **Pre-computed Combinations**
   - Red balls: C(35,5) = 324,632 combinations stored in `hit_dlt_redcombinations`
   - Blue balls: C(12,2) = 66 combinations stored in `hit_dlt_bluecombinations`
   - Each combination pre-calculated with features (sum, span, zone_ratio, odd_even_ratio, etc.)

2. **Task-Based Processing** (StreamBatchPredictor)
   - Tasks stored in `PredictionTask` collection with status tracking
   - Batch processing with configurable batch sizes
   - Progress tracking via task status updates
   - Three pairing modes:
     - `default`: Fixed red-blue pairing (1:1)
     - `unlimited`: Custom pairing with indices
     - `truly-unlimited`: Full Cartesian product (red × blue)

3. **Exclusion Conditions**
   - Basic filtering: sum, span, zone_ratio, odd_even_ratio
   - Hot-Warm-Cold ratio (热温冷比): Based on missing value analysis
     - Hot (热): missing ≤ 4
     - Warm (温): 5 ≤ missing ≤ 9
     - Cold (冷): missing ≥ 10
   - Conflict pairs (相克): Incompatible ball combinations
   - Co-occurrence analysis: Ball pairing frequency across historical periods

4. **Hit Analysis** (命中统计)
   - Calculates prize levels based on red and blue ball matches
   - **Critical**: Prize calculation logic in `calculatePrizeStats()` and `judgePrize()`
   - Supports three pairing modes with different calculation strategies

### Prize Calculation Rules (大乐透中奖规则)

**Official Rules** (see `prize-rules-fix-summary.md` for detailed bug fix history):
- 一等奖 (1st): 5 red + 2 blue
- 二等奖 (2nd): 5 red + 1 blue
- 三等奖 (3rd): 5 red + 0 blue
- 四等奖 (4th): 4 red + 2 blue
- 五等奖 (5th): 4 red + 1 blue
- 六等奖 (6th): 3 red + 2 blue
- 七等奖 (7th): 4 red + 0 blue
- 八等奖 (8th): 3 red + 1 blue OR 2 red + 2 blue
- 九等奖 (9th): 3 red + 0 blue OR 1 red + 2 blue OR 2 red + 1 blue OR 0 red + 2 blue

**Implementation Locations:**
- `judgePrize(redHit, blueHit)` - src/server/server.js:13572-13616
- `calculatePrizeStats()` - src/server/server.js:12124-12309

### Performance Optimizations

**Hot-Warm-Cold Optimization Table:**
- Pre-computed hot-warm-cold ratios for all combinations
- Reduces real-time calculation overhead by 99.7%
- Generated per issue pair (base_issue → target_issue)
- Updated via `update-hwc-optimized.js` script

**Batch Processing:**
- Configurable batch sizes (default: 50,000)
- Stream processing for large datasets
- Async/await patterns throughout

**MongoDB Indexes:**
- Indexed on: combination_id, sum_value, span_value, zone_ratio, odd_even_ratio
- Combo fields (combo_2, combo_3, combo_4) for co-occurrence queries
- Compound indexes for task queries

## Important Patterns

### Task Status Flow
```
pending → processing → completed/failed
```
Task monitoring via `monitor-task.js` script.

### Excel Export Pattern
Uses ExcelJS with multi-sheet workbooks:
- Sheet 1: Retained combinations (保留的组合) with hit analysis
- Sheets 2+: Excluded combinations by condition type

Export includes columns: combination details, pairing info, features, hit counts, prize level, prize amount.

### API Error Handling
All API endpoints follow pattern:
```javascript
try {
  // ... logic
  res.json({ success: true, data: result });
} catch (error) {
  log('❌ Error:', error);
  res.status(500).json({ success: false, message: error.message });
}
```

## Critical Files

- `src/server/server.js` - 14,000+ lines, all backend logic including schemas, API routes, and business logic
- `src/renderer/dlt-module.js` - 15,000+ lines, all 大乐透 frontend logic
- `src/database/config.js` - Database manager singleton
- `prize-rules-fix-summary.md` - Documents critical prize calculation bug fixes
- `verify-prize-rules.js` - Test script for prize calculation validation

## Security Notes

- Context Isolation: enabled
- Node Integration: disabled in renderer
- CSP: Permissive policy set in server.js (lines 44-58) for local development
- webSecurity: false in development (main.js:32) - should be stricter in production

## Common Pitfalls

1. **Prize Calculation**: Always verify against official rules. Historical bugs involved incorrect mappings of hit combinations to prize levels.

2. **Task Cleanup**: Incomplete tasks may remain in "processing" state. Use task monitoring to identify stuck tasks.

3. **Port Configuration**: **This project uses FIXED PORT 3003**. The server always runs on http://localhost:3003. Frontend API calls must use this port. DO NOT change to 3001 or any other port.

4. **MongoDB Connection**: App prioritizes local MongoDB but falls back to in-memory. Check connection logs to determine which is active.

5. **Hot-Warm-Cold Missing Data**: Requires previous issue's missing value data. Missing this data results in empty hot-warm-cold ratios.

6. **Batch Size**: Large batch sizes can cause memory issues. Monitor heap usage when processing 300K+ combinations.

## Verification Scripts

Run these to validate system integrity:
- `verify-prize-rules.js` - Validates all 18 prize calculation scenarios
- `check-db-hit-analysis.js` - Checks hit analysis data
- `check-all-collections.js` - Verifies database collections
- `monitor-task.js` - Real-time task monitoring

## Troubleshooting Guide

### "暂无任务" (No Tasks) Issue

**Symptoms**: Task list shows "🎯 暂无任务" even though tasks were created

**Root Causes**:
1. **Database is empty** - PredictionTask collection has no records
2. **Server not running** - Express server on port 3003 failed to start
3. **Port mismatch** - Frontend calling wrong port (must be 3003)
4. **MongoDB connection failed** - Database not accessible

**Diagnosis Steps**:
```bash
# 1. Check if server is running on correct port
netstat -ano | findstr ":3003"

# 2. Verify API endpoint is accessible
curl http://localhost:3003/api/dlt/prediction-tasks/list?page=1&limit=10&status=all

# 3. Check database for tasks
node check-current-task.js

# 4. Check browser console (F12) for API errors
# Look for failed fetch requests to localhost:3003
```

**Solutions**:
1. **If no tasks in database**: Create a test task through the UI or via API
2. **If server not running**: Restart application with `npm start`
3. **If port conflict**: Kill conflicting processes and restart
4. **If MongoDB down**: Check MongoDB service status

### Task Creation via API (for testing)
```bash
curl -X POST http://localhost:3003/api/dlt/prediction-tasks/create \
  -H "Content-Type: application/json" \
  -d '{
    "task_name": "Test Task",
    "base_issue": "25120",
    "target_issue": "25121",
    "exclusion_conditions": {},
    "pairing_mode": "default"
  }'
```

## 预测期号范围行为说明

### Issue（期号）与 ID（记录ID）的重要区别

⚠️ **关键概念**：
- **Issue（期号）**：不连续！例如 `25001, 25003, 25006, 25008...`（可能跳过某些期号）
- **ID（记录ID）**：数据库主键，连续递增 `1, 2, 3, 4...`
- **重要**：期号计数基于数据库记录条数（按 Issue 排序后的顺序），而非 Issue 数值范围

### 三种范围模式详解

#### 1. 全部历史期号
- **返回**：所有已开奖期号（按 Issue 升序）
- **实现**：`hit_dlts.find({}).sort({ Issue: 1 })`
- **示例**：如果数据库有 2000 条记录，返回 2000 个期号

#### 2. 最近N期（默认100期）
- **返回**：**N期已开奖（按ID顺序） + 1期推算的下一期，共 N+1 期**
- **推算方法**：`下一期 = max(Issue) + 1`
- **实现位置**：`src/server/server.js:10306-10328`
- **示例**：
  ```
  数据库最新期号: 25120
  "最近100期" 返回：
    - 100期已开奖：按 Issue 降序取100条记录，转升序
    - 推算下一期：25121
    - 共：101期
  ```

#### 3. 自定义范围
- **范围在已开奖期内**：返回范围内所有已开奖期号（无额外推算）
- **范围包含未开奖期**：返回已开奖期号 + 推算的下一期（仅1期）
- **实现位置**：`src/server/server.js:10330-10378`
- **示例**：
  ```
  数据库最新期号: 25120

  场景A：用户输入 25100-25120
  返回：25100-25120 范围内所有已开奖期号（无推算）

  场景B：用户输入 25100-25125
  返回：25100-25120（已开奖）+ 25121（推算下一期），共 N+1 期
  前端提示："期号 25121 尚未开奖，将作为预测目标"

  场景C：用户输入 25130-25140
  返回：25121（仅推算下一期）
  前端提示："所选范围超出已开奖数据，仅包含下一期预测目标 25121"
  ```

### 前端交互增强

**位置**：`src/renderer/dlt-module.js:10150-10205`

**功能**：
1. 自定义范围输入框获取焦点时，异步获取并显示最新期号和下一期
2. 输入结束期号后，智能提示：
   - 范围内全部已开奖 ✅
   - 包含下一期作为预测目标 ✅
   - 超出范围将自动包含下一期 ⚠️

### 验证脚本

#### 测试"最近100期"
```bash
curl -X POST http://localhost:3003/api/dlt/resolve-issue-range \
  -H "Content-Type: application/json" \
  -d '{"rangeType":"recent","recentCount":100}'
```
**预期**：返回101期（100期已开奖 + 1期推算）

#### 测试"自定义范围（范围内）"
```bash
curl -X POST http://localhost:3003/api/dlt/resolve-issue-range \
  -H "Content-Type: application/json" \
  -d '{"rangeType":"custom","startIssue":"25100","endIssue":"25120"}'
```
**预期**：返回范围内所有已开奖期号（无推算）

#### 测试"自定义范围（超出范围）"
```bash
curl -X POST http://localhost:3003/api/dlt/resolve-issue-range \
  -H "Content-Type: application/json" \
  -d '{"rangeType":"custom","startIssue":"25100","endIssue":"25125"}'
```
**预期**：返回已开奖期号 + 推算下一期（共N+1期）

### 修改记录
- **2025-10-27**：实现期号范围推算逻辑
  - 后端：`resolveIssueRangeInternal` 函数增加下一期推算
  - 前端：UI提示和交互增强
  - 文档：完善期号范围行为说明

## Recent Critical Fixes

See `prize-rules-fix-summary.md` and `export-excel-enhancement-summary.md` for detailed documentation of:
- Prize calculation rule corrections (2025-10-25)
- Excel export enhancement with hit count columns (2025-10-25)
- Port 3003 configuration documentation (2025-10-26)
- Issue range prediction logic enhancement (2025-10-27)
