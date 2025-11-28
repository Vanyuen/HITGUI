const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

async function consolidateHWCTables() {
    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('✅ 已连接到数据库\n');

        const db = client.db(DB_NAME);
        const Hit_dlts = db.collection('hit_dlts');
        const HWCOptimized = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');
        const HWCOldTable = db.collection('hit_dlt_redcombinationshotwarmcolds');

        // 1. 获取所有已开奖期号
        const allIssues = await Hit_dlts.find({}).sort({ ID: 1 }).toArray();
        const latestIssue = allIssues[allIssues.length - 1];
        const nextIssue = parseInt(latestIssue.Issue) + 1;

        console.log('🔍 数据库信息:');
        console.log(`   - 总开奖期数: ${allIssues.length}`);
        console.log(`   - 最新期号: ${latestIssue.Issue}`);
        console.log(`   - 下一期预测期号: ${nextIssue}\n`);

        // 2. 检查旧表中的数据
        const oldTableCount = await HWCOldTable.countDocuments();
        console.log(`📊 旧表 hit_dlt_redcombinationshotwarmcolds 记录数: ${oldTableCount}`);

        // 3. 如果旧表有数据，尝试合并
        if (oldTableCount > 0) {
            console.log('🔄 尝试合并旧表数据...\n');

            // 获取旧表的所有数据
            const oldTableData = await HWCOldTable.find({}).toArray();

            // 准备批量写入操作
            const bulkOps = oldTableData.map(doc => ({
                updateOne: {
                    filter: {
                        base_issue: doc.base_issue,
                        target_issue: doc.target_issue
                    },
                    update: { $set: doc },
                    upsert: true
                }
            }));

            // 执行批量写入
            const mergeResult = await HWCOptimized.bulkWrite(bulkOps);
            console.log('🎉 旧表数据合并结果:');
            console.log(`   - 新增记录数: ${mergeResult.upsertedCount}`);
            console.log(`   - 更新记录数: ${mergeResult.modifiedCount}\n`);
        }

        // 4. 重建热温冷比优化表
        await HWCOptimized.deleteMany({});
        console.log('🗑️ 已删除现有记录\n');

        // 5. 插入所有已开奖期
        const issueDocuments = allIssues.map(issue => ({
            base_issue: issue.Issue.toString(),
            target_issue: issue.Issue.toString(),
            is_predicted: false
        }));

        // 插入下一期预测期
        issueDocuments.push({
            base_issue: latestIssue.Issue.toString(),
            target_issue: nextIssue.toString(),
            is_predicted: true
        });

        // 执行批量插入
        const insertResult = await HWCOptimized.insertMany(issueDocuments, { ordered: false });

        console.log('🎉 重建结果:');
        console.log(`   - 总处理记录数: ${insertResult.insertedCount}`);

        // 验证
        const finalCount = await HWCOptimized.countDocuments();
        console.log(`\n📊 最终记录数: ${finalCount}`);

        // 检查最后几条记录
        const lastRecords = await HWCOptimized
            .find({}, { projection: { _id: 0, base_issue: 1, target_issue: 1, is_predicted: 1 } })
            .sort({ target_issue: -1 })
            .limit(10)
            .toArray();

        console.log('\n🕵️ 最后10条记录:');
        lastRecords.forEach((record, index) => {
            console.log(`记录 ${index + 1}:`);
            console.log(`  基准期: ${record.base_issue}`);
            console.log(`  目标期: ${record.target_issue}`);
            console.log(`  是否为预测期: ${record.is_predicted}`);
        });

        // 验证记录的正确性
        const validationIssues = lastRecords.map(r => r.target_issue);
        console.log('\n🔍 目标期号验证:');
        console.log(`   验证期号: ${validationIssues.join(', ')}`);
        console.log(`   是否包含最新期号 ${latestIssue.Issue}: ${validationIssues.includes(latestIssue.Issue.toString())}`);
        console.log(`   是否包含下一期预测期号 ${nextIssue}: ${validationIssues.includes(nextIssue.toString())}`);

        // 记录日志
        const logContent = JSON.stringify({
            timestamp: new Date().toISOString(),
            totalIssues: allIssues.length,
            latestIssue: latestIssue.Issue,
            nextIssue: nextIssue,
            insertedCount: insertResult.insertedCount,
            oldTableCount: oldTableCount
        }, null, 2);

        const logPath = path.join(__dirname, 'hwc_table_consolidation_log.json');
        fs.writeFileSync(logPath, logContent);
        console.log(`\n📝 已将合并日志保存到: ${logPath}`);

        await client.close();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

consolidateHWCTables();