const mongoose = require('mongoose');

console.log('🔧 创建集合命名常量定义文件\n');

const constants = `/**
 * 数据库集合名称常量定义
 *
 * ⚠️  重要：禁止在代码中硬编码集合名称！
 *
 * 使用方法：
 * const { COLLECTIONS } = require('./constants/collections');
 * db.collection(COLLECTIONS.HWC_OPTIMIZED).find({});
 *
 * 创建时间: ${new Date().toISOString()}
 */

const COLLECTIONS = {
  // ═══════════════════════════════════════════════════════════════
  // 主数据表
  // ═══════════════════════════════════════════════════════════════

  /**
   * 大乐透主数据表
   * 记录数: 2792+ (期号 7001-25124+)
   * 更新频率: 每期新增1条
   */
  HIT_DLTS: 'hit_dlts',

  /**
   * 双色球主数据表
   */
  HIT_UNION_LOTTO: 'hit_unionlotto',

  // ═══════════════════════════════════════════════════════════════
  // 组合表（固定数据）
  // ═══════════════════════════════════════════════════════════════

  /**
   * 红球组合表（C(35,5) = 324,632种组合）
   * 记录数: 324,632 (固定)
   * 更新频率: 不变
   */
  RED_COMBINATIONS: 'hit_dlt_redcombinations',

  /**
   * 蓝球组合表（C(12,2) = 66种组合）
   * 记录数: 66 (固定)
   * 更新频率: 不变
   */
  BLUE_COMBINATIONS: 'hit_dlt_bluecombinations',

  // ═══════════════════════════════════════════════════════════════
  // 统计表（随主表更新）
  // ═══════════════════════════════════════════════════════════════

  /**
   * 红球遗漏值历史表
   * 记录数: 与主表同步（2792+）
   * 更新频率: 每期更新
   */
  RED_MISSING_HISTORIES: 'hit_dlt_basictrendchart_redballmissing_histories',

  /**
   * 组合特征表
   * 记录数: 与主表同步（2792+）
   * 更新频率: 每期更新
   */
  COMBO_FEATURES: 'hit_dlt_combofeatures',

  // ═══════════════════════════════════════════════════════════════
  // 热温冷优化表（核心重要数据！）
  // ═══════════════════════════════════════════════════════════════

  /**
   * 热温冷优化表
   *
   * ⚠️  极其重要！请严格使用此常量！
   *
   * 正确集合名: hit_dlt_redcombinationshotwarmcoldoptimizeds
   *
   * 注意事项:
   * 1. 必须使用复数形式: optimizeds (末尾有's')
   * 2. 必须全小写
   * 3. 必须使用完整单词: hotwarmcold (不要缩写为hwc)
   *
   * ❌ 常见错误（禁止使用）:
   * - hit_dlt_redcombinationshotwarmcoldoptimized (缺少's')
   * - HIT_DLT_RedCombinationsHotWarmColdOptimized (大写)
   * - hit_dlt_hwcoptimized (缩写)
   *
   * 记录数: 与主表同步（2792+）
   * 更新频率: 每期更新
   * 备份策略: 每日自动备份 + 全量重建前备份
   *
   * 数据结构:
   * {
   *   base_issue: "25124",
   *   target_issue: "25125",
   *   is_predicted: true,
   *   hot_warm_cold_data: {
   *     "2:1:2": [1, 6, 8, ...],  // 21种热温冷比例
   *     ...
   *   },
   *   hit_analysis: {...},
   *   statistics: {...}
   * }
   */
  HWC_OPTIMIZED: 'hit_dlt_redcombinationshotwarmcoldoptimizeds',

  // ═══════════════════════════════════════════════════════════════
  // 备份表命名前缀
  // ═══════════════════════════════════════════════════════════════

  /**
   * 热温冷优化表备份前缀
   * 完整命名格式: hit_dlt_redcombinationshotwarmcoldoptimizeds_backup_YYYYMMDD_HHMMSS
   * 示例: hit_dlt_redcombinationshotwarmcoldoptimizeds_backup_20251121_020000
   */
  HWC_OPTIMIZED_BACKUP_PREFIX: 'hit_dlt_redcombinationshotwarmcoldoptimizeds_backup_',

  // ═══════════════════════════════════════════════════════════════
  // 任务相关表
  // ═══════════════════════════════════════════════════════════════

  /**
   * 热温冷正选批量预测任务表
   */
  HWC_POSITIVE_TASKS: 'hit_dlt_hwcpositivepredictiontasks',

  /**
   * 热温冷正选批量预测任务结果表
   */
  HWC_POSITIVE_RESULTS: 'hit_dlt_hwcpositivepredictiontaskresults',

  /**
   * 排除详情表
   */
  EXCLUSION_DETAILS: 'hit_dlt_exclusiondetails',

  /**
   * 普通预测任务表
   */
  PREDICTION_TASKS: 'hit_dlt_predictiontasks',

  /**
   * 普通预测任务结果表
   */
  PREDICTION_TASK_RESULTS: 'hit_dlt_predictiontaskresults',
};

/**
 * 辅助函数：生成备份集合名
 * @param {Date} date - 备份时间，默认为当前时间
 * @returns {string} 备份集合名
 *
 * @example
 * const backupName = getBackupCollectionName();
 * // 返回: hit_dlt_redcombinationshotwarmcoldoptimizeds_backup_20251121_143052
 */
function getBackupCollectionName(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');

  return \`\${COLLECTIONS.HWC_OPTIMIZED_BACKUP_PREFIX}\${year}\${month}\${day}_\${hour}\${minute}\${second}\`;
}

/**
 * 辅助函数：验证集合名是否正确
 * @param {string} collectionName - 集合名
 * @returns {boolean} 是否为正确的集合名
 *
 * @example
 * isValidHWCCollection('hit_dlt_redcombinationshotwarmcoldoptimizeds'); // true
 * isValidHWCCollection('hit_dlt_hwcoptimized'); // false
 */
function isValidHWCCollection(collectionName) {
  return collectionName === COLLECTIONS.HWC_OPTIMIZED;
}

module.exports = {
  COLLECTIONS,
  getBackupCollectionName,
  isValidHWCCollection
};
`;

const fs = require('fs');
const path = require('path');

// 创建 constants 目录
const constantsDir = path.join(__dirname, 'constants');
if (!fs.existsSync(constantsDir)) {
  fs.mkdirSync(constantsDir, { recursive: true });
  console.log('✅ 创建目录: constants/');
}

// 写入文件
const filePath = path.join(constantsDir, 'collections.js');
fs.writeFileSync(filePath, constants, 'utf8');

console.log(`✅ 已创建文件: ${filePath}`);
console.log('');
console.log('使用示例:');
console.log('');
console.log('```javascript');
console.log("const { COLLECTIONS } = require('./constants/collections');");
console.log('');
console.log('// ✅ 正确用法');
console.log('db.collection(COLLECTIONS.HWC_OPTIMIZED).find({});');
console.log('');
console.log('// ❌ 错误用法（硬编码）');
console.log("db.collection('hit_dlt_hwcoptimized').find({});");
console.log('```');
console.log('');
console.log('现在可以在代码中使用此常量文件了！');
