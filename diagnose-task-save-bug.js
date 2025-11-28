/**
 * 全面诊断热温冷正选批量预测功能 - 任务保存失败根本原因分析
 */

const fs = require('fs');
const mongoose = require('mongoose');

async function diagnoseBug() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('\n===== 全面诊断热温冷正选批量预测功能 =====\n');

        const db = mongoose.connection.db;

        // ====== 第一部分：数据库状态检查 ======
        console.log('【第一部分：数据库状态检查】\n');

        // 1. 检查任务表
        const taskCount = await db.collection('predictiontasks').countDocuments({});
        console.log(`1. PredictionTask 集合记录数: ${taskCount}`);

        if (taskCount > 0) {
            const latestTask = await db.collection('predictiontasks').findOne({}, { sort: { created_at: -1 } });
            console.log(`   最新任务ID: ${latestTask._id}`);
            console.log(`   任务名称: ${latestTask.task_name}`);
            console.log(`   状态: ${latestTask.status}`);
            console.log(`   创建时间: ${latestTask.created_at}`);
        } else {
            console.log('   ❌ 数据库中无任务记录！');
        }

        // 2. 检查任务结果表
        const resultCount = await db.collection('predictiontaskresults').countDocuments({});
        console.log(`\n2. PredictionTaskResult 集合记录数: ${resultCount}`);

        if (resultCount > 0) {
            const latestResult = await db.collection('predictiontaskresults').findOne({}, { sort: { created_at: -1 } });
            console.log(`   最新结果ID: ${latestResult._id}`);
            console.log(`   任务ID: ${latestResult.task_id}`);
            console.log(`   期号: ${latestResult.period}`);
        } else {
            console.log('   ❌ 数据库中无任务结果记录！');
        }

        // 3. 检查排除详情表
        const exclusionCount = await db.collection('hit_dlt_exclusiondetails').countDocuments({});
        console.log(`\n3. DLTExclusionDetails 集合记录数: ${exclusionCount}`);

        if (exclusionCount > 0) {
            const latestExclusion = await db.collection('hit_dlt_exclusiondetails').findOne({}, { sort: { _id: -1 } });
            console.log(`   最新排除详情ID: ${latestExclusion._id}`);
            console.log(`   任务ID: ${latestExclusion.task_id}`);
            console.log(`   结果ID: ${latestExclusion.result_id}`);
            console.log(`   期号: ${latestExclusion.period}`);
            console.log(`   Step: ${latestExclusion.step}`);

            // 检查孤儿记录（没有对应任务的排除详情）
            const orphanExclusions = await db.collection('hit_dlt_exclusiondetails').aggregate([
                {
                    $lookup: {
                        from: 'predictiontasks',
                        localField: 'task_id',
                        foreignField: '_id',
                        as: 'task'
                    }
                },
                {
                    $match: { task: { $size: 0 } }
                },
                { $count: 'orphan_count' }
            ]).toArray();

            if (orphanExclusions.length > 0) {
                console.log(`   ⚠️ 孤儿排除详情记录数: ${orphanExclusions[0].orphan_count}`);
            }
        }

        // ====== 第二部分：代码结构分析 ======
        console.log('\n\n【第二部分：代码结构分析】\n');

        const currentCode = fs.readFileSync('E:\\HITGUI\\src\\server\\server.js', 'utf8');
        const backupCode = fs.readFileSync('E:\\HITGUI\\src\\server\\server.js.backup_metadata_enhancement_20251114', 'utf8');

        // 1. 检查关键函数是否存在语法错误
        console.log('1. 关键函数语法检查:\n');

        const criticalFunctions = [
            'processHwcPositiveTask',
            'saveExclusionDetailsBatch',
            'PredictionTask.save',
            'PredictionTaskResult.save'
        ];

        for (const funcName of criticalFunctions) {
            const currentMatches = currentCode.match(new RegExp(funcName, 'g'));
            const backupMatches = backupCode.match(new RegExp(funcName, 'g'));

            console.log(`   ${funcName}:`);
            console.log(`     当前文件出现次数: ${currentMatches ? currentMatches.length : 0}`);
            console.log(`     备份文件出现次数: ${backupMatches ? backupMatches.length : 0}`);
        }

        // 2. 检查 p-limit 导入
        console.log('\n2. p-limit 依赖检查:');
        const pLimitImport = currentCode.match(/const pLimit = require\('p-limit'\)/);
        console.log(`   p-limit 导入: ${pLimitImport ? '✅ 已导入' : '❌ 未导入'}`);

        // 3. 检查关键修改点
        console.log('\n3. 关键修改点检查:\n');

        // 检查 metadata 字段定义
        const metadataSchemaMatch = currentCode.match(/metadata:\s*{[\s\S]{0,1000}conflict_pairs:/);
        console.log(`   DLTExclusionDetails metadata 字段: ${metadataSchemaMatch ? '✅ 已定义' : '❌ 未定义'}`);

        // 检查排除详情保存逻辑修改
        const alwaysSavePattern = /\/\/ ⭐ 2025-11-14: 始终保存排除详情/g;
        const alwaysSaveMatches = currentCode.match(alwaysSavePattern);
        console.log(`   始终保存排除详情注释出现次数: ${alwaysSaveMatches ? alwaysSaveMatches.length : 0}`);

        // 检查 Step 10 完整实现
        const step10ImplPattern = /\/\/ ⭐ 2025-11-14: 完整实现同现比排除逻辑/;
        const step10ImplMatch = currentCode.match(step10ImplPattern);
        console.log(`   Step 10 完整实现标记: ${step10ImplMatch ? '✅ 已标记' : '❌ 未标记'}`);

        // ====== 第三部分：潜在BUG分析 ======
        console.log('\n\n【第三部分：潜在BUG分析】\n');

        // 分析1：检查是否有未闭合的括号/引号
        console.log('1. 语法结构分析:');
        const openBraces = (currentCode.match(/{/g) || []).length;
        const closeBraces = (currentCode.match(/}/g) || []).length;
        console.log(`   大括号: 开 ${openBraces} vs 闭 ${closeBraces} ${openBraces === closeBraces ? '✅' : '❌ 不匹配!'}`);

        const openParens = (currentCode.match(/\(/g) || []).length;
        const closeParens = (currentCode.match(/\)/g) || []).length;
        console.log(`   小括号: 开 ${openParens} vs 闭 ${closeParens} ${openParens === closeParens ? '✅' : '❌ 不匹配!'}`);

        // 分析2：检查任务保存相关代码
        console.log('\n2. 任务保存代码检查:');

        // 查找 newTask.save() 调用
        const taskSavePattern = /await\s+newTask\.save\(\)/g;
        const taskSaveMatches = currentCode.match(taskSavePattern);
        console.log(`   await newTask.save() 调用次数: ${taskSaveMatches ? taskSaveMatches.length : 0}`);

        // 查找 PredictionTaskResult.save() 调用
        const resultSavePattern = /await\s+\w+\.save\(\)/g;
        const resultSaveMatches = currentCode.match(resultSavePattern);
        console.log(`   await xxx.save() 调用总数: ${resultSaveMatches ? resultSaveMatches.length : 0}`);

        // 分析3：检查错误处理
        console.log('\n3. 错误处理检查:');

        // 查找 catch 块中的 log 或 console
        const catchBlocks = currentCode.match(/catch\s*\([^)]*\)\s*{[\s\S]{0,500}?}/g) || [];
        console.log(`   总 catch 块数量: ${catchBlocks.length}`);

        let silentCatchCount = 0;
        for (const catchBlock of catchBlocks) {
            if (!catchBlock.includes('log(') && !catchBlock.includes('console.')) {
                silentCatchCount++;
            }
        }
        console.log(`   静默错误处理块数: ${silentCatchCount} ${silentCatchCount > 0 ? '⚠️' : '✅'}`);

        // 分析4：检查 async/await 使用
        console.log('\n4. async/await 使用检查:');

        // 查找可能遗漏 await 的 save() 调用
        const saveWithoutAwait = currentCode.match(/(?<!await\s+)\w+\.save\(\)/g) || [];
        console.log(`   可能遗漏 await 的 save() 调用: ${saveWithoutAwait.length} ${saveWithoutAwait.length > 0 ? '⚠️' : '✅'}`);
        if (saveWithoutAwait.length > 0 && saveWithoutAwait.length <= 5) {
            saveWithoutAwait.forEach(match => {
                console.log(`     - ${match}`);
            });
        }

        // ====== 第四部分：对比备份文件差异 ======
        console.log('\n\n【第四部分：对比备份文件差异】\n');

        // 提取关键函数代码进行对比
        const extractFunction = (code, funcName) => {
            const regex = new RegExp(`async function ${funcName}[\\s\\S]{0,50000}?\\n(?=async function|app\\.|module\\.exports)`, 'm');
            const match = code.match(regex);
            return match ? match[0] : null;
        };

        const processTaskFuncCurrent = extractFunction(currentCode, 'processHwcPositiveTask');
        const processTaskFuncBackup = extractFunction(backupCode, 'processHwcPositiveTask');

        if (processTaskFuncCurrent && processTaskFuncBackup) {
            const currentLines = processTaskFuncCurrent.split('\n').length;
            const backupLines = processTaskFuncBackup.split('\n').length;
            console.log(`1. processHwcPositiveTask 函数行数对比:`);
            console.log(`   当前版本: ${currentLines} 行`);
            console.log(`   备份版本: ${backupLines} 行`);
            console.log(`   差异: ${currentLines - backupLines > 0 ? '+' : ''}${currentLines - backupLines} 行`);

            // 检查是否包含关键代码
            const hasTaskSaveCurrent = processTaskFuncCurrent.includes('await newTask.save()');
            const hasTaskSaveBackup = processTaskFuncBackup.includes('await newTask.save()');
            console.log(`   包含任务保存代码: 当前 ${hasTaskSaveCurrent ? '✅' : '❌'} / 备份 ${hasTaskSaveBackup ? '✅' : '❌'}`);

            const hasResultSaveCurrent = processTaskFuncCurrent.includes('await periodResult.save()');
            const hasResultSaveBackup = processTaskFuncBackup.includes('await periodResult.save()');
            console.log(`   包含结果保存代码: 当前 ${hasResultSaveCurrent ? '✅' : '❌'} / 备份 ${hasResultSaveBackup ? '✅' : '❌'}`);
        }

        // ====== 第五部分：可能的BUG原因总结 ======
        console.log('\n\n【第五部分：可能的BUG原因总结】\n');

        const possibleReasons = [];

        if (taskCount === 0 && exclusionCount > 0) {
            possibleReasons.push('❌ 数据库有排除详情但无任务记录 → 任务保存逻辑被跳过或失败');
        }

        if (taskCount === 0 && resultCount === 0) {
            possibleReasons.push('❌ 任务和结果都未保存 → 可能是保存前的异常退出或条件判断错误');
        }

        if (silentCatchCount > 0) {
            possibleReasons.push(`⚠️ 发现 ${silentCatchCount} 个静默错误处理块 → 可能吞掉了关键错误信息`);
        }

        if (saveWithoutAwait.length > 0) {
            possibleReasons.push(`⚠️ 发现 ${saveWithoutAwait.length} 个可能遗漏 await 的 save() 调用`);
        }

        if (possibleReasons.length === 0) {
            possibleReasons.push('✅ 未发现明显语法错误，需要运行时调试');
        }

        console.log('可能的BUG原因:\n');
        possibleReasons.forEach((reason, index) => {
            console.log(`   ${index + 1}. ${reason}`);
        });

        console.log('\n\n===== 诊断完成 =====\n');
        mongoose.connection.close();

    } catch (error) {
        console.error('诊断过程出错:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

diagnoseBug();
