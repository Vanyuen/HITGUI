/**
 * 增量更新遗漏值表
 * 只处理 hit_dlts 中比遗漏值表新的记录
 * @returns {Object} { newRecords: Number, latestID: Number }
 */
async function incrementalUpdateMissingTables() {
    log('═══════════════════════════════════════════════════════════════');
    log('🔄 增量更新遗漏值表');
    log('═══════════════════════════════════════════════════════════════\n');

    const db = mongoose.connection.db;

    // 1. 获取遗漏值表最新记录
    const latestMissing = await db.collection('hit_dlt_basictrendchart_redballmissing_histories')
        .findOne({}, { sort: { ID: -1 } });

    const startID = latestMissing ? latestMissing.ID + 1 : 1;
    log(`📊 遗漏值表最新ID: ${latestMissing ? latestMissing.ID : '无'}`);

    // 2. 获取 hit_dlts 最新ID
    const latestDlt = await hit_dlts.findOne({}).sort({ ID: -1 }).select('ID Issue').lean();
    if (!latestDlt) {
        log('⚠️  hit_dlts表为空，无需更新\n');
        return { newRecords: 0, latestID: 0, message: '数据源为空' };
    }
    log(`📊 hit_dlts最新ID: ${latestDlt.ID} (期号${latestDlt.Issue})`);

    // 3. 检查是否需要更新
    if (startID > latestDlt.ID) {
        log('✅ 遗漏值表已是最新，无需更新\n');
        return { newRecords: 0, latestID: latestMissing.ID, message: '已是最新' };
    }

    // 4. 获取需要处理的新开奖记录
    const newRecords = await hit_dlts.find({ ID: { $gte: startID } })
        .sort({ ID: 1 }).lean();

    log(`📦 需要处理 ${newRecords.length} 期新数据 (ID: ${startID} ~ ${latestDlt.ID})\n`);

    // 5. 继承上一期的遗漏状态
    let redMissing = Array(35).fill(0);
    let blueMissing = Array(12).fill(0);

    if (latestMissing) {
        // 从上一条记录恢复遗漏状态
        for (let i = 1; i <= 35; i++) {
            redMissing[i - 1] = latestMissing[String(i)] || 0;
        }
        for (let i = 1; i <= 12; i++) {
            blueMissing[i - 1] = latestMissing[`blue_${i}`] || 0;
        }
        log(`📥 已恢复ID=${latestMissing.ID}的遗漏状态`);
    }

    // 计算热温冷比辅助函数
    const calculateHWCRatio = (missingValues) => {
        let hot = 0, warm = 0, cold = 0;
        missingValues.forEach(missing => {
            if (missing <= 4) hot++;
            else if (missing <= 9) warm++;
            else cold++;
        });
        return `${hot}:${warm}:${cold}`;
    };

    // 6. 逐期计算新的遗漏值
    const newMissingRecords = [];
    const newBlueMissingRecords = [];

    for (let i = 0; i < newRecords.length; i++) {
        const record = newRecords[i];
        const drawnReds = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5];
        const drawnBlues = [record.Blue1, record.Blue2];

        // 遗漏值递增
        for (let j = 0; j < 35; j++) redMissing[j]++;
        for (let j = 0; j < 12; j++) blueMissing[j]++;

        // 重置开出号码的遗漏值
        drawnReds.forEach(ball => { redMissing[ball - 1] = 0; });
        drawnBlues.forEach(ball => { blueMissing[ball - 1] = 0; });

        // 计算当前期的热温冷比
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
        newMissingRecords.push(redRecord);

        // 蓝球遗漏记录
        const blueRecord = {
            ID: record.ID,
            Issue: record.Issue.toString(),
            DrawingDay: record.DrawDate ? new Date(record.DrawDate).toLocaleDateString('zh-CN') : ''
        };
        for (let j = 0; j < 12; j++) {
            blueRecord[(j + 1).toString()] = blueMissing[j];
        }
        newBlueMissingRecords.push(blueRecord);

        if ((i + 1) % 10 === 0 || i === newRecords.length - 1) {
            log(`   处理进度: ${i + 1} / ${newRecords.length}`);
        }
    }

    // 7. 批量插入
    if (newMissingRecords.length > 0) {
        log('\n💾 插入新的遗漏值数据...');
        await db.collection('hit_dlt_basictrendchart_redballmissing_histories')
            .insertMany(newMissingRecords);
        log(`   ✅ 红球遗漏: 新增 ${newMissingRecords.length} 条`);

        // 蓝球遗漏表（如果存在）
        try {
            await db.collection('hit_dlt_basictrendchart_blueballmissing_histories')
                .insertMany(newBlueMissingRecords);
            log(`   ✅ 蓝球遗漏: 新增 ${newBlueMissingRecords.length} 条`);
        } catch (e) {
            log(`   ⚠️  蓝球遗漏表更新跳过: ${e.message}`);
        }
    }

    log(`\n✅ 遗漏值表增量更新完成，新增 ${newMissingRecords.length} 条记录\n`);

    return {
        newRecords: newMissingRecords.length,
        latestID: newRecords[newRecords.length - 1].ID,
        latestIssue: newRecords[newRecords.length - 1].Issue
    };
}

