/**
 * 测试热温冷正选批量预测任务创建
 * 模拟前端发送的请求数据
 */

const http = require('http');

const testData = {
    task_name: "测试期号范围处理_2025-11-16",
    period_range: {
        type: "custom",
        start: "25115",
        end: "25125"
    },
    positive_selection: {
        hwc_ratios: ["3:2:0", "2:3:0"],
        zone_ratios: ["2:1:2"],
        odd_even_ratios: ["2:3"]
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

                // 如果任务创建成功，直接查看任务详情
                const taskId = result.data.task_id;
                const detailOptions = {
                    hostname: 'localhost',
                    port: 3003,
                    path: `/api/dlt/hwc-positive-tasks/${taskId}`,
                    method: 'GET'
                };

                const detailReq = http.request(detailOptions, (detailRes) => {
                    let detailData = '';
                    detailRes.on('data', (chunk) => {
                        detailData += chunk;
                    });
                    detailRes.on('end', () => {
                        try {
                            const detailResult = JSON.parse(detailData);
                            console.log('\n📋 任务详情:');
                            console.log(JSON.stringify(detailResult, null, 2));

                            // 打印期号范围
                            if (detailResult.data && detailResult.data.period_range) {
                                console.log('\n📅 期号范围:');
                                console.log(`起始期号: ${detailResult.data.period_range.start}`);
                                console.log(`结束期号: ${detailResult.data.period_range.end}`);
                            }
                        } catch (detailError) {
                            console.log('❌ 解析任务详情失败:', detailError.message);
                        }
                    });
                });

                detailReq.on('error', (error) => {
                    console.error('❌ 获取任务详情失败:', error.message);
                });

                detailReq.end();
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