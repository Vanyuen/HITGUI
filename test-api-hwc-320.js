const http = require('http');

function testAPI(periods) {
    return new Promise((resolve, reject) => {
        const url = `http://localhost:3003/api/dlt/stats-relation?hwcRatios=3:2:0&periods=${periods}`;

        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
}

async function main() {
    console.log('\n=== 测试热温冷比 3:2:0 API查询 ===\n');

    // 测试不同的periods参数
    const testCases = [30, 50, 100];

    for (const periods of testCases) {
        console.log(`\n📊 测试 periods=${periods}:\n`);

        const result = await testAPI(periods);

        console.log(`  ✅ success: ${result.success}`);
        console.log(`  📂 dataSource: ${result.dataSource}`);
        console.log(`  📋 totalRecords: ${result.totalRecords}`);
        console.log(`  ✨ matchedRecords: ${result.matchedRecords}`);
        console.log(`  📈 matchRate: ${result.matchRate}%`);

        if (result.detailRecords && result.detailRecords.length > 0) {
            console.log(`\n  最近匹配的期号（显示前5期）:`);
            result.detailRecords.slice(0, 5).forEach(rec => {
                console.log(`    期号 ${rec.issue}: 红球[${rec.frontBalls.join(', ')}] - 热温冷比:${rec.hwcRatio}, 和值:${rec.frontSum}, 跨度:${rec.frontSpan}`);
            });
        }
    }

    console.log('\n✅ 测试完成！\n');
    process.exit(0);
}

main().catch(error => {
    console.error('测试失败:', error);
    process.exit(1);
});
