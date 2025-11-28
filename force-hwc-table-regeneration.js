const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

async function forceHWCTableRegeneration() {
    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('✅ 已连接到数据库\n');

        const db = client.db(DB_NAME);
        const Hit_dlts = db.collection('hit_dlts');
        const DLTRedCombinationsHotWarmColdOptimized = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

        // 1. 获取所有已开奖期号
        const allIssues = await Hit_dlts.find({}).sort({ ID: 1 }).toArray();
        const latestIssue = allIssues[allIssues.length - 1];
        const nextIssue = parseInt(latestIssue.Issue) + 1;

        console.log('🔍 数据库信息:');
        console.log(`   - 总开奖期数: ${allIssues.length}`);
        console.log(`   - 最新期号: ${latestIssue.Issue}`);
        console.log(`   - 下一期预测期号: ${nextIssue}\n`);

        // 2. 强制删除并重新创建集合
        try {
            await DLTRedCombinationsHotWarmColdOptimized.drop();
            console.log('🗑️ 已删除旧集合\n');
        } catch (dropError) {
            console.warn('❗ 删除集合时出错:', dropError.message);
        }

        // 3. 重新创建集合并添加索引
        await db.createCollection('hit_dlt_redcombinationshotwarmcoldoptimizeds');
        await DLTRedCombinationsHotWarmColdOptimized.createIndexes([
            { key: { base_issue: 1 } },
            { key: { target_issue: 1 } },
            { key: { base_issue: 1, target_issue: 1 }, unique: true }
        ]);
        console.log('✅ 已重新创建集合并添加索引\n');

        // 4. 准备批量写入
        const bulkOps = [];

        // 插入所有已开奖期
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
        const insertResult = await DLTRedCombinationsHotWarmColdOptimized.insertMany(issueDocuments, { ordered: false });

        console.log('🎉 重建结果:');
        console.log(`   - 总处理记录数: ${insertResult.insertedCount}`);

        // 验证
        const finalCount = await DLTRedCombinationsHotWarmColdOptimized.countDocuments();
        console.log(`\n📊 最终记录数: ${finalCount}`);

        // 检查最后几条记录
        const lastRecords = await DLTRedCombinationsHotWarmColdOptimized
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
            insertedCount: insertResult.insertedCount
        }, null, 2);

        const logPath = path.join(__dirname, 'hwc_table_regeneration_log.json');
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