/**
 * 大乐透统计数据迁移脚本
 * 为hit_dlts表的所有历史数据添加statistics字段
 *
 * 功能：
 * 1. 读取所有hit_dlts开奖记录
 * 2. 计算8个统计指标（和值、跨度、热温冷比、区间比、AC值、奇偶比等）
 * 3. 更新到statistics字段
 * 4. 显示迁移进度
 */

require('dotenv').config();
const mongoose = require('mongoose');

// ===== 数据库连接 =====
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/HIT';

// ===== AC值计算函数 =====
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

// ===== 连号计算函数 =====
function calculateConsecutiveCount(numbers) {
    if (!numbers || numbers.length < 2) return 0;

    const sorted = [...numbers].sort((a, b) => a - b);
    let consecutiveCount = 0;

    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i + 1] - sorted[i] === 1) {
            consecutiveCount++;
        }
    }

    return consecutiveCount;
}

// ===== Schema定义 =====
const dltSchema = new mongoose.Schema({
    ID: Number,
    Issue: Number,
    Red1: Number,
    Red2: Number,
    Red3: Number,
    Red4: Number,
    Red5: Number,
    Blue1: Number,
    Blue2: Number,
    PoolPrize: String,
    FirstPrizeCount: Number,
    FirstPrizeAmount: String,
    SecondPrizeCount: Number,
    SecondPrizeAmount: String,
    TotalSales: String,
    DrawDate: Date,
    createdAt: Date,
    statistics: {
        frontSum: Number,
        frontSpan: Number,
        frontHotWarmColdRatio: String,
        frontZoneRatio: String,
        frontOddEvenRatio: String,
        frontAcValue: Number,
        backSum: Number,
        backOddEvenRatio: String,
        consecutiveCount: Number,
        repeatCount: Number
    },
    updatedAt: Date
});

const dltRedMissingSchema = new mongoose.Schema({
    ID: Number,
    Issue: Number,
    FrontHotWarmColdRatio: String  // 格式: "2:2:1"
}, { strict: false });  // 允许动态字段

const hit_dlts = mongoose.model('hit_dlts', dltSchema);
const DLTRedMissing = mongoose.model('HIT_DLT_Basictrendchart_redballmissing_history', dltRedMissingSchema);

