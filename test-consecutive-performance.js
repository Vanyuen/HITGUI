// 测试连号组数排除性能
require('dotenv').config();
const mongoose = require('mongoose');

// 连接数据库
mongoose.connect('mongodb://localhost:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const dltRedCombinationsSchema = new mongoose.Schema({
    combination_id: Number,
    red_balls: [Number],
    consecutive_groups: Number,
    max_consecutive_length: Number,
    sum_value: Number,
    span_value: Number
}, { collection: 'hit_dlt_redcombinations' });

const DLTRedCombinations = mongoose.model('HIT_DLT_RedCombinations_Test', dltRedCombinationsSchema);

async function testPerformance() {
    console.log('🔍 开始性能测试...\n');

    // 测试1: 简单等值查询（consecutive_groups = 0）
    console.log('=== 测试1: consecutive_groups = 0 ===');
    let start = Date.now();
    const count1 = await DLTRedCombinations.countDocuments({ consecutive_groups: 0 });
    let elapsed1 = Date.now() - start;
    console.log(`结果数: ${count1}`);
    console.log(`耗时: ${elapsed1}ms\n`);

    // 测试2: $nor 查询（排除 consecutive_groups = 0）
    console.log('=== 测试2: $nor [{ consecutive_groups: 0 }] ===');
    start = Date.now();
    const count2 = await DLTRedCombinations.countDocuments({
        $nor: [{ consecutive_groups: 0 }]
    });
    let elapsed2 = Date.now() - start;
    console.log(`结果数: ${count2}`);
    console.log(`耗时: ${elapsed2}ms\n`);

    // 测试3: $nor 多个值（排除 0 和 1）
    console.log('=== 测试3: $nor [{ consecutive_groups: 0 }, { consecutive_groups: 1 }] ===');
    start = Date.now();
    const count3 = await DLTRedCombinations.countDocuments({
        $nor: [
            { consecutive_groups: 0 },
            { consecutive_groups: 1 }
        ]
    });
    let elapsed3 = Date.now() - start;
    console.log(`结果数: ${count3}`);
    console.log(`耗时: ${elapsed3}ms\n`);

    // 测试4: $nin 查询（优化写法）
    console.log('=== 测试4: consecutive_groups: { $nin: [0, 1] } ===');
    start = Date.now();
    const count4 = await DLTRedCombinations.countDocuments({
        consecutive_groups: { $nin: [0, 1] }
    });
    let elapsed4 = Date.now() - start;
    console.log(`结果数: ${count4}`);
    console.log(`耗时: ${elapsed4}ms\n`);

    // 测试5: 检查索引使用情况
    console.log('=== 测试5: 检查查询计划 ===');
    const explain = await DLTRedCombinations.find({
        $nor: [{ consecutive_groups: 0 }]
    }).limit(1).explain('executionStats');

    console.log('执行统计:');
    console.log(`  - 扫描文档数: ${explain.executionStats.totalDocsExamined}`);
    console.log(`  - 返回文档数: ${explain.executionStats.nReturned}`);
    console.log(`  - 执行时间: ${explain.executionStats.executionTimeMillis}ms`);
    console.log(`  - 使用索引: ${explain.executionStats.executionStages.indexName || '无'}`);

    // 测试6: 检查consecutive_groups字段分布
    console.log('\n=== 测试6: consecutive_groups 字段分布 ===');
    const distribution = await DLTRedCombinations.aggregate([
        { $group: { _id: '$consecutive_groups', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
    ]);
    console.log('分布统计:');
    distribution.forEach(d => {
        console.log(`  consecutive_groups=${d._id}: ${d.count} 个组合 (${(d.count / 324632 * 100).toFixed(2)}%)`);
    });

    console.log('\n✅ 测试完成');
    process.exit(0);
}

mongoose.connection.once('open', () => {
    console.log('✅ 已连接到MongoDB\n');
    testPerformance().catch(err => {
        console.error('❌ 测试失败:', err);
        process.exit(1);
    });
});
