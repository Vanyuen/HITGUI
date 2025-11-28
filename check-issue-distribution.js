/**
 * 检查 hit_dlts 表的期号分布
 */

const mongoose = require('mongoose');

async function checkIssueDistribution() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到 MongoDB\n');

        const hit_dltsSchema = new mongoose.Schema({}, { collection: 'hit_dlts', strict: false });
        const hit_dlts = mongoose.model('hit_dlts_check', hit_dltsSchema);

        const totalCount = await hit_dlts.countDocuments();
        console.log(`📊 总记录数: ${totalCount}\n`);

        // 获取最小和最大期号
        const minRecord = await hit_dlts.findOne({}).sort({ Issue: 1 }).select('ID Issue').lean();
        const maxRecord = await hit_dlts.findOne({}).sort({ Issue: -1 }).select('ID Issue').lean();

        console.log(`📋 期号范围:`);
        console.log(`   最小: ID=${minRecord.ID}, Issue=${minRecord.Issue}`);
        console.log(`   最大: ID=${maxRecord.ID}, Issue=${maxRecord.Issue}\n`);

        // 检查期号9153附近的记录
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🔍 检查期号9153附近的记录（前后各5条）\n`);

        const around9153 = await hit_dlts.find({
            Issue: { $gte: 9148, $lte: 9158 }
        }).sort({ Issue: 1 }).select('ID Issue').lean();

        around9153.forEach(record => {
            console.log(`   ID=${record.ID.toString().padStart(4)}, Issue=${record.Issue}`);
        });

        // 检查期号10001-10100范围
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🔍 检查期号10001-10100范围\n`);

        const range10001_10100 = await hit_dlts.find({
            Issue: { $gte: 10001, $lte: 10100 }
        }).sort({ Issue: 1 }).select('ID Issue').lean();

        console.log(`   找到 ${range10001_10100.length} 条记录:`);
        range10001_10100.slice(0, 10).forEach(record => {
            console.log(`   ID=${record.ID.toString().padStart(4)}, Issue=${record.Issue}`);
        });
        if (range10001_10100.length > 10) {
            console.log(`   ... 省略 ${range10001_10100.length - 10} 条 ...`);
        }

        // 检查期号25000+范围（最新期号）
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🔍 检查最新期号（25000+）\n`);

        const latest = await hit_dlts.find({
            Issue: { $gte: 25000 }
        }).sort({ Issue: -1 }).limit(10).select('ID Issue').lean();

        console.log(`   最新10期记录:`);
        latest.forEach(record => {
            console.log(`   ID=${record.ID.toString().padStart(4)}, Issue=${record.Issue}`);
        });

        // 分析期号分布
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📊 期号分布分析\n`);

        const issueRanges = [
            { name: '7000-7999', min: 7000, max: 7999 },
            { name: '8000-8999', min: 8000, max: 8999 },
            { name: '9000-9999', min: 9000, max: 9999 },
            { name: '10000-10999', min: 10000, max: 10999 },
            { name: '11000-19999', min: 11000, max: 19999 },
            { name: '20000-24999', min: 20000, max: 24999 },
            { name: '25000+', min: 25000, max: 99999 }
        ];

        for (const range of issueRanges) {
            const count = await hit_dlts.countDocuments({
                Issue: { $gte: range.min, $lte: range.max }
            });
            if (count > 0) {
                console.log(`   ${range.name.padEnd(15)}: ${count.toString().padStart(4)} 条`);
            }
        }

        await mongoose.connection.close();
        console.log('\n✅ 数据库连接已关闭');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

checkIssueDistribution();
