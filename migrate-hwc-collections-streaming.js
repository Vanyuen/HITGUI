#!/usr/bin/env node

const mongoose = require('mongoose');

async function migrateHwcDataStreaming() {
    console.log('\n🔄 开始迁移热温冷优化表数据 (流式处理)\n');
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
        // ========== 步骤 1: 备份现有数据 (使用聚合管道) ==========
        console.log('\n步骤 1/7: 备份现有 Collection 2 (小写)');
        console.log('-'.repeat(80));

        const targetCount = await db.collection(targetCollection).countDocuments();
        console.log(`当前 Collection 2 记录数: ${targetCount}`);

        if (targetCount > 0) {
            console.log(`正在备份到: ${backupCollection}...`);

            // 使用聚合管道复制，避免内存问题
            await db.collection(targetCollection).aggregate([
                { $out: backupCollection }
            ]).toArray();

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

        // ========== 步骤 3: 复制数据 (分批流式处理) ==========
        console.log('\n步骤 3/7: 复制数据从 Collection 1 到 Collection 2');
        console.log('-'.repeat(80));

        const sourceCount = await db.collection(sourceCollection).countDocuments();
        console.log(`源数据记录数: ${sourceCount}`);

        if (sourceCount === 0) {
            throw new Error('❌ 源 Collection 为空！中止迁移');
        }

        console.log('正在分批复制数据...');

        const batchSize = 100;  // 每批100条
        let insertedCount = 0;

        const cursor = db.collection(sourceCollection).find({}).batchSize(batchSize);

        let batch = [];

        while (await cursor.hasNext()) {
            const doc = await cursor.next();

            // 移除 _id 字段让 MongoDB 生成新的
            const { _id, ...rest } = doc;
            batch.push(rest);

            // 当批次达到指定大小时，执行插入
            if (batch.length >= batchSize) {
                await db.collection(targetCollection).insertMany(batch);
                insertedCount += batch.length;

                const progress = ((insertedCount / sourceCount) * 100).toFixed(1);
                console.log(`  进度: ${insertedCount}/${sourceCount} (${progress}%)`);

                batch = [];  // 清空批次
            }
        }

        // 插入剩余的数据
        if (batch.length > 0) {
            await db.collection(targetCollection).insertMany(batch);
            insertedCount += batch.length;
            console.log(`  进度: ${insertedCount}/${sourceCount} (100.0%)`);
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

        // ========== 步骤 6: 清理旧备份 ==========
        console.log('\n步骤 6/7: 列出备份');
        console.log('-'.repeat(80));

        const allCollections = await db.listCollections().toArray();
        const backups = allCollections.filter(c =>
            c.name.startsWith('hit_dlt_redcombinationshotwarmcoldoptimizeds_backup_')
        );

        console.log(`当前备份数量: ${backups.length}`);
        backups.forEach(b => {
            const timestamp = b.name.split('_backup_')[1];
            const date = new Date(parseInt(timestamp));
            console.log(`  - ${b.name} (${date.toLocaleString()})`);
        });

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
        console.log(`  如果需要恢复，可以从备份 ${backupCollection} 恢复数据`);

        await mongoose.disconnect();
        process.exit(1);
    }
}

migrateHwcDataStreaming().catch(error => {
    console.error('❌ 脚本执行失败:', error);
    process.exit(1);
});
