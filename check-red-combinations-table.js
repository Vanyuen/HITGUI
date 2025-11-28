/**
 * 检查红球组合表是否存在
 */

const mongoose = require('mongoose');

async function checkRedCombinations() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到 MongoDB\n');

        const db = mongoose.connection.db;

        // 检查红球组合表
        const redComboCollection = db.collection('hit_dlt_redcombinations');
        const count = await redComboCollection.countDocuments();

        console.log(`📊 红球组合表记录数: ${count}`);
        console.log(`   期望记录数: 324632 (C(35,5))\n`);

        if (count === 0) {
            console.log('❌ 红球组合表为空！这就是问题所在！');
            console.log('   步骤4需要红球组合数据才能生成热温冷比优化表\n');
        } else if (count === 324632) {
            console.log('✅ 红球组合表完整\n');

            // 检查样本数据
            const sample = await redComboCollection.findOne({});
            console.log('📋 样本记录:');
            console.log(`   combination_id: ${sample.combination_id}`);
            console.log(`   红球: [${sample.red_ball_1}, ${sample.red_ball_2}, ${sample.red_ball_3}, ${sample.red_ball_4}, ${sample.red_ball_5}]`);
        } else {
            console.log(`⚠️  红球组合表不完整（缺少 ${324632 - count} 条记录）\n`);
        }

        await mongoose.connection.close();
        console.log('✅ 数据库连接已关闭');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

checkRedCombinations();
