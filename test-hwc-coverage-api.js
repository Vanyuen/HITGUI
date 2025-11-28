#!/usr/bin/env node

const fetch = require('node-fetch');

async function testCoverageAPI() {
    console.log('\n🔍 测试热温冷优化表覆盖率API\n');
    console.log('='.repeat(70));

    const testCases = [
        {
            name: '最近10期',
            data: { rangeType: 'recent', recentCount: 10 }
        },
        {
            name: '自定义范围 (25115-25124)',
            data: { rangeType: 'custom', startIssue: '25115', endIssue: '25124' }
        }
    ];

    for (const testCase of testCases) {
        console.log(`\n测试: ${testCase.name}`);
        console.log('-'.repeat(70));

        try {
            const response = await fetch('http://localhost:3003/api/dlt/check-hwc-coverage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testCase.data)
            });

            const result = await response.json();

            console.log(`状态码: ${response.status}`);
            console.log(`响应:`, JSON.stringify(result, null, 2));

            if (result.success) {
                const { total, covered, missing, coveragePercent } = result.data;
                console.log(`\n✅ API返回成功`);
                console.log(`   总期号对: ${total}`);
                console.log(`   已覆盖: ${covered}`);
                console.log(`   缺失: ${missing}`);
                console.log(`   覆盖率: ${coveragePercent}%`);
            } else {
                console.log(`\n❌ API返回失败: ${result.message}`);
            }

        } catch (error) {
            console.log(`❌ 请求失败: ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(70));
    console.log('测试完成');
    console.log('='.repeat(70));
}

testCoverageAPI().catch(console.error);
