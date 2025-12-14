/**
 * 测试：在成功配置基础上仅添加ball_1约束
 */
const http = require('http');

const taskConfig = {
    task_name: "测试_仅添加ball_1_25085-25095",
    period_range: {
        type: "custom",
        value: { start: "25085", end: "25095" }
    },
    positive_selection: {
        red_hot_warm_cold_ratios: [{ hot: 3, warm: 1, cold: 1 }],
        zone_ratios: ["2:2:1"],
        sum_ranges: [{ min: 60, max: 90 }],
        span_ranges: [{ min: 18, max: 25 }],  // 单范围
        odd_even_ratios: ["3:2"],  // 单比例
        primes_ratios: [],
        ac_values: [4, 5, 6],
        consecutive_settings: { allow_2_consecutive: true, allow_3_consecutive: false },
        red_balls: { ball_1: [1], ball_2: [], ball_3: [], ball_4: [], ball_5: [] }  // 仅添加ball_1约束
    },
    exclusion_conditions: {
        sum: { historical: { enabled: true, count: 10 } },
        span: { historical: { enabled: true, count: 10 } },
        coOccurrence: { enabled: true, historical: { enabled: true, period: 10, combo2: false, combo3: true, combo4: false }, threshold: { enabled: false } },
        consecutiveGroups: { enabled: true, groups: [2, 3, 4] },
        maxConsecutiveLength: { enabled: true, lengths: [3, 4, 5] }
    },
    output_config: { pairingMode: "unlimited", enableHitAnalysis: true, exclusion_details: { enabled: true, mode: "recent", recent_count: 1 } }
};

const postData = JSON.stringify(taskConfig);
const req = http.request({
    hostname: 'localhost', port: 3003,
    path: '/api/dlt/hwc-positive-tasks/create',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
}, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        const result = JSON.parse(data);
        console.log('task_id:', result.data?.task_id);
    });
});
req.write(postData);
req.end();
