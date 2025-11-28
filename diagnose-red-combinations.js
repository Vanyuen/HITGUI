const mongoose = require('mongoose');

async function diagnoseRedCombinations() {
    try {
        // 连接数据库
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // 检查红球组合集合
        const RedCombination = mongoose.connection.db.collection('hit_dlt_redcombinations');

        // 统计总记录数
        const totalCombinations = await RedCombination.countDocuments();
        console.log(`红球组合总记录数: ${totalCombinations}`);

        // 抽样检查组合的结构
        const sampleCombinations = await RedCombination.find().limit(10).toArray();

        console.log('\n样本组合结构:');
        sampleCombinations.forEach((combo, index) => {
            console.log(`组合 ${index + 1}:`);
            console.log('- combination_id:', combo.combination_id);
            console.log('- combination:', combo.combination);
            console.log('- 其他字段:', Object.keys(combo).filter(k => !['combination_id', 'combination'].includes(k)));
            console.log('---');
        });

        // 检查组合的有效性
        const invalidCombos = await RedCombination.countDocuments({
            $or: [
                { combination: { $exists: false } },
                { combination: { $not: { $type: 'array' } } },
                { combination: { $size: 0 } }
            ]
        });
        console.log(`\n无效组合数量: ${invalidCombos}`);

        // 关闭数据库连接
        await mongoose.connection.close();
    } catch (error) {
        console.error('诊断过程中发生错误:', error);
    }
}

diagnoseRedCombinations();