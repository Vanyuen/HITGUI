/**
 * 诊断期号显示错误的问题
 * 为什么界面显示最新期号是 9153 而不是 25124？
 */

const mongoose = require('mongoose');

async function diagnose() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 已连接到 MongoDB\n');

        const db = mongoose.connection.db;

        // 检查 hit_dlts 表的期号类型和排序
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 hit_dlts 表期号分析');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const hitDltsCollection = db.collection('hit_dlts');

        // 1. 按 Issue 降序（数值型）
        console.log('1️⃣ 按 Issue 降序（数值型排序）：');
        const byIssueDesc = await hitDltsCollection.find({}).sort({ Issue: -1 }).limit(5).toArray();
        byIssueDesc.forEach(r => {
            console.log(`   ID=${r.ID}, Issue=${r.Issue} (类型: ${typeof r.Issue})`);
        });

        // 2. 按 Issue 升序（数值型）
        console.log('\n2️⃣ 按 Issue 升序（数值型排序）：');
        const byIssueAsc = await hitDltsCollection.find({}).sort({ Issue: 1 }).limit(5).toArray();
        byIssueAsc.forEach(r => {
            console.log(`   ID=${r.ID}, Issue=${r.Issue} (类型: ${typeof r.Issue})`);
        });

        // 3. 按 ID 降序
        console.log('\n3️⃣ 按 ID 降序（最新记录）：');
        const byIDDesc = await hitDltsCollection.find({}).sort({ ID: -1 }).limit(5).toArray();
        byIDDesc.forEach(r => {
            console.log(`   ID=${r.ID}, Issue=${r.Issue}, Red=[${r.Red1},${r.Red2},${r.Red3},${r.Red4},${r.Red5}], Blue=[${r.Blue1},${r.Blue2}]`);
        });

        // 4. 统计 Issue 字段类型
        console.log('\n4️⃣ Issue 字段类型统计：');
        const issueTypes = await hitDltsCollection.aggregate([
            {
                $project: {
                    issueType: { $type: "$Issue" }
                }
            },
            {
                $group: {
                    _id: "$issueType",
                    count: { $sum: 1 }
                }
            }
        ]).toArray();
        issueTypes.forEach(t => {
            console.log(`   ${t._id}: ${t.count} 条记录`);
        });

        // 5. 查找所有期号 > 20000 的记录
        console.log('\n5️⃣ 期号 > 20000 的记录统计：');
        const gt20000Count = await hitDltsCollection.countDocuments({ Issue: { $gt: 20000 } });
        console.log(`   共 ${gt20000Count} 条记录`);
        if (gt20000Count > 0) {
            const samples = await hitDltsCollection.find({ Issue: { $gt: 20000 } }).sort({ Issue: -1 }).limit(3).toArray();
            console.log('   样本：');
            samples.forEach(r => {
                console.log(`      ID=${r.ID}, Issue=${r.Issue}`);
            });
        }

        // 6. 检查红球遗漏值表
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 红球遗漏值表分析');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const redMissingCollection = db.collection('hit_dlt_basictrendchart_redballmissing_histories');

        console.log('1️⃣ 按 Issue 降序：');
        const redByIssueDesc = await redMissingCollection.find({}).sort({ Issue: -1 }).limit(5).toArray();
        redByIssueDesc.forEach(r => {
            console.log(`   ID=${r.ID}, Issue=${r.Issue} (类型: ${typeof r.Issue})`);
        });

        console.log('\n2️⃣ 按 ID 降序：');
        const redByIDDesc = await redMissingCollection.find({}).sort({ ID: -1 }).limit(5).toArray();
        redByIDDesc.forEach(r => {
            console.log(`   ID=${r.ID}, Issue=${r.Issue}`);
        });

        // 7. 检查界面可能使用的查询
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 模拟界面查询');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 模拟界面获取最新期号的方式（字符串排序）
        const latestByStringSort = await redMissingCollection.find({}).sort({ Issue: -1 }).limit(1).toArray();
        console.log('1️⃣ 遗漏值表按 Issue 降序（可能是字符串排序）：');
        if (latestByStringSort[0]) {
            console.log(`   Issue=${latestByStringSort[0].Issue} (这可能就是界面显示的 9153)`);
        }

        // 正确的方式应该是按 ID 降序
        const latestByID = await hitDltsCollection.find({}).sort({ ID: -1 }).limit(1).toArray();
        console.log('\n2️⃣ hit_dlts 按 ID 降序（正确方式）：');
        if (latestByID[0]) {
            console.log(`   ID=${latestByID[0].ID}, Issue=${latestByID[0].Issue} (这才是正确的最新期号)`);
        }

        await mongoose.connection.close();
        console.log('\n✅ 数据库连接已关闭');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

diagnose();
