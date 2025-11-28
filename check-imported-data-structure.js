/**
 * 检查导入后的数据实际结构
 */

const mongoose = require('mongoose');

async function check() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到 MongoDB\n');

        const db = mongoose.connection.db;
        const collection = db.collection('hit_dlts');

        // 获取ID=2792的完整记录
        const latest = await collection.findOne({ ID: 2792 });

        console.log('📋 ID=2792 的完整记录：');
        console.log(JSON.stringify(latest, null, 2));
        console.log('\n字段列表：', Object.keys(latest).sort());

        // 获取ID=1的完整记录
        const earliest = await collection.findOne({ ID: 1 });

        console.log('\n\n📋 ID=1 的完整记录：');
        console.log(JSON.stringify(earliest, null, 2));
        console.log('\n字段列表：', Object.keys(earliest).sort());

        // 检查是否有 Red1 字段
        const hasRed1 = await collection.countDocuments({ Red1: { $exists: true, $ne: null } });
        console.log(`\n\n有 Red1 字段且不为null的记录数: ${hasRed1} / 2792`);

        await mongoose.connection.close();
        console.log('\n✅ 数据库连接已关闭');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

check();
