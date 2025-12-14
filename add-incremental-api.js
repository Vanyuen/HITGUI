/**
 * 添加增量更新API到 server.js
 */
const fs = require('fs');

const filePath = 'src/server/server.js';
let content = fs.readFileSync(filePath, 'utf8');

// 查找插入位置：在 unified-update API 后面
const insertAfter = `            message: error.message
        });
    }
});

/**
 * 执行统一更新任务 (带进度推送)
 */`;

const newCode = `            message: error.message
        });
    }
});

/**
 * 增量更新API - 只处理新增的开奖数据
 * POST /api/dlt/unified-update-incremental
 */
app.post('/api/dlt/unified-update-incremental', async (req, res) => {
    const startTime = Date.now();
    log('═══════════════════════════════════════════════════════════════');
    log('⚡ 开始一键增量更新所有数据表');
    log('═══════════════════════════════════════════════════════════════\\n');

    try {
        const results = {
            missingTable: { newRecords: 0 },
            statistics: { newRecords: 0 },
            comboFeatures: { newRecords: 0 },
            hwcOptimized: { createdCount: 0, totalCount: 0 }
        };

        // 获取当前数据状态
        const totalDltRecords = await hit_dlts.countDocuments();
        const latestDlt = await hit_dlts.findOne({}).sort({ ID: -1 }).lean();

        // 步骤1: 增量更新遗漏值表
        log('📊 步骤1/4: 增量更新遗漏值表...');
        const redMissingCount = await mongoose.connection.db
            .collection('hit_dlt_basictrendchart_redballmissing_histories')
            .countDocuments();

        if (redMissingCount < totalDltRecords) {
            // 需要生成新的遗漏值记录
            const missingResult = await generateUnifiedMissingTables();
            results.missingTable.newRecords = totalDltRecords - redMissingCount;
            log(\`✅ 遗漏值表更新完成，新增 \${results.missingTable.newRecords} 条\\n\`);
        } else {
            log(\`✅ 遗漏值表已是最新 (\${redMissingCount}/\${totalDltRecords})\\n\`);
        }

        // 步骤2: 增量更新statistics字段
        log('📊 步骤2/4: 增量更新statistics字段...');
        const statsCount = await hit_dlts.countDocuments({ 'statistics.frontSum': { $exists: true } });

        if (statsCount < totalDltRecords) {
            const statsResult = await generateUnifiedStatistics();
            results.statistics.newRecords = totalDltRecords - statsCount;
            log(\`✅ statistics字段更新完成，新增 \${results.statistics.newRecords} 条\\n\`);
        } else {
            log(\`✅ statistics字段已是最新 (\${statsCount}/\${totalDltRecords})\\n\`);
        }

        // 步骤3: 增量更新组合特征表
        log('📊 步骤3/4: 增量更新组合特征表...');
        const comboCount = await mongoose.connection.db
            .collection('hit_dlt_combofeatures')
            .countDocuments();

        if (comboCount < totalDltRecords) {
            const comboResult = await generateUnifiedComboFeatures();
            results.comboFeatures.newRecords = totalDltRecords - comboCount;
            log(\`✅ 组合特征表更新完成，新增 \${results.comboFeatures.newRecords} 条\\n\`);
        } else {
            log(\`✅ 组合特征表已是最新 (\${comboCount}/\${totalDltRecords})\\n\`);
        }

        // 步骤4: 增量更新热温冷优化表
        log('📊 步骤4/4: 增量更新热温冷优化表...');
        const hwcResult = await generateUnifiedHotWarmColdOptimizedTable({ fullRegeneration: false });
        results.hwcOptimized = hwcResult || { createdCount: 0, totalCount: 0 };
        log(\`✅ 热温冷优化表更新完成，新增 \${results.hwcOptimized.createdCount} 条\\n\`);

        // 验证数据完整性
        log('🔍 验证数据完整性...');
        const verifyResult = await verifyUnifiedData();

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        log('═══════════════════════════════════════════════════════════════');
        log(\`✅ 一键增量更新完成，总耗时 \${elapsed} 秒\`);
        log('═══════════════════════════════════════════════════════════════\\n');

        res.json({
            success: true,
            message: '增量更新完成',
            totalTime: \`\${elapsed}s\`,
            results: results,
            verification: verifyResult
        });

    } catch (error) {
        log(\`❌ 增量更新失败: \${error.message}\`);
        log(error.stack);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 执行统一更新任务 (带进度推送)
 */`;

if (content.includes(insertAfter)) {
    content = content.replace(insertAfter, newCode);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ 增量更新API已添加');
} else {
    console.log('❌ 未找到插入位置');
    // 尝试用正则查找
    const regex = /message: error\.message\s*\}\);\s*\}\s*\}\);\s*\/\*\*\s*\* 执行统一更新任务/;
    if (regex.test(content)) {
        console.log('尝试使用正则匹配...');
    }
}
