/**
 * 测试趋势图API
 */
const http = require('http');

function testAPI(url, name) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    console.log(`\n✅ ${name}:`);
                    console.log(`  Success: ${json.success}`);
                    if (json.data && Array.isArray(json.data)) {
                        console.log(`  Data periods: ${json.data.length}`);
                        if (json.data.length > 0) {
                            console.log(`  First issue: ${json.data[0].issue || json.data[0].Issue}`);
                        }
                    }
                    if (json.error) {
                        console.log(`  Error: ${json.error}`);
                    }
                    resolve(json);
                } catch (e) {
                    console.log(`\n❌ ${name}: Parse error`, e.message);
                    reject(e);
                }
            });
        }).on('error', (e) => {
            console.log(`\n❌ ${name}: ${e.message}`);
            reject(e);
        });
    });
}

async function runTests() {
    console.log('🧪 测试大乐透API...\n');

    try {
        await testAPI('http://localhost:3003/api/dlt/history?page=1&limit=5', 'hit_dlts历史数据');
        await testAPI('http://localhost:3003/api/dlt/trendchart?recentPeriods=5', 'hit_dlts趋势图');

        console.log('\n✅ 所有测试完成！');
    } catch (error) {
        console.log('\n❌ 测试失败:', error.message);
    }
}

runTests();
