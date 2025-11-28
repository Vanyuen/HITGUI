#!/usr/bin/env node

const mongoose = require('mongoose');

async function migrateHwcData() {
    console.log('\n🔄 开始迁移热温冷优化表数据\n');
    console.log('='.repeat(80));
    console.log('迁移计划:');
    console.log('  源: HIT_DLT_RedCombinationsHotWarmColdOptimized (大写, 2791条)');
    console.log('  目标: hit_dlt_redcombinationshotwarmcoldoptimizeds (小写, 服务端使用)');
    console.log('='.repeat(80));

    await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    const db = mongoose.connection.db;

    const sourceCollection = 'HIT_DLT_RedCombinationsHotWarmColdOptimized';  // 大写
    const targetCollection = 'hit_dlt_redcombinationshotwarmcoldoptimizeds';  // 小写
    const backupCollection = 'hit_dlt_redcombinationshotwarmcoldoptimizeds_backup_' + Date.now();

    try {
        // ========== 步骤 1: 备份现有数据 ==========
        console.log('\n步骤 1/7: 备份现有 Collection 2 (小写)');
        console.log('-'.repeat(80));

        const targetCount = await db.collection(targetCollection).countDocuments();
        console.log(`当前 Collection 2 记录数: ${targetCount}`);

        if (targetCount > 0) {
            console.log(`正在备份到: ${backupCollection}...`);

            const targetData = await db.collection(targetCollection).find({}).toArray();
            await db.collection(backupCollection).insertMany(targetData);

            const backupCount = await db.collection(backupCollection).countDocuments();
            console.log(`✅ 备份完成: ${backupCount} 条记录`);
        } else {
            console.log('⚠️  Collection 2 为空，跳过备份');
        }

        // ========== 步骤 2: 清空目标 Collection ==========
        console.log('\n步骤 2/7: 清空 Collection 2 (小写)');
        console.log('-'.repeat(80));

        const deleteResult = await db.collection(targetCollection).deleteMany({});
        console.log(`✅ 删除 ${deleteResult.deletedCount} 条旧记录`);

        // ========== 步骤 3: 复制数据 ==========
        console.log('\n步骤 3/7: 复制数据从 Collection 1 到 Collection 2');
        console.log('-'.repeat(80));

        const sourceCount = await db.collection(sourceCollection).countDocuments();
        console.log(`源数据记录数: ${sourceCount}`);

        if (sourceCount === 0) {
            throw new Error('❌ 源 Collection 为空！中止迁移');
        }

        console.log('正在读取源数据...');
        const sourceData = await db.collection(sourceCollection).find({}).toArray();

        console.log('正在写入目标 Collection...');

        // 分批插入以避免内存问题
        const batchSize = 500;
        let insertedCount = 0;

        for (let i = 0; i < sourceData.length; i += batchSize) {
            const batch = sourceData.slice(i, i + batchSize);

            // 移除 _id 字段让 MongoDB 生成新的
            const cleanedBatch = batch.map(doc => {
                const { _id, ...rest } = doc;
                return rest;
            });

            await db.collection(targetCollection).insertMany(cleanedBatch);
            insertedCount += cleanedBatch.length;

            const progress = ((insertedCount / sourceData.length) * 100).toFixed(1);
            console.log(`  进度: ${insertedCount}/${sourceData.length} (${progress}%)`);
        }

        console.log(`✅ 复制完成: ${insertedCount} 条记录`);

        // ========== 步骤 4: 验证数据完整性 ==========
        console.log('\n步骤 4/7: 验证数据完整性');
        console.log('-'.repeat(80));

        const newTargetCount = await db.collection(targetCollection).countDocuments();
        console.log(`目标 Collection 记录数: ${newTargetCount}`);

        if (newTargetCount !== sourceCount) {
            throw new Error(`❌ 记录数不匹配！源=${sourceCount}, 目标=${newTargetCount}`);
        }

        // 检查期号25124
        const target25124 = await db.collection(targetCollection).findOne({ target_issue: '25124' });
        if (!target25124) {
            throw new Error('❌ 验证失败：未找到期号25124');
        }

        if (!target25124.hot_warm_cold_data) {
            throw new Error('❌ 验证失败：期号25124缺少 hot_warm_cold_data 字段');
        }

        const ratios = Object.keys(target25124.hot_warm_cold_data);
        const withWarm = ratios.filter(r => {
            const [h, w, c] = r.split(':').map(Number);
            return w > 0;
        });

        console.log(`✅ 期号25124验证通过:`);
        console.log(`   - 比例种类: ${ratios.length}`);
        console.log(`   - 含温号比例: ${withWarm.length}`);
        console.log(`   - 4:1:0组合数: ${target25124.hot_warm_cold_data['4:1:0']?.length || 0}`);

        // 抽样检查5条记录
        console.log('\n抽样检查数据质量 (随机5条):');
        const samples = await db.collection(targetCollection).aggregate([
            { $sample: { size: 5 } }
        ]).toArray();

        let validCount = 0;
        for (const record of samples) {
            const hasData = record.hot_warm_cold_data && Object.keys(record.hot_warm_cold_data).length > 0;
            if (hasData) validCount++;
            console.log(`  ${record.base_issue}→${record.target_issue}: ${hasData ? '✅ 有数据' : '❌ 无数据'}`);
        }

        console.log(`\n抽样结果: ${validCount}/5 包含热温冷数据`);

        if (validCount === 0) {
            throw new Error('❌ 验证失败：抽样数据全部缺失热温冷字段');
        }

        // ========== 步骤 5: 删除源 Collection ==========
        console.log('\n步骤 5/7: 删除源 Collection 1 (大写)');
        console.log('-'.repeat(80));

        await db.collection(sourceCollection).drop();
        console.log(`✅ 已删除 ${sourceCollection}`);

        // ========== 步骤 6: 删除旧备份 ==========
        console.log('\n步骤 6/7: 清理旧备份');
        console.log('-'.repeat(80));

        const allCollections = await db.listCollections().toArray();
        const oldBackups = allCollections.filter(c =>
            c.name.startsWith('hit_dlt_redcombinationshotwarmcoldoptimizeds_backup_') &&
            c.name !== backupCollection
        );

        if (oldBackups.length > 0) {
            console.log(`找到 ${oldBackups.length} 个旧备份:`);
            for (const backup of oldBackups) {
                console.log(`  - ${backup.name}`);
            }
            console.log('保留最新备份，可以手动删除旧备份');
        } else {
            console.log('✅ 无旧备份需要清理');
        }

        // ========== 步骤 7: 最终验证 ==========
        console.log('\n步骤 7/7: 最终验证');
        console.log('-'.repeat(80));

        const finalCount = await db.collection(targetCollection).countDocuments();
        console.log(`✅ 目标 Collection 记录数: ${finalCount}`);

        // 检查是否存在源 Collection
        const collections = await db.listCollections({ name: sourceCollection }).toArray();
        if (collections.length === 0) {
            console.log(`✅ 源 Collection 已删除`);
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ 数据迁移完成！');
        console.log('='.repeat(80));
        console.log(`\n总结:`);
        console.log(`  ✅ 迁移记录数: ${finalCount}`);
        console.log(`  ✅ 目标 Collection: ${targetCollection}`);
        console.log(`  ✅ 备份位置: ${backupCollection}`);
        console.log(`  ✅ 数据验证: 通过`);
        console.log(`\n下一步: 修改 generate-hwc-optimized-table.js 使用小写 collection 名称\n`);

        await mongoose.disconnect();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ 迁移失败:', error.message);
        console.error('错误详情:', error);

        console.log('\n恢复操作:');
        console.log(`  如果需要恢复，运行以下命令:`);
        console.log(`  db.${backupCollection}.find().forEach(doc => db.${targetCollection}.insert(doc))`);

        await mongoose.disconnect();
        process.exit(1);
    }
}

migrateHwcData().catch(error => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
});
