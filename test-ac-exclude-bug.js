// 测试AC值排除功能的Bug
require('dotenv').config();
const mongoose = require('mongoose');

// 计算AC值函数（与server.js一致）
function calculateACValue(numbers) {
    if (!numbers || numbers.length < 2) return 0;

    const sorted = [...numbers].sort((a, b) => a - b);
    const differences = new Set();

    for (let i = 0; i < sorted.length - 1; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
            const diff = sorted[j] - sorted[i];
            differences.add(diff);
        }
    }

    const acValue = differences.size - (sorted.length - 1);
    return Math.max(0, acValue);
}

// 定义组合模型
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

async function testACExclusion() {
    try {
        console.log('📊 AC值排除功能测试\n');
        console.log('='.repeat(80));

        // 连接数据库
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ 数据库连接成功\n');

        // 模拟用户配置：排除AC值 5-6 和 1-3
        const userConfig = {
            ac: {
                enabled: true,
                ranges: [
                    { enabled: true, min: 5, max: 6 },
                    { enabled: true, min: 1, max: 3 }
                ],
                historical: { enabled: false }
            }
        };

        console.log('🔧 用户配置的AC值排除条件:');
        console.log(JSON.stringify(userConfig, null, 2));
        console.log();

        // 步骤1: 检查数据库中AC值的分布
        console.log('📊 步骤1: 检查数据库中AC值的分布');
        console.log('-'.repeat(80));

        const acDistribution = await DLTRedCombination.aggregate([
            { $group: { _id: '$acValue', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        console.log('AC值分布:');
        acDistribution.forEach(item => {
            console.log(`  AC=${item._id}: ${item.count.toLocaleString()} 个组合`);
        });
        console.log();

        // 步骤2: 构建查询条件（模拟server.js中的逻辑）
        console.log('📊 步骤2: 构建数据库查询条件');
        console.log('-'.repeat(80));

        const query = {};
        const excludeRanges = [];

        // 处理AC值排除范围
        userConfig.ac.ranges.forEach(range => {
            if (range.enabled && range.min !== undefined && range.max !== undefined) {
                console.log(`  ➜ 排除AC值范围: ${range.min} - ${range.max}`);
                excludeRanges.push({ ac_value: { $gte: range.min, $lte: range.max } });
            }
        });

        if (excludeRanges.length > 0) {
            query.$nor = excludeRanges;
            console.log(`  ✅ 添加了 ${excludeRanges.length} 个AC值排除条件`);
        }

        console.log('\n生成的MongoDB查询:');
        console.log(JSON.stringify(query, null, 2));
        console.log();

        // 步骤3: 执行查询
        console.log('📊 步骤3: 执行数据库查询');
        console.log('-'.repeat(80));

        const totalCount = await DLTRedCombination.countDocuments({});
        console.log(`总组合数: ${totalCount.toLocaleString()}`);

        const filteredCount = await DLTRedCombination.countDocuments(query);
        console.log(`排除后组合数: ${filteredCount.toLocaleString()}`);

        const excludedCount = totalCount - filteredCount;
        console.log(`被排除组合数: ${excludedCount.toLocaleString()}`);
        console.log();

        // 步骤4: 验证排除效果
        console.log('📊 步骤4: 验证排除效果 - 抽查前50个结果');
        console.log('-'.repeat(80));

        const samples = await DLTRedCombination.find(query).limit(50).lean();

        let bugFound = false;
        samples.forEach((combo, index) => {
            const acValue = combo.acValue;
            const shouldBeExcluded = (acValue >= 5 && acValue <= 6) || (acValue >= 1 && acValue <= 3);

            if (shouldBeExcluded) {
                if (!bugFound) {
                    console.log('\n⚠️  发现Bug！以下组合应该被排除但仍然出现在结果中:');
                    bugFound = true;
                }
                console.log(`  [${index + 1}] ID=${combo.id}, AC值=${acValue}, 号码=[${combo.numbers.join(', ')}]`);
            }
        });

        if (!bugFound) {
            console.log('✅ 抽查的50个组合中，没有发现应被排除的AC值');
        }
        console.log();

        // 步骤5: 统计每个AC值的组合数（使用查询条件后）
        console.log('📊 步骤5: 查询结果中的AC值分布');
        console.log('-'.repeat(80));

        const resultDistribution = await DLTRedCombination.aggregate([
            { $match: query },
            { $group: { _id: '$acValue', count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        console.log('查询结果中的AC值分布:');
        resultDistribution.forEach(item => {
            const isExcluded = (item._id >= 5 && item._id <= 6) || (item._id >= 1 && item._id <= 3);
            const marker = isExcluded ? '❌ [应被排除]' : '✅';
            console.log(`  ${marker} AC=${item._id}: ${item.count.toLocaleString()} 个组合`);
        });
        console.log();

        // 步骤6: 检查特定AC值的组合
        console.log('📊 步骤6: 详细检查应被排除的AC值');
        console.log('-'.repeat(80));

        for (let acValue of [1, 2, 3, 5, 6]) {
            const count = await DLTRedCombination.countDocuments({
                ...query,
                acValue: acValue
            });

            if (count > 0) {
                console.log(`\n⚠️  AC值=${acValue} 应该被完全排除，但仍有 ${count.toLocaleString()} 个组合！`);

                // 显示几个示例
                const examples = await DLTRedCombination.find({
                    ...query,
                    acValue: acValue
                }).limit(5).lean();

                console.log('  示例组合:');
                examples.forEach((combo, i) => {
                    console.log(`    [${i + 1}] ID=${combo.id}, 号码=[${combo.numbers.join(', ')}], AC=${combo.acValue}`);
                });
            } else {
                console.log(`✅ AC值=${acValue} 已被完全排除`);
            }
        }

        console.log('\n' + '='.repeat(80));
        console.log('📋 测试总结');
        console.log('='.repeat(80));

        if (bugFound || resultDistribution.some(item =>
            ((item._id >= 5 && item._id <= 6) || (item._id >= 1 && item._id <= 3)) && item.count > 0
        )) {
            console.log('❌ Bug确认：AC值排除条件未正确生效！');
            console.log('\n可能的原因:');
            console.log('  1. $nor 查询语法错误');
            console.log('  2. acValue 字段数据类型不匹配');
            console.log('  3. 查询条件被其他条件覆盖');
            console.log('  4. 数据库索引问题');
        } else {
            console.log('✅ 排除功能正常工作！');
        }

    } catch (error) {
        console.error('❌ 测试失败:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n数据库连接已关闭');
    }
}

testACExclusion();
