/**
 * 热温冷优化表数据迁移脚本
 *
 * 目的：为现有数据添加新字段并修正推算期 target_id
 *
 * 新增字段：
 * - base_id: Number (基准期ID)
 * - target_id: Number (目标期ID，推算期使用 latest_ID + 1)
 * - is_predicted: Boolean (推算期标识，主要判断依据)
 * - version: Number (数据版本号，默认2)
 * - last_updated: Date (最后更新时间)
 *
 * 使用方式：
 * node migrate-hwc-optimized-schema.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

// 连接数据库
async function connectDB() {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lottery';
    await mongoose.connect(mongoURI);
    console.log('✅ 数据库连接成功\n');
}

// hit_dlts Schema
const dltSchema = new mongoose.Schema({
    ID: { type: Number, required: true },
    Issue: { type: Number, required: true },
    Red1: Number,
    Red2: Number,
    Red3: Number,
    Red4: Number,
    Red5: Number,
    Blue1: Number,
    Blue2: Number
}, { collection: 'hit_dlts', strict: false });

const hit_dlts = mongoose.model('hit_dlts_migration', dltSchema);

// 热温冷优化表 Schema
const hwcOptimizedSchema = new mongoose.Schema({
    base_issue: String,
    target_issue: String,
    base_id: Number,
    target_id: Number,
    is_predicted: Boolean,
    hot_warm_cold_data: Object,
    hit_analysis: Object,
    statistics: Object,
    version: Number,
    last_updated: Date,
    created_at: Date
}, { collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds', strict: false });

const HwcOptimized = mongoose.model('HwcOptimized_migration', hwcOptimizedSchema);

/**
 * 主迁移函数
 */
