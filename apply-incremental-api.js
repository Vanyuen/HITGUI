/**
 * 临时脚本：为 server.js 添加增量更新 API
 */
const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'src/server/server.js');
let content = fs.readFileSync(serverPath, 'utf-8');

// 要插入的代码（纯文本）
const newCode = `
/**
 * 一键增量更新API - 只处理新增期号的数据
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
            hwcOptimized: { createdCount: 0 }
        };

        // 步骤1: 增量更新遗漏值表
        log('📊 [1/4] 增量更新遗漏值表...');
        const missingResult = await generateMissingTablesIncremental();
        results.missingTable.newRecords = missingResult.newRecords;
        log(\`   ✅ 新增 \${missingResult.newRecords} 条记录\\n\`);

        // 步骤2: 增量更新statistics字段
        log('📈 [2/4] 增量更新statistics字段...');
        const statsResult = await generateStatisticsIncremental();
        results.statistics.newRecords = statsResult.newRecords;
        log(\`   ✅ 新增 \${statsResult.newRecords} 条记录\\n\`);

        // 步骤3: 增量更新组合特征表
        log('🔢 [3/4] 增量更新组合特征表...');
        const comboResult = await generateComboFeaturesIncremental();
        results.comboFeatures.newRecords = comboResult.newRecords;
        log(\`   ✅ 新增 \${comboResult.newRecords} 条记录\\n\`);

        // 步骤4: 增量更新热温冷优化表（删除旧推算期 + 增量更新）
        log('🔥 [4/4] 增量更新热温冷优化表...');
        const hwcResult = await generateUnifiedHotWarmColdOptimizedTable({ fullRegeneration: false });
        results.hwcOptimized.createdCount = hwcResult?.createdCount || 0;
        log(\`   ✅ 新增 \${results.hwcOptimized.createdCount} 条记录\\n\`);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        log(\`\\n✅ 一键增量更新完成，总耗时 \${elapsed} 秒\`);
        log('═══════════════════════════════════════════════════════════════\\n');

        res.json({
            success: true,
            totalTime: \`\${elapsed}秒\`,
            results
        });
    } catch (error) {
        log(\`❌ 增量更新失败: \${error.message}\`);
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 增量生成遗漏值表 - 只处理新增期号
 */
async function generateMissingTablesIncremental() {
    // 获取遗漏值表最新ID
    const latestRedMissing = await mongoose.connection.db
        .collection('hit_dlt_basictrendchart_redballmissing_histories')
        .findOne({}, { sort: { ID: -1 } });

    const latestMissingID = latestRedMissing?.ID || 0;

    // 获取hit_dlts中比遗漏值表更新的记录
    const newRecords = await hit_dlts.find({ ID: { $gt: latestMissingID } })
        .sort({ ID: 1 }).lean();

    if (newRecords.length === 0) {
        log('   📊 遗漏值表已是最新，无需更新');
        return { newRecords: 0 };
    }

    log(\`   📊 发现 \${newRecords.length} 期新数据需要处理\`);

    // 获取上一期的遗漏值状态作为起点
    let redMissing = Array(35).fill(0);
    let blueMissing = Array(12).fill(0);

    if (latestRedMissing) {
        for (let j = 1; j <= 35; j++) {
            redMissing[j - 1] = latestRedMissing[String(j)] || 0;
        }
        const latestBlueMissing = await mongoose.connection.db
            .collection('hit_dlt_basictrendchart_blueballmissing_histories')
            .findOne({ ID: latestMissingID });
        if (latestBlueMissing) {
            for (let j = 1; j <= 12; j++) {
                blueMissing[j - 1] = latestBlueMissing[String(j)] || 0;
            }
        }
    }

    // 计算热温冷比辅助函数
    const calculateHWCRatio = (missingValues) => {
        let hot = 0, warm = 0, cold = 0;
        missingValues.forEach(missing => {
            if (missing <= 4) hot++;
            else if (missing <= 9) warm++;
            else cold++;
        });
        return \`\${hot}:\${warm}:\${cold}\`;
    };

    const redMissingRecords = [];
    const blueMissingRecords = [];

    for (const record of newRecords) {
        const drawnReds = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5];
        const drawnBlues = [record.Blue1, record.Blue2];

        // 遗漏值递增
        for (let j = 0; j < 35; j++) redMissing[j]++;
        for (let j = 0; j < 12; j++) blueMissing[j]++;

        // 重置开出号码的遗漏值
        drawnReds.forEach(ball => { redMissing[ball - 1] = 0; });
        drawnBlues.forEach(ball => { blueMissing[ball - 1] = 0; });

        const hotWarmColdRatio = calculateHWCRatio(redMissing);

        // 红球遗漏记录
        const redRecord = {
            ID: record.ID,
            Issue: record.Issue.toString(),
            DrawingDay: record.DrawDate ? new Date(record.DrawDate).toLocaleDateString('zh-CN') : '',
            FrontHotWarmColdRatio: hotWarmColdRatio
        };
        for (let j = 0; j < 35; j++) {
            redRecord[(j + 1).toString()] = redMissing[j];
        }
        redMissingRecords.push(redRecord);

        // 蓝球遗漏记录
        const blueRecord = {
            ID: record.ID,
            Issue: record.Issue.toString(),
            DrawingDay: record.DrawDate ? new Date(record.DrawDate).toLocaleDateString('zh-CN') : ''
        };
        for (let j = 0; j < 12; j++) {
            blueRecord[(j + 1).toString()] = blueMissing[j];
        }
        blueMissingRecords.push(blueRecord);
    }

    // 插入新记录
    if (redMissingRecords.length > 0) {
        await mongoose.connection.db
            .collection('hit_dlt_basictrendchart_redballmissing_histories')
            .insertMany(redMissingRecords);
        await mongoose.connection.db
            .collection('hit_dlt_basictrendchart_blueballmissing_histories')
            .insertMany(blueMissingRecords);
    }

    return { newRecords: newRecords.length };
}

/**
 * 增量生成statistics字段 - 只处理缺少statistics的记录
 */
async function generateStatisticsIncremental() {
    // 查找没有statistics字段的记录
    const recordsWithoutStats = await hit_dlts.find({
        $or: [
            { statistics: { $exists: false } },
            { statistics: null }
        ]
    }).sort({ ID: 1 }).lean();

    if (recordsWithoutStats.length === 0) {
        log('   📈 statistics字段已是最新，无需更新');
        return { newRecords: 0 };
    }

    log(\`   📈 发现 \${recordsWithoutStats.length} 条记录需要更新statistics\`);

    // 获取遗漏值映射
    const allRedMissing = await mongoose.connection.db
        .collection('hit_dlt_basictrendchart_redballmissing_histories')
        .find({}).sort({ ID: 1 }).toArray();
    const missingMap = new Map();
    allRedMissing.forEach(record => missingMap.set(record.ID, record));

    let updateCount = 0;

    for (const record of recordsWithoutStats) {
        const reds = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5];
        const blues = [record.Blue1, record.Blue2];

        // 基础统计
        const frontSum = reds.reduce((a, b) => a + b, 0);
        const frontSpan = Math.max(...reds) - Math.min(...reds);

        let zone1 = 0, zone2 = 0, zone3 = 0;
        reds.forEach(n => {
            if (n <= 12) zone1++;
            else if (n <= 24) zone2++;
            else zone3++;
        });
        const frontZoneRatio = \`\${zone1}:\${zone2}:\${zone3}\`;

        let frontOdd = 0, frontEven = 0;
        reds.forEach(n => n % 2 === 0 ? frontEven++ : frontOdd++);
        const frontOddEvenRatio = \`\${frontOdd}:\${frontEven}\`;

        const frontAcValue = calculateACValue(reds);

        const backSum = blues.reduce((a, b) => a + b, 0);
        let backOdd = 0, backEven = 0;
        blues.forEach(n => n % 2 === 0 ? backEven++ : backOdd++);
        const backOddEvenRatio = \`\${backOdd}:\${backEven}\`;

        // 热温冷比
        let frontHotWarmColdRatio = '0:0:0';
        const previousMissingRecord = missingMap.get(record.ID - 1);
        if (previousMissingRecord) {
            const missingValues = reds.map(ball => previousMissingRecord[String(ball)] || 0);
            let hot = 0, warm = 0, cold = 0;
            missingValues.forEach(missing => {
                if (missing <= 4) hot++;
                else if (missing <= 9) warm++;
                else cold++;
            });
            frontHotWarmColdRatio = \`\${hot}:\${warm}:\${cold}\`;
        }

        // 连号组数
        const sortedReds = [...reds].sort((a, b) => a - b);
        let consecutiveCount = 0;
        for (let j = 0; j < sortedReds.length - 1; j++) {
            if (sortedReds[j + 1] - sortedReds[j] === 1) consecutiveCount++;
        }

        // 重号数
        let repeatCount = 0;
        const previousRecord = await hit_dlts.findOne({ ID: record.ID - 1 }).lean();
        if (previousRecord) {
            const prevReds = [previousRecord.Red1, previousRecord.Red2, previousRecord.Red3,
                             previousRecord.Red4, previousRecord.Red5];
            repeatCount = reds.filter(r => prevReds.includes(r)).length;
        }

        const statistics = {
            frontSum, frontSpan, frontHotWarmColdRatio, frontZoneRatio,
            frontOddEvenRatio, frontAcValue, backSum, backOddEvenRatio,
            consecutiveCount, repeatCount
        };

        await hit_dlts.updateOne({ ID: record.ID }, { $set: { statistics, updatedAt: new Date() } });
        updateCount++;
    }

    return { newRecords: updateCount };
}

/**
 * 增量生成组合特征表 - 只处理缺少特征的记录
 */
async function generateComboFeaturesIncremental() {
    // 获取组合特征表最新ID
    const latestCombo = await DLTComboFeatures.findOne({}).sort({ ID: -1 }).lean();
    const latestComboID = latestCombo?.ID || 0;

    // 查找比组合特征表更新的记录
    const newRecords = await hit_dlts.find({ ID: { $gt: latestComboID } })
        .sort({ ID: 1 }).lean();

    if (newRecords.length === 0) {
        log('   🔢 组合特征表已是最新，无需更新');
        return { newRecords: 0 };
    }

    log(\`   🔢 发现 \${newRecords.length} 条记录需要生成组合特征\`);

    const generateCombo2 = (balls) => {
        const combos = [];
        for (let i = 0; i < balls.length - 1; i++) {
            for (let j = i + 1; j < balls.length; j++) {
                combos.push(\`\${String(balls[i]).padStart(2, '0')}-\${String(balls[j]).padStart(2, '0')}\`);
            }
        }
        return combos;
    };

    const generateCombo3 = (balls) => {
        const combos = [];
        for (let i = 0; i < balls.length - 2; i++) {
            for (let j = i + 1; j < balls.length - 1; j++) {
                for (let k = j + 1; k < balls.length; k++) {
                    combos.push(\`\${String(balls[i]).padStart(2, '0')}-\${String(balls[j]).padStart(2, '0')}-\${String(balls[k]).padStart(2, '0')}\`);
                }
            }
        }
        return combos;
    };

    const generateCombo4 = (balls) => {
        const combos = [];
        for (let i = 0; i < balls.length - 3; i++) {
            for (let j = i + 1; j < balls.length - 2; j++) {
                for (let k = j + 1; k < balls.length - 1; k++) {
                    for (let l = k + 1; l < balls.length; l++) {
                        combos.push(\`\${String(balls[i]).padStart(2, '0')}-\${String(balls[j]).padStart(2, '0')}-\${String(balls[k]).padStart(2, '0')}-\${String(balls[l]).padStart(2, '0')}\`);
                    }
                }
            }
        }
        return combos;
    };

    const bulkOps = newRecords.map(record => {
        const balls = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5].sort((a, b) => a - b);
        return {
            updateOne: {
                filter: { ID: record.ID },
                update: {
                    $set: {
                        Issue: record.Issue.toString(),
                        combo_2: generateCombo2(balls),
                        combo_3: generateCombo3(balls),
                        combo_4: generateCombo4(balls),
                        updated_at: new Date()
                    },
                    $setOnInsert: { created_at: new Date() }
                },
                upsert: true
            }
        };
    });

    if (bulkOps.length > 0) {
        await DLTComboFeatures.bulkWrite(bulkOps, { ordered: false });
    }

    return { newRecords: newRecords.length };
}

`;

// 查找位置索引
const searchStr = '执行统一更新任务 (带进度推送)';
const idx = content.indexOf(searchStr);

if (idx === -1) {
    console.error('❌ 找不到插入位置');
    process.exit(1);
}

// 找到 /** 的位置
let commentStart = content.lastIndexOf('/**', idx);
if (commentStart === -1) {
    console.error('❌ 找不到注释开始位置');
    process.exit(1);
}

// 在注释前插入新代码
const before = content.substring(0, commentStart);
const after = content.substring(commentStart);

content = before + newCode + after;

fs.writeFileSync(serverPath, content, 'utf-8');
console.log('✅ 成功添加增量更新 API 到 server.js');
console.log('   - POST /api/dlt/unified-update-incremental');
console.log('   - generateMissingTablesIncremental()');
console.log('   - generateStatisticsIncremental()');
console.log('   - generateComboFeaturesIncremental()');
