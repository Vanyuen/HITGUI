/**
 * 直接测试导出API，获取详细错误信息
 */

const http = require('http');
const fs = require('fs');

// 从数据库获取一个测试任务和期号
const mongoose = require('mongoose');

async function testExportAPI() {
    try {
        // 连接数据库
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到MongoDB\n');

        // 查找一个已完成的任务
        const taskCollection = mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks');
        const task = await taskCollection.findOne({ status: 'completed' });

        if (!task) {
            console.log('❌ 没有找到已完成的任务');
            process.exit(1);
        }

        // 查找该任务的一个期号结果
        const resultCollection = mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults');
        const result = await resultCollection.findOne({
            task_id: task.task_id,
            is_predicted: false
        });

        if (!result) {
            console.log('❌ 没有找到该任务的期号结果');
            process.exit(1);
        }

        console.log(`📋 测试任务: ${task.task_name} (${task.task_id})`);
        console.log(`📊 测试期号: ${result.period}`);
        console.log(`📦 数据格式检查:`);
        console.log(`   - paired_combinations: ${result.paired_combinations ? result.paired_combinations.length : 0} 个`);
        console.log(`   - red_combinations: ${result.red_combinations ? result.red_combinations.length : 0} 个`);
        console.log(`   - blue_combinations: ${result.blue_combinations ? result.blue_combinations.length : 0} 个\n`);

        await mongoose.connection.close();

        // 测试API调用
        const apiPath = `/api/dlt/hwc-positive-tasks/${task.task_id}/period/${result.period}/export`;
        console.log(`🔗 请求URL: http://localhost:3003${apiPath}\n`);
        console.log('⏳ 发送请求...\n');

        const options = {
            hostname: 'localhost',
            port: 3003,
            path: apiPath,
            method: 'GET'
        };

        const req = http.request(options, (res) => {
            console.log(`📡 响应状态码: ${res.statusCode}`);
            console.log(`📋 响应头: ${JSON.stringify(res.headers, null, 2)}\n`);

            if (res.statusCode !== 200) {
                let errorData = '';
                res.on('data', (chunk) => {
                    errorData += chunk;
                });
                res.on('end', () => {
                    console.log('❌ 错误响应体:');
                    console.log(errorData);
                    console.log('\n💡 建议检查服务器端日志以获取详细错误信息');
                    process.exit(1);
                });
            } else {
                let dataLength = 0;
                res.on('data', (chunk) => {
                    dataLength += chunk.length;
                });
                res.on('end', () => {
                    console.log(`✅ 导出成功！文件大小: ${dataLength} 字节`);
                    process.exit(0);
                });
            }
        });

        req.on('error', (error) => {
            console.error('❌ 请求失败:', error.message);
            console.log('\n💡 可能的原因:');
            console.log('   1. 服务器未启动（端口3003）');
            console.log('   2. 防火墙阻止连接');
            console.log('   3. 服务器崩溃\n');
            process.exit(1);
        });

        // 设置超时
        req.setTimeout(30000, () => {
            console.error('❌ 请求超时（30秒）');
            req.destroy();
            process.exit(1);
        });

        req.end();

    } catch (error) {
        console.error('❌ 测试失败:', error);
        process.exit(1);
    }
}

testExportAPI();
