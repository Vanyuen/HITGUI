/**
 * 诊断推算期误判bug
 * 用户反馈：大量已开奖期号被错误标记为 (推算)
 */

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function diagnose() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 已连接到MongoDB\n');

        // 定义Schema
        const hit_dlts = mongoose.model('hit_dlts', new mongoose.Schema({}, { strict: false }));

        // 尝试多个可能的collection名称
        let HwcPositivePredictionTask, HwcPositivePredictionTaskResult;
        let latestTask;

        const possibleTaskCollections = [
            'hwcpositivepredictiontasks',
            'HIT_DLT_HwcPositivePredictionTask',
            'hit_dlt_hwcpositivepredictiontasks',
            'hwc_positive_prediction_tasks'
        ];

        for (const collName of possibleTaskCollections) {
            try {
                const TempModel = mongoose.model(collName + '_temp', new mongoose.Schema({}, { strict: false }), collName);
                const task = await TempModel.findOne().sort({ created_at: -1 }).lean();
                if (task) {
                    latestTask = task;
                    HwcPositivePredictionTask = TempModel;
                    console.log(`✅ 找到任务 collection: ${collName}`);
                    break;
                }
            } catch (e) {
                // 继续尝试下一个
            }
        }

        if (!latestTask) {
            console.log('❌ 在所有可能的collection中都没有找到任务');
            console.log('尝试过的collections:', possibleTaskCollections.join(', '));
            return;
        }

        // 找到对应的Result collection
        const possibleResultCollections = [
            'hwcpositivepredictiontaskresults',
            'HwcPositivePredictionTaskResult',
            'hit_dlt_hwcpositivepredictiontaskresults'
        ];

        for (const collName of possibleResultCollections) {
            try {
                const TempModel = mongoose.model(collName + '_temp_result', new mongoose.Schema({}, { strict: false }), collName);
                const count = await TempModel.countDocuments({ task_id: latestTask.task_id });
                if (count > 0) {
                    HwcPositivePredictionTaskResult = TempModel;
                    console.log(`✅ 找到结果 collection: ${collName}`);
                    break;
                }
            } catch (e) {
                // 继续尝试下一个
            }
        }

        if (!HwcPositivePredictionTaskResult) {
            console.log('❌ 没有找到对应的结果collection');
            return;
        }

        console.log('📋 最新任务信息:');
        console.log(`  任务ID: ${latestTask.task_id}`);
        console.log(`  任务名称: ${latestTask.task_name}`);
        console.log(`  期号范围: ${latestTask.period_range.start} - ${latestTask.period_range.end}`);
        console.log(`  创建时间: ${latestTask.created_at}`);
        console.log('');

        // 2. 查看任务结果中的推算期标记情况
        const results = await HwcPositivePredictionTaskResult.find({ task_id: latestTask.task_id })
            .sort({ period: 1 })
            .lean();

        console.log('📊 任务结果分析:');
        console.log(`  总期数: ${results.length}`);

        const predictedCount = results.filter(r => r.is_predicted).length;
        const drawnCount = results.filter(r => !r.is_predicted).length;

        console.log(`  标记为推算期: ${predictedCount}期 ❌`);
        console.log(`  标记为已开奖: ${drawnCount}期 ✅`);
        console.log('');

        // 3. 查看数据库中实际存在的期号
        console.log('🔍 数据库实际数据检查:');

        // 查询数据库中最新的期号
        const latestIssue = await hit_dlts.findOne()
            .sort({ Issue: -1 })
            .lean();

        if (latestIssue) {
            console.log(`  数据库最新期号: ${latestIssue.Issue} (ID: ${latestIssue.ID})`);
        }

        // 获取任务期号范围
        const startIssue = parseInt(latestTask.period_range.start);
        const endIssue = parseInt(latestTask.period_range.end);

        // 查询期号范围内数据库中实际存在的期号
        const existingIssues = await hit_dlts.find({
            Issue: { $gte: startIssue, $lte: endIssue }
        })
            .select('Issue ID')
            .sort({ Issue: 1 })
            .lean();

        console.log(`  期号范围 ${startIssue}-${endIssue}:`);
        console.log(`    数据库中存在的期号数量: ${existingIssues.length}期`);
        console.log(`    任务处理的期号数量: ${results.length}期`);
        console.log('');

        // 4. 对比分析
        console.log('🔍 误判分析:');

        // 构建期号集合
        const existingIssueSet = new Set(existingIssues.map(i => i.Issue.toString()));

        // 检查被误判的期号
        const wronglyMarkedAsPredicted = [];
        const correctlyMarkedAsPredicted = [];

        for (const result of results) {
            const period = result.period.toString();
            const isInDB = existingIssueSet.has(period);

            if (result.is_predicted && isInDB) {
                // 数据库中存在，但被标记为推算期 = 误判
                wronglyMarkedAsPredicted.push({
                    period: period,
                    dbRecord: existingIssues.find(i => i.Issue.toString() === period)
                });
            } else if (result.is_predicted && !isInDB) {
                // 数据库中不存在，标记为推算期 = 正确
                correctlyMarkedAsPredicted.push(period);
            }
        }

        console.log(`  ❌ 被误判为推算期的已开奖期号: ${wronglyMarkedAsPredicted.length}期`);
        if (wronglyMarkedAsPredicted.length > 0) {
            console.log(`  示例误判期号 (前10个):`);
            wronglyMarkedAsPredicted.slice(0, 10).forEach(item => {
                console.log(`    期号${item.period} (数据库ID: ${item.dbRecord.ID}) ← 应该标记为已开奖`);
            });
        }
        console.log('');

        console.log(`  ✅ 正确标记为推算期的期号: ${correctlyMarkedAsPredicted.length}期`);
        if (correctlyMarkedAsPredicted.length > 0) {
            console.log(`  推算期号列表: ${correctlyMarkedAsPredicted.join(', ')}`);
        }
        console.log('');

        // 5. 根因分析
        console.log('🔎 根因分析:');
        console.log('');
        console.log('判断逻辑位置: src/server/server.js:16803-16804');
        console.log('```javascript');
        console.log('const issueExists = this.issueToIdMap.has(targetIssue.toString());');
        console.log('isPredicted = !issueExists;  // 不在映射中 = 未开奖 = 推算期');
        console.log('```');
        console.log('');
        console.log('issueToIdMap 构建位置: src/server/server.js:16585-16588');
        console.log('```javascript');
        console.log('this.issueToIdMap = new Map();');
        console.log('for (const record of targetRecords) {');
        console.log('    this.issueToIdMap.set(record.Issue.toString(), record.ID);');
        console.log('}');
        console.log('```');
        console.log('');
        console.log('targetRecords 查询位置: src/server/server.js:16472-16477');
        console.log('```javascript');
        console.log('const targetRecords = await hit_dlts.find({');
        console.log('    Issue: { $in: issueNumbers }');
        console.log('})');
        console.log('    .select(\'Issue ID\')');
        console.log('    .sort({ ID: 1 })');
        console.log('    .lean();');
        console.log('```');
        console.log('');

        // 6. 可能原因
        console.log('❓ 可能的bug原因:');
        console.log('');
        console.log('1. **issueNumbers 为空或格式错误**');
        console.log('   → targetRecords 查询结果为空');
        console.log('   → issueToIdMap 为空');
        console.log('   → 所有期号都不在 issueToIdMap 中');
        console.log('   → 所有期号都被标记为推算期');
        console.log('');
        console.log('2. **数据库查询条件不匹配**');
        console.log('   → Issue 字段类型不匹配 (字符串 vs 数字)');
        console.log('   → $in 操作符查询失败');
        console.log('   → targetRecords 为空');
        console.log('');
        console.log('3. **preloadData 方法未被正确调用**');
        console.log('   → issueToIdMap 未初始化');
        console.log('   → 默认为空 Map');
        console.log('   → 所有期号都被标记为推算期');
        console.log('');

        // 7. 建议修复方案
        console.log('💡 建议修复方案:');
        console.log('');
        console.log('**方案A: 使用全局缓存的 issueToIDMap (推荐)**');
        console.log('位置: src/server/server.js:16803');
        console.log('```javascript');
        console.log('// ✅ 修复前:');
        console.log('// const issueExists = this.issueToIdMap.has(targetIssue.toString());');
        console.log('');
        console.log('// ✅ 修复后:');
        console.log('const issueExists = globalCacheManager.issueToIDMap?.has(targetIssue.toString()) ||');
        console.log('                    this.issueToIdMap?.has(targetIssue.toString());');
        console.log('isPredicted = !issueExists;');
        console.log('```');
        console.log('');
        console.log('**方案B: 直接查询数据库判断期号是否存在**');
        console.log('位置: src/server/server.js:16803-16840');
        console.log('```javascript');
        console.log('// ✅ 修复：直接查询数据库判断期号是否存在');
        console.log('const targetData = await hit_dlts.findOne({ Issue: parseInt(targetIssue) })');
        console.log('    .select(\'Issue\')');
        console.log('    .lean();');
        console.log('const isPredicted = !targetData;  // 数据库中不存在 = 推算期');
        console.log('```');
        console.log('');
        console.log('**方案C: 增强 preloadData 的错误处理和日志**');
        console.log('位置: src/server/server.js:16472-16485');
        console.log('```javascript');
        console.log('const targetRecords = await hit_dlts.find({');
        console.log('    Issue: { $in: issueNumbers }');
        console.log('})');
        console.log('    .select(\'Issue ID\')');
        console.log('    .sort({ ID: 1 })');
        console.log('    .lean();');
        console.log('');
        console.log('log(`  📊 issueNumbers: ${issueNumbers.length}个期号`);');
        console.log('log(`  📊 targetRecords: ${targetRecords.length}条记录`);');
        console.log('');
        console.log('if (targetRecords.length === 0 && issueNumbers.length > 0) {');
        console.log('    log(`  ⚠️ 警告: 查询到0条记录，可能导致所有期号被误判为推算期！`);');
        console.log('    log(`  期号示例: ${issueNumbers.slice(0, 5).join(\', \')}`);');
        console.log('}');
        console.log('```');
        console.log('');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n已断开MongoDB连接');
    }
}

diagnose();
