// 最终验证：使用正确的集合直接测试AC值排除
require('dotenv').config();
const mongoose = require('mongoose');

async function finalTest() {
    try {
        console.log('🎯 AC值排除功能最终验证\n');
        console.log('='.repeat(80));

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ 数据库连接成功\n');

        const db = mongoose.connection.db;
        const collection = db.collection('hit_dlt_redcombinations');

        // 查看AC值分布
        console.log('📊 数据库中的AC值分布:');
        const distribution = await collection.aggregate([
            { $group: { _id: '$ac_value', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]).toArray();

        let totalCombos = 0;
        distribution.forEach(item => {
            totalCombos += item.count;
            console.log(`  AC=${item._id}: ${item.count.toLocaleString()} 个组合`);
        });
        console.log(`  总计: ${totalCombos.toLocaleString()} 个组合\n`);

        // 测试排除条件：排除AC值 5-6 和 1-3
        console.log('🔧 测试排除条件: AC值 5-6 和 1-3');
        console.log('-'.repeat(80));

        const query = {
            $nor: [
                { ac_value: { $gte: 5, $lte: 6 } },
                { ac_value: { $gte: 1, $lte: 3 } }
            ]
        };

        console.log('MongoDB查询:', JSON.stringify(query, null, 2));

        const totalCount = await collection.countDocuments({});
        const filteredCount = await collection.countDocuments(query);
        const excludedCount = totalCount - filteredCount;

        console.log(`\n📊 查询结果:`);
        console.log(`  总组合数: ${totalCount.toLocaleString()}`);
        console.log(`  排除后组合数: ${filteredCount.toLocaleString()}`);
        console.log(`  被排除组合数: ${excludedCount.toLocaleString()}\n`);

        // 验证排除的组合
        console.log('📋 验证被排除的AC值:');
        for (let ac of [1, 2, 3, 5, 6]) {
            const count = await collection.countDocuments({ ...query, ac_value: ac });
            const total = await collection.countDocuments({ ac_value: ac });
            const status = count === 0 ? '✅ 完全排除' : `❌ 仍有 ${count} 个`;
            console.log(`  AC=${ac}: 原有${total.toLocaleString()}个, ${status}`);
        }

        // 查看排除后的AC值分布
        console.log(`\n📊 排除后的AC值分布:`);
        const filteredDist = await collection.aggregate([
            { $match: query },
            { $group: { _id: '$ac_value', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]).toArray();

        filteredDist.forEach(item => {
            console.log(`  AC=${item._id}: ${item.count.toLocaleString()} 个组合`);
        });

        // 抽查几个结果
        console.log(`\n📋 抽查10个排除后的组合:`);
        const samples = await collection.find(query).limit(10).toArray();
        samples.forEach((s, i) => {
            const numbers = [s.red_ball_1, s.red_ball_2, s.red_ball_3, s.red_ball_4, s.red_ball_5];
            console.log(`  [${i + 1}] ID=${s.combination_id}, 号码=[${numbers.join(',')}], AC值=${s.ac_value}`);
        });

        console.log('\n' + '='.repeat(80));
        console.log('✅ 验证完成！');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('❌ 错误:', error);
    } finally {
        await mongoose.disconnect();
    }
}

finalTest();
