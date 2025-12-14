/**
 * 深度诊断正选红球功能 - 检查任务配置和执行结果
 */
const mongoose = require('mongoose');

async function diagnose() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 数据库连接成功\n');

        const taskCollection = mongoose.connection.collection('hit_dlt_hwcpositivepredictiontasks');
        const resultCollection = mongoose.connection.collection('hit_dlt_hwcpositivepredictiontaskresults');

        // 查询最新的任务
        const latestTask = await taskCollection.findOne({}, { sort: { created_at: -1 } });

        if (!latestTask) {
            console.log('❌ 没有找到任务');
            await mongoose.disconnect();
            return;
        }

        console.log('📋 最新任务详情:');
        console.log('任务ID:', latestTask.task_id);
        console.log('创建时间:', latestTask.created_at);
        console.log('状态:', latestTask.status);
        console.log('期号范围:', latestTask.period_range);

        // 检查red_balls配置
        const ps = latestTask.positive_selection || {};
        console.log('\n🎱 正选红球配置 (red_balls):');
        if (ps.red_balls) {
            console.log('  ball_1:', JSON.stringify(ps.red_balls.ball_1));
            console.log('  ball_2:', JSON.stringify(ps.red_balls.ball_2));
            console.log('  ball_3:', JSON.stringify(ps.red_balls.ball_3));
            console.log('  ball_4:', JSON.stringify(ps.red_balls.ball_4));
            console.log('  ball_5:', JSON.stringify(ps.red_balls.ball_5));
        } else {
            console.log('  ❌ red_balls 字段不存在');
        }

        // 查询该任务的结果
        const results = await resultCollection.find({ task_id: latestTask.task_id })
            .sort({ period: -1 })
            .limit(5)
            .toArray();

        console.log('\n📊 最近5期结果:');
        for (const r of results) {
            console.log(`\n期号 ${r.period}:`);
            console.log(`  组合数: ${r.combination_count}`);
            console.log(`  是否推算期: ${r.is_predicted}`);

            // 检查positive_selection_details
            const psd = r.positive_selection_details || {};
            console.log(`  step1_count: ${psd.step1_count}`);
            console.log(`  step6_retained_count: ${psd.step6_retained_count}`);
            console.log(`  step7_retained_count: ${psd.step7_retained_count}`);
            console.log(`  final_retained_count: ${psd.final_retained_count}`);
        }

        // 检查推算期（is_predicted=true）
        const predictedResults = await resultCollection.find({
            task_id: latestTask.task_id,
            is_predicted: true
        }).toArray();

        console.log(`\n🔮 推算期数量: ${predictedResults.length}`);
        if (predictedResults.length > 0) {
            console.log('推算期列表:', predictedResults.map(r => r.period).join(', '));
        }

        // 检查combination_count=0的期号
        const zeroResults = await resultCollection.find({
            task_id: latestTask.task_id,
            combination_count: 0
        }).toArray();

        console.log(`\n⚠️ 组合数为0的期号数量: ${zeroResults.length}`);
        if (zeroResults.length > 0 && zeroResults.length <= 10) {
            console.log('期号列表:', zeroResults.map(r => r.period).join(', '));
        }

        await mongoose.disconnect();
    } catch (err) {
        console.error('❌ 错误:', err.message);
        process.exit(1);
    }
}

diagnose();
