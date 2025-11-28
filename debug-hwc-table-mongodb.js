const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

async function debugHWCTableRegeneration() {
    const client = new MongoClient(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    try {
        console.log('🔍 开始MongoDB深度诊断和重建...\n');

        await client.connect();
        const db = client.db(DB_NAME);

        // 获取所有集合
        const collections = await db.listCollections().toArray();
        console.log('📊 数据库集合列表:');
        collections.forEach(collection => {
            console.log(`  - ${collection.name}`);
        });
        console.log('');

        // 检查 hit_dlts 集合
        const Hit_dlts = db.collection('hit_dlts');
        const dltsCount = await Hit_dlts.countDocuments();
        const latestDltRecord = await Hit_dlts.findOne({}, { sort: { ID: -1 } });

        console.log('🔎 hit_dlts 集合诊断:');
        console.log(`   - 总记录数: ${dltsCount}`);
        console.log(`   - 最新期号: ${latestDltRecord.Issue}`);
        console.log(`   - 最新期ID: ${latestDltRecord.ID}`);
        console.log(`   - 下一期预测期号: ${parseInt(latestDltRecord.Issue) + 1}\n`);

        // 尝试不同的集合名称
        const potentialCollections = [
            'hit_dlt_redcombinationshotwarmcoldoptimizeds',
            'hit_dlt_redcombinationshotwarmcolds',
            'hit_dlt_hwcpositivepredictiontasks',
            'hit_dlt_redcombinations_hwc_optimized',
            'hit_dlt_hwc_table'
        ];

        let HWCCollection = null;
        for (const collectionName of potentialCollections) {
            try {
                const collection = db.collection(collectionName);
                const count = await collection.countDocuments();
                if (count > 0) {
                    HWCCollection = collection;
                    console.log(`🎯 找到非空集合: ${collectionName} (${count} 条记录)\n`);
                    break;
                }
            } catch (err) {
                console.warn(`❌ 无法访问集合 ${collectionName}: ${err.message}`);
            }
        }

        if (!HWCCollection) {
            // 如果没有找到现有集合，创建新集合
            HWCCollection = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');
            console.log('🆕 未找到现有集合，将创建新集合\n');
        }

        // 准备批量写入的文档
        const bulkDocuments = [];

        // 插入所有已开奖期
        const allIssues = await Hit_dlts.find({}).sort({ ID: 1 }).toArray();
        for (const issue of allIssues) {
            bulkDocuments.push({
                base_issue: issue.Issue.toString(),
                target_issue: issue.Issue.toString(),
                is_predicted: false,
                hits: {
                    reds: [issue.Red1, issue.Red2, issue.Red3, issue.Red4, issue.Red5],
                    blues: [issue.Blue1, issue.Blue2]
                }
            });
        }

        // 插入下一期预测期
        const nextIssue = parseInt(latestDltRecord.Issue) + 1;
        bulkDocuments.push({
            base_issue: latestDltRecord.Issue.toString(),
            target_issue: nextIssue.toString(),
            is_predicted: true,
            hits: {
                reds: [],
                blues: []
            }
        });

        // 清空现有集合
        await HWCCollection.deleteMany({});
        console.log('🗑️ 已清空现有集合\n');

        // 插入新文档
        const insertResult = await HWCCollection.insertMany(bulkDocuments, { ordered: false });

        console.log('🎉 重建结果:');
        console.log(`   - 总处理记录数: ${insertResult.insertedCount}`);

        // 验证
        const finalCount = await HWCCollection.countDocuments();
        console.log(`\n📊 最终记录数: ${finalCount}`);

        // 检查最后几条记录
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
            console.log(`  红球: ${record.hits.reds.join(', ')}`);
            console.log(`  蓝球: ${record.hits.blues.join(', ')}`);
        });

        // 验证记录的正确性
        const validationIssues = lastRecords.map(r => r.target_issue);
        console.log('\n🔍 目标期号验证:');
        console.log(`   验证期号: ${validationIssues.join(', ')}`);
        console.log(`   是否包含最新期号 ${latestDltRecord.Issue}: ${validationIssues.includes(latestDltRecord.Issue.toString())}`);
        console.log(`   是否包含下一期预测期号 ${nextIssue}: ${validationIssues.includes(nextIssue.toString())}`);

        // 记录诊断日志
        const logContent = JSON.stringify({
            timestamp: new Date().toISOString(),
            totalIssues: allIssues.length,
            latestIssue: latestDltRecord.Issue,
            nextIssue: nextIssue,
            insertedCount: insertResult.insertedCount,
            collectionName: HWCCollection.collectionName
        }, null, 2);

        const logPath = path.join(__dirname, 'hwc_table_mongodb_debug_log.json');
        fs.writeFileSync(logPath, logContent);
        console.log(`\n📝 已将诊断日志保存到: ${logPath}`);

        await client.close();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

debugHWCTableRegeneration();