const mongoose = require('mongoose');

// 连接数据库
mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// 红球组合Schema（使用正确的模型名）
const dltRedCombinationsSchema = new mongoose.Schema({}, { strict: false });
const DLTRedCombination = mongoose.model('HIT_DLT_RedCombinations', dltRedCombinationsSchema);

async function checkComboFeatures() {
    try {
        console.log('📊 开始检查组合特征存在情况...\n');

        // 1. 获取总组合数
        const totalCount = await DLTRedCombination.countDocuments();
        console.log(`📦 总组合数: ${totalCount.toLocaleString()}`);

        // 2. 随机抽样检查10个组合
        const sampleCombos = await DLTRedCombination.find({}).limit(10).lean();

        let hasFeatures = 0;
        let noFeatures = 0;

        console.log('\n🔍 随机抽样检查10个组合:\n');

        sampleCombos.forEach((combo, index) => {
            const has_combo_2 = combo.combo_2 && combo.combo_2.length > 0;
            const has_combo_3 = combo.combo_3 && combo.combo_3.length > 0;
            const has_combo_4 = combo.combo_4 && combo.combo_4.length > 0;
            const hasAllFeatures = has_combo_2 && has_combo_3 && has_combo_4;

            if (hasAllFeatures) {
                hasFeatures++;
            } else {
                noFeatures++;
            }

            console.log(`${index + 1}. ID: ${combo.combination_id || 'N/A'}`);
            console.log(`   红球: ${combo.red_ball_1}-${combo.red_ball_2}-${combo.red_ball_3}-${combo.red_ball_4}-${combo.red_ball_5}`);
            console.log(`   2码特征: ${has_combo_2 ? '✅ 存在' : '❌ 缺失'} ${has_combo_2 ? `(${combo.combo_2.length}个)` : ''}`);
            console.log(`   3码特征: ${has_combo_3 ? '✅ 存在' : '❌ 缺失'} ${has_combo_3 ? `(${combo.combo_3.length}个)` : ''}`);
            console.log(`   4码特征: ${has_combo_4 ? '✅ 存在' : '❌ 缺失'} ${has_combo_4 ? `(${combo.combo_4.length}个)` : ''}`);
            console.log(`   整体状态: ${hasAllFeatures ? '✅ 完整' : '⚠️  不完整'}\n`);
        });

        console.log('📊 抽样统计:');
        console.log(`   ✅ 有特征: ${hasFeatures}/10 (${(hasFeatures / 10 * 100).toFixed(1)}%)`);
        console.log(`   ❌ 缺失特征: ${noFeatures}/10 (${(noFeatures / 10 * 100).toFixed(1)}%)`);

        // 3. 检查是否有combo_2字段的组合数量
        const withCombo2 = await DLTRedCombination.countDocuments({
            combo_2: { $exists: true, $ne: null, $not: { $size: 0 } }
        });
        const withCombo3 = await DLTRedCombination.countDocuments({
            combo_3: { $exists: true, $ne: null, $not: { $size: 0 } }
        });
        const withCombo4 = await DLTRedCombination.countDocuments({
            combo_4: { $exists: true, $ne: null, $not: { $size: 0 } }
        });

        console.log('\n📊 全量统计:');
        console.log(`   combo_2字段存在: ${withCombo2.toLocaleString()}/${totalCount.toLocaleString()} (${(withCombo2 / totalCount * 100).toFixed(1)}%)`);
        console.log(`   combo_3字段存在: ${withCombo3.toLocaleString()}/${totalCount.toLocaleString()} (${(withCombo3 / totalCount * 100).toFixed(1)}%)`);
        console.log(`   combo_4字段存在: ${withCombo4.toLocaleString()}/${totalCount.toLocaleString()} (${(withCombo4 / totalCount * 100).toFixed(1)}%)`);

        // 4. 结论
        console.log('\n🎯 结论:');
        if (withCombo2 === totalCount && withCombo3 === totalCount && withCombo4 === totalCount) {
            console.log('   ✅ 所有组合都有预存特征，性能良好！');
        } else if (withCombo2 === 0 && withCombo3 === 0 && withCombo4 === 0) {
            console.log('   ❌ 所有组合都缺失特征，需要动态计算（性能影响严重）！');
            console.log('   💡 建议：运行特征生成脚本预先计算所有组合的特征');
        } else {
            console.log('   ⚠️  部分组合有特征，部分需要动态计算');
            console.log(`   💡 建议：补全缺失的 ${(totalCount - withCombo2).toLocaleString()} 个组合的特征`);
        }

    } catch (error) {
        console.error('❌ 检查失败:', error);
    } finally {
        mongoose.connection.close();
        console.log('\n✅ 数据库连接已关闭');
    }
}

checkComboFeatures();
