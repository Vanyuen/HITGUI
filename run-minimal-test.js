/**
 * 运行最小测试任务，只有3期，方便观察日志
 */
const http = require('http');

const taskConfig = {
    task_name: "最小测试_3期_25093-25095",
    period_range: {
        type: "custom",
        value: {
            start: "25093",
            end: "25095"
        }
    },
    positive_selection: {
        red_hot_warm_cold_ratios: [{ hot: 3, warm: 1, cold: 1 }],
        zone_ratios: ["2:2:1"],
        sum_ranges: [{ min: 60, max: 90 }],
        span_ranges: [{ min: 18, max: 25 }],
        odd_even_ratios: ["3:2"],
        primes_ratios: [],
        ac_values: [4, 5, 6],
        consecutive_settings: {
            allow_2_consecutive: true,
            allow_3_consecutive: false
        },
        red_balls: { ball_1: [], ball_2: [], ball_3: [], ball_4: [], ball_5: [] }
    },
    exclusion_conditions: {},  // 不使用排除条件，简化测试
    output_config: {
        pairingMode: "unlimited",
        enableHitAnalysis: true,
        exclusion_details: { enabled: false, mode: "none" }
    }
};

const postData = JSON.stringify(taskConfig);

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

console.log('创建最小测试任务 (25093-25095, 3期)...');

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const result = JSON.parse(data);
            console.log('API响应:');
            console.log(JSON.stringify(result, null, 2));
            if (result.success) {
                console.log(`\n✅ 任务创建成功: ${result.data.task_id}`);
                console.log('请查看服务器控制台的DEBUG日志...');
            }
        } catch (e) {
            console.log('响应:', data);
        }
    });
});

req.on('error', (e) => {
    console.error(`请求错误: ${e.message}`);
});

req.write(postData);
req.end();