// ===== 主迁移函数 =====
async function migrateStatistics() {
    try {
        console.log('='.repeat(60));
        console.log('大乐透统计数据迁移脚本');
        console.log('='.repeat(60));

        // 连接数据库
        console.log('\n📡 连接数据库...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 数据库连接成功');

        // 获取所有hit_dlts记录（按ID升序，保证从旧到新处理）
        console.log('\n📊 读取hit_dlts开奖数据...');
        const dltRecords = await hit_dlts.find().sort({ ID: 1 }).lean();
        console.log(`✅ 找到 ${dltRecords.length} 条记录\n`);

        if (dltRecords.length === 0) {
            console.log('⚠️  没有数据需要迁移');
            return;
        }

        // 获取热温冷比数据（一次性加载，提高性能）
        console.log('📊 读取热温冷比数据...');
        const hotWarmColdData = await DLTRedMissing.find().lean();
        const hotWarmColdMap = new Map(
            hotWarmColdData.map(item => [item.Issue, item.FrontHotWarmColdRatio || '0:0:5'])
        );
        console.log(`✅ 找到 ${hotWarmColdData.length} 条热温冷比数据\n`);

        // 批量更新
        const batchSize = 100;
        let successCount = 0;
        let errorCount = 0;
        let previousRedBalls = null;  // 用于计算重号

        console.log('🔄 开始迁移统计数据...\n');
        const startTime = Date.now();

        for (let i = 0; i < dltRecords.length; i += batchSize) {
            const batch = dltRecords.slice(i, i + batchSize);
            const updateOperations = [];

            for (const record of batch) {
                try {
                    // 提取前区号码和后区号码
                    const frontNumbers = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5];
                    const backNumbers = [record.Blue1, record.Blue2];

                    // 计算前区统计
                    const frontSum = frontNumbers.reduce((a, b) => a + b, 0);
                    const frontSpan = Math.max(...frontNumbers) - Math.min(...frontNumbers);

                    // 从DLTRedMissing获取热温冷比
                    const frontHotWarmColdRatio = hotWarmColdMap.get(record.Issue) || '0:0:5';

                    // 计算前区区间比
                    let zone1 = 0, zone2 = 0, zone3 = 0;
                    frontNumbers.forEach(n => {
                        if (n <= 12) zone1++;
                        else if (n <= 24) zone2++;
                        else zone3++;
                    });
                    const frontZoneRatio = `${zone1}:${zone2}:${zone3}`;

                    // 计算前区奇偶比
                    let frontOdd = 0, frontEven = 0;
                    frontNumbers.forEach(n => n % 2 === 0 ? frontEven++ : frontOdd++);
                    const frontOddEvenRatio = `${frontOdd}:${frontEven}`;

                    // 计算AC值
                    const frontAcValue = calculateACValue(frontNumbers);

                    // 计算后区统计
                    const backSum = backNumbers.reduce((a, b) => a + b, 0);
                    let backOdd = 0, backEven = 0;
                    backNumbers.forEach(n => n % 2 === 0 ? backEven++ : backOdd++);
                    const backOddEvenRatio = `${backOdd}:${backEven}`;

                    // 计算连号个数
                    const consecutiveCount = calculateConsecutiveCount(frontNumbers);

                    // 计算重号个数（相对上一期）
                    let repeatCount = 0;
                    if (previousRedBalls) {
                        repeatCount = frontNumbers.filter(n => previousRedBalls.includes(n)).length;
                    }
                    previousRedBalls = frontNumbers;

                    // 准备更新操作
                    updateOperations.push({
                        updateOne: {
                            filter: { _id: record._id },
                            update: {
                                $set: {
                                    statistics: {
                                        frontSum,
                                        frontSpan,
                                        frontHotWarmColdRatio,
                                        frontZoneRatio,
                                        frontOddEvenRatio,
                                        frontAcValue,
                                        backSum,
                                        backOddEvenRatio,
                                        consecutiveCount,
                                        repeatCount
                                    },
                                    updatedAt: new Date()
                                }
                            }
                        }
                    });

                    successCount++;
                } catch (error) {
                    console.error(`❌ 处理期号 ${record.Issue} 失败:`, error.message);
                    errorCount++;
                }
            }

            // 批量执行更新
            if (updateOperations.length > 0) {
                await hit_dlts.bulkWrite(updateOperations);
            }

            // 显示进度
            const progress = Math.min(i + batchSize, dltRecords.length);
            const percentage = ((progress / dltRecords.length) * 100).toFixed(1);
            process.stdout.write(`\r📈 进度: ${progress}/${dltRecords.length} (${percentage}%) - 成功: ${successCount}, 失败: ${errorCount}`);
        }

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log('\n\n' + '='.repeat(60));
        console.log('✅ 迁移完成！');
        console.log('='.repeat(60));
        console.log(`📊 总记录数: ${dltRecords.length}`);
        console.log(`✅ 成功: ${successCount}`);
        console.log(`❌ 失败: ${errorCount}`);
        console.log(`⏱️  耗时: ${duration} 秒`);
        console.log('='.repeat(60));

        // 验证迁移结果
        console.log('\n🔍 验证迁移结果...');
        const sampleRecord = await hit_dlts.findOne({ 'statistics.frontSum': { $exists: true } }).lean();
        if (sampleRecord && sampleRecord.statistics) {
            console.log('✅ 迁移验证通过');
            console.log('\n📋 示例数据:');
            console.log(`   期号: ${sampleRecord.Issue}`);
            console.log(`   前区号码: ${sampleRecord.Red1}, ${sampleRecord.Red2}, ${sampleRecord.Red3}, ${sampleRecord.Red4}, ${sampleRecord.Red5}`);
            console.log(`   前区和值: ${sampleRecord.statistics.frontSum}`);
            console.log(`   前区跨度: ${sampleRecord.statistics.frontSpan}`);
            console.log(`   热温冷比: ${sampleRecord.statistics.frontHotWarmColdRatio}`);
            console.log(`   区间比: ${sampleRecord.statistics.frontZoneRatio}`);
            console.log(`   AC值: ${sampleRecord.statistics.frontAcValue}`);
            console.log(`   前区奇偶: ${sampleRecord.statistics.frontOddEvenRatio}`);
            console.log(`   后区和值: ${sampleRecord.statistics.backSum}`);
            console.log(`   后区奇偶: ${sampleRecord.statistics.backOddEvenRatio}`);
        } else {
            console.log('⚠️  未找到迁移后的数据，请检查');
        }

    } catch (error) {
        console.error('\n❌ 迁移失败:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('\n📡 数据库连接已关闭');
    }
}

// ===== 执行迁移 =====
if (require.main === module) {
    migrateStatistics()
        .then(() => {
            console.log('\n✅ 脚本执行完成');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ 脚本执行失败:', error);
            process.exit(1);
        });
}

module.exports = { migrateStatistics };
