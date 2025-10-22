const mongoose = require('mongoose');

async function checkMissingTableStructure() {
    try {
        await mongoose.connect('mongodb://localhost:27017/lottery');

        const redMissingSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_basictrendchart_redballmissing_histories' });
        const DLTRedMissing = mongoose.models.HIT_DLT_Basictrendchart_redballmissing_history ||
                              mongoose.model('HIT_DLT_Basictrendchart_redballmissing_history', redMissingSchema);

        console.log('\n=== DLTRedMissing表结构检查 ===\n');

        // 获取最新3条记录
        const latestRecords = await DLTRedMissing.find({}).sort({ _id: -1 }).limit(3).lean();

        console.log(`总记录数: ${await DLTRedMissing.countDocuments()}\n`);

        latestRecords.forEach((record, index) => {
            console.log(`记录 ${index + 1}:`);
            console.log(`  _id: ${record._id}`);
            console.log(`  Issue类型: ${typeof record.Issue} 值: ${record.Issue}`);
            console.log(`  ID字段: ${record.ID}`);

            // 列出所有字段
            const fields = Object.keys(record);
            const numFields = fields.filter(f => /^\d+$/.test(f));

            console.log(`  字段数量: ${fields.length}`);
            console.log(`  数字字段（号码遗漏值）: ${numFields.length}个`);

            if (numFields.length > 0) {
                console.log(`  示例遗漏值数据:`);
                numFields.slice(0, 5).forEach(ballNum => {
                    console.log(`    号码 ${ballNum}: 遗漏值 ${record[ballNum]}`);
                });
            }

            console.log('');
        });

        // 获取Issue字段的排序方式
        const allRecords = await DLTRedMissing.find({}).select('Issue ID').sort({ ID: 1 }).lean();

        console.log('期号排序检查:');
        console.log(`  按ID升序的前5期: ${allRecords.slice(0, 5).map(r => `ID:${r.ID} Issue:${r.Issue}`).join(', ')}`);
        console.log(`  按ID升序的后5期: ${allRecords.slice(-5).map(r => `ID:${r.ID} Issue:${r.Issue}`).join(', ')}`);

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('检查失败:', error);
        process.exit(1);
    }
}

checkMissingTableStructure();