async function migrateHwcOptimizedData() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🚀 开始迁移热温冷优化表数据');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const startTime = Date.now();

    try {
        // ========================================
        // 步骤1: 构建 Issue → ID 映射
        // ========================================
        console.log('📊 步骤1/4: 构建 Issue → ID 映射...\n');

        const dltRecords = await hit_dlts.find({}).sort({ ID: 1 }).lean();
        console.log(`   找到 ${dltRecords.length} 期数据\n`);

        if (dltRecords.length === 0) {
            throw new Error('hit_dlts 表为空，无法构建映射');
        }

        const issueToIdMap = new Map();
        dltRecords.forEach(record => {
            issueToIdMap.set(record.Issue.toString(), record.ID);
        });

        const latestId = Math.max(...issueToIdMap.values());
        const latestIssue = dltRecords[dltRecords.length - 1].Issue;

        console.log(`   最新期号: ${latestIssue}, 最新ID: ${latestId}\n`);

        // ========================================
        // 步骤2: 统计记录数量
        // ========================================
        console.log('📊 步骤2/4: 统计热温冷优化表记录数...\n');

        const totalCount = await HwcOptimized.countDocuments({});
        console.log(`   找到 ${totalCount} 条记录\n`);

        if (totalCount === 0) {
            console.log('⚠️  热温冷优化表为空，无需迁移\n');
            return;
        }

        // ========================================
        // 步骤3: 分批更新记录（避免内存溢出）
        // ========================================
        console.log('📊 步骤3/4: 分批更新记录...\n');

        let updatedCount = 0;
        let predictedCount = 0;
        let drawnCount = 0;
        let errorCount = 0;
        const batchSize = 100; // 每次处理100条

        for (let skip = 0; skip < totalCount; skip += batchSize) {
            // 分批查询（只查询必要字段）
            const batch = await HwcOptimized.find({})
                .select('_id base_issue target_issue')
                .skip(skip)
                .limit(batchSize)
                .lean();

            // 批量更新操作
            const bulkOps = [];

            for (const record of batch) {
                try {
                    const baseIssue = record.base_issue;
                    const targetIssue = record.target_issue;

                    // 获取 base_id
                    const baseId = issueToIdMap.get(baseIssue) || 0;

                    // 判断是否为推算期
                    const targetIdFromMap = issueToIdMap.get(targetIssue);
                    let targetId;
                    let isPredicted;

                    if (targetIdFromMap) {
                        // 已开奖期
                        targetId = targetIdFromMap;
                        isPredicted = false;
                        drawnCount++;
                    } else {
                        // 推算期：使用 latestId + 1
                        targetId = latestId + 1;
                        isPredicted = true;
                        predictedCount++;
                    }

                    // 添加到批量操作
                    bulkOps.push({
                        updateOne: {
                            filter: { _id: record._id },
                            update: {
                                $set: {
                                    base_id: baseId,
                                    target_id: targetId,
                                    is_predicted: isPredicted,
                                    version: 2,
                                    last_updated: new Date()
                                }
                            }
                        }
                    });

                    updatedCount++;

                } catch (error) {
                    console.error(`   ❌ 处理失败 - base: ${record.base_issue}, target: ${record.target_issue}: ${error.message}`);
                    errorCount++;
                }
            }

            // 执行批量更新
            if (bulkOps.length > 0) {
                await HwcOptimized.bulkWrite(bulkOps);
            }

            // 输出进度
            console.log(`   进度: ${updatedCount}/${totalCount} (${((updatedCount / totalCount) * 100).toFixed(1)}%)`);
        }

        console.log(`\n✅ 步骤3完成！`);
        console.log(`   更新记录: ${updatedCount}条`);
        console.log(`   已开奖期: ${drawnCount}条`);
        console.log(`   推算期: ${predictedCount}条`);
        console.log(`   错误: ${errorCount}条\n`);

        // ========================================
        // 步骤4: 验证迁移结果
        // ========================================
        console.log('📊 步骤4/4: 验证迁移结果...\n');

        // 检查是否有 target_id = 0 的记录（应该没有）
        const zeroIdCount = await HwcOptimized.countDocuments({ target_id: 0 });
        console.log(`   target_id=0 的记录数: ${zeroIdCount} ${zeroIdCount === 0 ? '✅' : '❌'}`);

        // 检查推算期记录
        const predictedRecords = await HwcOptimized.find({ is_predicted: true })
            .limit(5)
            .lean();

        console.log(`\n   推算期记录示例:`);
        for (const record of predictedRecords) {
            console.log(`     - ${record.base_issue} → ${record.target_issue}, target_id=${record.target_id}, is_predicted=${record.is_predicted}`);
        }

        // 检查已开奖期记录
        const drawnSample = await HwcOptimized.find({ is_predicted: false })
            .limit(3)
            .lean();

        console.log(`\n   已开奖期记录示例:`);
        for (const record of drawnSample) {
            const targetExists = await hit_dlts.findOne({ Issue: parseInt(record.target_issue) });
            console.log(`     - ${record.base_issue} → ${record.target_issue}, target_id=${record.target_id}, 期号存在=${!!targetExists}`);
        }

        // 检查 ID 连续性
        console.log(`\n   ID连续性检查:`);
        console.log(`     最新数据库ID: ${latestId}`);

        const predictedTargetIds = predictedRecords.map(r => r.target_id);
        const expectedId = latestId + 1;

        console.log(`     推算期 target_id: ${predictedTargetIds.join(', ')}`);
        console.log(`     预期值: ${expectedId}`);

        const isConsistent = predictedTargetIds.every(id => id === expectedId);
        console.log(`     一致性: ${isConsistent ? '✅ 通过' : '❌ 失败'}\n`);

        // ========================================
        // 总结
        // ========================================
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('✅ 迁移完成！');
        console.log('═══════════════════════════════════════════════════════════════\n');
        console.log(`   总耗时: ${duration}秒`);
        console.log(`   更新记录: ${updatedCount}条`);
        console.log(`   已开奖期: ${drawnCount}条`);
        console.log(`   推算期: ${predictedCount}条`);
        console.log(`   错误: ${errorCount}条`);
        console.log(`   target_id=0: ${zeroIdCount}条`);
        console.log(`   ID一致性: ${isConsistent ? '✅ 通过' : '❌ 失败'}\n`);

        if (zeroIdCount > 0 || !isConsistent) {
            console.log('⚠️  发现问题，请检查数据！\n');
        } else {
            console.log('🎉 数据迁移成功，所有检查通过！\n');
        }

    } catch (error) {
        console.error('❌ 迁移失败:', error);
        throw error;
    }
}

// 执行迁移
async function main() {
    try {
        await connectDB();
        await migrateHwcOptimizedData();
    } catch (error) {
        console.error('❌ 执行失败:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('数据库连接已关闭');
    }
}

main();
