/**
 * 检查最近创建的热温冷正选任务结果
 */

const mongoose = require('mongoose');

const DB_URL = 'mongodb://127.0.0.1:27017/lottery';

async function checkRecentTask() {
    try {
        console.log('\n📡 连接数据库...');
        await mongoose.connect(DB_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // 获取最近创建的任务
        const HwcPositivePredictionTask = mongoose.model('HwcPositivePredictionTask',
            new mongoose.Schema({}, { strict: false }));

        const task = await HwcPositivePredictionTask.findOne({})
            .sort({ created_at: -1 })
            .lean();

        if (!task) {
            console.log('❌ 未找到任务');
            return;
        }

        console.log(`✅ 找到任务: ${task.task_id}`);
        console.log(`   任务名称: ${task.task_name}`);
        console.log(`   状态: ${task.status}\n`);

        // 获取任务的结果
        const HwcPositivePredictionTaskResult = mongoose.model('HwcPositivePredictionTaskResult',
            new mongoose.Schema({}, { strict: false }));

        const results = await HwcPositivePredictionTaskResult.find({
            task_id: task.task_id
        }).lean();

        console.log(`✅ 找到 ${results.length} 个结果记录\n`);

        results.forEach(result => {
            console.log(`📊 期号: ${result.period}`);
            console.log(`   组合数: ${result.combination_count}`);

            if (result.positive_selection_details) {
                const details = result.positive_selection_details;
                console.log(`   ✅ positive_selection_details 存在`);
                console.log(`      Step 1 基准数: ${details.step1_count}`);
                console.log(`      Step 1 基准ID数: ${details.step1_base_combination_ids?.length || 0}`);
                console.log(`      Step 2 保留数: ${details.step2_retained_count}`);
                console.log(`      Step 3 保留数: ${details.step3_retained_count}`);
                console.log(`      Step 4 保留数: ${details.step4_retained_count}`);
                console.log(`      Step 5 保留数: ${details.step5_retained_count}`);
                console.log(`      Step 6 保留数: ${details.step6_retained_count}`);
                console.log(`      最终保留数: ${details.final_retained_count}`);
            } else {
                console.log(`   ❌ positive_selection_details 不存在`);
            }
            console.log('');
        });

        // 获取排除详情
        const DLTExclusionDetails = mongoose.model('DLTExclusionDetails',
            new mongoose.Schema({}, { strict: false }));

        const exclusions = await DLTExclusionDetails.find({
            task_id: task.task_id
        }).lean();

        console.log(`📊 排除详情记录数: ${exclusions.length}\n`);

        if (exclusions.length > 0) {
            exclusions.forEach(exc => {
                console.log(`   Step ${exc.step}: ${exc.condition}`);
                console.log(`      排除数量: ${exc.excluded_count}`);
                console.log(`      期号: ${exc.period}`);
            });
        }

    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 数据库连接已关闭\n');
    }
}

checkRecentTask();
