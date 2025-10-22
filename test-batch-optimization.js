/**
 * 批量预测性能优化测试脚本
 * 测试优化后的批量预测功能
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3003';

// 测试配置：预测最近20期（完整测试）
const TEST_CONFIG = {
    rangeConfig: {
        rangeType: 'recent',
        recentCount: 20  // 完整测试20期
    },
    filters: {
        maxRedCombinations: 100,  // 限制红球组合数，加快测试
        maxBlueCombinations: 66
    },
    exclude_conditions: {},
    enableValidation: true,
    trulyUnlimited: false,
    combinationMode: 'default'
};

async function testBatchPrediction() {
    console.log('='.repeat(80));
    console.log('🚀 批量预测性能优化测试');
    console.log('='.repeat(80));
    console.log();

    console.log('📋 测试配置:');
    console.log(`   - 期号范围: 最近${TEST_CONFIG.rangeConfig.recentCount}期`);
    console.log(`   - 红球组合上限: ${TEST_CONFIG.filters.maxRedCombinations}`);
    console.log(`   - 蓝球组合上限: ${TEST_CONFIG.filters.maxBlueCombinations}`);
    console.log(`   - 启用命中验证: ${TEST_CONFIG.enableValidation ? '是' : '否'}`);
    console.log();

    try {
        console.log('⏱️  开始计时...');
        const startTime = Date.now();

        console.log('🌐 发送批量预测请求...');
        const response = await fetch(`${API_BASE}/api/dlt/batch-prediction`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(TEST_CONFIG)
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`✅ 请求完成！耗时: ${duration}ms (${(duration / 1000).toFixed(2)}秒)`);
        console.log();

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message || '批量预测失败');
        }

        console.log('='.repeat(80));
        console.log('📊 测试结果');
        console.log('='.repeat(80));
        console.log();

        console.log('✅ 基本信息:');
        console.log(`   - 总期数: ${result.statistics.totalIssues}`);
        console.log(`   - Session ID: ${result.statistics.sessionId}`);
        console.log(`   - 处理时间: ${result.statistics.processingTime || duration + 'ms'}`);
        console.log(`   - 平均速度: ${result.statistics.averageSpeed || '未知'}`);
        console.log();

        if (result.data && result.data.length > 0) {
            console.log('✅ 预测数据:');
            console.log(`   - 返回数据条数: ${result.data.length}`);

            // 显示前3期的数据示例
            const sampleCount = Math.min(3, result.data.length);
            console.log(`   - 前${sampleCount}期示例:`);

            for (let i = 0; i < sampleCount; i++) {
                const item = result.data[i];
                console.log(`     ${i + 1}. 期号${item.target_issue}: 红球${item.red_count || item.redCount || '?'}个, 蓝球${item.blue_count || item.blueCount || '?'}个`);
            }
        }

        console.log();
        console.log('='.repeat(80));
        console.log('🎯 性能评估');
        console.log('='.repeat(80));
        console.log();

        const issueCount = result.statistics.totalIssues || TEST_CONFIG.rangeConfig.recentCount;
        const avgTimePerIssue = duration / issueCount;

        console.log(`平均每期处理时间: ${avgTimePerIssue.toFixed(2)}ms`);
        console.log();

        // 性能等级评估
        if (duration < 1000) {
            console.log('⭐⭐⭐⭐⭐ 性能评级: 优秀 (极快)');
        } else if (duration < 3000) {
            console.log('⭐⭐⭐⭐ 性能评级: 良好');
        } else if (duration < 5000) {
            console.log('⭐⭐⭐ 性能评级: 一般');
        } else if (duration < 10000) {
            console.log('⭐⭐ 性能评级: 较慢');
        } else {
            console.log('⭐ 性能评级: 慢');
        }

        console.log();
        console.log('='.repeat(80));
        console.log('💡 优化效果估算');
        console.log('='.repeat(80));
        console.log();

        // 基于之前的分析，优化前20期约20秒
        const oldTime20 = 20000; // 20秒
        const estimatedNew20 = (duration / issueCount) * 20;

        console.log(`优化前预估 (20期): ~${oldTime20 / 1000}秒`);
        console.log(`优化后预估 (20期): ~${(estimatedNew20 / 1000).toFixed(2)}秒`);
        console.log(`提速倍数: ~${(oldTime20 / estimatedNew20).toFixed(1)}x`);
        console.log();

        console.log('='.repeat(80));
        console.log('✅ 测试完成！');
        console.log('='.repeat(80));

    } catch (error) {
        console.error();
        console.error('='.repeat(80));
        console.error('❌ 测试失败');
        console.error('='.repeat(80));
        console.error();
        console.error('错误信息:', error.message);
        console.error();

        if (error.stack) {
            console.error('错误堆栈:');
            console.error(error.stack);
        }

        process.exit(1);
    }
}

// 执行测试
console.log();
testBatchPrediction().then(() => {
    console.log();
    console.log('💡 提示:');
    console.log('   - 如果测试成功，可以修改 TEST_CONFIG.rangeConfig.recentCount 为 20 进行完整测试');
    console.log('   - 如果需要测试更多配置，可以修改 TEST_CONFIG 中的其他参数');
    console.log();
    process.exit(0);
}).catch(error => {
    console.error('脚本执行异常:', error);
    process.exit(1);
});
