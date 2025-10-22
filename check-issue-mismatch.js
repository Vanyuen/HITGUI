const mongoose = require('mongoose');

async function checkIssueMismatch() {
    try {
        await mongoose.connect('mongodb://localhost:27017/lottery');

        const dltSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlts' });
        const redMissingSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_basictrendchart_redballmissing_histories' });

        const DLT = mongoose.models.HIT_DLT || mongoose.model('HIT_DLT', dltSchema);
        const DLTRedMissing = mongoose.models.HIT_DLT_Basictrendchart_redballmissing_history ||
                              mongoose.model('HIT_DLT_Basictrendchart_redballmissing_history', redMissingSchema);

        // 获取DLT表的期号范围
        const dltRecords = await DLT.find({}).select('Issue').sort({ Issue: 1 }).lean();
        const dltIssues = dltRecords.map(r => r.Issue);

        // 获取DLTRedMissing表的期号范围
        const missingRecords = await DLTRedMissing.find({}).select('Issue').sort({ Issue: 1 }).lean();
        const missingIssues = missingRecords.map(r => r.Issue);

        console.log('\n=== 期号匹配检查 ===\n');
        console.log(`DLT表期号数量: ${dltIssues.length}`);
        console.log(`DLT表期号范围: ${dltIssues[0]} - ${dltIssues[dltIssues.length - 1]}`);
        console.log(`DLT表前10期: ${dltIssues.slice(0, 10).join(', ')}`);
        console.log(`DLT表后10期: ${dltIssues.slice(-10).join(', ')}\n`);

        console.log(`DLTRedMissing表期号数量: ${missingIssues.length}`);
        console.log(`DLTRedMissing表期号范围: ${missingIssues[0]} - ${missingIssues[missingIssues.length - 1]}`);
        console.log(`DLTRedMissing表前10期: ${missingIssues.slice(0, 10).join(', ')}`);
        console.log(`DLTRedMissing表后10期: ${missingIssues.slice(-10).join(', ')}\n`);

        // 找出匹配的期号
        const dltSet = new Set(dltIssues);
        const missingSet = new Set(missingIssues);

        const matchedIssues = dltIssues.filter(issue => missingSet.has(issue));

        console.log(`匹配的期号数量: ${matchedIssues.length} / ${dltIssues.length}`);
        console.log(`匹配率: ${(matchedIssues.length / dltIssues.length * 100).toFixed(1)}%\n`);

        if (matchedIssues.length > 0) {
            console.log(`匹配的前10期: ${matchedIssues.slice(0, 10).join(', ')}`);
            console.log(`匹配的后10期: ${matchedIssues.slice(-10).join(', ')}\n`);
        }

        // 找出DLT表中没有遗漏值数据的期号范围
        const unmatchedIssues = dltIssues.filter(issue => !missingSet.has(issue));
        if (unmatchedIssues.length > 0) {
            console.log(`DLT表中缺少遗漏值的期号（前20个）:`);
            console.log(unmatchedIssues.slice(0, 20).join(', '));
        }

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('检查失败:', error);
        process.exit(1);
    }
}

checkIssueMismatch();
