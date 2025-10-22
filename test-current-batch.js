/**
 * 测试当前运行的服务器批量预测功能
 */

const fetch = require('node-fetch');

const API_BASE = 'http://localhost:3003';

// 使用您当前的请求配置
const TEST_CONFIG = {
    task_name: "",
    period_range: {
        type: "recent",
        value: 20
    },
    exclude_conditions: {
        sum: {
            enabled: true,
            ranges: [
                { enabled: true, min: 15, max: 50 },
                { enabled: true, min: 121, max: 165 }
            ],
            historical: { enabled: false }
        },
        ac: {
            enabled: true,
            excludeValues: [0, 1, 2, 3],
            historical: { enabled: false }
        },
        hwc: {
            excludeRatios: [
                "5:0:0", "0:5:0", "0:0:5", "4:0:1", "1:4:0",
                "0:4:1", "1:0:4", "0:1:4", "3:2:0", "3:1:1",
                "3:0:2", "2:3:0", "2:2:1", "2:1:2", "2:0:3",
                "1:3:1", "1:2:2", "1:1:3", "0:2:3"
            ],
            enabled: true,
            historical: { enabled: false }
        }
    }
};

async function testCurrentBatch() {
    console.log('='.repeat(80));
    console.log('🧪 测试当前服务器批量预测');
    console.log('='.repeat(80));
    console.log();

    try {
        console.log('⏱️  发送请求...');
        const startTime = Date.now();

        const response = await fetch(`${API_BASE}/api/dlt/batch-prediction`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_CONFIG)
        });

        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`✅ 请求完成！耗时: ${duration}ms (${(duration / 1000).toFixed(2)}秒)`);
        console.log();

        if (!response.ok) {
            const text = await response.text();
            console.error('❌ HTTP错误:', response.status, response.statusText);
            console.error('响应内容:', text);
            return;
        }

        const result = await response.json();

        if (!result.success) {
            console.error('❌ API返回失败:', result.message || '未知错误');
            console.error('完整响应:', JSON.stringify(result, null, 2));
            return;
        }

        console.log('✅ 批量预测成功！');
        console.log('📊 统计信息:');
        console.log(`   - 总期数: ${result.statistics?.totalIssues || '未知'}`);
        console.log(`   - 处理时间: ${result.statistics?.processingTime || duration + 'ms'}`);
        console.log(`   - 平均速度: ${result.statistics?.averageSpeed || '未知'}`);
        console.log(`   - Session ID: ${result.statistics?.sessionId || '未知'}`);
        console.log();

        if (result.data && result.data.length > 0) {
            console.log(`📦 返回数据: ${result.data.length}期`);
            console.log('前3期示例:');
            for (let i = 0; i < Math.min(3, result.data.length); i++) {
                const item = result.data[i];
                console.log(`   ${i + 1}. 期号${item.target_issue}: 红球${item.red_count || 0}个, 蓝球${item.blue_count || 0}个`);
            }
        }

        console.log();
        console.log('='.repeat(80));
        console.log('✅ 测试完成！优化代码正在工作！');
        console.log('='.repeat(80));

    } catch (error) {
        console.error();
        console.error('❌ 测试失败:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

testCurrentBatch().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('脚本执行异常:', error);
    process.exit(1);
});
