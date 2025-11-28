/**
 * 排查热温冷优化表数据查询失败的原因
 */

const mongoose = require('mongoose');

async function diagnoseHwcDataIssue() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 已连接到 MongoDB');

        const db = mongoose.connection.db;

        // 1. 检查热温冷优化表的实际集合名
        console.log('\n========================================');
        console.log('📂 检查所有包含"hwc"或"hotwarmcold"的集合');
        console.log('========================================');

        const collections = await db.listCollections().toArray();
        const hwcCollections = collections.filter(c =>
            c.name.toLowerCase().includes('hwc') ||
            c.name.toLowerCase().includes('hotwarmcold') ||
            c.name.toLowerCase().includes('optimized')
        );

        console.log('\n相关集合:');
        for (const coll of hwcCollections) {
            const count = await db.collection(coll.name).countDocuments();
            console.log(`  - ${coll.name}: ${count} 条记录`);
        }

        // 2. 检查正确集合名的数据
        const correctCollName = 'hit_dlt_redcombinationshotwarmcoldoptimizeds';
        console.log(`\n========================================`);
        console.log(`📊 检查集合: ${correctCollName}`);
        console.log(`========================================`);

        const correctColl = db.collection(correctCollName);
        const totalCount = await correctColl.countDocuments();
        console.log(`总记录数: ${totalCount}`);

        if (totalCount > 0) {
            // 查看最新的几条记录
            const samples = await correctColl.find({})
                .sort({ _id: -1 })
                .limit(5)
                .toArray();

            console.log('\n最新5条记录样本:');
            samples.forEach((doc, i) => {
                console.log(`\n记录 #${i + 1}:`);
                console.log(`  base_issue: ${doc.base_issue} (${typeof doc.base_issue})`);
                console.log(`  target_issue: ${doc.target_issue} (${typeof doc.target_issue})`);
                console.log(`  base_id: ${doc.base_id}`);
                console.log(`  target_id: ${doc.target_id}`);
                console.log(`  is_predicted: ${doc.is_predicted}`);
                console.log(`  has hot_warm_cold_data: ${!!doc.hot_warm_cold_data}`);
                if (doc.hot_warm_cold_data) {
                    const ratios = Object.keys(doc.hot_warm_cold_data);
                    console.log(`  热温冷比种类: ${ratios.length}个 (${ratios.slice(0, 3).join(', ')}...)`);
                }
            });
        }

        // 3. 获取最新期号
        const hit_dlts = db.collection('hit_dlts');
        const latestRecord = await hit_dlts.findOne({}, { sort: { ID: -1 } });
        console.log(`\n========================================`);
        console.log(`🎲 数据库最新期号信息`);
        console.log(`========================================`);
        console.log(`  最新期号 (Issue): ${latestRecord.Issue}`);
        console.log(`  最新ID: ${latestRecord.ID}`);
        console.log(`  下一期推算: ${latestRecord.Issue + 1}`);

        // 4. 测试查询：模拟任务创建时的查询
        console.log(`\n========================================`);
        console.log(`🔍 模拟任务创建查询`);
        console.log(`========================================`);

        // 假设用户选择最近1期+1期推算
        const latestIssue = latestRecord.Issue;
        const baseIssue = latestIssue.toString();
        const targetIssue = (latestIssue + 1).toString();

        console.log(`\n测试查询期号对: ${baseIssue} → ${targetIssue}`);

        // 方式1：使用我们新代码中的查询方式
        const DLTRedCombinationsHotWarmColdOptimized1 = mongoose.model(
            'hit_dlt_redcombinationshotwarmcoldoptimizeds_test1',
            new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds' })
        );

        console.log('\n查询方式1: Mongoose Model (strict: false)');
        const result1 = await DLTRedCombinationsHotWarmColdOptimized1.find({
            base_issue: baseIssue,
            target_issue: targetIssue
        }).lean();
        console.log(`  结果数量: ${result1.length}`);

        // 方式2：直接使用db.collection
        console.log('\n查询方式2: db.collection (原生查询)');
        const result2 = await correctColl.find({
            base_issue: baseIssue,
            target_issue: targetIssue
        }).toArray();
        console.log(`  结果数量: ${result2.length}`);

        // 方式3：尝试数字类型查询
        console.log('\n查询方式3: 数字类型 (Number)');
        const result3 = await correctColl.find({
            base_issue: parseInt(baseIssue),
            target_issue: parseInt(targetIssue)
        }).toArray();
        console.log(`  结果数量: ${result3.length}`);

        // 方式4：使用 $or 查询（模拟任务创建时的查询）
        console.log('\n查询方式4: $or 查询 (任务创建时使用的方式)');
        const result4 = await correctColl.find({
            $or: [{
                base_issue: baseIssue,
                target_issue: targetIssue
            }]
        }).toArray();
        console.log(`  结果数量: ${result4.length}`);

        // 5. 检查数据库中是否存在这个期号对
        console.log(`\n========================================`);
        console.log(`🔍 检查期号对是否存在于数据库`);
        console.log(`========================================`);

        const allPairs = await correctColl.find({})
            .sort({ target_id: -1 })
            .limit(10)
            .project({ base_issue: 1, target_issue: 1, base_id: 1, target_id: 1 })
            .toArray();

        console.log('\n最新10个期号对:');
        allPairs.forEach((pair, i) => {
            console.log(`  ${i + 1}. ${pair.base_issue} → ${pair.target_issue} (base_id=${pair.base_id}, target_id=${pair.target_id})`);
        });

        // 6. 检查是否存在目标期号对
        const targetPairExists = allPairs.some(p =>
            p.base_issue == baseIssue && p.target_issue == targetIssue
        );
        console.log(`\n期号对 ${baseIssue} → ${targetIssue} 是否存在: ${targetPairExists ? '✅ 是' : '❌ 否'}`);

        // 7. 如果不存在，检查是否需要生成
        if (!targetPairExists) {
            console.log(`\n⚠️ 期号对不存在的可能原因:`);
            console.log(`  1. 热温冷优化表尚未生成该期号对的数据`);
            console.log(`  2. target_issue (${targetIssue}) 是推算期，可能未被预先生成`);
            console.log(`  3. 数据生成脚本可能只生成了已开奖期的数据`);
        }

        // 8. 检查是否有 is_predicted = true 的记录
        console.log(`\n========================================`);
        console.log(`🔮 检查推算期数据`);
        console.log(`========================================`);

        const predictedCount = await correctColl.countDocuments({ is_predicted: true });
        console.log(`is_predicted=true 的记录数: ${predictedCount}`);

        if (predictedCount > 0) {
            const predictedSamples = await correctColl.find({ is_predicted: true })
                .limit(5)
                .toArray();
            console.log('\n推算期样本:');
            predictedSamples.forEach((doc, i) => {
                console.log(`  ${i + 1}. ${doc.base_issue} → ${doc.target_issue}`);
            });
        }

        // 9. 总结分析
        console.log(`\n========================================`);
        console.log(`📝 诊断总结`);
        console.log(`========================================`);
        console.log(`1. 集合名称: ${correctCollName} ✅ 正确`);
        console.log(`2. 记录总数: ${totalCount}`);
        console.log(`3. 推算期记录数: ${predictedCount}`);
        console.log(`4. 查询测试: 字符串=${result1.length || result2.length || result4.length}, 数字=${result3.length}`);
        console.log(`5. 目标期号对存在: ${targetPairExists ? '✅' : '❌'}`);

        if (!targetPairExists) {
            console.log(`\n🔧 建议解决方案:`);
            console.log(`  - 确认热温冷优化表生成脚本是否包含推算期`);
            console.log(`  - 检查 target_issue 的数据类型（String vs Number）`);
            console.log(`  - 手动生成缺失的期号对数据`);
        }

    } catch (error) {
        console.error('❌ 错误:', error);
        console.error('错误堆栈:', error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n已断开数据库连接');
    }
}

diagnoseHwcDataIssue();
