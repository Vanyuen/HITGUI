/**
 * 测试统计关系API
 */

const fetch = require('node-fetch');

async function testStatsAPI() {
    console.log('🧪 测试统计关系API...\n');

    const url = 'http://localhost:3003/api/dlt/stats-relation?hwcRatios=0:0:5&periods=50';

    console.log('请求URL:', url);
    console.log('\n等待响应...\n');

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) {
            console.error('❌ API返回错误:', data.error);
            return;
        }

        console.log('✅ API响应成功\n');
        console.log('═══════════════════════════════════════════════════');
        console.log('📊 统计结果概览');
        console.log('═══════════════════════════════════════════════════');
        console.log(`分析范围: ${data.totalRecords} 期`);
        console.log(`符合热温冷比的期数: ${data.matchedRecords} 期`);
        console.log(`选中的热温冷比: ${data.hwcRatios.join(', ')}`);
        console.log('');

        console.log('═══════════════════════════════════════════════════');
        console.log('📈 TOP3 统计');
        console.log('═══════════════════════════════════════════════════');

        console.log('\n前区和值 TOP3:');
        data.topStats.frontSum.forEach((item, i) => {
            console.log(`  ${i+1}. ${item.value} - ${item.count}次`);
        });

        console.log('\n前区跨度 TOP3:');
        data.topStats.frontSpan.forEach((item, i) => {
            console.log(`  ${i+1}. ${item.value} - ${item.count}次`);
        });

        console.log('\n热温冷比 TOP3:');
        data.topStats.hwcRatio.forEach((item, i) => {
            console.log(`  ${i+1}. ${item.value} - ${item.count}次`);
        });

        console.log('\n区间比 TOP3:');
        data.topStats.zoneRatio.forEach((item, i) => {
            console.log(`  ${i+1}. ${item.value} - ${item.count}次`);
        });

        console.log('\nAC值 TOP3:');
        data.topStats.acValue.forEach((item, i) => {
            console.log(`  ${i+1}. ${item.value} - ${item.count}次`);
        });

        console.log('\n═══════════════════════════════════════════════════');
        console.log('📋 详细记录 (前5期)');
        console.log('═══════════════════════════════════════════════════');
        data.detailRecords.slice(0, 5).forEach((record, i) => {
            console.log(`\n${i+1}. 期号: ${record.issue}`);
            console.log(`   前区号码: ${record.frontBalls.join(', ')}`);
            console.log(`   和值: ${record.frontSum}, 跨度: ${record.frontSpan}`);
            console.log(`   热温冷比: ${record.hwcRatio}, 区间比: ${record.zoneRatio}, AC值: ${record.acValue}`);
        });

        console.log(`\n... 共 ${data.detailRecords.length} 条记录\n`);

        // 验证数据一致性
        console.log('═══════════════════════════════════════════════════');
        console.log('✅ 数据一致性验证');
        console.log('═══════════════════════════════════════════════════');
        console.log(`详细记录数: ${data.detailRecords.length}`);
        console.log(`matchedRecords: ${data.matchedRecords}`);
        console.log(`一致性: ${data.detailRecords.length === data.matchedRecords ? '✅ 通过' : '❌ 不一致!'}`);

        // 验证TOP3的次数总和是否超过matchedRecords
        const frontSumTotal = data.topStats.frontSum.reduce((sum, item) => sum + item.count, 0);
        console.log(`\n前区和值TOP3次数总和: ${frontSumTotal}`);
        console.log(`是否合理: ${frontSumTotal <= data.matchedRecords ? '✅ 合理' : '❌ 不合理 (超过总期数)'}`);

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
    }
}

// 等待服务器启动
setTimeout(() => {
    testStatsAPI();
}, 2000);
