const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function fixHWCTableRegeneration() {
    try {
        await mongoose.connect(MONGODB_URI, {
            maxPoolSize: 10,
            socketTimeoutMS: 60000,
            connectTimeoutMS: 60000
        });
        console.log('✅ 已连接到数据库\n');

        const Hit_dlts = mongoose.connection.db.collection('hit_dlts');
        const DLTRedCombinationsHotWarmColdOptimized = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

        // 1. 获取所有已开奖期号
        const allIssues = await Hit_dlts.find({}).sort({ ID: 1 }).toArray();
        const latestIssue = allIssues[allIssues.length - 1];
        const nextIssue = parseInt(latestIssue.Issue) + 1;

        console.log('🔍 数据库信息:');
        console.log(`   - 总开奖期数: ${allIssues.length}`);
        console.log(`   - 最新期号: ${latestIssue.Issue}`);
        console.log(`   - 下一期预测期号: ${nextIssue}\n`);

        // 2. 清空现有表
        const deleteResult = await DLTRedCombinationsHotWarmColdOptimized.deleteMany({});
        console.log(`🗑️ 已删除 ${deleteResult.deletedCount} 条旧记录\n`);

        // 3. 准备批量插入
        const bulkOps = [];

        // 插入所有已开奖期
        for (const issue of allIssues) {
            bulkOps.push({
                insertOne: {
                    document: {
                        base_issue: issue.Issue.toString(),
                        target_issue: issue.Issue.toString(),
                        is_predicted: false
                    }
                }
            });
        }

        // 插入下一期预测期
        bulkOps.push({
            insertOne: {
                document: {
                    base_issue: latestIssue.Issue.toString(),
                    target_issue: nextIssue.toString(),
                    is_predicted: true
                }
            }
        });

        // 执行批量写入
        const bulkWriteResult = await DLTRedCombinationsHotWarmColdOptimized.bulkWrite(bulkOps);

        console.log('🎉 重建结果:');
        console.log(`   - 总处理记录数: ${bulkWriteResult.insertedCount}`);
        console.log(`   - 新插入记录数: ${bulkWriteResult.insertedCount}`);

        // 验证
        const finalCount = await DLTRedCombinationsHotWarmColdOptimized.countDocuments();
        console.log(`\n📊 最终记录数: ${finalCount}`);

        // 检查最后几条记录
        const lastRecords = await DLTRedCombinationsHotWarmColdOptimized
            .find({})
            .sort({ target_issue: -1 })
            .limit(5)
            .toArray();

        console.log('\n🕵️ 最后5条记录:');
        lastRecords.forEach((record, index) => {
            console.log(`记录 ${index + 1}:`);
            console.log(`  基准期: ${record.base_issue}`);
            console.log(`  目标期: ${record.target_issue}`);
            console.log(`  是否为预测期: ${record.is_predicted}`);
        });

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

fixHWCTableRegeneration();