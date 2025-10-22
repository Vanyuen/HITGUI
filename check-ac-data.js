// 检查数据库中的AC值数据
require('dotenv').config();
const mongoose = require('mongoose');

const dltRedCombinationSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    numbers: [Number],
    sum: Number,
    zoneRatio: String,
    evenOddRatio: String,
    largeSmallRatio: String,
    consecutiveCount: Number,
    spanValue: Number,
    acValue: Number,
    sumRange: String,
    createdAt: { type: Date, default: Date.now }
});

const DLTRedCombination = mongoose.model('DLTRedCombination', dltRedCombinationSchema, 'hit_dlt_redcombinations');

async function checkACData() {
    try {
        console.log('🔍 检查数据库中的AC值数据\n');

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ 数据库连接成功\n');

        // 1. 检查总数
        const totalCount = await DLTRedCombination.countDocuments({});
        console.log(`📊 总组合数: ${totalCount.toLocaleString()}`);

        if (totalCount === 0) {
            console.log('❌ 数据库为空！请先生成组合数据。');
            return;
        }

        // 2. 检查AC值字段是否存在
        const withACValue = await DLTRedCombination.countDocuments({ acValue: { $exists: true } });
        const withoutACValue = await DLTRedCombination.countDocuments({ acValue: { $exists: false } });

        console.log(`\n📊 AC值字段统计:`);
        console.log(`  有AC值的组合: ${withACValue.toLocaleString()}`);
        console.log(`  缺少AC值的组合: ${withoutACValue.toLocaleString()}`);

        if (withoutACValue > 0) {
            console.log(`\n⚠️  警告：${withoutACValue.toLocaleString()} 个组合缺少AC值字段！`);
        }

        // 3. 查看AC值的分布
        if (withACValue > 0) {
            console.log(`\n📊 AC值分布:`);
            const distribution = await DLTRedCombination.aggregate([
                { $match: { acValue: { $exists: true } } },
                { $group: { _id: '$acValue', count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]);

            distribution.forEach(item => {
                const percentage = ((item.count / withACValue) * 100).toFixed(2);
                console.log(`  AC=${item._id}: ${item.count.toLocaleString()} (${percentage}%)`);
            });
        }

        // 4. 查看几个示例组合
        console.log(`\n📋 示例组合（前10个）:`);
        const samples = await DLTRedCombination.find({}).limit(10).lean();

        samples.forEach((combo, index) => {
            console.log(`  [${index + 1}] ID=${combo.id}, 号码=[${combo.numbers.join(', ')}], AC=${combo.acValue ?? 'null'}`);
        });

        // 5. 专门检查AC值为5-6和1-3的组合
        console.log(`\n📊 目标AC值范围的组合数:`);
        for (let ac of [1, 2, 3, 5, 6]) {
            const count = await DLTRedCombination.countDocuments({ acValue: ac });
            console.log(`  AC=${ac}: ${count.toLocaleString()} 个组合`);
        }

    } catch (error) {
        console.error('❌ 检查失败:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n数据库连接已关闭');
    }
}

checkACData();
