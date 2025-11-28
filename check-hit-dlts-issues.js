/**
 * 检查 hit_dlts 表的期号分布
 */

const mongoose = require('mongoose');

async function checkIssues() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 已连接到 MongoDB\n');

        const hit_dltsSchema = new mongoose.Schema({
            ID: Number,
            Issue: Number
        }, { collection: 'hit_dlts', strict: false });

        const hit_dlts = mongoose.model('hit_dlts_check', hit_dltsSchema);

        // 统计信息
        const totalCount = await hit_dlts.countDocuments();
        const minIssue = await hit_dlts.findOne({}).sort({ Issue: 1 });
        const maxIssue = await hit_dlts.findOne({}).sort({ Issue: -1 });
        const minID = await hit_dlts.findOne({}).sort({ ID: 1 });
        const maxID = await hit_dlts.findOne({}).sort({ ID: -1 });

        console.log('📊 hit_dlts 表数据统计:');
        console.log(`   总记录数: ${totalCount}`);
        console.log(`   期号范围: ${minIssue?.Issue} → ${maxIssue?.Issue}`);
        console.log(`   ID范围: ${minID?.ID} → ${maxID?.ID}`);
        console.log();

        // 获取最新10期
        const latest10 = await hit_dlts.find({}).sort({ Issue: -1 }).limit(10);
        console.log('📋 最新10期数据:');
        latest10.forEach(record => {
            console.log(`   期号: ${record.Issue}, ID: ${record.ID}, Red: [${record.Red1},${record.Red2},${record.Red3},${record.Red4},${record.Red5}], Blue: [${record.Blue1},${record.Blue2}]`);
        });
        console.log();

        // 检查是否有statistics字段的样本
        const withStats = await hit_dlts.findOne({ statistics: { $exists: true } });
        const withStatsCount = await hit_dlts.countDocuments({ statistics: { $exists: true } });

        console.log(`📈 statistics字段检查:`);
        console.log(`   有statistics字段的记录数: ${withStatsCount}`);
        if (withStats) {
            console.log(`   样本数据: ${JSON.stringify(withStats, null, 2)}`);
        } else {
            console.log(`   ❌ 没有找到任何有statistics字段的记录`);
        }

        await mongoose.connection.close();
        console.log('\n✅ 数据库连接已关闭');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

checkIssues();
