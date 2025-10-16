/**
 * 检查DLTRedCombination表中的组合是否有combo_2, combo_3, combo_4特征字段
 */

const mongoose = require('mongoose');

// MongoDB连接配置
const MONGODB_URI = 'mongodb://localhost:27017/HIT';

const DLTRedCombinationSchema = new mongoose.Schema({}, {
    collection: 'hit_dlt_redball_combinations',
    strict: false
});
const DLTRedCombination = mongoose.model('DLTRedCombination_Check', DLTRedCombinationSchema);

async function checkRedComboFeatures() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ MongoDB连接成功');

        // 检查前10条记录
        const combos = await DLTRedCombination.find({}).limit(10).lean();

        console.log(`\n📊 检查前10条红球组合记录:\n`);

        combos.forEach((combo, index) => {
            console.log(`\n记录 ${index + 1}:`);
            console.log(`  红球: ${combo.red_ball_1}, ${combo.red_ball_2}, ${combo.red_ball_3}, ${combo.red_ball_4}, ${combo.red_ball_5}`);
            console.log(`  combo_2字段存在: ${!!combo.combo_2}, 值: ${combo.combo_2 ? combo.combo_2.length + '个' : '无'}`);
            console.log(`  combo_3字段存在: ${!!combo.combo_3}, 值: ${combo.combo_3 ? combo.combo_3.length + '个' : '无'}`);
            console.log(`  combo_4字段存在: ${!!combo.combo_4}, 值: ${combo.combo_4 ? combo.combo_4.length + '个' : '无'}`);
            console.log(`  所有字段: ${Object.keys(combo).join(', ')}`);
        });

        // 统计有/无特征字段的记录数
        const totalCount = await DLTRedCombination.countDocuments({});
        const withCombo2 = await DLTRedCombination.countDocuments({ combo_2: { $exists: true, $ne: null } });
        const withCombo3 = await DLTRedCombination.countDocuments({ combo_3: { $exists: true, $ne: null } });
        const withCombo4 = await DLTRedCombination.countDocuments({ combo_4: { $exists: true, $ne: null } });

        console.log(`\n📊 统计信息:`);
        console.log(`  总记录数: ${totalCount}`);
        console.log(`  有combo_2字段的记录: ${withCombo2} (${(withCombo2/totalCount*100).toFixed(2)}%)`);
        console.log(`  有combo_3字段的记录: ${withCombo3} (${(withCombo3/totalCount*100).toFixed(2)}%)`);
        console.log(`  有combo_4字段的记录: ${withCombo4} (${(withCombo4/totalCount*100).toFixed(2)}%)`);

        if (withCombo2 === 0 && withCombo3 === 0 && withCombo4 === 0) {
            console.log(`\n❌ 问题确认：DLTRedCombination表中的记录缺少combo_2/3/4特征字段！`);
            console.log(`   这就是同出排除功能无效的根本原因。`);
            console.log(`\n💡 解决方案：需要为红球组合表生成特征字段，或者修改过滤逻辑来动态计算特征。`);
        } else {
            console.log(`\n✅ DLTRedCombination表中有特征字段。`);
        }

    } catch (error) {
        console.error('❌ 错误:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ MongoDB连接已关闭');
    }
}

checkRedComboFeatures();
