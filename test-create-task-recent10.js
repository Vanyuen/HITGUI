/**
 * 测试创建"最近10期"任务
 */

const http = require('http');

const requestData = JSON.stringify({
    task_name: "测试任务-最近10期",
    period_range: {
        type: "recent",
        value: 10
    },
    exclude_conditions: {},
    output_config: {
        combination_mode: "default",
        enable_validation: true,
        display_mode: "comprehensive"
    }
});

console.log('📤 发送请求:');
console.log(requestData);
console.log('');

const options = {
    hostname: 'localhost',
    port: 3003,
    path: '/api/dlt/prediction-tasks/create',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
    }
};

const req = http.request(options, (res) => {
    console.log(`📊 响应状态码: ${res.statusCode}`);
    console.log(`📊 响应头:`, res.headers);
    console.log('');

    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('📥 响应内容:');
        try {
            const result = JSON.parse(data);
            console.log(JSON.stringify(result, null, 2));
        } catch (e) {
            console.log(data);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ 请求失败:', error);
});

req.write(requestData);
req.end();
