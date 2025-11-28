const mongoose = require('mongoose');

console.log('🔍 模拟HWC查询过程...\n');

async function simulate() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功\n');

        // 定义Schema（与server.js完全一致）
        const Schema = mongoose.Schema;
        const dltRedCombinationsHotWarmColdOptimizedSchema = new Schema({
            base_issue: { type: String, required: true },
            target_issue: { type: String, required: true },
            base_id: { type: Number, required: false },
            target_id: { type: Number, required: false },
            hot_warm_cold_data: {
                type: Map,
                of: [Number],
                required: true
            },
            total_combinations: { type: Number, required: true }
        }, { timestamps: true });

        const DLTRedCombinationsHotWarmColdOptimized = mongoose.model(
            'HIT_DLT_RedCombinationsHotWarmColdOptimized',
            dltRedCombinationsHotWarmColdOptimizedSchema,
            'hit_dlt_redcombinationshotwarmcoldoptimizeds'
        );

        // 模拟期号对生成（与preloadData完全一致）
        console.log('📋 步骤1: 模拟期号对生成...');

        const issueNumbers = [25120, 25121, 25122, 25123, 25124, 25125];

        // 模拟hit_dlts表的Schema
        const hitDLTSchema = new Schema({
            Issue: Number,
            ID: Number
        }, { collection: 'hit_dlts' });
        const hit_dlts = mongoose.model('TestHitDLT', hitDLTSchema, 'hit_dlts');

        // 查询第一个期号
        const firstIssueRecord = await hit_dlts.findOne({ Issue: issueNumbers[0] })
            .select('Issue ID')
            .lean();

        console.log(`第一个期号: ${firstIssueRecord.Issue} (ID=${firstIssueRecord.ID})`);

        // 第1步：查询第一个期号的base期（ID-1）
        const baseIssueRecord = await hit_dlts.findOne({ ID: firstIssueRecord.ID - 1 })
            .select('Issue ID')
            .lean();

        console.log(`base期: ${baseIssueRecord ? baseIssueRecord.Issue + ' (ID=' + baseIssueRecord.ID + ')' : '不存在'}`);

        // 第2步：查询所有目标期号
        const targetRecords = await hit_dlts.find({
            Issue: { $in: issueNumbers }
        })
            .select('Issue ID')
            .sort({ ID: 1 })
            .lean();

        console.log(`目标期号: ${targetRecords.length}个`);

        // 合并所有记录
        const allRecords = baseIssueRecord
            ? [baseIssueRecord, ...targetRecords]
            : targetRecords;

        console.log(`总记录数: ${allRecords.length}个\n`);

        // 构建ID→Record映射
        const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));

        // 生成期号对
        const issueRecords = allRecords.filter(r => issueNumbers.includes(r.Issue));
        const issuePairs = [];

        for (const record of issueRecords) {
            const targetID = record.ID;
            const targetIssue = record.Issue.toString();
            const baseRecord = idToRecordMap.get(targetID - 1);

            if (baseRecord) {
                issuePairs.push({
                    base_issue: baseRecord.Issue.toString(),
                    target_issue: targetIssue
                });
                console.log(`  ✅ 期号对: ${baseRecord.Issue}→${targetIssue} (类型: ${typeof baseRecord.Issue.toString()}, ${typeof targetIssue})`);
            } else {
                console.log(`  ⚠️ 期号${targetIssue}的base期不存在，跳过`);
            }
        }

        console.log(`\n共生成${issuePairs.length}个期号对\n`);

        // 步骤2: 查询HWC优化数据（与preloadHwcOptimizedData完全一致）
        console.log('📋 步骤2: 查询HWC优化数据...\n');

        console.log('期号对列表:');
        issuePairs.forEach(p => {
            console.log(`  - ${p.base_issue}→${p.target_issue} (类型: ${typeof p.base_issue}, ${typeof p.target_issue})`);
        });

        console.log('\n执行查询...');
        const hwcDataList = await DLTRedCombinationsHotWarmColdOptimized.find({
            $or: issuePairs.map(p => ({
                base_issue: p.base_issue,
                target_issue: p.target_issue
            }))
        }).lean();

        console.log(`\n📊 查询到${hwcDataList.length}条HWC优化数据`);

        if (hwcDataList.length > 0) {
            console.log('样本数据:');
            hwcDataList.forEach(d => {
                const ratios = Object.keys(d.hot_warm_cold_data || {});
                console.log(`  - ${d.base_issue}→${d.target_issue}: ${ratios.length}种比例`);
            });
        } else {
            console.log('⚠️ 没有查询到任何数据！');

            // 手动测试单个查询
            console.log('\n📋 测试单个期号对查询:');
            const testPair = issuePairs[0];
            console.log(`测试: ${testPair.base_issue}→${testPair.target_issue}`);

            const testResult = await DLTRedCombinationsHotWarmColdOptimized.findOne({
                base_issue: testPair.base_issue,
                target_issue: testPair.target_issue
            }).lean();

            console.log(`结果: ${testResult ? '找到' : '未找到'}`);

            // 查询数据库中是否有这些期号
            console.log('\n📋 查询数据库中的期号范围:');
            const minMax = await DLTRedCombinationsHotWarmColdOptimized.find()
                .sort({ target_issue: 1 })
                .limit(1)
                .select('base_issue target_issue')
                .lean();
            const maxIssue = await DLTRedCombinationsHotWarmColdOptimized.find()
                .sort({ target_issue: -1 })
                .limit(1)
                .select('base_issue target_issue')
                .lean();

            console.log(`最小期号对: ${minMax[0].base_issue}→${minMax[0].target_issue}`);
            console.log(`最大期号对: ${maxIssue[0].base_issue}→${maxIssue[0].target_issue}`);
        }

        console.log('\n✅ 模拟完成');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
    }
}

simulate();
