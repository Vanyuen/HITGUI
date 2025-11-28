const http = require('http');

const requestData = JSON.stringify({
    task_name: "命中分析验证测试",
    period_range: {
        type: "custom",
        value: {
            start: "25120",
            end: "25124"
        }
    },
    positive_selection: {
        red_hot_warm_cold_ratios: ["5-0-0", "4-1-0", "4-0-1", "3-2-0", "3-1-1", "3-0-2"],
        blue_hot_warm_cold_ratios: ["2-0-0", "1-1-0", "1-0-1", "0-2-0", "0-1-1"]
    },
    exclusion_conditions: {},
    output_config: {
        max_combinations: 10000
    }
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/dlt/hwc-positive-tasks/create',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData)
    }
};

const req = http.request(options, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        console.log('Response:', JSON.parse(data));
    });
});

req.on('error', (e) => {
    console.error('Request error:', e.message);
});

req.write(requestData);
req.end();
