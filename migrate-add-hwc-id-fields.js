/**
 * 迁移脚本：为热温冷优化表补充ID字段
 * 目的：为现有2792条记录添加 base_id 和 target_id 字段
 * 时间：预计10-15分钟
 */

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function migrate() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 已连接到MongoDB\n');

        // 1. 获取hit_dlts的Issue→ID映射
        console.log('📊 步骤1: 构建Issue→ID映射...');
        const hit_dlts = mongoose.model('hit_dlts', new mongoose.Schema({}, { strict: false }));
        const allIssues = await hit_dlts.find().select('Issue ID').lean();

        const issueToIdMap = new Map();
        allIssues.forEach(record => {
            issueToIdMap.set(record.Issue.toString(), record.ID);
        });
        console.log(`  ✅ 构建完成: ${issueToIdMap.size}个期号\n`);

        // 2. 获取所有优化表记录
        console.log('📊 步骤2: 加载优化表数据...');
        const HwcOptimized = mongoose.model('HwcOptimized',
            new mongoose.Schema({}, { strict: false }),
            'hit_dlt_redcombinationshotwarmcoldoptimizeds'
        );

        const records = await HwcOptimized.find().lean();
        console.log(`  ✅ 找到${records.length}条记录需要更新\n`);

        // 3. 批量更新记录
        console.log('📊 步骤3: 批量更新ID字段...\n');
        let updatedCount = 0;
        let skippedCount = 0;
        const startTime = Date.now();

        for (let i = 0; i < records.length; i++) {
            const record = records[i];
            const base_id = issueToIdMap.get(record.base_issue);
            const target_id = issueToIdMap.get(record.target_issue);

            if (base_id && target_id) {
                await HwcOptimized.updateOne(
                    { _id: record._id },
                    { $set: { base_id, target_id } }
                );
                updatedCount++;

                // 每100条显示进度
                if ((updatedCount % 100 === 0) || (updatedCount === records.length)) {
                    const progress = (updatedCount / records.length * 100).toFixed(1);
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    console.log(`  进度: ${updatedCount}/${records.length} (${progress}%) - 耗时${elapsed}秒`);
                }
            } else {
                console.log(`  ⚠️ 跳过: ${record.base_issue}→${record.target_issue} (找不到对应的ID)`);
                skippedCount++;
            }
        }

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log(`\n${'='.repeat(60)}`);
        console.log('✅ 迁移完成！');
        console.log(`${'='.repeat(60)}`);
        console.log(`  更新成功: ${updatedCount}条`);
        console.log(`  跳过: ${skippedCount}条`);
        console.log(`  总耗时: ${totalTime}秒`);
        console.log(`${'='.repeat(60)}\n`);

        // 4. 验证结果
        console.log('📊 步骤4: 验证迁移结果...');
        const withIdCount = await HwcOptimized.countDocuments({
            base_id: { $exists: true, $ne: null },
            target_id: { $exists: true, $ne: null }
        });

        const totalCount = await HwcOptimized.countDocuments();
        const coverage = (withIdCount / totalCount * 100).toFixed(1);

        console.log(`  总记录数: ${totalCount}`);
        console.log(`  有ID字段: ${withIdCount}`);
        console.log(`  覆盖率: ${coverage}%`);

        if (withIdCount === totalCount) {
            console.log(`  ✅ 完美！所有记录都有ID字段\n`);
        } else {
            console.log(`  ⚠️ 警告：${totalCount - withIdCount}条记录没有ID字段\n`);
        }

        // 5. 显示样本数据
        console.log('📊 步骤5: 样本数据检查...');
        const sample = await HwcOptimized.findOne({ base_id: { $exists: true } }).lean();
        if (sample) {
            console.log('  样本数据:');
            console.log(`    base_issue: "${sample.base_issue}", base_id: ${sample.base_id}`);
            console.log(`    target_issue: "${sample.target_issue}", target_id: ${sample.target_id}`);
            console.log(`    hot_warm_cold_data字段: ${Object.keys(sample.hot_warm_cold_data || {}).length}种比例`);
        }

        console.log('\n🎉 迁移成功！可以重启服务器应用修复。');

    } catch (error) {
        console.error('❌ 迁移失败:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n已断开MongoDB连接');
    }
}

migrate();
