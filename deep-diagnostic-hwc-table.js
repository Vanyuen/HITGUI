const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

async function deepDiagnosticHWCTable() {
    const client = new MongoClient(MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    try {
        console.log('🔍 开始深度诊断和数据一致性检查...\n');

        await client.connect();
        const db = client.db(DB_NAME);

        // 1. 检查所有集合
        const collections = await db.listCollections().toArray();
        console.log('📊 数据库集合列表:');
        collections.forEach(collection => {
            console.log(`  - ${collection.name}`);
        });
        console.log('');

        // 2. 详细检查 hit_dlts 集合
        const Hit_dlts = db.collection('hit_dlts');
        const dltsCount = await Hit_dlts.countDocuments();
        const latestDltRecord = await Hit_dlts.findOne({}, { sort: { ID: -1 } });
        const oldestDltRecord = await Hit_dlts.findOne({}, { sort: { ID: 1 } });

        console.log('🔎 hit_dlts 集合详细诊断:');
        console.log(`   - 总记录数: ${dltsCount}`);
        console.log(`   - 最新期号: ${latestDltRecord.Issue}`);
        console.log(`   - 最新期ID: ${latestDltRecord.ID}`);
        console.log(`   - 最早期号: ${oldestDltRecord.Issue}`);
        console.log(`   - 最早期ID: ${oldestDltRecord.ID}\n`);

        // 3. 打印最后10条 hit_dlts 记录的详细信息
        const lastTenDltRecords = await Hit_dlts.find({}).sort({ ID: -1 }).limit(10).toArray();
        console.log('🔬 最后10条 hit_dlts 记录:');
        lastTenDltRecords.forEach((record, index) => {
            console.log(`记录 ${index + 1}:`);
            console.log(`  期号: ${record.Issue}`);
            console.log(`  ID: ${record.ID}`);
            console.log(`  红球: ${[record.Red1, record.Red2, record.Red3, record.Red4, record.Red5].join(', ')}`);
            console.log(`  蓝球: ${[record.Blue1, record.Blue2].join(', ')}`);
        });
        console.log('');

        // 4. 检查热温冷比优化表集合
        const HWCCollection = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');
        const hwcCount = await HWCCollection.countDocuments();

        console.log('🔬 热温冷比优化表诊断:');
        console.log(`   - 总记录数: ${hwcCount}`);

        const firstHWCRecord = await HWCCollection.findOne({}, { sort: { target_issue: 1 } });
        const lastHWCRecord = await HWCCollection.findOne({}, { sort: { target_issue: -1 } });

        console.log('\n🔍 热温冷比优化表最早和最后记录:');
        console.log('最早记录:');
        console.log(JSON.stringify(firstHWCRecord, null, 2));
        console.log('\n最后一条记录:');
        console.log(JSON.stringify(lastHWCRecord, null, 2));

        // 5. 检查最后10条热温冷比优化表记录
        const lastTenHWCRecords = await HWCCollection.find({}).sort({ target_issue: -1 }).limit(10).toArray();
        console.log('\n🕵️ 热温冷比优化表最后10条记录:');
        lastTenHWCRecords.forEach((record, index) => {
            console.log(`记录 ${index + 1}:`);
            console.log(`  基准期: ${record.base_issue}`);
            console.log(`  目标期: ${record.target_issue}`);
            console.log(`  是否为预测期: ${record.is_predicted}`);
        });

        // 6. 记录诊断日志
        const logContent = {
            timestamp: new Date().toISOString(),
            dltTotalRecords: dltsCount,
            latestDltIssue: latestDltRecord.Issue,
            oldestDltIssue: oldestDltRecord.Issue,
            hwcTotalRecords: hwcCount,
            firstHWCRecord: firstHWCRecord,
            lastHWCRecord: lastHWCRecord
        };

        const logPath = path.join(__dirname, 'hwc_table_deep_diagnostic_log.json');
        fs.writeFileSync(logPath, JSON.stringify(logContent, null, 2));
        console.log(`\n📝 已将诊断日志保存到: ${logPath}`);

        await client.close();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

deepDiagnosticHWCTable();