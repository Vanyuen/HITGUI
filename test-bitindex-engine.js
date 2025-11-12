/**
 * 测试 BitIndexEngine
 */
const { BitIndexEngine, BitSet } = require('./src/server/engines/BitIndexEngine');

function testBitSet() {
    console.log('🧪 测试BitSet基本操作\n');

    const size = 100;
    const bitset1 = new BitSet(size);
    const bitset2 = new BitSet(size);

    // 设置位
    bitset1.set(10);
    bitset1.set(20);
    bitset1.set(30);

    bitset2.set(20);
    bitset2.set(30);
    bitset2.set(40);

    console.log('BitSet1:', bitset1.toArray());
    console.log('BitSet2:', bitset2.toArray());

    // AND运算 (交集)
    const andResult = bitset1.and(bitset2);
    console.log('AND结果:', andResult.toArray(), '期望: [20, 30]');

    // OR运算 (并集)
    const orResult = bitset1.or(bitset2);
    console.log('OR结果:', orResult.toArray(), '期望: [10, 20, 30, 40]');

    // AND NOT运算 (差集)
    const andNotResult = bitset1.andNot(bitset2);
    console.log('AND NOT结果:', andNotResult.toArray(), '期望: [10]');

    // Cardinality
    console.log('BitSet1 cardinality:', bitset1.cardinality(), '期望: 3');
    console.log('BitSet2 cardinality:', bitset2.cardinality(), '期望: 3');

    // 验证结果
    const andCorrect = JSON.stringify(andResult.toArray()) === JSON.stringify([20, 30]);
    const orCorrect = JSON.stringify(orResult.toArray()) === JSON.stringify([10, 20, 30, 40]);
    const andNotCorrect = JSON.stringify(andNotResult.toArray()) === JSON.stringify([10]);

    if (andCorrect && orCorrect && andNotCorrect) {
        console.log('\n✅ BitSet基本操作测试通过!\n');
        return true;
    } else {
        console.log('\n❌ BitSet基本操作测试失败!\n');
        return false;
    }
}

function testBitIndexEngine() {
    console.log('🧪 测试BitIndexEngine\n');

    // 创建测试数据
    const testCombinations = [
        {
            combination_id: 1,
            zone_ratio: '2:2:1',
            odd_even_ratio: '3:2',
            sum_value: 65,
            span_value: 15,
            ac_value: 5
        },
        {
            combination_id: 2,
            zone_ratio: '2:2:1',
            odd_even_ratio: '2:3',
            sum_value: 70,
            span_value: 18,
            ac_value: 6
        },
        {
            combination_id: 3,
            zone_ratio: '3:1:1',
            odd_even_ratio: '3:2',
            sum_value: 68,
            span_value: 16,
            ac_value: 5
        },
        {
            combination_id: 10,
            zone_ratio: '2:1:2',
            odd_even_ratio: '1:4',
            sum_value: 95,
            span_value: 25,
            ac_value: 8
        }
    ];

    // 创建引擎
    const engine = new BitIndexEngine();
    engine.totalCombinations = 20; // 测试用小数据

    // 构建索引
    engine.buildStaticIndexes(testCombinations);

    // 获取统计
    console.log('📈 引擎统计:');
    console.log(JSON.stringify(engine.getStats(), null, 2));

    // 测试查询
    console.log('\n🔍 测试索引查询:');

    // 查询区间比='2:2:1'的组合
    const zoneRatioBitSet = engine.indexes.zoneRatio.get('2:2:1');
    if (zoneRatioBitSet) {
        const ids = zoneRatioBitSet.toArray();
        console.log('区间比=2:2:1:', ids, '期望: [1, 2]');

        const correct = JSON.stringify(ids) === JSON.stringify([1, 2]);
        if (!correct) {
            console.log('❌ 区间比查询结果不正确');
            return false;
        }
    }

    // 查询奇偶比='3:2'的组合
    const oddEvenBitSet = engine.indexes.oddEvenRatio.get('3:2');
    if (oddEvenBitSet) {
        const ids = oddEvenBitSet.toArray();
        console.log('奇偶比=3:2:', ids, '期望: [1, 3]');

        const correct = JSON.stringify(ids) === JSON.stringify([1, 3]);
        if (!correct) {
            console.log('❌ 奇偶比查询结果不正确');
            return false;
        }
    }

    // 复杂查询: 区间比='2:2:1' AND 奇偶比='3:2'
    const zone221 = engine.indexes.zoneRatio.get('2:2:1');
    const oddEven32 = engine.indexes.oddEvenRatio.get('3:2');
    if (zone221 && oddEven32) {
        const result = zone221.and(oddEven32);
        const ids = result.toArray();
        console.log('区间比=2:2:1 AND 奇偶比=3:2:', ids, '期望: [1]');

        const correct = JSON.stringify(ids) === JSON.stringify([1]);
        if (!correct) {
            console.log('❌ 复杂查询结果不正确');
            return false;
        }
    }

    console.log('\n✅ BitIndexEngine测试通过!\n');
    return true;
}

// 运行测试
async function runTests() {
    const test1 = testBitSet();
    const test2 = testBitIndexEngine();

    if (test1 && test2) {
        console.log('🎉 所有测试通过!');
        return 0;
    } else {
        console.log('❌ 部分测试失败');
        return 1;
    }
}

runTests().then(exitCode => {
    process.exit(exitCode);
}).catch(error => {
    console.error('❌ 测试失败:', error);
    process.exit(1);
});
