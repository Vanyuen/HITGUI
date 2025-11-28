/**
 * 诊断服务器卡住问题
 */

const http = require('http');

console.log('='.repeat(80));
console.log('服务器卡住诊断');
console.log('='.repeat(80));

// Test 1: 检查端口3003是否响应
console.log('\n测试1: 检查服务器是否响应');
console.log('-'.repeat(80));

const testEndpoints = [
    '/api/dlt/prediction-tasks/list?page=1&limit=10&status=all',
    '/api/health',
    '/'
];

let completedTests = 0;
const totalTests = testEndpoints.length;

testEndpoints.forEach(endpoint => {
    const options = {
        hostname: 'localhost',
        port: 3003,
        path: endpoint,
        method: 'GET',
        timeout: 5000
    };

    console.log(`\n正在测试: ${endpoint}`);

    const req = http.request(options, (res) => {
        console.log(`  状态码: ${res.statusCode}`);
        console.log(`  响应头: ${JSON.stringify(res.headers)}`);

        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            console.log(`  响应长度: ${data.length} bytes`);
            if (data.length < 200) {
                console.log(`  响应内容: ${data}`);
            } else {
                console.log(`  响应内容: ${data.substring(0, 200)}...`);
            }
            completedTests++;
            if (completedTests === totalTests) {
                console.log('\n' + '='.repeat(80));
                console.log('✅ 诊断完成');
                console.log('='.repeat(80));
            }
        });
    });

    req.on('error', (e) => {
        console.error(`  ❌ 错误: ${e.message}`);
        completedTests++;
        if (completedTests === totalTests) {
            console.log('\n' + '='.repeat(80));
            console.log('❌ 诊断完成 - 发现错误');
            console.log('='.repeat(80));
        }
    });

    req.on('timeout', () => {
        console.error(`  ⏱️  超时: 请求5秒内未响应`);
        req.abort();
    });

    req.end();
});

// 超时保护
setTimeout(() => {
    console.log('\n' + '='.repeat(80));
    console.log('⏱️  总体超时 - 强制退出');
    console.log('='.repeat(80));
    process.exit(1);
}, 15000);
