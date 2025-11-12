/**
 * ⚡ 优化点1: Worker线程 - 组合过滤Worker
 *
 * 功能：在独立线程中执行组合过滤逻辑，避免阻塞主线程
 * 性能：充分利用CPU多核，预期提升10-20%
 *
 * @author Claude Code
 * @date 2025-11-11
 */

const { parentPort, workerData } = require('worker_threads');

/**
 * 应用基础排除条件
 * @param {Object} combo - 组合对象
 * @param {Object} conditions - 排除条件
 * @returns {boolean} - true表示保留，false表示排除
 */
function applyExclusionConditions(combo, conditions) {
    // 和值范围过滤
    if (conditions.sumRange) {
        const sum = combo.sum_value;
        if (sum < conditions.sumRange.min || sum > conditions.sumRange.max) {
            return false;
        }
    }

    // 跨度范围过滤
    if (conditions.spanRange) {
        const span = combo.span_value;
        if (span < conditions.spanRange.min || span > conditions.spanRange.max) {
            return false;
        }
    }

    // 区间比过滤
    if (conditions.zoneRatios && conditions.zoneRatios.length > 0) {
        if (!conditions.zoneRatios.includes(combo.zone_ratio)) {
            return false;
        }
    }

    // 奇偶比过滤
    if (conditions.oddEvenRatios && conditions.oddEvenRatios.length > 0) {
        if (!conditions.oddEvenRatios.includes(combo.odd_even_ratio)) {
            return false;
        }
    }

    // AC值过滤
    if (conditions.acRange) {
        const ac = combo.ac_value;
        if (ac !== undefined && ac !== null) {
            if (ac < conditions.acRange.min || ac > conditions.acRange.max) {
                return false;
            }
        }
    }

    return true;
}

/**
 * 过滤组合批次
 * @param {Array} combinations - 组合数组
 * @param {Object} conditions - 排除条件
 * @returns {Object} - 过滤结果和统计信息
 */
function filterCombinations(combinations, conditions) {
    const startTime = Date.now();
    const excludedDetails = [];

    const filtered = combinations.filter(combo => {
        const pass = applyExclusionConditions(combo, conditions);

        // 记录排除详情（仅记录前100条，避免内存占用过大）
        if (!pass && excludedDetails.length < 100) {
            excludedDetails.push({
                combination_id: combo.combination_id,
                reason: '基础条件不符'
            });
        }

        return pass;
    });

    const duration = Date.now() - startTime;

    return {
        filtered,
        excludedDetails,
        stats: {
            inputCount: combinations.length,
            outputCount: filtered.length,
            excludedCount: combinations.length - filtered.length,
            duration,
            workerId: workerData.workerId || 'unknown'
        }
    };
}

// ========== Worker主逻辑 ==========

try {
    // 记录开始时间
    const workerStart = Date.now();

    // 执行过滤
    const result = filterCombinations(
        workerData.combinations,
        workerData.conditions
    );

    // 添加总耗时
    result.stats.totalDuration = Date.now() - workerStart;

    // 返回结果给主线程
    parentPort.postMessage({
        success: true,
        data: result
    });

} catch (error) {
    // 错误处理
    parentPort.postMessage({
        success: false,
        error: {
            message: error.message,
            stack: error.stack
        }
    });
}
