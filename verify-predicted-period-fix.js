/**
 * 验证推算期误判修复效果
 * 修复内容：
 * - 方案A: 使用全局缓存 globalCacheManager.issueToIDMap 判断期号是否开奖
 * - 方案C: 增强 preloadData 错误处理和日志
 */

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function verify() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 已连接到MongoDB\n');

        // 定义Schema
        const hit_dlts = mongoose.model('hit_dlts', new mongoose.Schema({}, { strict: false }));

        // 尝试多个可能的collection名称
        let HwcPositivePredictionTaskResult;

        const possibleResultCollections = [
            'hit_dlt_hwcpositivepredictiontaskresults',
            'hwcpositivepredictiontaskresults',
            'HwcPositivePredictionTaskResult'
        ];

        for (const collName of possibleResultCollections) {
            try {
                const TempModel = mongoose.model(collName + '_temp_verify', new mongoose.Schema({}, { strict: false }), collName);
                const count = await TempModel.countDocuments();
                if (count > 0) {
                    HwcPositivePredictionTaskResult = TempModel;
                    console.log(`✅ 找到结果 collection: ${collName}`);
                    break;
                }
            } catch (e) {
                // 继续尝试下一个
            }
        }

        if (!HwcPositivePredictionTaskResult) {
            console.log('❌ 没有找到结果collection');
            return;
        }

        // 获取最近3个任务
        const recentTasks = await HwcPositivePredictionTaskResult.aggregate([
            {
                $group: {
                    _id: '$task_id',
                    created_at: { $first: '$created_at' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { created_at: -1 } },
            { $limit: 3 }
        ]);

        console.log(`📊 找到 ${recentTasks.length} 个最近的任务\n`);

        for (const taskInfo of recentTasks) {
            const taskId = taskInfo._id;
            console.log(`\n${'='.repeat(80)}`);
            console.log(`📋 任务ID: ${taskId}`);
            console.log(`   创建时间: ${taskInfo.created_at}`);
            console.log(`   结果数量: ${taskInfo.count}期`);
            console.log(`${'='.repeat(80)}\n`);

            // 获取任务的所有结果
            const results = await HwcPositivePredictionTaskResult.find({ task_id: taskId })
                .sort({ period: 1 })
                .lean();

            if (results.length === 0) {
                console.log('  ⚠️ 该任务没有结果数据\n');
                continue;
            }

            // 统计分析
            const totalPeriods = results.length;
            const predictedCount = results.filter(r => r.is_predicted).length;
            const drawnCount = results.filter(r => !r.is_predicted).length;

            console.log('📊 任务结果统计:');
            console.log(`  总期数: ${totalPeriods}`);
            console.log(`  标记为推算期: ${predictedCount}期`);
            console.log(`  标记为已开奖: ${drawnCount}期\n`);

            // 获取期号范围
            const periods = results.map(r => parseInt(r.period));
            const minPeriod = Math.min(...periods);
            const maxPeriod = Math.max(...periods);

            console.log(`  期号范围: ${minPeriod} - ${maxPeriod}`);

            // 查询数据库中实际存在的期号
            const existingIssues = await hit_dlts.find({
                Issue: { $gte: minPeriod, $lte: maxPeriod }
            })
                .select('Issue')
                .lean();

            const existingIssueSet = new Set(existingIssues.map(i => i.Issue.toString()));

            console.log(`  数据库中存在: ${existingIssues.length}期已开奖\n`);

            // 验证准确性
            let correctCount = 0;
            let wrongPredictedCount = 0;
            let wrongDrawnCount = 0;

            const wronglyMarkedAsPredicted = [];
            const wronglyMarkedAsDrawn = [];

            for (const result of results) {
                const period = result.period.toString();
                const isInDB = existingIssueSet.has(period);
                const markedAsPredicted = result.is_predicted;

                if (isInDB && !markedAsPredicted) {
                    // 数据库中存在，标记为已开奖 → 正确
                    correctCount++;
                } else if (!isInDB && markedAsPredicted) {
                    // 数据库中不存在，标记为推算期 → 正确
                    correctCount++;
                } else if (isInDB && markedAsPredicted) {
                    // 数据库中存在，但标记为推算期 → 错误
                    wrongPredictedCount++;
                    wronglyMarkedAsPredicted.push(period);
                } else if (!isInDB && !markedAsPredicted) {
                    // 数据库中不存在，但标记为已开奖 → 错误
                    wrongDrawnCount++;
                    wronglyMarkedAsDrawn.push(period);
                }
            }

            console.log('✅ 验证结果:');
            console.log(`  正确标记: ${correctCount}期 (${((correctCount / totalPeriods) * 100).toFixed(1)}%)`);
            console.log(`  错误标记: ${wrongPredictedCount + wrongDrawnCount}期 (${(((wrongPredictedCount + wrongDrawnCount) / totalPeriods) * 100).toFixed(1)}%)\n`);

            if (wrongPredictedCount > 0) {
                console.log(`  ❌ 误判为推算期: ${wrongPredictedCount}期`);
                console.log(`     示例期号 (前5个): ${wronglyMarkedAsPredicted.slice(0, 5).join(', ')}`);
                console.log('');
            }

            if (wrongDrawnCount > 0) {
                console.log(`  ❌ 误判为已开奖: ${wrongDrawnCount}期`);
                console.log(`     示例期号 (前5个): ${wronglyMarkedAsDrawn.slice(0, 5).join(', ')}`);
                console.log('');
            }

            if (wrongPredictedCount + wrongDrawnCount === 0) {
                console.log('  🎉 所有期号标记完全正确！修复成功！\n');
            } else {
                console.log('  ⚠️ 仍存在误判，可能需要进一步排查\n');
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('📝 总结:');
        console.log('');
        console.log('如果显示"所有期号标记完全正确"，说明修复成功！');
        console.log('如果仍有误判，请检查：');
        console.log('  1. 服务器是否已重启（npm start）');
        console.log('  2. 是否在修复后创建了新任务');
        console.log('  3. 查看服务器日志中的"📌 期号XXX: 推算期/已开奖 (来源: globalCache/localCache/notFound)"');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n已断开MongoDB连接');
    }
}

verify();
