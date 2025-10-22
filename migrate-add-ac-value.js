/**
 * 数据迁移脚本：为大乐透红球组合表添加AC值
 * 处理约324,632条记录
 */

const mongoose = require('mongoose');

// MongoDB连接配置
const MONGODB_URI = 'mongodb://localhost:27017/HIT';

// 定义Schema（与server.js保持一致）
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

const DLTRedCombination = mongoose.model('HIT_DLT_RedCombination', dltRedCombinationSchema, 'hit_dlt_redcombinations');

/**
 * 计算AC值 (与server.js中的函数完全一致)
 */
function calculateACValue(numbers) {
    if (!numbers || numbers.length < 2) return 0;

    const sorted = [...numbers].sort((a, b) => a - b);
    const differences = new Set();

    // 计算所有号码对之间的差值并去重
    for (let i = 0; i < sorted.length - 1; i++) {
        for (let j = i + 1; j < sorted.length; j++) {
            const diff = sorted[j] - sorted[i];
            differences.add(diff);
        }
    }

    // AC值 = 去重后的差值数量 - (n-1)
    const acValue = differences.size - (sorted.length - 1);
    return Math.max(0, acValue);
}

/**
 * 主迁移函数
 */
async function migrateACValue() {
    console.log('='.repeat(60));
    console.log('开始迁移：为大乐透红球组合表添加AC值');
    console.log('='.repeat(60));

    try {
        // 连接数据库
        console.log('\n[1/6] 连接MongoDB数据库...');
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 数据库连接成功');

        // 统计总数
        console.log('\n[2/6] 统计待处理记录数...');
        const totalCount = await DLTRedCombination.countDocuments();
        console.log(`📊 总记录数: ${totalCount.toLocaleString()}`);

        // 检查是否已有AC值（使用实际字段名 ac_value）
        const existingACCount = await DLTRedCombination.countDocuments({ ac_value: { $exists: true, $ne: null } });
        console.log(`📊 已有AC值的记录数: ${existingACCount.toLocaleString()}`);

        if (existingACCount === totalCount) {
            console.log('\n⚠️  所有记录都已有AC值，无需迁移');
            return;
        }

        // 需要更新的记录数
        const needUpdateCount = totalCount - existingACCount;
        console.log(`📊 需要更新的记录数: ${needUpdateCount.toLocaleString()}`);

        // 批量更新
        console.log('\n[3/6] 开始批量更新AC值...');
        const batchSize = 1000;
        let processedCount = 0;
        let updatedCount = 0;
        let errorCount = 0;
        const startTime = Date.now();

        // 查询所有没有AC值的记录（使用实际字段名 ac_value）
        const cursor = DLTRedCombination.find({
            $or: [
                { ac_value: { $exists: false } },
                { ac_value: null }
            ]
        }).cursor();

        const batch = [];

        for await (const combo of cursor) {
            try {
                // 从实际字段名获取号码数组
                const numbers = [
                    combo.red_ball_1,
                    combo.red_ball_2,
                    combo.red_ball_3,
                    combo.red_ball_4,
                    combo.red_ball_5
                ];

                // 计算AC值
                const acValue = calculateACValue(numbers);

                batch.push({
                    updateOne: {
                        filter: { _id: combo._id },
                        update: { $set: { ac_value: acValue } }  // 使用snake_case字段名
                    }
                });

                // 每1000条执行一次批量更新
                if (batch.length >= batchSize) {
                    const result = await DLTRedCombination.bulkWrite(batch);
                    updatedCount += result.modifiedCount;
                    processedCount += batch.length;
                    batch.length = 0;

                    // 显示进度
                    const progress = ((processedCount / needUpdateCount) * 100).toFixed(2);
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    const speed = (processedCount / elapsed).toFixed(0);
                    console.log(`   进度: ${processedCount.toLocaleString()}/${needUpdateCount.toLocaleString()} (${progress}%) | 速度: ${speed}条/秒 | 用时: ${elapsed}秒`);
                }
            } catch (error) {
                errorCount++;
                console.error(`   ❌ 处理记录ID=${combo.id}时出错:`, error.message);
            }
        }

        // 处理剩余的记录
        if (batch.length > 0) {
            const result = await DLTRedCombination.bulkWrite(batch);
            updatedCount += result.modifiedCount;
            processedCount += batch.length;
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log('\n[4/6] 更新完成统计:');
        console.log(`   处理记录数: ${processedCount.toLocaleString()}`);
        console.log(`   成功更新数: ${updatedCount.toLocaleString()}`);
        console.log(`   错误记录数: ${errorCount.toLocaleString()}`);
        console.log(`   总耗时: ${totalTime}秒`);

        // 验证结果
        console.log('\n[5/6] 验证迁移结果...');
        const finalACCount = await DLTRedCombination.countDocuments({ ac_value: { $exists: true, $ne: null } });
        console.log(`   现有AC值记录数: ${finalACCount.toLocaleString()}`);

        if (finalACCount === totalCount) {
            console.log('   ✅ 所有记录都已有AC值');
        } else {
            console.log(`   ⚠️  还有 ${totalCount - finalACCount} 条记录没有AC值`);
        }

        // 抽样验证
        console.log('\n[6/6] 抽样验证AC值计算准确性...');
        const samples = await DLTRedCombination.find().limit(5).lean();
        console.log('\n   抽样验证结果:');
        samples.forEach(s => {
            const numbers = [s.red_ball_1, s.red_ball_2, s.red_ball_3, s.red_ball_4, s.red_ball_5];
            const calculated = calculateACValue(numbers);
            const stored = s.ac_value;
            const match = calculated === stored ? '✅' : '❌';
            console.log(`   ${match} ID=${s.combination_id}, 号码=[${numbers.join(',')}], 存储AC=${stored}, 计算AC=${calculated}`);
        });

        console.log('\n' + '='.repeat(60));
        console.log('✅ 迁移完成！');
        console.log('='.repeat(60));

    } catch (error) {
        console.error('\n❌ 迁移过程中发生错误:', error);
        throw error;
    } finally {
        // 关闭数据库连接
        await mongoose.connection.close();
        console.log('\n数据库连接已关闭');
    }
}

// 执行迁移
if (require.main === module) {
    migrateACValue()
        .then(() => {
            console.log('\n✅ 脚本执行成功');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 脚本执行失败:', error);
            process.exit(1);
        });
}

module.exports = { migrateACValue, calculateACValue };
