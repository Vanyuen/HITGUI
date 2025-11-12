/**
 * 测试热温冷正选批量预测任务创建
 * 模拟前端发送的请求数据
 */

const http = require('http');

const testData = {
    task_name: "超级认真模式测试_2025-11-04",
    period_range: {
        type: "custom",
        value: { start: "25114", end: "25125" }
    },
    positive_selection: {
        hwc_ratios: [
            { hot: 4, warm: 1, cold: 0 }
        ],
        zone_ratios: [
            { zone1: 2, zone2: 1, zone3: 2 }
        ],
        sum_ranges: [],
        span_ranges: [],
        odd_even_ratios: [
            { odd: 2, even: 3 },
            { odd: 3, even: 2 }
        ],
        primes_ratios: [],
        ac_values: [],
        consecutive_settings: {
            allow_2_consecutive: true,
            allow_3_consecutive: false
        }
    },
    exclusion_conditions: {}
};

const postData = JSON.stringify(testData);

const options = {
    hostname: 'localhost',
    port: 3003,
    path: '/api/dlt/hwc-positive-tasks/create',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
    }
};

console.log('🚀 发送测试请求到热温冷正选任务创建API...');
console.log('📝 请求数据:', JSON.stringify(testData, null, 2));

const req = http.request(options, (res) => {
    console.log(`\n📡 响应状态码: ${res.statusCode}`);
    console.log(`📋 响应头:`, res.headers);

    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('\n📥 响应数据:');
        try {
            const result = JSON.parse(data);
            console.log(JSON.stringify(result, null, 2));

            if (result.success) {
                console.log('\n✅ 任务创建成功！');
                console.log(`📋 任务ID: ${result.data.task_id}`);
            } else {
                console.log('\n❌ 任务创建失败！');
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
});

req.write(postData);
req.end();
