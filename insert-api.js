const fs = require('fs');

const filePath = 'src/server/server.js';
let content = fs.readFileSync(filePath, 'utf8');

// 使用数组拼接来避免模板字符串的转义问题
const lines = [
    '',
    '/**',
    ' * 增量更新API - 只处理新增的开奖数据',
    ' * POST /api/dlt/unified-update-incremental',
    ' */',
    "app.post('/api/dlt/unified-update-incremental', async (req, res) => {",
    '    const startTime = Date.now();',
    "    log('═══════════════════════════════════════════════════════════════');",
    "    log('⚡ 开始一键增量更新所有数据表');",
    "    log('═══════════════════════════════════════════════════════════════\n');",
    '',
    '    try {',
    '        const results = {',
    '            missingTable: { newRecords: 0 },',
    '            statistics: { newRecords: 0 },',
    '            comboFeatures: { newRecords: 0 },',
    '            hwcOptimized: { createdCount: 0, totalCount: 0 }',
    '        };',
    '',
    '        const totalDltRecords = await hit_dlts.countDocuments();',
    '',
    "        log('📊 步骤1/4: 增量更新遗漏值表...');",
    '        const redMissingCount = await mongoose.connection.db',
    "            .collection('hit_dlt_basictrendchart_redballmissing_histories')",
    '            .countDocuments();',
    '',
    '        if (redMissingCount < totalDltRecords) {',
    '            const missingResult = await generateUnifiedMissingTables();',
    '            results.missingTable.newRecords = totalDltRecords - redMissingCount;',
    "            log('✅ 遗漏值表更新完成，新增 ' + results.missingTable.newRecords + ' 条\n');",
    '        } else {',
    "            log('✅ 遗漏值表已是最新 (' + redMissingCount + '/' + totalDltRecords + ')\n');",
    '        }',
    '',
    "        log('📊 步骤2/4: 增量更新statistics字段...');",
    "        const statsCount = await hit_dlts.countDocuments({ 'statistics.frontSum': { $exists: true } });",
    '',
    '        if (statsCount < totalDltRecords) {',
    '            const statsResult = await generateUnifiedStatistics();',
    '            results.statistics.newRecords = totalDltRecords - statsCount;',
    "            log('✅ statistics字段更新完成，新增 ' + results.statistics.newRecords + ' 条\n');",
    '        } else {',
    "            log('✅ statistics字段已是最新 (' + statsCount + '/' + totalDltRecords + ')\n');",
    '        }',
    '',
    "        log('📊 步骤3/4: 增量更新组合特征表...');",
    '        const comboCount = await mongoose.connection.db',
    "            .collection('hit_dlt_combofeatures')",
    '            .countDocuments();',
    '',
    '        if (comboCount < totalDltRecords) {',
    '            const comboResult = await generateUnifiedComboFeatures();',
    '            results.comboFeatures.newRecords = totalDltRecords - comboCount;',
    "            log('✅ 组合特征表更新完成，新增 ' + results.comboFeatures.newRecords + ' 条\n');",
    '        } else {',
    "            log('✅ 组合特征表已是最新 (' + comboCount + '/' + totalDltRecords + ')\n');",
    '        }',
    '',
    "        log('📊 步骤4/4: 增量更新热温冷优化表...');",
    '        const hwcResult = await generateUnifiedHotWarmColdOptimizedTable({ fullRegeneration: false });',
    '        results.hwcOptimized = hwcResult || { createdCount: 0, totalCount: 0 };',
    "        log('✅ 热温冷优化表更新完成，新增 ' + results.hwcOptimized.createdCount + ' 条\n');",
    '',
    "        log('🔍 验证数据完整性...');",
    '        const verifyResult = await verifyUnifiedData();',
    '',
    '        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);',
    "        log('═══════════════════════════════════════════════════════════════');",
    "        log('✅ 一键增量更新完成，总耗时 ' + elapsed + ' 秒');",
    "        log('═══════════════════════════════════════════════════════════════\n');",
    '',
    '        res.json({',
    '            success: true,',
    "            message: '增量更新完成',",
    "            totalTime: elapsed + 's',",
    '            results: results,',
    '            verification: verifyResult',
    '        });',
    '',
    '    } catch (error) {',
    "        log('❌ 增量更新失败: ' + error.message);",
    '        log(error.stack);',
    '        res.status(500).json({',
    '            success: false,',
    '            message: error.message',
    '        });',
    '    }',
    '});',
    ''
];

const newApiCode = lines.join('\r\n');

// 查找插入点
const searchStr = '/**\r\n * 执行统一更新任务 (带进度推送)\r\n */\r\nasync function executeUnifiedUpdate';
let insertIdx = content.indexOf(searchStr);

if (insertIdx === -1) {
    const searchStrLF = '/**\n * 执行统一更新任务 (带进度推送)\n */\nasync function executeUnifiedUpdate';
    insertIdx = content.indexOf(searchStrLF);
}

if (insertIdx > 0) {
    content = content.substring(0, insertIdx) + newApiCode + content.substring(insertIdx);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('增量更新API已成功添加');
} else {
    console.log('未找到插入位置');
}
