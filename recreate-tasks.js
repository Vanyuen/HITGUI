/**
 * 重新创建两个HWC正选批量预测任务
 * 使用与原始任务相同的配置，但生成新的task_id
 */
const mongoose = require('mongoose');

async function recreateTasks() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    // 定义schema
    const taskSchema = new mongoose.Schema({}, { strict: false });
    const Task = mongoose.model('HwcTask', taskSchema, 'hit_dlt_hwcpositivepredictiontasks');

    console.log('=== 获取原始任务配置 ===\n');

    // 获取原始任务1的配置
    const task1 = await Task.findOne({ task_id: 'hwc-pos-20251213-ykt' }).lean();
    console.log('任务1 (hwc-pos-20251213-ykt):');
    console.log(`  名称: ${task1?.task_name}`);
    console.log(`  期号范围: ${task1?.period_range_type}, value: ${JSON.stringify(task1?.period_range_value)}`);
    console.log(`  正选条件: ${JSON.stringify(task1?.positive_selection)}`);
    console.log(`  排除条件: ${JSON.stringify(task1?.exclusion_conditions)}`);
    console.log(`  输出配置: ${JSON.stringify(task1?.output_config)}`);

    // 获取原始任务2的配置
    const task2 = await Task.findOne({ task_id: 'hwc-pos-20251213-7pg' }).lean();
    console.log('\n任务2 (hwc-pos-20251213-7pg):');
    console.log(`  名称: ${task2?.task_name}`);
    console.log(`  期号范围: ${task2?.period_range_type}, value: ${JSON.stringify(task2?.period_range_value)}`);
    console.log(`  正选条件: ${JSON.stringify(task2?.positive_selection)}`);
    console.log(`  排除条件: ${JSON.stringify(task2?.exclusion_conditions)}`);
    console.log(`  输出配置: ${JSON.stringify(task2?.output_config)}`);

    await mongoose.disconnect();
}

recreateTasks().catch(e => { console.error(e); process.exit(1); });
