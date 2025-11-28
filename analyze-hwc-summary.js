/**
 * 分析热温冷比数据结构 - 简化版
 */

const mongoose = require('mongoose');

async function analyze() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        const db = mongoose.connection.db;

        console.log('=== 热温冷比数据结构分析 ===\n');

        // 1. 查看第一条记录的结构
        const firstDoc = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').findOne({});

        console.log('1. 数据结构:');
        console.log('   - base_issue:', firstDoc.base_issue);
        console.log('   - target_issue:', firstDoc.target_issue);
        console.log('   - hot_warm_cold_data 的键:', Object.keys(firstDoc.hot_warm_cold_data));
        console.log('   - 示例热温冷比 "5:0:0" 的组合数:', firstDoc.hot_warm_cold_data['5:0:0']?.length || 0);
       console.log('\n   数据含义: 每条记录存储一个期号对(base→target)的所有组合按热温冷比分组后的ID列表\n');

        // 2. 统计期号对覆盖率
        const pairStats = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
            .aggregate([
                {
                    $group: {
                        _id: null,
                        pairs: { $addToSet: { base: '$base_issue', target: '$target_issue' } },
                        count: { $sum: 1 }
                    }
                }
            ]).toArray();

        console.log('2. 期号对统计:');
        console.log(`   - 总记录数: ${pairStats[0].count} 条`);
        console.log(`   - 覆盖期号对数: ${pairStats[0].pairs.length} 对`);

        // 3. 查看最新的10个期号对
        const recentPairs = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
            .find({})
            .sort({ target_issue: -1 })
            .limit(10)
            .toArray();

        console.log('\n3. 最近10个期号对:');
        recentPairs.forEach((doc, i) => {
            const ratios = Object.keys(doc.hot_warm_cold_data).length;
            console.log(`   ${i + 1}. ${doc.base_issue} → ${doc.target_issue} (${ratios}种热温冷比)`);
        });

        //4. 检查是否有25120-25130范围的数据
        console.log('\n4. 检查最新期号范围(25120-25130):');
        const recentData = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
            .find({
                target_issue: { $gte: '25120', $lte: '25130' }
            })
            .toArray();

        if (recentData.length > 0) {
            console.log(`   ✅ 找到 ${recentData.length} 条最新期号数据`);
            recentData.forEach(d => console.log(`      ${d.base_issue} → ${d.target_issue}`));
        } else {
            console.log('   ❌ 未找到25120-25130范围的数据');
        }

        await mongoose.disconnect();

    } catch (error) {
        console.error('错误:', error);
        await mongoose.disconnect();
    }
}

analyze();
