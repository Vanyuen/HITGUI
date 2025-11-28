const mongoose = require('mongoose');
const _ = require('lodash');

function generateCombinations(n, r) {
    const result = [];
    const combination = Array(r).fill(0);

    function generate(start, depth) {
        if (depth === r) {
            result.push([...combination]);
            return;
        }

        for (let i = start; i <= n; i++) {
            combination[depth] = i;
            generate(i + 1, depth + 1);
        }
    }

    generate(1, 0);
    return result;
}

async function rebuildRedCombinations() {
    try {
        // 连接数据库
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // 删除现有集合
        const RedCombinationModel = mongoose.connection.db.collection('hit_dlt_redcombinations');
        await RedCombinationModel.drop();
        console.log('✅ 已删除原有红球组合表');

        // 生成所有可能的红球组合
        const allCombinations = generateCombinations(35, 5);
        console.log(`🔢 总组合数: ${allCombinations.length}`);

        // 批量插入组合
        const bulkOps = allCombinations.map((combo, index) => ({
            insertOne: {
                document: {
                    combination_id: index + 1,
                    combination: combo,
                    red_ball_1: combo[0],
                    red_ball_2: combo[1],
                    red_ball_3: combo[2],
                    red_ball_4: combo[3],
                    red_ball_5: combo[4],
                    sum_value: _.sum(combo),
                    span_value: Math.max(...combo) - Math.min(...combo),
                    zone_ratio: calculateZoneRatio(combo),
                    odd_even_ratio: calculateOddEvenRatio(combo),
                    ac_value: calculateACValue(combo),
                    created_at: new Date()
                }
            }
        }));

        // 分批插入以避免内存问题
        const BATCH_SIZE = 10000;
        for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
            const batch = bulkOps.slice(i, i + BATCH_SIZE);
            await RedCombinationModel.bulkWrite(batch);
            console.log(`✅ 已插入 ${Math.min(i + BATCH_SIZE, bulkOps.length)} / ${bulkOps.length} 组合`);
        }

        console.log('🎉 红球组合表重建完成');

        // 关闭数据库连接
        await mongoose.connection.close();
    } catch (error) {
        console.error('重建过程中发生错误:', error);
    }
}

function calculateZoneRatio(combo) {
    const zones = [
        [1, 12],   // 第一区
        [13, 24],  // 第二区
        [25, 35]   // 第三区
    ];

    const zoneCount = zones.map(([start, end]) =>
        combo.filter(num => num >= start && num <= end).length
    );

    return zoneCount.join(':');
}

function calculateOddEvenRatio(combo) {
    const oddCount = combo.filter(num => num % 2 !== 0).length;
    const evenCount = 5 - oddCount;
    return `${oddCount}:${evenCount}`;
}

function calculateACValue(combo) {
    const sortedCombo = [...combo].sort((a, b) => a - b);
    const differences = [];
    for (let i = 0; i < sortedCombo.length; i++) {
        for (let j = i + 1; j < sortedCombo.length; j++) {
            differences.push(sortedCombo[j] - sortedCombo[i]);
        }
    }
    return differences.filter((v, i, a) => a.indexOf(v) === i).length;
}

rebuildRedCombinations();