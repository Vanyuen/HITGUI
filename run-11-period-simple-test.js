/**
 * 运行11期测试，但使用简化的正选条件
 */
const http = require('http');

const taskConfig = {
    task_name: "11期测试_简化条件_25085-25095",
    period_range: {
        type: "custom",
        value: {
            start: "25085",
            end: "25095"
        }
    },
    positive_selection: {
        red_hot_warm_cold_ratios: [{ hot: 3, warm: 1, cold: 1 }],
        zone_ratios: ["2:2:1"],
        sum_ranges: [{ min: 60, max: 90 }],
        span_ranges: [{ min: 18, max: 25 }],  // 只有1个范围（和成功的测试相同）
        odd_even_ratios: ["3:2"],  // 只有1个比例（和成功的测试相同）
        primes_ratios: [],
        ac_values: [4, 5, 6],
        consecutive_settings: {
            allow_2_consecutive: true,
            allow_3_consecutive: false
        },
        red_balls: { ball_1: [], ball_2: [], ball_3: [], ball_4: [], ball_5: [] }
    },
    exclusion_conditions: {},  // 不使用排除条件
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

console.log('创建11期简化测试任务 (25085-25095)...');

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const result = JSON.parse(data);
            console.log('API响应:', JSON.stringify(result, null, 2));
            if (result.success) {
                console.log(`\n✅ 任务创建成功: ${result.data.task_id}`);
            }
        } catch (e) {
            console.log('响应:', data);
        }
    });
});

req.on('error', (e) => console.error(`请求错误: ${e.message}`));
req.write(postData);
req.end();
