const mongoose = require('mongoose');

// MongoDB连接
const MONGO_URI = 'mongodb://127.0.0.1:27017/lottery';

// Schema定义
const DLTExclusionDetailsSchema = new mongoose.Schema({
    task_id: String,
    period: String,
    condition: String,
    excluded_combination_ids: [Number]
}, { collection: 'DLTExclusionDetails' });

const PredictionTaskSchema = new mongoose.Schema({
    task_id: String,
    exclusion_conditions: Object,
    created_at: Date
}, { collection: 'PredictionTask' });

const PredictionTaskResultSchema = new mongoose.Schema({
    task_id: String,
    period: String,
    exclusion_chain: Array
}, { collection: 'PredictionTaskResult' });

const DLTExclusionDetails = mongoose.model('DLTExclusionDetails', DLTExclusionDetailsSchema);
const PredictionTask = mongoose.model('PredictionTask', PredictionTaskSchema);
const PredictionTaskResult = mongoose.model('PredictionTaskResult', PredictionTaskResultSchema);

async function checkExclusionData() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ MongoDB连接成功');

        // 查找所有任务，按时间倒序
        const tasks = await PredictionTask.find().sort({ created_at: -1 }).limit(5).lean();

        if (tasks.length === 0) {
            console.log('❌ 未找到任务');
            process.exit(0);
        }

        for (const task of tasks) {
            console.log('\n' + '='.repeat(80));
            console.log(`📋 任务ID: ${task.task_id}`);
            console.log(`📅 创建时间: ${task.created_at}`);
            console.log('\n📊 排除条件配置:');
            console.log(JSON.stringify(task.exclusion_conditions, null, 2));

            // 查询该任务的所有任务结果
            const results = await PredictionTaskResult.find({
                task_id: task.task_id
            }).lean();

            console.log(`\n📊 该任务有 ${results.length} 个期号结果`);

            // 随机选择一个期号进行详细检查
            if (results.length > 0) {
                const sampleResult = results[0];
                console.log(`\n🔍 检查期号: ${sampleResult.period}`);
                console.log(`\n排除链 (exclusion_chain):`);
                console.log(JSON.stringify(sampleResult.exclusion_chain, null, 2));

                // 查询该期号的排除详情记录
                const exclusionDetails = await DLTExclusionDetails.find({
                    task_id: task.task_id,
                    period: sampleResult.period
                }).lean();

                console.log(`\n📊 DLTExclusionDetails记录数: ${exclusionDetails.length}`);

                if (exclusionDetails.length === 0) {
                    console.log('❌ 没有找到任何排除详情记录！这就是为什么只有保留的组合表。');
                } else {
                    console.log('\n排除详情记录:');
                    for (const detail of exclusionDetails) {
                        console.log(`  - 条件: ${detail.condition}, 排除数量: ${detail.excluded_combination_ids.length}`);
                    }
                }

                // 统计按条件分组的排除数量
                const excludedByCondition = {};
                for (const detail of exclusionDetails) {
                    const condition = detail.condition;
                    if (!excludedByCondition[condition]) {
                        excludedByCondition[condition] = [];
                    }
                    excludedByCondition[condition].push(...detail.excluded_combination_ids);
                }

                // 去重
                for (const condition in excludedByCondition) {
                    excludedByCondition[condition] = [...new Set(excludedByCondition[condition])];
                }

                console.log('\n📊 按条件统计（去重后）:');
                for (const [condition, ids] of Object.entries(excludedByCondition)) {
                    console.log(`  - ${condition}: ${ids.length}个`);
                }
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

checkExclusionData();
