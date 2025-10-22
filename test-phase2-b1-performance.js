/**
 * 阶段2优化 B1 性能测试脚本
 *
 * 测试内容：预计算并缓存组合特征
 * 预期收益：特征匹配从 500ms-2s → 50-200ms
 *
 * 测试场景：主要测试"同出排除(按红球)"和"同出排除(按期号)"功能
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3003';

// 测试配置
const TEST_CONFIG = {
    // 测试的期号
    targetIssues: ['25001', '25002', '25003'],

    // 重点测试同出排除功能（这是使用特征匹配的主要场景）
    excludeConditions: {
        coOccurrencePerBall: {
            enabled: true,
            periods: 2,  // 每个号码分析最近2次出现
            combo2: true,
            combo3: true,
            combo4: true
        }
    },

    // 测试次数
    repeatTimes: 3
};

/**
 * 获取缓存统计信息
 */
async function getCacheStats() {
    try {
        const response = await axios.get(`${API_BASE}/api/cache/combo-features/stats`);
        return response.data;
    } catch (error) {
        return null;
    }
}

/**
 * 执行批量预测
 */
async function runBatchPrediction(targetIssues, excludeConditions) {
    const startTime = Date.now();

    try {
        const response = await axios.post(`${API_BASE}/api/dlt/batch-prediction`, {
            targetIssues,
            excludeConditions,
            combinationPattern: 'default'
        }, {
            timeout: 300000
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
 * 分析同出排除性能
 */
function analyzeCoOccurrencePerformance(results) {
    const analysis = {
        totalIssues: results.length,
        avgCoOccTime: 0,
        avgTotalTime: 0
    };

    let coOccTimes = [];
    let totalTimes = [];

    for (const result of results) {
        if (!result.exclusion_chain) continue;

        let totalTime = 0;
        for (const step of result.exclusion_chain) {
            totalTime += step.execution_time_ms || 0;

            if (step.condition === 'coOccurrencePerBall' || step.condition === 'coOccurrenceByIssues') {
                coOccTimes.push(step.execution_time_ms || 0);
            }
        }
        totalTimes.push(totalTime);
    }

    const avg = (arr) => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 0;

    analysis.avgCoOccTime = avg(coOccTimes);
    analysis.avgTotalTime = avg(totalTimes);

    return analysis;
}

/**
 * 主测试函数
 */
async function runB1PerformanceTest() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🚀 阶段2优化 B1 性能测试：组合特征缓存');
    console.log('═══════════════════════════════════════════════════════\n');

    // 1. 检查缓存状态
    console.log('📊 步骤 1/4: 检查缓存状态\n');
    const initialStats = await getCacheStats();

    if (!initialStats) {
        console.log('❌ 无法连接到服务器，请确保服务器已启动');
        console.log('   运行命令: npm start');
        return;
    }

    console.log('  缓存状态:');
    console.log(`    - 已启用: ${initialStats.enabled ? '✅ 是' : '❌ 否'}`);
    console.log(`    - 已加载: ${initialStats.isLoaded ? '✅ 是' : '❌ 否'}`);

    if (initialStats.isLoaded) {
        console.log(`    - 加载组合数: ${initialStats.stats.loadedCount}`);
        console.log(`    - 内存占用: ${initialStats.stats.memoryUsageMB.toFixed(2)} MB`);
        console.log(`    - 加载耗时: ${initialStats.stats.loadTime} ms`);
    }

    if (!initialStats.enabled || !initialStats.isLoaded) {
        console.log('\n⚠️  警告: 缓存未启用或未加载，测试将使用动态计算模式（性能较低）');
        console.log('   如需启用缓存，请重启服务器');
    }

    // 2. 执行性能测试
    console.log('\n📊 步骤 2/4: 执行性能测试\n');
    console.log(`  测试配置:`);
    console.log(`    - 测试期号: ${TEST_CONFIG.targetIssues.join(', ')}`);
    console.log(`    - 重复次数: ${TEST_CONFIG.repeatTimes} 次`);
    console.log(`    - 同出排除: 每个号码分析最近2次出现`);
    console.log(`    - 特征类型: 2码、3码、4码`);
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

            // 分析同出排除性能
            const analysis = analyzeCoOccurrencePerformance(result.results);
            console.log(`\n  📊 同出排除平均耗时: ${analysis.avgCoOccTime}ms ← B1优化重点`);

            allResults.push({
                totalTime: result.totalTime,
                avgTimePerIssue: result.totalTime / result.results.length,
                analysis
            });
        } else {
            console.log(`❌ 测试失败: ${result.error}`);
        }
    }

    // 3. 检查缓存命中率
    console.log('\n\n📊 步骤 3/4: 检查缓存命中率\n');
    const finalStats = await getCacheStats();

    if (finalStats && finalStats.isLoaded) {
        console.log(`  缓存统计:`);
        console.log(`    - 命中次数: ${finalStats.stats.hitCount}`);
        console.log(`    - 未命中次数: ${finalStats.stats.missCount}`);
        console.log(`    - 命中率: ${finalStats.hitRate}`);

        if (parseFloat(finalStats.hitRate) < 90) {
            console.log(`\n  ⚠️  注意: 命中率低于90%，可能存在以下问题:`);
            console.log(`    1. 缓存加载不完整`);
            console.log(`    2. 查询的组合ID不在缓存范围内`);
            console.log(`    3. 组合特征数据缺失`);
        } else {
            console.log(`\n  ✅ 命中率良好，缓存工作正常`);
        }
    }

    // 4. 汇总结果
    if (allResults.length > 0) {
        console.log('\n\n═══════════════════════════════════════════════════════');
        console.log('📈 步骤 4/4: 性能测试汇总');
        console.log('═══════════════════════════════════════════════════════\n');

        const avgTotalTime = (allResults.reduce((sum, r) => sum + r.totalTime, 0) / allResults.length).toFixed(2);
        const avgTimePerIssue = (allResults.reduce((sum, r) => sum + r.avgTimePerIssue, 0) / allResults.length).toFixed(2);
        const avgCoOccTime = (allResults.reduce((sum, r) => sum + parseFloat(r.analysis.avgCoOccTime), 0) / allResults.length).toFixed(2);

        console.log(`  🎯 ${TEST_CONFIG.repeatTimes}次测试平均结果:`);
        console.log(`    - 总耗时: ${avgTotalTime}ms`);
        console.log(`    - 平均每期: ${avgTimePerIssue}ms`);
        console.log(`    - 同出排除: ${avgCoOccTime}ms ← B1优化重点`);

        console.log(`\n  📊 性能对比（预期）:`);
        console.log(`    ┌──────────────────────────────────────────────┐`);
        console.log(`    │ 场景              │ 优化前        │ 优化后   │`);
        console.log(`    ├──────────────────────────────────────────────┤`);
        console.log(`    │ 同出排除(缓存OFF) │ 500-2000ms   │    -     │`);
        console.log(`    │ 同出排除(缓存ON)  │      -       │ 50-200ms │`);
        console.log(`    ├──────────────────────────────────────────────┤`);
        console.log(`    │ 实际测试结果      │      -       │ ${avgCoOccTime}ms  │`);
        console.log(`    └──────────────────────────────────────────────┘`);

        console.log(`\n  💡 优化效果判断:`);
        if (parseFloat(avgCoOccTime) < 200) {
            console.log(`    ✅ 同出排除时间 < 200ms - B1优化生效！`);
            console.log(`    ✅ 性能达到预期，特征匹配速度显著提升`);
        } else if (parseFloat(avgCoOccTime) < 500) {
            console.log(`    ⚠️  同出排除时间 200-500ms - 优化部分生效`);
            console.log(`    ⚠️  可能原因：缓存命中率不高或其他瓶颈`);
        } else {
            console.log(`    ❌ 同出排除时间 > 500ms - 优化未生效或失效`);
            console.log(`    ❌ 请检查：`);
            console.log(`       1. 缓存是否正常加载`);
            console.log(`       2. 特征匹配逻辑是否使用缓存`);
            console.log(`       3. 是否有其他性能瓶颈`);
        }

        console.log(`\n  🔧 提示:`);
        console.log(`    - 查看缓存统计: curl http://localhost:3000/api/cache/combo-features/stats`);
        console.log(`    - 重新加载缓存: curl -X POST http://localhost:3000/api/cache/combo-features/reload`);
        console.log(`    - 禁用缓存测试: 设置环境变量 DISABLE_COMBO_CACHE=true 后重启`);

        // 5. 对比建议
        console.log(`\n  📋 下一步建议:`);
        if (parseFloat(avgCoOccTime) < 200) {
            console.log(`    ✅ B1优化效果显著，可以继续使用`);
            console.log(`    ✅ 如果整体性能仍不满意，可考虑实施 B2 优化（相克缓存）`);
        } else {
            console.log(`    ⚠️  B1优化效果不明显，建议：`);
            console.log(`    1. 检查缓存加载日志`);
            console.log(`    2. 查看缓存命中率统计`);
            console.log(`    3. 对比缓存开启/关闭的性能差异`);
        }
    }

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ 测试完成');
    console.log('═══════════════════════════════════════════════════════\n');
}

// 执行测试
runB1PerformanceTest().catch(console.error);
