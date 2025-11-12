/**
 * 测试蓝球生成逻辑
 * 验证是否会产生重复的蓝球组合
 */

// 模拟 getFilteredBlueCombinations 函数
function getFilteredBlueCombinations(maxCount = 66) {
    console.log(`\n🎲 测试蓝球生成逻辑 (maxCount=${maxCount})...\n`);

    const combinations = [];
    for (let i = 1; i <= 12; i++) {
        for (let j = i + 1; j <= 12; j++) {
            combinations.push([i, j]);
            if (combinations.length >= maxCount) break;
        }
        if (combinations.length >= maxCount) break;
    }

    console.log(`生成的组合数: ${combinations.length}\n`);

    // 检查是否有重复
    let duplicateCount = 0;
    const duplicates = [];

    combinations.forEach((combo, idx) => {
        if (combo[0] === combo[1]) {
            duplicateCount++;
            duplicates.push({ index: idx + 1, combo });
            console.log(`⚠️ 发现重复: 第${idx + 1}个组合 = [${combo[0]}, ${combo[1]}]`);
        }
    });

    if (duplicateCount === 0) {
        console.log('✅ 没有发现重复的蓝球组合');
    } else {
        console.log(`\n🚨 共发现 ${duplicateCount} 个重复组合！`);
    }

    // 显示前10个和后10个
    console.log('\n前10个组合:');
    combinations.slice(0, 10).forEach((combo, idx) => {
        console.log(`  ${idx + 1}. [${combo[0]}, ${combo[1]}]`);
    });

    console.log('\n后10个组合:');
    const startIdx = Math.max(0, combinations.length - 10);
    combinations.slice(startIdx).forEach((combo, idx) => {
        console.log(`  ${startIdx + idx + 1}. [${combo[0]}, ${combo[1]}]`);
    });

    return { combinations, duplicateCount, duplicates };
}

// 测试完整66个组合
console.log('=== 测试1: 生成全部66个组合 ===');
const test1 = getFilteredBlueCombinations(66);

// 测试限制数量
console.log('\n\n=== 测试2: 限制20个组合 ===');
const test2 = getFilteredBlueCombinations(20);

// 测试超大数量（应该最多66个）
console.log('\n\n=== 测试3: 请求1000个组合（应返回66个） ===');
const test3 = getFilteredBlueCombinations(1000);

// 验证数学正确性
console.log('\n\n=== 验证数学正确性 ===');
const expected = (12 * 11) / 2;  // C(12,2) = 66
console.log(`C(12,2) 理论值: ${expected}`);
console.log(`实际生成: ${test1.combinations.length}`);
console.log(`是否匹配: ${test1.combinations.length === expected ? '✅ 是' : '❌ 否'}`);

// 验证所有组合的唯一性
console.log('\n\n=== 验证组合唯一性 ===');
const uniqueSet = new Set();
test1.combinations.forEach(combo => {
    const key = `${combo[0]}-${combo[1]}`;
    uniqueSet.add(key);
});
console.log(`不同的组合数: ${uniqueSet.size}`);
console.log(`是否所有组合都唯一: ${uniqueSet.size === test1.combinations.length ? '✅ 是' : '❌ 否'}`);

// 总结
console.log('\n\n=== 测试总结 ===');
if (test1.duplicateCount === 0 && test1.combinations.length === 66 && uniqueSet.size === 66) {
    console.log('✅ 蓝球生成逻辑完全正确，没有任何重复');
} else {
    console.log('🚨 蓝球生成逻辑存在问题：');
    if (test1.duplicateCount > 0) {
        console.log(`  - 发现 ${test1.duplicateCount} 个内部重复 (ball1 === ball2)`);
    }
    if (test1.combinations.length !== 66) {
        console.log(`  - 生成数量错误: ${test1.combinations.length} (期望 66)`);
    }
    if (uniqueSet.size !== test1.combinations.length) {
        console.log(`  - 存在重复组合: ${test1.combinations.length - uniqueSet.size} 个`);
    }
}

console.log('\n✅ 测试完成！\n');
