const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function debugAndRegenerateHWCTable() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 已连接到数据库\n');

        // 定义模式
        const dltSchema = new mongoose.Schema({
            ID: { type: Number, required: true, unique: true },
            Issue: { type: Number, required: true, unique: true }
        });

        const Hit_dlts = mongoose.model('hit_dlts', dltSchema);

        const DLTRedCombinationsHotWarmColdOptimizedSchema = new mongoose.Schema({
            base_issue: { type: String, required: true },
            target_issue: { type: String, required: true },
            is_predicted: { type: Boolean, default: false }
        });

        const DLTRedCombinationsHotWarmColdOptimized = mongoose.model(
            'hit_dlt_redcombinationshotwarmcoldoptimizeds',
            DLTRedCombinationsHotWarmColdOptimizedSchema
        );

        // 1. 诊断主数据库记录
        const allIssues = await Hit_dlts.find({}).sort({ ID: 1 });
        console.log(`📊 主数据库记录数: ${allIssues.length}`);
        console.log(`📊 最新期号: ${allIssues[allIssues.length - 1].Issue}`);
        console.log(`📊 最新记录ID: ${allIssues[allIssues.length - 1].ID}`);

        // 2. 检查热温冷比优化表
        const hwcTableCount = await DLTRedCombinationsHotWarmColdOptimized.countDocuments();
        console.log(`\n🔍 热温冷比优化表当前记录数: ${hwcTableCount}`);

        // 3. 清空热温冷比优化表
        const deleteResult = await DLTRedCombinationsHotWarmColdOptimized.deleteMany({});
        console.log(`🗑️ 已删除 ${deleteResult.deletedCount} 条旧记录`);

        // 4. 准备重建逻辑
        console.log('\n🛠️ 准备重建热温冷比优化表');

        // 获取最后一条记录作为基准
        const latestRecord = allIssues[allIssues.length - 1];
        const nextIssue = latestRecord.Issue + 1;

        // 插入已开奖记录
        const bulkOps = allIssues.map(issue => ({
            updateOne: {
                filter: {
                    base_issue: issue.Issue.toString(),
                    target_issue: issue.Issue.toString()
                },
                update: {
                    base_issue: issue.Issue.toString(),
                    target_issue: issue.Issue.toString(),
                    is_predicted: false
                },
                upsert: true
            }
        }));

        // 插入推算期记录
        bulkOps.push({
            updateOne: {
                filter: {
                    base_issue: latestRecord.Issue.toString(),
                    target_issue: nextIssue.toString()
                },
                update: {
                    base_issue: latestRecord.Issue.toString(),
                    target_issue: nextIssue.toString(),
                    is_predicted: true
                },
                upsert: true
            }
        });

        // 执行批量写入
        const bulkWriteResult = await DLTRedCombinationsHotWarmColdOptimized.bulkWrite(bulkOps);

        console.log('\n📊 重建结果:');
        console.log(`  - 已处理记录数: ${bulkWriteResult.upsertedCount + bulkWriteResult.modifiedCount}`);
        console.log(`  - 插入新记录: ${bulkWriteResult.upsertedCount}`);
        console.log(`  - 更新现有记录: ${bulkWriteResult.modifiedCount}`);

        // 验证重建结果
        const finalCount = await DLTRedCombinationsHotWarmColdOptimized.countDocuments();
        console.log(`\n🎉 热温冷比优化表最终记录数: ${finalCount}`);

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

debugAndRegenerateHWCTable();