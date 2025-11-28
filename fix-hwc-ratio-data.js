/**
 * 修复热温冷比数据脚本
 * 问题：所有2780条hit_dlts记录的statistics.frontHotWarmColdRatio都是"0:0:5"
 * 解决：重新计算每期的正确热温冷比
 */

const mongoose = require('mongoose');

// 连接数据库
const MONGODB_URI = 'mongodb://localhost:27017/lottery';

// 定义Schema
const dltSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlts' });
const redMissingSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_basictrendchart_redballmissing_histories' });

let hit_dlts, DLTRedMissing;

/**
 * 计算热温冷比
 * @param {Array} redBalls - 红球号码数组 [Red1, Red2, Red3, Red4, Red5]
 * @param {Object} previousMissingData - 上一期的遗漏值数据
 * @returns {string} 热温冷比，如 "3:2:0"
 */
function calculateHotWarmColdRatio(redBalls, previousMissingData) {
    if (!redBalls || redBalls.length !== 5) {
        console.warn('  ⚠️  红球数量不是5个:', redBalls);
        return null;
    }

    if (!previousMissingData) {
        console.warn('  ⚠️  没有上期遗漏值数据');
        return null;
    }

    let hot = 0, warm = 0, cold = 0;

    for (const ball of redBalls) {
        // 从上期遗漏值数据中获取该号码的遗漏值
        // 遗漏值字段名是号码本身（如：字段"1", "2", ..., "35"，不带前导0）
        const ballStr = String(ball);
        const missingValue = previousMissingData[ballStr];

        if (missingValue === undefined || missingValue === null) {
            console.warn(`  ⚠️  号码 ${ballStr} 找不到遗漏值`);
            continue;
        }

        // 分类标准：遗漏值 ≤4 热号, 5-9 温号, ≥10 冷号
        if (missingValue <= 4) {
            hot++;
        } else if (missingValue <= 9) {
            warm++;
        } else {
            cold++;
        }
    }

    return `${hot}:${warm}:${cold}`;
}

/**
 * 主修复函数
 */
async function fixHotWarmColdRatios() {
    try {
        console.log('\n🔧 开始修复热温冷比数据...\n');

        // 连接数据库
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB连接成功\n');

        // 初始化模型
        hit_dlts = mongoose.models.hit_dlts || mongoose.model('hit_dlts', dltSchema);
        DLTRedMissing = mongoose.models.HIT_DLT_Basictrendchart_redballmissing_history ||
                        mongoose.model('HIT_DLT_Basictrendchart_redballmissing_history', redMissingSchema);

        // 获取所有hit_dlts记录（按期号升序，方便处理上一期）
        console.log('📊 查询所有hit_dlts记录...');
        const allRecords = await hit_dlts.find({})
            .select('Issue Red1 Red2 Red3 Red4 Red5 statistics')
            .sort({ Issue: 1 })
            .lean();

        console.log(`✅ 找到 ${allRecords.length} 条记录\n`);

        // 获取所有遗漏值数据（用于快速查找）
        // 注意：必须使用ID字段排序，因为Issue是字符串会导致排序错误
        console.log('📊 查询所有遗漏值数据...');
        const allMissingRecords = await DLTRedMissing.find({})
            .sort({ ID: 1 })  // 修改：使用ID字段排序
            .lean();

        console.log(`✅ 找到 ${allMissingRecords.length} 条遗漏值记录\n`);

        // 创建遗漏值数据的快速查找Map（Key: ID序号, Value: 遗漏值对象）
        const missingDataMap = new Map();
        allMissingRecords.forEach((record, index) => {
            // 使用ID字段作为key，确保能正确匹配
            missingDataMap.set(record.ID, record);
            // 同时也保存Issue作为备用key
            missingDataMap.set(record.Issue, record);
        });

        console.log('🚀 开始批量修复...\n');

        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;
        const batchSize = 100; // 每100条显示一次进度

        for (let i = 0; i < allRecords.length; i++) {
            const record = allRecords[i];
            const currentIssue = record.Issue;

            // 显示进度
            if ((i + 1) % batchSize === 0 || i === allRecords.length - 1) {
                console.log(`⏳ 进度: ${i + 1}/${allRecords.length} (${((i + 1) / allRecords.length * 100).toFixed(1)}%)`);
            }

            // 获取红球号码
            const redBalls = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5];

            // 热温冷比需要使用上一期的遗漏值数据
            // 遗漏值表中存储的是"开奖后"的遗漏值（当期号码遗漏值为0）
            // 所以要获取上一期的遗漏值数据
            let previousMissingData;
            if (i === 0) {
                // 第一期没有上一期，跳过
                console.warn(`  ⚠️  第一期 ${currentIssue} 没有上期遗漏值，跳过`);
                skipCount++;
                continue;
            }

            // 使用上一期的Issue查找遗漏值
            const previousIssue = allRecords[i - 1].Issue;
            previousMissingData = missingDataMap.get(String(previousIssue));

            if (!previousMissingData) {
                console.warn(`  ⚠️  上期 ${previousIssue} 找不到遗漏值数据，跳过`);
                skipCount++;
                continue;
            }

            // 计算热温冷比
            const hwcRatio = calculateHotWarmColdRatio(
                redBalls,
                previousMissingData
            );

            if (!hwcRatio) {
                errorCount++;
                continue;
            }

            // 更新数据库
            try {
                await hit_dlts.updateOne(
                    { Issue: currentIssue },
                    {
                        $set: {
                            'statistics.frontHotWarmColdRatio': hwcRatio
                        }
                    }
                );
                successCount++;
            } catch (updateError) {
                console.error(`  ❌ 更新期号 ${currentIssue} 失败:`, updateError.message);
                errorCount++;
            }
        }

        console.log('\n✅ 修复完成！\n');
        console.log('📈 统计结果:');
        console.log(`  - 总记录数: ${allRecords.length}`);
        console.log(`  - 修复成功: ${successCount}`);
        console.log(`  - 跳过: ${skipCount}`);
        console.log(`  - 失败: ${errorCount}`);

        // 验证修复结果
        console.log('\n🔍 验证修复结果...\n');
        await verifyFixedData();

        await mongoose.connection.close();
        console.log('\n✅ 数据库连接已关闭');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ 修复失败:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

/**
 * 验证修复后的数据
 */
async function verifyFixedData() {
    // 统计不同热温冷比的分布
    const allRecords = await hit_dlts.find({
        'statistics.frontHotWarmColdRatio': { $exists: true, $ne: null }
    })
    .select('statistics.frontHotWarmColdRatio')
    .lean();

    const distribution = {};
    allRecords.forEach(rec => {
        const ratio = rec.statistics.frontHotWarmColdRatio;
        distribution[ratio] = (distribution[ratio] || 0) + 1;
    });

    const sorted = Object.entries(distribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);

    console.log('TOP 15 热温冷比分布:');
    sorted.forEach(([ratio, count], index) => {
        const percentage = (count / allRecords.length * 100).toFixed(1);
        console.log(`  ${index + 1}. ${ratio}: ${count}次 (${percentage}%)`);
    });

    console.log(`\n总计: ${Object.keys(distribution).length} 种不同的热温冷比`);

    // 检查是否还有"0:0:5"占主导
    if (distribution['0:0:5'] && distribution['0:0:5'] > allRecords.length * 0.9) {
        console.warn('\n⚠️  警告: "0:0:5"仍然占比超过90%，可能修复不完整');
    } else {
        console.log('\n✅ 热温冷比分布正常，修复成功！');
    }
}

// 执行修复
fixHotWarmColdRatios();
