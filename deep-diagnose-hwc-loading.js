const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

console.log('🔍 深度诊断最新任务的HWC数据加载...\n');

async function diagnose() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功\n');

        // 1. 查询最新任务
        const Schema = mongoose.Schema;
        const hwcTaskSchema = new Schema({
            task_id: String,
            task_name: String,
            period_range: Schema.Types.Mixed,
            positive_selection: Schema.Types.Mixed,
            status: String,
            created_at: Date
        }, { collection: 'hwc_positive_prediction_tasks' });

        const HwcTask = mongoose.model('HwcTaskCheck', hwcTaskSchema, 'hwc_positive_prediction_tasks');

        const latestTask = await HwcTask.findOne()
            .sort({ created_at: -1 })
            .lean();

        console.log('📋 最新任务:');
        console.log(`  任务ID: ${latestTask.task_id}`);
        console.log(`  任务名: ${latestTask.task_name}`);
        console.log(`  状态: ${latestTask.status}`);
        console.log(`  期号范围: ${JSON.stringify(latestTask.period_range)}`);
        console.log(`  创建时间: ${latestTask.created_at}\n`);

        // 2. 获取期号范围
        const issueRange = latestTask.period_range.issue_range || [];
        console.log(`📊 期号范围: ${issueRange.join(', ')}\n`);

        // 3. 检查hit_dlts表
        const hitDLTSchema = new Schema({
            Issue: Number,
            ID: Number
        }, { collection: 'hit_dlts' });
        const hit_dlts = mongoose.model('HitDLTCheck2', hitDLTSchema, 'hit_dlts');

        // 查询这些期号的ID
        const records = await hit_dlts.find({
            Issue: { $in: issueRange }
        }).select('Issue ID').sort({ ID: 1 }).lean();

        console.log('📊 期号→ID映射:');
        records.forEach(r => {
            console.log(`  ${r.Issue} → ID=${r.ID}`);
        });

        // 4. 生成期号对（模拟preloadData逻辑）
        console.log('\n📋 生成期号对（使用ID-1规则）:');

        const firstRecord = records[0];
        const baseRecord = await hit_dlts.findOne({ ID: firstRecord.ID - 1 })
            .select('Issue ID')
            .lean();

        const allRecords = baseRecord ? [baseRecord, ...records] : records;
        const idToRecordMap = new Map(allRecords.map(r => [r.ID, r]));

        const issuePairs = [];
        for (const record of records) {
            const targetID = record.ID;
            const targetIssue = record.Issue.toString();
            const base = idToRecordMap.get(targetID - 1);

            if (base) {
                const pair = {
                    base_issue: base.Issue.toString(),
                    target_issue: targetIssue
                };
                issuePairs.push(pair);
                console.log(`  ✅ ${pair.base_issue}→${pair.target_issue}`);
            } else {
                console.log(`  ❌ ${targetIssue}的base期不存在`);
            }
        }

        console.log(`\n共生成${issuePairs.length}个期号对\n`);

        // 5. 查询HWC优化表
        const hwcSchema = new Schema({
            base_issue: String,
            target_issue: String,
            hot_warm_cold_data: Schema.Types.Mixed
        }, { collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds' });

        const HWCModel = mongoose.model('HWCCheck2', hwcSchema, 'hit_dlt_redcombinationshotwarmcoldoptimizeds');

        console.log('📋 查询HWC优化数据...');
        console.log('期号对列表:');
        issuePairs.forEach(p => {
            console.log(`  - ${p.base_issue}→${p.target_issue} (类型: ${typeof p.base_issue}, ${typeof p.target_issue})`);
        });

        const hwcData = await HWCModel.find({
            $or: issuePairs.map(p => ({
                base_issue: p.base_issue,
                target_issue: p.target_issue
            }))
        }).lean();

        console.log(`\n📊 查询结果: ${hwcData.length}条HWC数据`);

        if (hwcData.length > 0) {
            console.log('样本数据:');
            hwcData.forEach(d => {
                const ratios = Object.keys(d.hot_warm_cold_data || {});
                console.log(`  ✅ ${d.base_issue}→${d.target_issue}: ${ratios.length}种比例`);
            });
        } else {
            console.log('❌ 没有查询到任何HWC数据！');
        }

        // 6. 查询任务结果
        const resultSchema = new Schema({
            task_id: String,
            target_issue: String,
            final_combinations: Number,
            step1_basic_combinations: Number,
            is_predicted: Boolean
        }, { collection: 'hwc_positive_prediction_task_results' });

        const ResultModel = mongoose.model('ResultCheck2', resultSchema, 'hwc_positive_prediction_task_results');

        const results = await ResultModel.find({
            task_id: latestTask.task_id
        }).sort({ target_issue: 1 }).lean();

        console.log('\n📊 任务结果:');
        results.forEach(r => {
            console.log(`  期号${r.target_issue}: Step1=${r.step1_basic_combinations}, 最终=${r.final_combinations}, 推算=${r.is_predicted}`);
        });

        // 7. 检查server.js中的模型定义
        console.log('\n📋 检查server.js中的模型定义:');
        const serverPath = path.join(__dirname, 'src', 'server', 'server.js');
        const serverContent = fs.readFileSync(serverPath, 'utf-8');

        // 检查第512行
        const lines = serverContent.split('\n');
        const line512 = lines[511];
        console.log('第512行:');
        console.log(`  ${line512.trim()}`);

        if (line512.includes("'hit_dlt_redcombinationshotwarmcoldoptimizeds'")) {
            console.log('  ✅ 集合名正确');
        } else {
            console.log('  ❌ 集合名错误或缺失');
        }

        // 检查schema定义
        const schemaDefLine = lines.findIndex(l => l.includes('const dltRedCombinationsHotWarmColdOptimizedSchema'));
        if (schemaDefLine !== -1) {
            console.log(`\nSchema定义（第${schemaDefLine + 1}行附近）:`);
            for (let i = schemaDefLine; i < schemaDefLine + 5; i++) {
                console.log(`  ${lines[i].trim()}`);
            }
        }

        console.log('\n✅ 诊断完成');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
    }
}

diagnose();
