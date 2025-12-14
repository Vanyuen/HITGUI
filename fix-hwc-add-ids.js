/**
 * 为现有 HWC 表记录补充 target_id 和 base_id 字段
 */
const mongoose = require('mongoose');

async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    console.log('✅ 数据库连接成功\n');

    const hitDlts = mongoose.connection.db.collection('hit_dlts');
    const hwcCol = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    // 1. 构建 Issue -> ID 映射表
    console.log('📊 构建 Issue -> ID 映射表...');
    const allIssues = await hitDlts.find({}).project({ ID: 1, Issue: 1 }).toArray();
    const issueToId = new Map();
    allIssues.forEach(r => issueToId.set(r.Issue.toString(), r.ID));
    console.log(`   已加载 ${issueToId.size} 条映射关系\n`);

    // 2. 获取所有 HWC 记录
    console.log('📊 获取 HWC 表记录...');
    const hwcRecords = await hwcCol.find({}).project({ _id: 1, base_issue: 1, target_issue: 1, target_id: 1, base_id: 1 }).toArray();
    console.log(`   共 ${hwcRecords.length} 条记录\n`);

    // 3. 检查需要更新的记录
    let needUpdate = 0;
    let alreadyHasIds = 0;
    const updates = [];

    for (const r of hwcRecords) {
        if (r.target_id !== undefined && r.base_id !== undefined) {
            alreadyHasIds++;
            continue;
        }

        const targetId = issueToId.get(r.target_issue);
        const baseId = issueToId.get(r.base_issue);

        if (targetId !== undefined) {
            updates.push({
                updateOne: {
                    filter: { _id: r._id },
                    update: { 
                        $set: { 
                            target_id: targetId,
                            base_id: baseId || null  // base_id 可能为 null（第一期）
                        }
                    }
                }
            });
            needUpdate++;
        }
    }

    console.log(`📊 统计:`);
    console.log(`   已有ID字段: ${alreadyHasIds} 条`);
    console.log(`   需要更新: ${needUpdate} 条\n`);

    // 4. 批量更新
    if (updates.length > 0) {
        console.log('🔄 开始批量更新...');
        const batchSize = 1000;
        let updated = 0;

        for (let i = 0; i < updates.length; i += batchSize) {
            const batch = updates.slice(i, i + batchSize);
            const result = await hwcCol.bulkWrite(batch);
            updated += result.modifiedCount;
            console.log(`   已更新 ${updated}/${updates.length} 条`);
        }

        console.log(`\n✅ 更新完成! 共更新 ${updated} 条记录`);
    } else {
        console.log('✅ 无需更新，所有记录已有ID字段');
    }

    // 5. 验证结果
    console.log('\n📊 验证结果...');
    const sampleAfter = await hwcCol.findOne({}, { sort: { created_at: -1 } });
    console.log('   最新记录:');
    console.log('     base_issue:', sampleAfter.base_issue, '-> base_id:', sampleAfter.base_id);
    console.log('     target_issue:', sampleAfter.target_issue, '-> target_id:', sampleAfter.target_id);

    await mongoose.disconnect();
}

main().catch(e => {
    console.error('❌ 错误:', e);
    process.exit(1);
});
