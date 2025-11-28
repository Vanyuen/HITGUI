const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

async function forceHWCTableRegeneration() {
    const client = new MongoClient(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    try {
        console.log('🔍 开始强制重建热温冷比优化表...\n');

        await client.connect();
        const db = client.db(DB_NAME);

        const Hit_dlts = db.collection('hit_dlts');
        const HWCCollection = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

        // 1. 获取所有已开奖期号，按照ID排序
        console.log('🔎 正在获取所有已开奖期号...');
        const allIssues = await Hit_dlts.find({}).sort({ ID: 1 }).toArray();

        // 2. 找到最新期号
        const latestIssue = allIssues[allIssues.length - 1];
        const nextIssue = parseInt(latestIssue.Issue) + 1;

        console.log('📊 数据库信息:');
        console.log(`   - 总开奖期数: ${allIssues.length}`);
        console.log(`   - 最新期号: ${latestIssue.Issue}`);
        console.log(`   - 最新期ID: ${latestIssue.ID}`);
        console.log(`   - 下一期预测期号: ${nextIssue}\n`);

        // 3. 强制删除并重建索引
        console.log('🔨 重建集合索引...');
        await HWCCollection.dropIndexes();
        await HWCCollection.createIndexes([
            { key: { base_issue: 1 } },
            { key: { target_issue: 1 } },
            { key: { base_issue: 1, target_issue: 1 }, unique: true }
        ]);

        // 4. 清空现有集合
        console.log('🗑️ 清空现有集合...');
        await HWCCollection.deleteMany({});

        // 5. 准备批量插入文档
        const bulkDocuments = [];

        // 插入所有已开奖期
        for (const issue of allIssues) {
            bulkDocuments.push({
                base_issue: issue.Issue.toString(),
                target_issue: issue.Issue.toString(),
                is_predicted: false,
                hit_analysis: {
                    target_winning_reds: [
                        issue.Red1, issue.Red2, issue.Red3,
                        issue.Red4, issue.Red5
                    ],
                    target_winning_blues: [issue.Blue1, issue.Blue2],
                    is_drawn: true
                }
            });
        }

        // 插入下一期预测期
        bulkDocuments.push({
            base_issue: latestIssue.Issue.toString(),
            target_issue: nextIssue.toString(),
            is_predicted: true,
            hit_analysis: {
                target_winning_reds: [],
                target_winning_blues: [],
                is_drawn: false
            }
        });

        // 6. 执行批量插入
        console.log('📥 开始批量插入文档...');
        const insertResult = await HWCCollection.insertMany(bulkDocuments, { ordered: false });

        console.log('🎉 重建结果:');
        console.log(`   - 总处理记录数: ${insertResult.insertedCount}`);

        // 7. 验证插入结果
        const finalCount = await HWCCollection.countDocuments();
        console.log(`\n📊 最终记录数: ${finalCount}`);

        // 8. 检查最后几条记录
        const lastRecords = await HWCCollection
            .find({})
            .sort({ target_issue: -1 })
            .limit(10)
            .toArray();

        console.log('\n🕵️ 最后10条记录:');
        lastRecords.forEach((record, index) => {
            console.log(`记录 ${index + 1}:`);
            console.log(`  基准期: ${record.base_issue}`);
            console.log(`  目标期: ${record.target_issue}`);
            console.log(`  是否为预测期: ${record.is_predicted}`);
            console.log(`  开奖红球: ${record.hit_analysis.target_winning_reds.join(', ')}`);
            console.log(`  开奖蓝球: ${record.hit_analysis.target_winning_blues.join(', ')}`);
        });

        // 9. 验证记录的正确性
        const validationIssues = lastRecords.map(r => r.target_issue);
        console.log('\n🔍 目标期号验证:');
        console.log(`   验证期号: ${validationIssues.join(', ')}`);
        console.log(`   是否包含最新期号 ${latestIssue.Issue}: ${validationIssues.includes(latestIssue.Issue.toString())}`);
        console.log(`   是否包含下一期预测期号 ${nextIssue}: ${validationIssues.includes(nextIssue.toString())}`);

        // 10. 记录诊断日志
        const logContent = JSON.stringify({
            timestamp: new Date().toISOString(),
            totalIssues: allIssues.length,
            latestIssue: latestIssue.Issue,
            nextIssue: nextIssue,
            insertedCount: insertResult.insertedCount
        }, null, 2);

        const logPath = path.join(__dirname, 'hwc_table_force_rebuild_log.json');
        fs.writeFileSync(logPath, logContent);
        console.log(`\n📝 已将重建日志保存到: ${logPath}`);

        await client.close();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

forceHWCTableRegeneration();