/**
 * 检查 hit_dlts 表的实际字段结构
 */

const mongoose = require('mongoose');

async function checkSchema() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 已连接到 MongoDB\n');

        // 不定义schema，直接读取原始数据
        const db = mongoose.connection.db;
        const collection = db.collection('hit_dlts');

        // 获取一条完整记录看看所有字段
        const sample = await collection.findOne({}, { sort: { _id: -1 } });

        console.log('📋 hit_dlts 表样本记录（最新一条）:');
        console.log(JSON.stringify(sample, null, 2));
        console.log('\n字段列表:', Object.keys(sample || {}));

        // 再获取一条按ID排序的记录
        console.log('\n\n📋 按ID排序的最新记录:');
        const byID = await collection.findOne({}, { sort: { ID: -1 } });
        console.log(JSON.stringify(byID, null, 2));

        // 获取按Issue排序的记录（数值型）
        console.log('\n\n📋 按Issue排序的最大期号记录:');
        const maxIssueRecord = await collection.findOne({}, { sort: { Issue: -1 } });
        console.log(JSON.stringify(maxIssueRecord, null, 2));

        // 统计各种字段的存在情况
        const totalCount = await collection.countDocuments();
        const hasIssue = await collection.countDocuments({ Issue: { $exists: true } });
        const hasRed1 = await collection.countDocuments({ Red1: { $exists: true } });
        const hasRedBall1 = await collection.countDocuments({ red_ball_1: { $exists: true } });
        const hasRedNum1 = await collection.countDocuments({ RedNum1: { $exists: true } });
        const hasStatistics = await collection.countDocuments({ statistics: { $exists: true } });

        console.log('\n\n📊 字段存在情况统计:');
        console.log(`   总记录数: ${totalCount}`);
        console.log(`   有 Issue 字段: ${hasIssue}`);
        console.log(`   有 Red1 字段: ${hasRed1}`);
        console.log(`   有 red_ball_1 字段: ${hasRedBall1}`);
        console.log(`   有 RedNum1 字段: ${hasRedNum1}`);
        console.log(`   有 statistics 字段: ${hasStatistics}`);

        await mongoose.connection.close();
        console.log('\n✅ 数据库连接已关闭');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

checkSchema();
