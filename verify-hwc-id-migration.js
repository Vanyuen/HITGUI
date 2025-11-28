/**
 * 验证脚本：检查热温冷优化表ID字段迁移结果
 */

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function verify() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 已连接到MongoDB\n');
        console.log(`${'='.repeat(60)}`);
        console.log('验证热温冷优化表ID字段迁移结果');
        console.log(`${'='.repeat(60)}\n`);

        const HwcOptimized = mongoose.model('HwcOptimized',
            new mongoose.Schema({}, { strict: false }),
            'hit_dlt_redcombinationshotwarmcoldoptimizeds'
        );

        // 1. 统计总数
        const totalCount = await HwcOptimized.countDocuments();
        console.log(`📊 总记录数: ${totalCount}`);

        // 2. 统计有ID字段的记录
        const withBothIds = await HwcOptimized.countDocuments({
            base_id: { $exists: true, $ne: null },
            target_id: { $exists: true, $ne: null }
        });

        const withBaseIdOnly = await HwcOptimized.countDocuments({
            base_id: { $exists: true, $ne: null },
            target_id: { $exists: false }
        });

        const withTargetIdOnly = await HwcOptimized.countDocuments({
            base_id: { $exists: false },
            target_id: { $exists: true, $ne: null }
        });

        const withoutIds = await HwcOptimized.countDocuments({
            base_id: { $exists: false },
            target_id: { $exists: false }
        });

        console.log(`\n📊 ID字段统计:`);
        console.log(`  ✅ 两个ID都有: ${withBothIds}条 (${(withBothIds / totalCount * 100).toFixed(1)}%)`);
        console.log(`  ⚠️ 只有base_id: ${withBaseIdOnly}条`);
        console.log(`  ⚠️ 只有target_id: ${withTargetIdOnly}条`);
        console.log(`  ❌ 两个都没有: ${withoutIds}条`);

        // 3. 检查ID的有效性
        console.log(`\n📊 ID有效性检查:`);

        // 检查是否有null或0的ID
        const nullBaseIds = await HwcOptimized.countDocuments({
            base_id: { $in: [null, 0] }
        });

        const nullTargetIds = await HwcOptimized.countDocuments({
            target_id: { $in: [null, 0] }
        });

        console.log(`  base_id为null/0: ${nullBaseIds}条`);
        console.log(`  target_id为null/0: ${nullTargetIds}条`);

        // 4. 样本检查（前5条和后5条）
        console.log(`\n📊 样本数据检查:`);

        const firstSamples = await HwcOptimized.find({ base_id: { $exists: true } })
            .sort({ base_id: 1, target_id: 1 })
            .limit(5)
            .lean();

        console.log('\n  前5条记录:');
        firstSamples.forEach((sample, index) => {
            console.log(`    [${index + 1}] ${sample.base_issue}(ID=${sample.base_id}) → ${sample.target_issue}(ID=${sample.target_id})`);
        });

        const lastSamples = await HwcOptimized.find({ base_id: { $exists: true } })
            .sort({ base_id: -1, target_id: -1 })
            .limit(5)
            .lean();

        console.log('\n  后5条记录:');
        lastSamples.forEach((sample, index) => {
            console.log(`    [${index + 1}] ${sample.base_issue}(ID=${sample.base_id}) → ${sample.target_issue}(ID=${sample.target_id})`);
        });

        // 5. 检查连续性
        console.log(`\n📊 ID连续性检查:`);

        const allWithIds = await HwcOptimized.find({
            base_id: { $exists: true },
            target_id: { $exists: true }
        })
            .select('base_issue target_issue base_id target_id')
            .sort({ base_id: 1, target_id: 1 })
            .lean();

        let expectedBase = null;
        let expectedTarget = null;
        let discontinuities = 0;

        for (let i = 0; i < allWithIds.length; i++) {
            const record = allWithIds[i];

            if (expectedBase !== null && expectedTarget !== null) {
                // 检查是否符合预期（target = base + 1）
                if (record.target_id !== record.base_id + 1) {
                    console.log(`  ⚠️ 不连续: ${record.base_issue}(ID=${record.base_id}) → ${record.target_issue}(ID=${record.target_id})`);
                    discontinuities++;
                }
            }

            expectedBase = record.base_id;
            expectedTarget = record.target_id;
        }

        if (discontinuities === 0) {
            console.log(`  ✅ ID连续性完美（target_id = base_id + 1）`);
        } else {
            console.log(`  ⚠️ 发现${discontinuities}处不连续`);
        }

        // 6. 最终结论
        console.log(`\n${'='.repeat(60)}`);
        if (withBothIds === totalCount && nullBaseIds === 0 && nullTargetIds === 0) {
            console.log('✅ 验证通过！所有记录都有有效的ID字段');
            console.log('✅ 可以安全使用ID索引进行查询');
        } else {
            console.log('⚠️ 验证未完全通过，部分记录可能需要修复');
            console.log(`   有ID的记录: ${withBothIds}/${totalCount}`);
            console.log(`   缺少ID的记录: ${totalCount - withBothIds}`);
        }
        console.log(`${'='.repeat(60)}`);

    } catch (error) {
        console.error('❌ 验证失败:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n已断开MongoDB连接');
    }
}

verify();
