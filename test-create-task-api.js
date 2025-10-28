const fetch = require('node-fetch');

async function testCreateTask() {
    try {
        console.log('📤 发送任务创建请求...\n');

        const requestBody = {
            task_name: "测试任务",
            period_range: {
                type: 'recent',
                value: 3
            },
            exclude_conditions: {
                sum: { min: 50, max: 150 },
                span: { min: 10, max: 30 }
            },
            output_config: {
                combination_mode: 'default',
                enable_validation: true
            }
        };

        console.log('请求体:', JSON.stringify(requestBody, null, 2));

        const response = await fetch('http://localhost:3003/api/dlt/prediction-tasks/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();

        console.log('\n📥 服务器响应:');
        console.log(JSON.stringify(result, null, 2));

        if (result.success) {
            console.log('\n✅ 任务创建成功！');
            console.log(`任务ID: ${result.data.task_id}`);

            // 等待2秒后查询任务状态
            console.log('\n等待2秒后查询任务状态...');
            await new Promise(resolve => setTimeout(resolve, 2000));

            const taskListResponse = await fetch('http://localhost:3003/api/dlt/prediction-tasks/list?page=1&limit=5&status=all');
            const taskList = await taskListResponse.json();

            console.log('\n📊 任务列表:');
            console.log(JSON.stringify(taskList, null, 2));
        } else {
            console.log('\n❌ 任务创建失败！');
            console.log(`错误信息: ${result.message}`);
        }

    } catch (error) {
        console.error('\n❌ 请求失败:', error.message);
        console.error(error.stack);
    }
}

testCreateTask();
