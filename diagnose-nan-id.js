/**
 * 诊断 hit_dlts 表 ID 字段问题
 * 运行: node diagnose-nan-id.js
 */
const mongoose = require('mongoose');

async function diagnose() {
    console.log('🔍 连接数据库...');
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;
    const collection = db.collection('hit_dlts');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 诊断 hit_dlts 表 ID 字段问题');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 1. 获取总记录数
    const totalCount = await collection.countDocuments();
    console.log(`📊 总记录数: ${totalCount}\n`);

    // 2. 检查 ID 字段类型分布
    const allRecords = await collection.find({}).project({ _id: 1, ID: 1, Issue: 1 }).toArray();

    const problems = [];
    const typeStats = { number: 0, NaN: 0, null: 0, undefined: 0, other: 0 };

    allRecords.forEach(r => {
        if (r.ID === null) {
            typeStats.null++;
            problems.push(r);
        } else if (r.ID === undefined) {
            typeStats.undefined++;
            problems.push(r);
        } else if (typeof r.ID === 'number') {
            if (Number.isNaN(r.ID)) {
                typeStats.NaN++;
                problems.push(r);
            } else {
                typeStats.number++;
            }
        } else {
            typeStats.other++;
            problems.push(r);
        }
    });

    console.log('📈 ID 字段类型分布:');
    console.log(`   ✅ 有效数字: ${typeStats.number} 条`);
    if (typeStats.NaN > 0) console.log(`   ❌ NaN: ${typeStats.NaN} 条`);
    if (typeStats.null > 0) console.log(`   ❌ null: ${typeStats.null} 条`);
    if (typeStats.undefined > 0) console.log(`   ❌ undefined: ${typeStats.undefined} 条`);
    if (typeStats.other > 0) console.log(`   ❌ 其他类型: ${typeStats.other} 条`);

    // 3. 显示问题记录详情
    if (problems.length > 0) {
        console.log(`\n⚠️  发现 ${problems.length} 条问题记录:\n`);
        problems.forEach((r, i) => {
            console.log(`   ${i + 1}. _id: ${r._id}`);
            console.log(`      ID: ${r.ID} (类型: ${typeof r.ID}, isNaN: ${Number.isNaN(r.ID)})`);
            console.log(`      Issue: ${r.Issue}`);
            console.log('');
        });
    } else {
        console.log('\n✅ 没有发现 ID 异常的记录');
    }

    // 4. 检查最新 5 条记录（按 _id 排序，避免 ID 排序问题）
    console.log('\n📋 最新 5 条记录 (按插入时间):');
    const latestRecords = await collection.find({})
        .sort({ _id: -1 })
        .limit(5)
        .project({ _id: 1, ID: 1, Issue: 1 })
        .toArray();

    latestRecords.forEach((r, i) => {
        const idStatus = (typeof r.ID === 'number' && !Number.isNaN(r.ID)) ? '✅' : '❌';
        console.log(`   ${i + 1}. ${idStatus} ID: ${r.ID}, Issue: ${r.Issue}`);
    });

    // 5. 尝试执行会出问题的查询
    console.log('\n🧪 测试关键查询:');
    try {
        const maxIDRecord = await collection.findOne(
            { ID: { $type: 'number' } },
            { sort: { ID: -1 }, projection: { ID: 1, Issue: 1 } }
        );
        console.log(`   findOne().sort({ID: -1}): ID=${maxIDRecord?.ID}, Issue=${maxIDRecord?.Issue}`);

        if (maxIDRecord && (Number.isNaN(maxIDRecord.ID) || maxIDRecord.ID === null)) {
            console.log('   ⚠️  最大ID查询返回了无效值！这就是问题所在！');
        }
    } catch (err) {
        console.log(`   ❌ 查询出错: ${err.message}`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════');

    if (problems.length > 0) {
        console.log('💡 建议: 运行 node fix-nan-id.js 修复问题记录');
    } else {
        console.log('✅ 数据库 ID 字段正常，问题可能出在其他地方');
    }

    console.log('═══════════════════════════════════════════════════════════════');

    await mongoose.disconnect();
}

diagnose().catch(err => {
    console.error('❌ 诊断失败:', err.message);
    process.exit(1);
});
