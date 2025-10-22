/**
 * 阶段1性能优化测试脚本
 *
 * 测试优化效果：
 * - A1: 硬编码总组合数常量（预期节省 50-100ms）
 * - A2: 使用 Set 替代 includes()（预期节省 200-400ms）
 * - A3: 添加数据库索引（预期节省 100-270ms）
 *
 * 总预期收益: 350-770ms（约 30-50% 性能提升）
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3003';

// 测试配置
const TEST_CONFIG = {
    // 测试的期号（选择不同的期号测试）
    targetIssues: ['25001', '25002', '25003'],

    // 排除条件（模拟真实使用场景）
    excludeConditions: {
        sum: {
            ranges: [
                { min: 60, max: 70 },
                { min: 130, max: 140 }
            ]
        },
        span: {
            ranges: [
                { min: 5, max: 10 }
            ]
        },
        zone: {
            excludeRatios: ['0:0:5', '5:0:0']
        },
        oddEven: {
            excludeRatios: ['0:5', '5:0']
        },
        hwc: {
            enabled: true,
            excludeHtcRatios: ['5:0:0', '0:5:0', '0:0:5'],
            excludeRecentPeriods: 30
        },
        conflict: {
            enabled: true,
            periodsToAnalyze: 50,
            topN: 10,
            perBallTopN: 3
        },
        coOccurrencePerBall: {
            enabled: true,
            periods: 2
        }
    },

    // 重复测试次数（计算平均值）
    repeatTimes: 3
};

/**
 * 执行单次批量预测
 */
async function runBatchPrediction(targetIssues, excludeConditions) {
    const startTime = Date.now();

    try {
        const response = await axios.post(`${API_BASE}/api/dlt/batch-prediction`, {
            targetIssues,
            excludeConditions,
            combinationPattern: 'default' // 限制100个红球组合
        }, {
            timeout: 300000 // 5分钟超时
        });

        const totalTime = Date.now() - startTime;

        return {
            success: true,
            totalTime,
            results: response.data.results,
            stats: response.data.stats
        };
    } catch (error) {
        const totalTime = Date.now() - startTime;
        return {
            success: false,
            totalTime,
            error: error.message
        };
    }
}

/**
 * 分析排除执行链的性能
 */
function analyzeExclusionChain(results) {
    const analysis = {
        totalIssues: results.length,
        avgBasicTime: 0,
        avgHwcTime: 0,
        avgConflictTime: 0,
        avgCoOccTime: 0,
        avgTotalExclusionTime: 0
    };

    let basicTimes = [];
    let hwcTimes = [];
    let conflictTimes = [];
    let coOccTimes = [];
    let totalTimes = [];

    for (const result of results) {
        if (!result.exclusion_chain) continue;

        let totalTime = 0;
        for (const step of result.exclusion_chain) {
            totalTime += step.execution_time_ms || 0;

            switch (step.condition) {
                case 'basic':
                    basicTimes.push(step.execution_time_ms || 0);
                    break;
                case 'hwc':
                    hwcTimes.push(step.execution_time_ms || 0);
                    break;
                case 'conflict':
                    conflictTimes.push(step.execution_time_ms || 0);
                    break;
                case 'coOccurrencePerBall':
                    coOccTimes.push(step.execution_time_ms || 0);
                    break;
            }
        }
        totalTimes.push(totalTime);
    }

    const avg = (arr) => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 0;

    analysis.avgBasicTime = avg(basicTimes);
    analysis.avgHwcTime = avg(hwcTimes);
    analysis.avgConflictTime = avg(conflictTimes);
    analysis.avgCoOccTime = avg(coOccTimes);
    analysis.avgTotalExclusionTime = avg(totalTimes);

    return analysis;
}

/**
 * 主测试函数
 */
