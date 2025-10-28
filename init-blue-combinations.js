/**
 * 初始化蓝球组合数据
 * 大乐透蓝球：从12个号码(1-12)中选2个，共 C(12,2) = 66 种组合
 */

const mongoose = require('mongoose');

// 连接MongoDB
const MONGO_URI = 'mongodb://127.0.0.1:27017/lottery';

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ MongoDB连接成功');
    initBlueCombinations();
}).catch(err => {
    console.error('❌ MongoDB连接失败:', err);
    process.exit(1);
});

// 定义蓝球组合Schema
const dltBlueCombinationsSchema = new mongoose.Schema({
    combination_id: { type: Number, required: true, unique: true },
    blue_ball_1: { type: Number, required: true, min: 1, max: 12 },
    blue_ball_2: { type: Number, required: true, min: 1, max: 12 },
    sum_value: { type: Number, required: true, min: 3, max: 23 },
    created_at: { type: Date, default: Date.now }
});

dltBlueCombinationsSchema.index({ sum_value: 1 });
dltBlueCombinationsSchema.index({ combination_id: 1 });

const DLTBlueCombinations = mongoose.model('HIT_DLT_BlueCombinations', dltBlueCombinationsSchema);

/**
 * 生成所有蓝球组合 C(12,2) = 66
 */
function generateAllBlueCombinations() {
    const combinations = [];
    let combinationId = 1;

    for (let i = 1; i <= 12; i++) {
        for (let j = i + 1; j <= 12; j++) {
            combinations.push({
                combination_id: combinationId,
                blue_ball_1: i,
                blue_ball_2: j,
                sum_value: i + j,
                created_at: new Date()
            });
            combinationId++;
        }
    }

    return combinations;
}

/**
 * 初始化蓝球组合数据
 */
async function initBlueCombinations() {
    try {
        console.log('🔍 检查 HIT_DLT_BlueCombinations 集合...');

        // 检查集合是否已有数据
        const existingCount = await DLTBlueCombinations.countDocuments();
        console.log(`📊 当前集合记录数: ${existingCount}`);

        if (existingCount > 0) {
            console.log('⚠️  集合已有数据，是否清空重建？');
            console.log('提示：如果要重建，请先运行: db.HIT_DLT_BlueCombinations.drop()');

            // 显示前5条记录
            const samples = await DLTBlueCombinations.find({}).limit(5).lean();
            console.log('📊 现有数据样本:');
            samples.forEach(s => {
                console.log(`  ID=${s.combination_id}, 蓝球=[${s.blue_ball_1}, ${s.blue_ball_2}], 和值=${s.sum_value}`);
            });

            await mongoose.disconnect();
            process.exit(0);
        }

        console.log('\n🔧 开始生成蓝球组合数据...');
        const combinations = generateAllBlueCombinations();
        console.log(`📊 生成组合数: ${combinations.length}个`);

        // 显示前10个组合
        console.log('📊 组合样本 (前10个):');
        combinations.slice(0, 10).forEach(c => {
            console.log(`  ID=${c.combination_id}, 蓝球=[${c.blue_ball_1}, ${c.blue_ball_2}], 和值=${c.sum_value}`);
        });

        console.log('\n💾 批量插入数据库...');
        const result = await DLTBlueCombinations.insertMany(combinations, { ordered: false });
        console.log(`✅ 插入成功: ${result.length}条记录`);

        // 验证插入结果
        const finalCount = await DLTBlueCombinations.countDocuments();
        console.log(`📊 验证：集合总记录数 = ${finalCount}`);

        // 测试查询
        console.log('\n🧪 测试查询...');
        const testQuery1 = await DLTBlueCombinations.find({ combination_id: { $in: [1, 2, 3, 4, 5] } }).lean();
        console.log(`  查询ID 1-5: 找到 ${testQuery1.length} 条`);
        testQuery1.forEach(bc => {
            console.log(`    ID=${bc.combination_id}, 蓝球=[${bc.blue_ball_1}, ${bc.blue_ball_2}]`);
        });

        const testQuery2 = await DLTBlueCombinations.find({ sum_value: 13 }).lean();
        console.log(`  查询和值=13: 找到 ${testQuery2.length} 条`);

        console.log('\n✅ 蓝球组合数据初始化完成！');
        console.log(`📊 总记录数: ${finalCount}`);
        console.log(`📊 组合范围: ID 1-66`);
        console.log(`📊 蓝球范围: 1-12 (每个组合2个号码)`);
        console.log(`📊 和值范围: 3-23`);

        await mongoose.disconnect();
        console.log('\n📦 数据库连接已关闭');
        process.exit(0);

    } catch (error) {
        console.error('❌ 初始化失败:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}
