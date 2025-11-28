/**
 * 诊断排除详情 metadata 为空的问题
 */

const mongoose = require('mongoose');

async function diagnoseMetadata() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('\n=== 诊断排除详情 Metadata 问题 ===\n');

        const db = mongoose.connection.db;

        // 1. 检查最新任务的排除详情
        console.log('1. 检查最新任务 (hwc-pos-20251114-b53) 的排除详情:');
        const taskExclusions = await db.collection('hit_dlt_exclusiondetails').find({
            task_id: 'hwc-pos-20251114-b53'
        }).sort({ step: 1 }).limit(10).toArray();

        console.log(`   找到 ${taskExclusions.length} 条排除详情记录\n`);

        for (const record of taskExclusions) {
            console.log(`   Period ${record.period}, Step ${record.step}: ${record.condition}`);
            console.log(`   - 排除数量: ${record.excluded_count}`);
            console.log(`   - metadata 存在: ${!!record.metadata}`);

            if (record.metadata) {
                if (record.metadata.conflict_pairs) {
                    const cp = record.metadata.conflict_pairs;
                    console.log(`   - 相克对数据:`);
                    console.log(`     * pairs数组长度: ${cp.pairs ? cp.pairs.length : 0}`);
                    console.log(`     * total_pairs_count: ${cp.total_pairs_count || 0}`);
                    console.log(`     * analysis_periods: ${cp.analysis_periods || 'N/A'}`);
                }

                if (record.metadata.cooccurrence) {
                    const co = record.metadata.cooccurrence;
                    console.log(`   - 同现比数据:`);
                    console.log(`     * analyzed_balls: ${co.analyzed_balls ? co.analyzed_balls.length : 0}`);
                    console.log(`     * analyzed_issues: ${co.analyzed_issues ? co.analyzed_issues.length : 0}`);
                }
            }
            console.log('');
        }

        // 2. 检查 Step 9 (相克对排除) 的记录
        console.log('\n2. 专门检查 Step 9 (相克对排除) 的记录:');
        const step9Records = await db.collection('hit_dlt_exclusiondetails').find({
            task_id: 'hwc-pos-20251114-b53',
            step: 9
        }).toArray();

        console.log(`   找到 ${step9Records.length} 条 Step 9 记录\n`);

        if (step9Records.length === 0) {
            console.log('   ❌ 没有 Step 9 记录！这说明相克对排除没有保存任何数据。');
            console.log('   原因：可能是 excludedIds.length === 0，导致整个保存逻辑被跳过。');
        } else {
            for (const record of step9Records) {
                console.log(`   Period ${record.period}:`);
                console.log(`   - 排除了 ${record.excluded_count} 个组合`);
                console.log(`   - metadata: ${JSON.stringify(record.metadata, null, 4)}`);
            }
        }

        // 3. 检查 Step 10 (同现比排除) 的记录
        console.log('\n3. 检查 Step 10 (同现比排除) 的记录:');
        const step10Records = await db.collection('hit_dlt_exclusiondetails').find({
            task_id: 'hwc-pos-20251114-b53',
            step: 10
        }).toArray();

        console.log(`   找到 ${step10Records.length} 条 Step 10 记录\n`);

        if (step10Records.length === 0) {
            console.log('   ❌ 没有 Step 10 记录！这说明同现比排除没有保存任何数据。');
            console.log('   原因：同现比排除当前是框架实现，未实际执行排除逻辑。');
        }

        // 4. 检查所有步骤的分布
        console.log('\n4. 所有步骤的分布统计:');
        const stepDistribution = await db.collection('hit_dlt_exclusiondetails').aggregate([
            { $match: { task_id: 'hwc-pos-20251114-b53' } },
            { $group: { _id: '$step', count: { $sum: 1 }, total_excluded: { $sum: '$excluded_count' } } },
            { $sort: { _id: 1 } }
        ]).toArray();

        for (const stat of stepDistribution) {
            console.log(`   Step ${stat._id}: ${stat.count} 条记录, 共排除 ${stat.total_excluded} 个组合`);
        }

        console.log('\n=== 诊断完成 ===\n');
        mongoose.connection.close();

    } catch (error) {
        console.error('错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

diagnoseMetadata();
