/**
 * 详细检查热温冷优化表字段和生成时间
 */

const mongoose = require('mongoose');

async function checkHwcOptimizedTableDetails() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 已连接到 MongoDB');

        const db = mongoose.connection.db;

        // 1. 确认正表名称
        const correctCollName = 'hit_dlt_redcombinationshotwarmcoldoptimizeds';
        console.log('\n========================================');
        console.log(`📊 检查正表: ${correctCollName}`);
        console.log('========================================');

        const coll = db.collection(correctCollName);

        // 2. 获取集合统计信息
        const stats = await db.command({ collStats: correctCollName });
        console.log('\n集合统计信息:');
        console.log(`  总记录数: ${stats.count}`);
        console.log(`  存储大小: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  平均文档大小: ${(stats.avgObjSize / 1024).toFixed(2)} KB`);

        // 3. 查看最新记录的所有字段
        console.log('\n========================================');
        console.log('📋 最新记录的完整字段结构');
        console.log('========================================');

        const latestDoc = await coll.findOne({}, { sort: { _id: -1 } });
        if (latestDoc) {
            console.log('\nObjectId 时间戳:', latestDoc._id.getTimestamp());
            console.log('记录生成时间:', latestDoc._id.getTimestamp().toLocaleString('zh-CN'));

            console.log('\n所有字段:');
            const allFields = Object.keys(latestDoc);
            allFields.forEach(field => {
                const value = latestDoc[field];
                const type = typeof value;
                const displayValue = type === 'object' && value !== null
                    ? `{...} (${Object.keys(value).length}个键)`
                    : value;
                console.log(`  - ${field}: ${displayValue} (${type})`);
            });

            console.log('\n详细字段值:');
            console.log(`  base_issue: "${latestDoc.base_issue}" (${typeof latestDoc.base_issue})`);
            console.log(`  target_issue: "${latestDoc.target_issue}" (${typeof latestDoc.target_issue})`);
            console.log(`  base_id: ${latestDoc.base_id} (${typeof latestDoc.base_id})`);
            console.log(`  target_id: ${latestDoc.target_id} (${typeof latestDoc.target_id})`);
            console.log(`  is_predicted: ${latestDoc.is_predicted} (${typeof latestDoc.is_predicted})`);

            if (latestDoc.created_at) {
                console.log(`  created_at: ${latestDoc.created_at.toLocaleString('zh-CN')}`);
            }
            if (latestDoc.updated_at) {
                console.log(`  updated_at: ${latestDoc.updated_at.toLocaleString('zh-CN')}`);
            }
        }

        // 4. 检查备份表（对比）
        console.log('\n========================================');
        console.log('📦 检查备份表（对比）');
        console.log('========================================');

        const backupCollName = 'hit_dlt_redcombinationshotwarmcoldoptimizeds_backup_1763989056187';
        const backupColl = db.collection(backupCollName);

        const backupCount = await backupColl.countDocuments();
        console.log(`备份表记录数: ${backupCount}`);

        const backupDoc = await backupColl.findOne({}, { sort: { _id: -1 } });
        if (backupDoc) {
            console.log('\n备份表最新记录时间:', backupDoc._id.getTimestamp().toLocaleString('zh-CN'));
            console.log('备份表字段:');
            const backupFields = Object.keys(backupDoc);
            backupFields.forEach(field => {
                const value = backupDoc[field];
                const type = typeof value;
                const displayValue = type === 'object' && value !== null
                    ? `{...}`
                    : value;
                console.log(`  - ${field}: ${displayValue} (${type})`);
            });

            console.log('\n备份表是否有新字段:');
            console.log(`  base_id: ${backupDoc.base_id !== undefined ? '✅ 有' : '❌ 无'}`);
            console.log(`  target_id: ${backupDoc.target_id !== undefined ? '✅ 有' : '❌ 无'}`);
            console.log(`  is_predicted: ${backupDoc.is_predicted !== undefined ? '✅ 有' : '❌ 无'}`);
        }

        // 5. 随机抽样检查（确认是否整个表都缺少字段）
        console.log('\n========================================');
        console.log('🎲 随机抽样检查（10条记录）');
        console.log('========================================');

        const samples = await coll.aggregate([
            { $sample: { size: 10 } }
        ]).toArray();

        let hasBaseIdCount = 0;
        let hasTargetIdCount = 0;
        let hasIsPredictedCount = 0;

        samples.forEach((doc, i) => {
            if (doc.base_id !== undefined) hasBaseIdCount++;
            if (doc.target_id !== undefined) hasTargetIdCount++;
            if (doc.is_predicted !== undefined) hasIsPredictedCount++;

            console.log(`\n样本 #${i + 1}: ${doc.base_issue} → ${doc.target_issue}`);
            console.log(`  base_id: ${doc.base_id !== undefined ? doc.base_id : 'undefined'}`);
            console.log(`  target_id: ${doc.target_id !== undefined ? doc.target_id : 'undefined'}`);
            console.log(`  is_predicted: ${doc.is_predicted !== undefined ? doc.is_predicted : 'undefined'}`);
        });

        console.log('\n抽样统计:');
        console.log(`  有 base_id 字段: ${hasBaseIdCount}/10`);
        console.log(`  有 target_id 字段: ${hasTargetIdCount}/10`);
        console.log(`  有 is_predicted 字段: ${hasIsPredictedCount}/10`);

        // 6. 检查索引
        console.log('\n========================================');
        console.log('📑 检查索引');
        console.log('========================================');

        const indexes = await coll.indexes();
        console.log(`索引数量: ${indexes.length}`);
        indexes.forEach(idx => {
            console.log(`\n索引名: ${idx.name}`);
            console.log(`  键: ${JSON.stringify(idx.key)}`);
            if (idx.unique) console.log(`  唯一索引: ✅`);
        });

        // 7. 检查生成脚本（如果存在）
        console.log('\n========================================');
        console.log('🔍 生成信息推断');
        console.log('========================================');

        // 通过 ObjectId 时间戳判断生成时间
        const oldestDoc = await coll.findOne({}, { sort: { _id: 1 } });
        const newestDoc = await coll.findOne({}, { sort: { _id: -1 } });

        if (oldestDoc && newestDoc) {
            const oldestTime = oldestDoc._id.getTimestamp();
            const newestTime = newestDoc._id.getTimestamp();

            console.log(`最早记录生成时间: ${oldestTime.toLocaleString('zh-CN')}`);
            console.log(`最新记录生成时间: ${newestTime.toLocaleString('zh-CN')}`);

            const timeDiff = newestTime - oldestTime;
            const hours = Math.floor(timeDiff / 1000 / 60 / 60);
            const minutes = Math.floor((timeDiff / 1000 / 60) % 60);
            console.log(`生成时间跨度: ${hours}小时${minutes}分钟`);

            // 判断是否是批量生成
            if (timeDiff < 3600000) { // 1小时内
                console.log('✅ 看起来是批量生成的（所有记录在1小时内生成）');
            } else {
                console.log('⚠️ 看起来是增量生成的（生成时间跨度较大）');
            }
        }

        // 8. 对比正表和备份表的差异
        console.log('\n========================================');
        console.log('🔄 正表 vs 备份表对比');
        console.log('========================================');

        console.log(`正表记录数: ${stats.count}`);
        console.log(`备份表记录数: ${backupCount}`);
        console.log(`差异: ${Math.abs(stats.count - backupCount)} 条`);

        if (latestDoc && backupDoc) {
            console.log('\n正表最新记录时间:', latestDoc._id.getTimestamp().toLocaleString('zh-CN'));
            console.log('备份表最新记录时间:', backupDoc._id.getTimestamp().toLocaleString('zh-CN'));

            const isNewer = latestDoc._id.getTimestamp() > backupDoc._id.getTimestamp();
            console.log(`正表是否更新: ${isNewer ? '✅ 是（正表更新）' : '❌ 否（备份表更新或相同）'}`);
        }

        // 9. 最终结论
        console.log('\n========================================');
        console.log('📝 诊断结论');
        console.log('========================================');

        const hasNewFields = hasBaseIdCount > 0 || hasTargetIdCount > 0 || hasIsPredictedCount > 0;

        if (!hasNewFields) {
            console.log('❌ 正表缺少新字段 (base_id, target_id, is_predicted)');
            console.log('\n可能的原因:');
            console.log('  1. 使用了旧版本的生成脚本');
            console.log('  2. 正表没有被重新生成，而是使用了旧数据');
            console.log('  3. 生成脚本中没有包含这些新字段');

            console.log('\n建议解决方案:');
            console.log('  1. 检查生成脚本是否包含 base_id, target_id, is_predicted 字段');
            console.log('  2. 重新运行生成脚本');
            console.log('  3. 或者：编写迁移脚本，为现有数据添加缺失字段');
        } else {
            console.log('✅ 正表包含新字段');
            console.log(`  base_id 覆盖率: ${hasBaseIdCount * 10}%（基于抽样）`);
            console.log(`  target_id 覆盖率: ${hasTargetIdCount * 10}%（基于抽样）`);
            console.log(`  is_predicted 覆盖率: ${hasIsPredictedCount * 10}%（基于抽样）`);
        }

    } catch (error) {
        console.error('❌ 错误:', error);
        console.error('错误堆栈:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n已断开数据库连接');
    }
}

checkHwcOptimizedTableDetails();
