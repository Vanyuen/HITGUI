const mongoose = require('mongoose');

async function debugMapKeys() {
    try {
        await mongoose.connect('mongodb://localhost:27017/lottery');

        const dltSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlts' });
        const redMissingSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_basictrendchart_redballmissing_histories' });

        const DLT = mongoose.models.HIT_DLT || mongoose.model('HIT_DLT', dltSchema);
        const DLTRedMissing = mongoose.models.HIT_DLT_Basictrendchart_redballmissing_history ||
                              mongoose.model('HIT_DLT_Basictrendchart_redballmissing_history', redMissingSchema);

        // 获取前3条DLT记录
        const dltRecords = await DLT.find({}).select('Issue').sort({ Issue: 1 }).limit(3).lean();

        // 获取前5条遗漏值记录
        const missingRecords = await DLTRedMissing.find({}).sort({ ID: 1 }).limit(5).lean();

        console.log('\n=== DLT表前3期 ===');
        dltRecords.forEach(r => {
            console.log(`Issue: "${r.Issue}" (类型: ${typeof r.Issue})`);
        });

        console.log('\n=== DLTRedMissing表前5期 ===');
        missingRecords.forEach(r => {
            console.log(`ID: ${r.ID}, Issue: "${r.Issue}" (类型: ${typeof r.Issue})`);
        });

        // 创建Map并测试
        console.log('\n=== 测试Map存储与查找 ===');
        const missingDataMap = new Map();
        missingRecords.forEach(record => {
            missingDataMap.set(record.ID, record);
            missingDataMap.set(record.Issue, record);
            console.log(`存入Map: ID=${record.ID}, Issue="${record.Issue}"`);
        });

        console.log(`\nMap大小: ${missingDataMap.size}`);
        console.log('Map中的所有keys:');
        for (const key of missingDataMap.keys()) {
            console.log(`  key: "${key}" (类型: ${typeof key})`);
        }

        // 测试查找
        console.log('\n=== 测试查找 ===');
        const testIssue = dltRecords[0].Issue;
        console.log(`查找Issue "${testIssue}": ${missingDataMap.has(testIssue) ? '找到' : '未找到'}`);

        const result = missingDataMap.get(testIssue);
        if (result) {
            console.log(`  查找结果: ID=${result.ID}, Issue="${result.Issue}"`);
        }

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('调试失败:', error);
        process.exit(1);
    }
}

debugMapKeys();
