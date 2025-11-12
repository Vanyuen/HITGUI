/**
 * 测试单期导出API
 */

const mongoose = require('mongoose');

async function testSinglePeriodExport() {
    try {
        // 连接数据库
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到MongoDB');

        // 查找一个已完成的任务
        const taskCollection = mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks');
        const task = await taskCollection.findOne({ status: 'completed' });

        if (!task) {
            console.log('❌ 没有找到已完成的任务');
            process.exit(1);
        }

        console.log(`\n📋 找到任务: ${task.task_name} (${task.task_id})`);
        console.log(`   状态: ${task.status}`);
        console.log(`   期号范围: ${task.period_range?.start} - ${task.period_range?.end}`);

        // 查找该任务的一个期号结果
        const resultCollection = mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults');
        const result = await resultCollection.findOne({
            task_id: task.task_id,
            is_predicted: false  // 只查找已开奖的期号
        });

        if (!result) {
            console.log('❌ 没有找到该任务的期号结果');
            process.exit(1);
        }

        console.log(`\n📊 找到期号结果: ${result.period}`);
        console.log(`   是否已开奖: ${!result.is_predicted}`);
        console.log(`   配对组合数: ${result.paired_combinations?.length || 0}`);
        console.log(`   组合总数: ${result.combination_count}`);

        // 检查 paired_combinations 数据
        if (result.paired_combinations && result.paired_combinations.length > 0) {
            const sample = result.paired_combinations[0];
            console.log(`\n✅ paired_combinations 数据结构正常`);
            console.log(`   红球: ${sample.red_balls}`);
            console.log(`   蓝球: ${sample.blue_balls}`);
            console.log(`   和值: ${sample.sum_value}`);
            console.log(`   跨度: ${sample.span_value}`);
            console.log(`   区间比: ${sample.zone_ratio}`);
        } else {
            console.log(`\n❌ 没有 paired_combinations 数据！`);
            console.log(`   结果对象键: ${Object.keys(result)}`);
        }

        // 测试API URL
        const apiUrl = `http://localhost:3003/api/dlt/hwc-positive-tasks/${task.task_id}/period/${result.period}/export`;
        console.log(`\n🔗 导出API URL: ${apiUrl}`);
        console.log(`\n💡 您可以在浏览器中访问此URL测试导出功能`);

        await mongoose.connection.close();
        console.log('\n✅ 测试完成');

    } catch (error) {
        console.error('❌ 测试失败:', error);
        process.exit(1);
    }
}

testSinglePeriodExport();
