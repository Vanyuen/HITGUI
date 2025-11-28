/**
 * 检查最新期号范围的记录
 */

const mongoose = require('mongoose');

async function checkLatestIssues() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 已连接到 MongoDB');

        const db = mongoose.connection.db;
        const coll = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

        // 获取数据库最新期号
        const hitDlts = db.collection('hit_dlts');
        const latestRecord = await hitDlts.findOne({}, { sort: { ID: -1 } });
        const latestIssue = latestRecord.Issue;

        console.log(`\n数据库最新期号: ${latestIssue}`);
        console.log(`推算期: ${latestIssue + 1}`);

        // 查找最新几期的热温冷数据
        console.log('\n========================================');
        console.log('🔍 检查最新10期的热温冷优化表记录');
        console.log('========================================');

        for (let i = 9; i >= 0; i--) {
            const targetIssue = (latestIssue - i).toString();
            const baseIssue = (latestIssue - i - 1).toString();

            const record = await coll.findOne({
                base_issue: baseIssue,
                target_issue: targetIssue
            });

            if (record) {
                const hasNewFields = record.base_id !== undefined &&
                                    record.target_id !== undefined &&
                                    record.is_predicted !== undefined;

                const status = hasNewFields ? '✅' : '❌';
                console.log(`\n${status} ${baseIssue} → ${targetIssue}`);
                console.log(`  base_id: ${record.base_id}`);
                console.log(`  target_id: ${record.target_id}`);
                console.log(`  is_predicted: ${record.is_predicted}`);
                console.log(`  has hot_warm_cold_data: ${!!record.hot_warm_cold_data}`);
                console.log(`  has hit_analysis: ${!!record.hit_analysis}`);
                console.log(`  ObjectId时间: ${record._id.getTimestamp().toLocaleString('zh-CN')}`);
            } else {
                console.log(`\n❌ ${baseIssue} → ${targetIssue}: 不存在`);
            }
        }

        // 检查推算期
        console.log('\n========================================');
        console.log('🔮 检查推算期数据');
        console.log('========================================');

        const predictedIssue = (latestIssue + 1).toString();
        const predictedRecord = await coll.findOne({
            base_issue: latestIssue.toString(),
            target_issue: predictedIssue
        });

        if (predictedRecord) {
            console.log(`✅ 推算期数据存在: ${latestIssue} → ${predictedIssue}`);
            console.log(`  base_id: ${predictedRecord.base_id}`);
            console.log(`  target_id: ${predictedRecord.target_id}`);
            console.log(`  is_predicted: ${predictedRecord.is_predicted}`);
        } else {
            console.log(`❌ 推算期数据不存在: ${latestIssue} → ${predictedIssue}`);
        }

        // 统计各字段的覆盖率（按期号范围）
        console.log('\n========================================');
        console.log('📊 字段覆盖率统计（按期号范围）');
        console.log('========================================');

        const ranges = [
            { name: '早期 (7001-10000)', min: 7001, max: 10000 },
            { name: '中期 (10001-20000)', min: 10001, max: 20000 },
            { name: '后期 (20001-25000)', min: 20001, max: 25000 },
            { name: '最新 (25001-25124)', min: 25001, max: 25124 }
        ];

        for (const range of ranges) {
            const samples = await coll.find({
                target_issue: {
                    $gte: range.min.toString(),
                    $lte: range.max.toString()
                }
            }).limit(20).toArray();

            if (samples.length > 0) {
                const hasBaseId = samples.filter(s => s.base_id !== undefined).length;
                const hasTargetId = samples.filter(s => s.target_id !== undefined).length;
                const hasIsPredicted = samples.filter(s => s.is_predicted !== undefined).length;

                console.log(`\n${range.name}: ${samples.length}条样本`);
                console.log(`  base_id: ${hasBaseId}/${samples.length} (${(hasBaseId/samples.length*100).toFixed(1)}%)`);
                console.log(`  target_id: ${hasTargetId}/${samples.length} (${(hasTargetId/samples.length*100).toFixed(1)}%)`);
                console.log(`  is_predicted: ${hasIsPredicted}/${samples.length} (${(hasIsPredicted/samples.length*100).toFixed(1)}%)`);
            } else {
                console.log(`\n${range.name}: 无数据`);
            }
        }

    } catch (error) {
        console.error('❌ 错误:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n已断开数据库连接');
    }
}

checkLatestIssues();
