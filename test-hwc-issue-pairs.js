/**
 * 测试热温冷正选批量预测的期号配对逻辑
 * 验证方案A（包含推算期，相邻配对）是否正确实施
 */

const fetch = require('node-fetch');

async function testIssuePairGeneration() {
    console.log('🧪 开始测试热温冷正选批量预测的期号配对逻辑...\n');

    // 测试场景1：最近10期
    console.log('=== 测试场景1：最近10期 ===');
    try {
        const response = await fetch('http://localhost:3003/api/dlt/check-hwc-coverage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rangeType: 'recent',
                recentCount: 10
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ API调用成功');
            console.log(`📊 数据覆盖率: ${result.data.coveragePercent}%`);
            console.log(`📊 总期号对数: ${result.data.total}`);
            console.log(`📊 已覆盖: ${result.data.covered}`);
            console.log(`📊 缺失: ${result.data.missing}`);

            // 验证期号对数量
            // 最近10期 + 1期推算 = 11期 → 应该生成10对（相邻配对）
            if (result.data.total === 10) {
                console.log('✅ 期号对数量正确: 11期 → 10对（相邻配对）');
            } else {
                console.log(`❌ 期号对数量错误: 预期10对，实际${result.data.total}对`);
            }
        } else {
            console.log(`❌ API调用失败: ${result.message}`);
        }
    } catch (error) {
        console.log(`❌ 测试失败: ${error.message}`);
    }

    console.log('\n=== 测试场景2：最近100期 ===');
    try {
        const response = await fetch('http://localhost:3003/api/dlt/check-hwc-coverage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rangeType: 'recent',
                recentCount: 100
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ API调用成功');
            console.log(`📊 数据覆盖率: ${result.data.coveragePercent}%`);
            console.log(`📊 总期号对数: ${result.data.total}`);
            console.log(`📊 已覆盖: ${result.data.covered}`);
            console.log(`📊 缺失: ${result.data.missing}`);

            // 验证期号对数量
            // 最近100期 + 1期推算 = 101期 → 应该生成100对（相邻配对）
            if (result.data.total === 100) {
                console.log('✅ 期号对数量正确: 101期 → 100对（相邻配对）');
            } else {
                console.log(`❌ 期号对数量错误: 预期100对，实际${result.data.total}对`);
            }
        } else {
            console.log(`❌ API调用失败: ${result.message}`);
        }
    } catch (error) {
        console.log(`❌ 测试失败: ${error.message}`);
    }

    console.log('\n=== 测试场景3：验证修复前后的对比 ===');
    console.log('修复前: N期 → N×(N-1)/2对（全组合）');
    console.log('  - 10期 → 45对');
    console.log('  - 100期 → 4950对 ❌ 性能问题');
    console.log('\n修复后: N期 → (N-1)对（相邻配对）');
    console.log('  - 10期 → 9对（或11期→10对，含推算期）');
    console.log('  - 100期 → 99对（或101期→100对，含推算期）✅');

    console.log('\n🎯 测试完成！');
}

// 运行测试
testIssuePairGeneration().catch(console.error);
