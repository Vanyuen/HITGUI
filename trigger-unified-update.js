/**
 * 直接触发统一更新所有数据API
 */
const http = require('http');

const postData = JSON.stringify({ mode: 'full' });

const options = {
    hostname: 'localhost',
    port: 3003,
    path: '/api/dlt/unified-update',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

console.log('🚀 触发统一更新所有数据API...\n');

const req = http.request(options, (res) => {
    console.log(`📡 响应状态码: ${res.statusCode}\n`);

    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('📥 响应数据:');
        try {
            const result = JSON.parse(data);
            console.log(JSON.stringify(result, null, 2));

            if (result.success) {
                console.log('\n✅ 统一更新已启动！');
                console.log('📊 请等待2-5分钟完成数据生成...');
                console.log('\n💡 监控进度：打开应用的"大乐透数据管理后台"查看实时进度');
                console.log('💡 或等待5分钟后运行: node check-missing-data.js');
            } else {
                console.log('\n❌ 统一更新启动失败！');
                console.log(`❌ 错误信息: ${result.message}`);
            }
        } catch (error) {
            console.log('❌ 解析响应失败:', error.message);
            console.log('📄 原始响应:', data);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ 请求失败:', error.message);
    console.error('💡 请确保服务器运行在 http://localhost:3003');
});

req.write(postData);
req.end();
