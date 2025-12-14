/**
 * 测试排除条件是否导致最后一期返回0
 */
const http = require('http');

const taskConfig = {
    task_name: "11期测试_带排除条件_25085-25095",
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
    // 启用排除条件（与原始失败测试相同）
    exclusion_conditions: {
        sum: { historical: { enabled: true, count: 10 } },
        span: { historical: { enabled: true, count: 10 } },
        coOccurrence: {
            enabled: true,
            historical: { enabled: true, period: 10, combo2: false, combo3: true, combo4: false },
            threshold: { enabled: false, value: 0.05 }
        },
        consecutiveGroups: { enabled: true, groups: [2, 3, 4] },
        maxConsecutiveLength: { enabled: true, lengths: [3, 4, 5] },
        hwc: { historical: { enabled: false, count: 10 } },
        zone: { historical: { enabled: false, count: 10 } },
        conflictPairs: { enabled: false }
    },
    output_config: {
        pairingMode: "unlimited",
        enableHitAnalysis: true,
        exclusion_details: { enabled: true, mode: "recent", recent_count: 1 }
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

console.log('创建11期带排除条件测试任务 (25085-25095)...');

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
