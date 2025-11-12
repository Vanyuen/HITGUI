const { MongoClient } = require('mongodb');

async function checkHwcTask() {
    const client = new MongoClient('mongodb://127.0.0.1:27017');

    try {
        await client.connect();
        const db = client.db('lottery');

        const taskId = 'hwc-pos-20251107-5xb';

        console.log(`\n========== 检查任务: ${taskId} ==========\n`);

        // 1. 查看任务基本信息
        const task = await db.collection('PredictionTask').findOne({ task_id: taskId });
        if (!task) {
            console.log('❌ 任务不存在！');
            return;
        }

        console.log('📋 任务基本信息:');
        console.log('  任务名称:', task.task_name);
        console.log('  状态:', task.status);
        console.log('  预测模式:', task.prediction_mode);
        console.log('  配对模式:', task.pairing_mode);
        console.log('  期号范围:', task.issue_range?.map(i => i.Issue).join(', '));
        console.log('  创建时间:', task.created_at);
        console.log('  完成时间:', task.completed_at);

        if (task.exclusion_conditions) {
            console.log('\n✨ 正选条件:');
            if (task.exclusion_conditions.hwc_positive_conditions) {
                console.log('  热温冷比:', JSON.stringify(task.exclusion_conditions.hwc_positive_conditions.hwc_ratio));
                console.log('  区间比:', JSON.stringify(task.exclusion_conditions.hwc_positive_conditions.zone_ratio));
                console.log('  奇偶比:', JSON.stringify(task.exclusion_conditions.hwc_positive_conditions.odd_even_ratio));
            }

            console.log('\n🚫 排除条件:');
            console.log('  历史和值排除:', task.exclusion_conditions.historical_sum_exclusion);
            console.log('  历史跨度排除:', task.exclusion_conditions.historical_span_exclusion);
        }

        // 2. 查看任务结果汇总
        console.log('\n\n📊 任务结果汇总:');
        const results = await db.collection('PredictionTaskResult')
            .find({ task_id: taskId })
            .sort({ target_issue: 1 })
            .toArray();

        console.log(`  共找到 ${results.length} 个期号的结果记录\n`);

        for (const result of results) {
            console.log(`\n期号 ${result.target_issue}:`);
            console.log('  retained_count:', result.retained_count);
            console.log('  retained_combinations 数量:', result.retained_combinations?.length || 0);
            console.log('  has_hit_analysis:', !!result.hit_analysis);

            if (result.hit_analysis) {
                console.log('  hit_analysis 内容:');
                console.log('    max_red_hit:', result.hit_analysis.max_red_hit);
                console.log('    max_blue_hit:', result.hit_analysis.max_blue_hit);
                console.log('    prize_stats:', JSON.stringify(result.hit_analysis.prize_stats));
                console.log('    total_prize_amount:', result.hit_analysis.total_prize_amount);
            }

            // 检查 retained_combinations 的第一个组合详情
            if (result.retained_combinations && result.retained_combinations.length > 0) {
                const firstCombo = result.retained_combinations[0];
                console.log('  第一个保留组合示例:');
                console.log('    red_combo:', firstCombo.red_combo);
                console.log('    blue_combo:', firstCombo.blue_combo);
                if (firstCombo.hit_result) {
                    console.log('    hit_result:', JSON.stringify(firstCombo.hit_result));
                }
            }

            // 检查排除明细
            if (result.exclusion_details) {
                console.log('  排除明细:');
                for (const [key, value] of Object.entries(result.exclusion_details)) {
                    console.log(`    ${key}: ${value}`);
                }
            }
        }

        // 3. 检查数据库中对应期号的开奖数据
        console.log('\n\n🎱 开奖数据检查:');
        const targetIssues = results.map(r => r.target_issue);
        const drawingResults = await db.collection('HIT_DLT')
            .find({ Issue: { $in: targetIssues } })
            .sort({ Issue: 1 })
            .toArray();

        console.log(`  找到 ${drawingResults.length} 个期号的开奖数据\n`);

        for (const drawing of drawingResults) {
            console.log(`期号 ${drawing.Issue}:`);
            console.log('  红球:', drawing.RedBalls);
            console.log('  蓝球:', drawing.BlueBalls);
        }

    } catch (error) {
        console.error('❌ 错误:', error);
    } finally {
        await client.close();
    }
}

checkHwcTask();
