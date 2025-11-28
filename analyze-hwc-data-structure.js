/**
 * 分析热温冷比数据结构和使用方式
 */

const mongoose = require('mongoose');

async function analyzeHWCDataStructure() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到MongoDB\n');

        const db = mongoose.connection.db;

        // ========== 1. 查看数据结构 ==========
        console.log('========== 1. 数据结构分析 ==========\n');

        const samples = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
            .find({})
            .limit(3)
            .toArray();

        console.log(`样本数据 (前3条):\n`);
        samples.forEach((doc, i) => {
            console.log(`样本${i + 1}:`);
            console.log(JSON.stringify(doc, null, 2));
            console.log('');
        });

        // ========== 2. 统计期号分布 ==========
        console.log('========== 2. 期号分布统计 ==========\n');

        const issueDist = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
            .aggregate([
                {
                    $group: {
                        _id: '$Issue',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: -1 } },
                { $limit: 20 }
            ]).toArray();

        console.log('最近20期的数据量:');
        issueDist.forEach(d => {
            console.log(`  期号 ${d._id}: ${d.count} 条`);
        });

        const totalIssues = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
            .distinct('Issue');
        console.log(`\n总共覆盖期号数: ${totalIssues.length} 期`);

        // ========== 3. 分析字段结构 ==========
        console.log('\n========== 3. 字段结构分析 ==========\n');

        if (samples.length > 0) {
            const firstDoc = samples[0];
            console.log('字段列表:');
            Object.keys(firstDoc).forEach(key => {
                const value = firstDoc[key];
                const type = Array.isArray(value) ? 'Array' : typeof value;
                console.log(`  - ${key}: ${type}`);
            });
        }

        // ========== 4. 检查是否有base_issue和target_issue字段 ==========
        console.log('\n========== 4. 检查期号对字段 ==========\n');

        const hasPairFields = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
            .findOne({ base_issue: { $exists: true } });

        if (hasPairFields) {
            console.log('✅ 存在base_issue和target_issue字段（期号对模式）');

            const pairDist = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
                .aggregate([
                    {
                        $group: {
                            _id: { base: '$base_issue', target: '$target_issue' },
                            count: { $sum: 1 }
                        }
                    },
                    { $limit: 10 }
                ]).toArray();

            console.log('\n期号对示例:');
            pairDist.forEach(p => {
                console.log(`  ${p._id.base} → ${p._id.target}: ${p.count} 条`);
            });
        } else {
            console.log('⚠️  不存在base_issue和target_issue字段（单期模式）');
            console.log('   数据结构: 每条记录对应一期的统计信息');
        }

        // ========== 5. 分析数据用途 ==========
        console.log('\n========== 5. 数据用途分析 ==========\n');

        console.log('根据数据结构判断:');
        if (samples.length > 0) {
            const doc = samples[0];

            if (doc.base_issue && doc.target_issue) {
                console.log('  用途: 存储期号对(base→target)的热温冷比统计');
                console.log('  查询方式: 指定base_issue和target_issue查询');
            } else if (doc.Issue) {
                console.log('  用途: 存储每期的热温冷比统计信息');
                console.log('  查询方式: 指定Issue查询该期的统计');

                // 检查是否存储了组合级别的数据
                if (doc.combination_id || doc.red_balls) {
                    console.log('  数据级别: 组合级别（每条记录=一个组合在某期的热温冷比）');
                } else {
                    console.log('  数据级别: 统计级别（每条记录=某期的汇总统计）');
                }
            }
        }

        await mongoose.disconnect();
        console.log('\n🔌 已断开MongoDB连接');

    } catch (error) {
        console.error('❌ 分析失败:', error);
        await mongoose.disconnect();
    }
}

analyzeHWCDataStructure();
