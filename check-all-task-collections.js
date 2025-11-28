/**
 * 检查所有可能的任务集合
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function checkCollections() {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lottery';
    await mongoose.connect(mongoURI);
    console.log('✅ 数据库连接成功\n');

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 检查所有集合');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // 列出所有集合
    const collections = await mongoose.connection.db.listCollections().toArray();

    console.log(`找到 ${collections.length} 个集合:\n`);

    // 查找包含 "task" 或 "prediction" 的集合
    const taskRelatedCollections = collections.filter(col =>
        col.name.toLowerCase().includes('task') ||
        col.name.toLowerCase().includes('prediction') ||
        col.name.toLowerCase().includes('exclusion')
    );

    if (taskRelatedCollections.length > 0) {
        console.log('🔍 任务相关的集合:\n');
        for (const col of taskRelatedCollections) {
            console.log(`   📁 ${col.name}`);

            // 统计记录数
            const count = await mongoose.connection.db.collection(col.name).countDocuments();
            console.log(`      记录数: ${count}`);

            if (count > 0) {
                // 显示最新的1条记录
                const latest = await mongoose.connection.db.collection(col.name)
                    .find({})
                    .sort({ _id: -1 })
                    .limit(1)
                    .toArray();

                if (latest.length > 0) {
                    console.log(`      最新记录:`);
                    console.log(`      ${JSON.stringify(latest[0], null, 8).substring(0, 500)}...`);
                }
            }
            console.log();
        }
    } else {
        console.log('⚠️  没有找到任务相关的集合\n');
    }

    // 显示所有集合名称
    console.log('📋 所有集合列表:\n');
    for (const col of collections) {
        const count = await mongoose.connection.db.collection(col.name).countDocuments();
        console.log(`   ${col.name}: ${count} 条记录`);
    }

    await mongoose.connection.close();
    console.log('\n数据库连接已关闭');
}

checkCollections().catch(console.error);
