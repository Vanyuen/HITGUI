/**
 * 测试 UltraFastDataEngine
 */
const UltraFastDataEngine = require('./src/server/engines/UltraFastDataEngine');

async function testEngine() {
    console.log('🧪 测试 UltraFastDataEngine\n');

    // 创建测试数据
    const testRedCombinations = [
        {
            combination_id: 1,
            red_ball_1: 1, red_ball_2: 2, red_ball_3: 3, red_ball_4: 4, red_ball_5: 5,
            sum_value: 15,
            span_value: 4,
            odd_even_ratio: '3:2',
            ac_value: 5,
            zone_ratio: '5:0:0'
        },
        {
            combination_id: 2,
            red_ball_1: 10, red_ball_2: 15, red_ball_3: 20, red_ball_4: 25, red_ball_5: 30,
            sum_value: 100,
            span_value: 20,
            odd_even_ratio: '1:4',
            ac_value: 10,
            zone_ratio: '1:2:2'
        },
        {
            combination_id: 100,
            red_ball_1: 5, red_ball_2: 10, red_ball_3: 15, red_ball_4: 20, red_ball_5: 25,
            sum_value: 75,
            span_value: 20,
            odd_even_ratio: '2:3',
            ac_value: 8,
            zone_ratio: '2:2:1'
        }
    ];

    const testBlueCombinations = [
        { combination_id: 1, blue_ball_1: 1, blue_ball_2: 2 },
        { combination_id: 2, blue_ball_1: 3, blue_ball_2: 5 },
        { combination_id: 10, blue_ball_1: 10, blue_ball_2: 12 }
    ];

    // 创建引擎实例
    const engine = new UltraFastDataEngine();

    // 加载数据
    console.log('📊 加载测试数据...');
    await engine.loadFromDatabase(testRedCombinations, testBlueCombinations);

    // 获取统计信息
    console.log('\n📈 引擎统计:');
    const stats = engine.getStats();
    console.log(JSON.stringify(stats, null, 2));

    // 测试单个组合查询
    console.log('\n🔍 测试单个组合查询:');
    const combo1 = engine.getRedCombination(1);
    console.log('组合ID=1:', combo1);

    const combo2 = engine.getRedCombination(2);
    console.log('组合ID=2:', combo2);

    const combo100 = engine.getRedCombination(100);
    console.log('组合ID=100:', combo100);

    // 测试批量查询
    console.log('\n🔍 测试批量查询:');
    const combos = engine.getRedCombinations([1, 2, 100]);
    console.log(`批量查询结果 (${combos.length}个):`, combos.map(c => c.combination_id));

    // 验证数据一致性
    console.log('\n✅ 数据一致性验证:');
    let allCorrect = true;

    for (const original of testRedCombinations) {
        const loaded = engine.getRedCombination(original.combination_id);
        if (!loaded) {
            console.error(`❌ 组合ID=${original.combination_id} 未找到`);
            allCorrect = false;
            continue;
        }

        // 验证球号
        const ballsMatch =
            loaded.red_ball_1 === original.red_ball_1 &&
            loaded.red_ball_2 === original.red_ball_2 &&
            loaded.red_ball_3 === original.red_ball_3 &&
            loaded.red_ball_4 === original.red_ball_4 &&
            loaded.red_ball_5 === original.red_ball_5;

        // 验证特征
        const featuresMatch =
            loaded.sum_value === original.sum_value &&
            loaded.span_value === original.span_value &&
            loaded.zone_ratio === original.zone_ratio &&
            loaded.ac_value === original.ac_value;

        if (ballsMatch && featuresMatch) {
            console.log(`✅ 组合ID=${original.combination_id} 数据一致`);
        } else {
            console.error(`❌ 组合ID=${original.combination_id} 数据不一致`);
            console.error('  原始:', original);
            console.error('  加载:', loaded);
            allCorrect = false;
        }
    }

    if (allCorrect) {
        console.log('\n🎉 所有测试通过! UltraFastDataEngine 运行正常!');
        return 0;
    } else {
        console.log('\n❌ 部分测试失败');
        return 1;
    }
}

// 运行测试
testEngine().then(exitCode => {
    process.exit(exitCode);
}).catch(error => {
    console.error('❌ 测试失败:', error);
    process.exit(1);
});
