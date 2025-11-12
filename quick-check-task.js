/**
 * 快速检查最新任务的正选详情
 */
const mongoose = require('mongoose');

const DB_URL = 'mongodb://127.0.0.1:27017/lottery';

async function quickCheck() {
    try {
        await mongoose.connect(DB_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // 直接使用collection名称
        const db = mongoose.connection.db;

        // 查找最新任务
        const tasks = await db.collection('hwcpositivepredictiontasks')
            .find({})
            .sort({ created_at: -1 })
            .limit(1)
            .toArray();

        if (tasks.length === 0) {
            console.log('❌ 未找到任务');
            return;
        }

        const task = tasks[0];
        console.log(`\n✅ 找到任务: ${task.task_id}`);
        console.log(`   状态: ${task.status}`);

        // 查找结果
        const results = await db.collection('hwcpositivepredictiontaskresults')
            .find({ task_id: task.task_id })
            .toArray();

        console.log(`\n✅ 找到 ${results.length} 个结果记录`);

        results.forEach(result => {
            console.log(`\n📊 期号: ${result.period}`);
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
        });

        // 查找排除详情
        const exclusions = await db.collection('hit_dlt_exclusiondetails')
            .find({ task_id: task.task_id })
            .toArray();

        console.log(`\n📊 排除详情记录数: ${exclusions.length}`);

        if (exclusions.length > 0) {
            exclusions.forEach(exc => {
                console.log(`   Step ${exc.step}: ${exc.condition}, 排除 ${exc.excluded_count} 个组合`);
            });
        }

    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 数据库连接已关闭\n');
    }
}

quickCheck();