async function runPerformanceTest() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🚀 阶段1性能优化测试');
    console.log('═══════════════════════════════════════════════════════\n');

    console.log('📋 测试配置:');
    console.log(`  - 测试期号: ${TEST_CONFIG.targetIssues.join(', ')}`);
    console.log(`  - 重复次数: ${TEST_CONFIG.repeatTimes} 次`);
    console.log(`  - 排除条件: 和值、跨度、区间比、奇偶比、热温冷比、相克、同出(按红球)`);
    console.log('');

    const allResults = [];

    for (let i = 1; i <= TEST_CONFIG.repeatTimes; i++) {
        console.log(`\n🔄 第 ${i}/${TEST_CONFIG.repeatTimes} 次测试`);
        console.log('─────────────────────────────────────────────────────');

        const result = await runBatchPrediction(
            TEST_CONFIG.targetIssues,
            TEST_CONFIG.excludeConditions
        );

        if (result.success) {
            console.log(`✅ 测试成功`);
            console.log(`  - 总耗时: ${result.totalTime}ms`);
            console.log(`  - 预测期数: ${result.results.length}期`);
            console.log(`  - 平均每期: ${(result.totalTime / result.results.length).toFixed(2)}ms`);

            // 分析排除链性能
            const analysis = analyzeExclusionChain(result.results);
            console.log(`\n  📊 排除条件平均耗时:`);
            console.log(`    - 基础排除: ${analysis.avgBasicTime}ms`);
            console.log(`    - 热温冷比: ${analysis.avgHwcTime}ms`);
            console.log(`    - 相克排除: ${analysis.avgConflictTime}ms`);
            console.log(`    - 同出排除: ${analysis.avgCoOccTime}ms`);
            console.log(`    - 总排除时间: ${analysis.avgTotalExclusionTime}ms/期`);

            allResults.push({
                totalTime: result.totalTime,
                avgTimePerIssue: result.totalTime / result.results.length,
                analysis
            });
        } else {
            console.log(`❌ 测试失败: ${result.error}`);
        }
    }

    // 计算所有测试的平均值
    if (allResults.length > 0) {
        console.log('\n\n═══════════════════════════════════════════════════════');
        console.log('📈 性能测试统计结果');
        console.log('═══════════════════════════════════════════════════════\n');

        const avgTotalTime = (allResults.reduce((sum, r) => sum + r.totalTime, 0) / allResults.length).toFixed(2);
        const avgTimePerIssue = (allResults.reduce((sum, r) => sum + r.avgTimePerIssue, 0) / allResults.length).toFixed(2);

        console.log(`🎯 ${TEST_CONFIG.repeatTimes}次测试平均结果:`);
        console.log(`  - 总耗时: ${avgTotalTime}ms`);
        console.log(`  - 平均每期: ${avgTimePerIssue}ms`);
        console.log(`  - 测试期数: ${TEST_CONFIG.targetIssues.length}期`);

        // 计算各排除条件的平均耗时
        const avgBasic = (allResults.reduce((sum, r) => sum + parseFloat(r.analysis.avgBasicTime), 0) / allResults.length).toFixed(2);
        const avgHwc = (allResults.reduce((sum, r) => sum + parseFloat(r.analysis.avgHwcTime), 0) / allResults.length).toFixed(2);
        const avgConflict = (allResults.reduce((sum, r) => sum + parseFloat(r.analysis.avgConflictTime), 0) / allResults.length).toFixed(2);
        const avgCoOcc = (allResults.reduce((sum, r) => sum + parseFloat(r.analysis.avgCoOccTime), 0) / allResults.length).toFixed(2);
        const avgTotal = (allResults.reduce((sum, r) => sum + parseFloat(r.analysis.avgTotalExclusionTime), 0) / allResults.length).toFixed(2);

        console.log(`\n  📊 各排除条件平均耗时:`);
        console.log(`    - 基础排除: ${avgBasic}ms ← 优化A1+A2主要影响`);
        console.log(`    - 热温冷比: ${avgHwc}ms`);
        console.log(`    - 相克排除: ${avgConflict}ms ← 优化A3主要影响`);
        console.log(`    - 同出排除: ${avgCoOcc}ms`);
        console.log(`    - 总排除时间: ${avgTotal}ms/期`);

        console.log('\n  🎁 预期优化效果对比:');
        console.log(`    ┌─────────────────────────────────────────┐`);
        console.log(`    │ 优化项目        │ 预期节省    │ 实际测试 │`);
        console.log(`    ├─────────────────────────────────────────┤`);
        console.log(`    │ A1: 硬编码常量  │  50-100ms   │   见上   │`);
        console.log(`    │ A2: Set优化     │ 200-400ms   │   见上   │`);
        console.log(`    │ A3: 索引优化    │ 100-270ms   │   见上   │`);
        console.log(`    ├─────────────────────────────────────────┤`);
        console.log(`    │ 总计            │ 350-770ms   │ ${avgBasic}+${avgConflict}ms │`);
        console.log(`    └─────────────────────────────────────────┘`);

        console.log('\n  💡 提示:');
        console.log(`    - 基础排除时间 < 200ms 表示A1+A2优化生效`);
        console.log(`    - 相克排除时间 < 200ms 表示A3索引优化生效`);
        console.log(`    - 总排除时间建议控制在 500-800ms/期以内`);
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ 测试完成');
    console.log('═══════════════════════════════════════════════════════\n');
}

// 执行测试
runPerformanceTest().catch(console.error);
