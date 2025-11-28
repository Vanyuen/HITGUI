const http = require('http');

const data = JSON.stringify({
    task_name: "hwc-pos-fix-test-02",
    period_range: {
        type: "recent",
        value: 10  // 最近10期 + 1期推算 = 11期
    },
    positive_selection: {
        red_hot_warm_cold_ratios: ["2-2-1", "3-1-1", "2-1-2"]
    },
    exclusion_conditions: {}
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/dlt/hwc-positive-tasks/create',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    }
};

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        try {
            const result = JSON.parse(body);
            console.log('=== 任务创建结果 ===');
            console.log('成功:', result.success);

            if (result.task) {
                console.log('\n任务ID:', result.task._id);
                console.log('任务名:', result.task.task_name);

                console.log('\n=== issue_pairs_by_id (新格式) ===');
                if (result.task.issue_pairs_by_id) {
                    result.task.issue_pairs_by_id.forEach((pair, i) => {
                        const status = pair.is_predicted ? '🔮推算' : '✅已开奖';
                        console.log(`  #${i + 1}: base_id=${pair.base_id}, target_id=${pair.target_id}, ${status} | ${pair.base_issue}→${pair.target_issue}`);
                    });

                    // 验证逻辑
                    const predictedCount = result.task.issue_pairs_by_id.filter(p => p.is_predicted).length;
                    const drawnCount = result.task.issue_pairs_by_id.filter(p => !p.is_predicted).length;
                    const uniqueTargetIds = new Set(result.task.issue_pairs_by_id.map(p => p.target_id));
                    const totalPairs = result.task.issue_pairs_by_id.length;

                    console.log('\n=== 验证结果 ===');
                    console.log('总期号对数量:', totalPairs, '(期望: 11)');
                    console.log('推算期数量:', predictedCount, '(期望: 1)');
                    console.log('已开奖期数量:', drawnCount, '(期望: 10)');
                    console.log('唯一target_id数量:', uniqueTargetIds.size, '(期望: 11)');

                    const success = predictedCount === 1 && drawnCount === 10 && uniqueTargetIds.size === 11;
                    console.log('\n🎉 修复验证:', success ? '✅ 成功！所有期号都有唯一的target_id' : '❌ 失败');
                } else {
                    console.log('  无 issue_pairs_by_id');
                }
            } else if (result.message) {
                console.log('错误信息:', result.message);
            }
        } catch (e) {
            console.log('响应:', body.substring(0, 3000));
            console.log('解析错误:', e.message);
        }
    });
});

req.on('error', (e) => {
    console.error('请求错误:', e.message);
});

req.write(data);
req.end();
