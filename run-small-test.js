/**
 * 运行小范围测试任务，观察批次边界行为
 * 范围: 25085-25095 (11期) - 包含批次边界期号25091
 */

const http = require('http');

const taskConfig = {
    task_name: "小范围测试_批次边界_25085-25095",
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
        span_ranges: [{ min: 18, max: 25 }, { min: 26, max: 32 }],
        odd_even_ratios: ["3:2", "4:1"],
        primes_ratios: [],
        ac_values: [4, 5, 6],
        consecutive_settings: {
            allow_2_consecutive: true,
            allow_3_consecutive: false
        },
        red_balls: {
            ball_1: [1],
            ball_2: [],
            ball_3: [],
            ball_4: [],
            ball_5: []
        }
    },
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
        conflictPairs: {
            enabled: false,
            globalTop: { enabled: false, period: 2700, top: 18, hotProtect: { enabled: false, top: 3 } },
            perBallTop: { enabled: false, period: 2700, top: 1, hotProtect: { enabled: false, top: 3 } },
            threshold: { enabled: false, value: 0.8, hotProtect: { enabled: false, top: 3 } }
        }
    },
    output_config: {
        pairingMode: "unlimited",
        enableHitAnalysis: true,
        exclusion_details: {
            enabled: true,
            mode: "recent",
            top_hit_count: 1,
            recent_count: 1
        },
        batchSize: 50000,
        autoExport: false,
        previewMode: "comprehensive",
        includeExclusionDetails: false
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

console.log('创建小范围测试任务 (25085-25095, 11期)...');
console.log('注意: 请观察服务器控制台的DEBUG日志输出\n');

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
                console.log('请等待任务完成后运行验证脚本...');
            } else {
                console.log(`\n❌ 任务创建失败: ${result.message}`);
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