/**
 * 增量更新statistics字段
 * 只处理缺少statistics字段的记录
 * @returns {Object} { newRecords: Number }
 */
async function incrementalUpdateStatistics() {
    log('═══════════════════════════════════════════════════════════════');
    log('📊 增量更新statistics字段');
    log('═══════════════════════════════════════════════════════════════\n');

    const db = mongoose.connection.db;

    // 1. 查找缺少statistics字段的记录
    const recordsWithoutStats = await hit_dlts.find({
        $or: [
            { statistics: { $exists: false } },
            { 'statistics.frontSum': { $exists: false } }
        ]
    }).sort({ ID: 1 }).lean();

    if (recordsWithoutStats.length === 0) {
        log('✅ statistics字段已是最新，无需更新\n');
        return { newRecords: 0, message: '已是最新' };
    }

    log(`📦 需要处理 ${recordsWithoutStats.length} 条记录\n`);

    // 2. 获取遗漏值映射（用于热温冷比计算）
    const missingMap = new Map();
    const allMissing = await db.collection('hit_dlt_basictrendchart_redballmissing_histories')
        .find({}).toArray();
    allMissing.forEach(r => missingMap.set(r.ID, r));
    log(`📥 已加载 ${allMissing.length} 条遗漏值记录`);

    // 3. 获取所有记录用于计算重号
    const allRecordsMap = new Map();
    const allRecords = await hit_dlts.find({}).sort({ ID: 1 }).select('ID Red1 Red2 Red3 Red4 Red5').lean();
    allRecords.forEach(r => allRecordsMap.set(r.ID, r));

    // 4. 逐条更新
    let updateCount = 0;
    for (let i = 0; i < recordsWithoutStats.length; i++) {
        const record = recordsWithoutStats[i];
        const reds = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5];
        const blues = [record.Blue1, record.Blue2];

        // 基础统计计算
        const frontSum = reds.reduce((a, b) => a + b, 0);
        const frontSpan = Math.max(...reds) - Math.min(...reds);

        // 区间比 (1-12, 13-24, 25-35)
        let zone1 = 0, zone2 = 0, zone3 = 0;
        reds.forEach(n => {
            if (n <= 12) zone1++;
            else if (n <= 24) zone2++;
            else zone3++;
        });
        const frontZoneRatio = `${zone1}:${zone2}:${zone3}`;

        // 奇偶比
        let frontOdd = 0, frontEven = 0;
        reds.forEach(n => n % 2 === 0 ? frontEven++ : frontOdd++);
        const frontOddEvenRatio = `${frontOdd}:${frontEven}`;

        // AC值
        const frontAcValue = calculateACValue(reds);

        // 后区统计
        const backSum = blues.reduce((a, b) => a + b, 0);
        let backOdd = 0, backEven = 0;
        blues.forEach(n => n % 2 === 0 ? backEven++ : backOdd++);
        const backOddEvenRatio = `${backOdd}:${backEven}`;

        // 热温冷比：从上一期的遗漏值计算
        let frontHotWarmColdRatio = '0:0:0';
        const previousRecord = allRecordsMap.get(record.ID - 1);
        if (previousRecord) {
            const previousMissingRecord = missingMap.get(previousRecord.ID);
            if (previousMissingRecord) {
                const missingValues = reds.map(ball => previousMissingRecord[String(ball)] || 0);
                let hot = 0, warm = 0, cold = 0;
                missingValues.forEach(missing => {
                    if (missing <= 4) hot++;
                    else if (missing <= 9) warm++;
                    else cold++;
                });
                frontHotWarmColdRatio = `${hot}:${warm}:${cold}`;
            }
        }

        // 连号组数
        const sortedReds = [...reds].sort((a, b) => a - b);
        let consecutiveCount = 0;
        for (let j = 0; j < sortedReds.length - 1; j++) {
            if (sortedReds[j + 1] - sortedReds[j] === 1) {
                consecutiveCount++;
            }
        }

        // 重号数
        let repeatCount = 0;
        if (previousRecord) {
            const prevReds = [previousRecord.Red1, previousRecord.Red2, previousRecord.Red3, previousRecord.Red4, previousRecord.Red5];
            repeatCount = reds.filter(r => prevReds.includes(r)).length;
        }

        // 构建statistics对象
        const statistics = {
            frontSum,
            frontSpan,
            frontHotWarmColdRatio,
            frontZoneRatio,
            frontOddEvenRatio,
            frontAcValue,
            backSum,
            backOddEvenRatio,
            consecutiveCount,
            repeatCount
        };

        // 更新数据库
        await hit_dlts.updateOne(
            { ID: record.ID },
            { $set: { statistics, updatedAt: new Date() } }
        );

        updateCount++;

        if ((i + 1) % 10 === 0 || i === recordsWithoutStats.length - 1) {
            log(`   处理进度: ${i + 1} / ${recordsWithoutStats.length}`);
        }
    }

    log(`\n✅ statistics字段增量更新完成，更新 ${updateCount} 条记录\n`);

    return { newRecords: updateCount };
}

