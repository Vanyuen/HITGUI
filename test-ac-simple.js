const http = require('http');

console.log('Testing AC Value Implementation...\n');

// Test 1: Trend Chart API
http.get('http://localhost:3003/api/dlt/trendchart?recentPeriods=3', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            console.log('✅ 测试1: 走势图API响应');
            console.log(`   返回期数: ${json.periods ? json.periods.length : 0}`);

            if (json.periods && json.periods.length > 0) {
                const firstPeriod = json.periods[0];
                console.log(`\n   期号: ${firstPeriod.period}`);
                console.log(`   红球: [${firstPeriod.redBalls.join(', ')}]`);
                console.log(`   前区和值: ${firstPeriod.statistics.frontSum}`);
                console.log(`   前区跨度: ${firstPeriod.statistics.frontSpan}`);
                console.log(`   前区AC值: ${firstPeriod.statistics.frontAcValue !== undefined ? firstPeriod.statistics.frontAcValue : '❌ 字段不存在'}`);

                if (firstPeriod.statistics.frontAcValue !== undefined) {
                    console.log('\n✅ AC值字段存在且有值！');
                } else {
                    console.log('\n❌ AC值字段不存在！');
                }
            }
        } catch (e) {
            console.error('❌ 解析JSON失败:', e.message);
        }

        // Test 2: Combination Prediction API with AC filter
        console.log('\n\n✅ 测试2: 批量预测API - AC值排除');
        const url = 'http://localhost:3003/api/dlt/new-combination-prediction?' +
            'targetIssue=2025001' +
            '&excludeConditions=' + encodeURIComponent(JSON.stringify({
                ac: {
                    enabled: true,
                    ranges: [{ enabled: true, min: 0, max: 3 }]
                }
            }));

        http.get(url, (res2) => {
            let data2 = '';
            res2.on('data', chunk => data2 += chunk);
            res2.on('end', () => {
                try {
                    const json2 = JSON.parse(data2);
                    console.log(`   返回组合数: ${json2.totalCount || json2.combinations?.length || 0}`);

                    if (json2.combinations && json2.combinations.length > 0) {
                        console.log(`\n   前3个组合的AC值:`);
                        for (let i = 0; i < Math.min(3, json2.combinations.length); i++) {
                            const combo = json2.combinations[i];
                            console.log(`   组合${i+1}: [${combo.numbers.join(', ')}] AC值=${combo.acValue}`);

                            // 验证是否符合排除条件(AC值应该>3)
                            if (combo.acValue >= 0 && combo.acValue <= 3) {
                                console.log(`      ❌ 错误：AC值=${combo.acValue}应该被排除！`);
                            } else {
                                console.log(`      ✅ 正确：AC值=${combo.acValue}未被排除`);
                            }
                        }
                    }

                    console.log('\n✅ 所有测试完成！');
                    process.exit(0);
                } catch (e) {
                    console.error('❌ 解析JSON失败:', e.message);
                    process.exit(1);
                }
            });
        }).on('error', err => {
            console.error('❌ 请求失败:', err.message);
            process.exit(1);
        });
    });
}).on('error', err => {
    console.error('❌ 请求失败:', err.message);
    process.exit(1);
});