/**
 * 增量更新组合特征表
 * 只处理组合特征表中不存在的记录
 * @returns {Object} { newRecords: Number }
 */
async function incrementalUpdateComboFeatures() {
    log('═══════════════════════════════════════════════════════════════');
    log('🔗 增量更新组合特征表');
    log('═══════════════════════════════════════════════════════════════\n');

    // 组合生成辅助函数
    const genCombo2 = (balls) => {
        const combos = [];
        for (let i = 0; i < balls.length - 1; i++) {
            for (let j = i + 1; j < balls.length; j++) {
                combos.push(`${String(balls[i]).padStart(2, '0')}-${String(balls[j]).padStart(2, '0')}`);
            }
        }
        return combos;
    };

    const genCombo3 = (balls) => {
        const combos = [];
        for (let i = 0; i < balls.length - 2; i++) {
            for (let j = i + 1; j < balls.length - 1; j++) {
                for (let k = j + 1; k < balls.length; k++) {
                    combos.push(`${String(balls[i]).padStart(2, '0')}-${String(balls[j]).padStart(2, '0')}-${String(balls[k]).padStart(2, '0')}`);
                }
            }
        }
        return combos;
    };

    const genCombo4 = (balls) => {
        const combos = [];
        for (let i = 0; i < balls.length - 3; i++) {
            for (let j = i + 1; j < balls.length - 2; j++) {
                for (let k = j + 1; k < balls.length - 1; k++) {
                    for (let l = k + 1; l < balls.length; l++) {
                        combos.push(`${String(balls[i]).padStart(2, '0')}-${String(balls[j]).padStart(2, '0')}-${String(balls[k]).padStart(2, '0')}-${String(balls[l]).padStart(2, '0')}`);
                    }
                }
            }
        }
        return combos;
    };

    // 1. 获取组合特征表最新ID
    const latestCombo = await DLTComboFeatures.findOne({}).sort({ ID: -1 }).lean();
    const startID = latestCombo ? latestCombo.ID + 1 : 1;
    log(`📊 组合特征表最新ID: ${latestCombo ? latestCombo.ID : '无'}`);

    // 2. 获取需要处理的新记录
    const newRecords = await hit_dlts.find({ ID: { $gte: startID } })
        .sort({ ID: 1 }).lean();

    if (newRecords.length === 0) {
        log('✅ 组合特征表已是最新，无需更新\n');
        return { newRecords: 0, message: '已是最新' };
    }

    log(`📦 需要处理 ${newRecords.length} 条记录\n`);

    // 3. 生成组合特征并插入
    const comboRecords = [];
    for (let i = 0; i < newRecords.length; i++) {
        const record = newRecords[i];
        const balls = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5].sort((a, b) => a - b);

        comboRecords.push({
            ID: record.ID,
            Issue: record.Issue.toString(),
            combo_2: genCombo2(balls),
            combo_3: genCombo3(balls),
            combo_4: genCombo4(balls),
            created_at: new Date(),
            updated_at: new Date()
        });

        if ((i + 1) % 10 === 0 || i === newRecords.length - 1) {
            log(`   处理进度: ${i + 1} / ${newRecords.length}`);
        }
    }

    // 4. 批量插入
    if (comboRecords.length > 0) {
        await DLTComboFeatures.insertMany(comboRecords);
    }

    log(`\n✅ 组合特征表增量更新完成，新增 ${comboRecords.length} 条记录\n`);

    return { newRecords: comboRecords.length };
}
