/**
 * 验证蓝球ID转换公式的BUG
 */

console.log('=== 验证当前错误的公式 ===\n');

// 错误的公式 (line 20214-20215)
function wrongFormula(blueComboId) {
    const blue_ball_2 = ((blueComboId - 1) % 12) + 1;
    const blue_ball_1 = Math.floor((blueComboId - 1) / 12) + 1;
    return [blue_ball_1, blue_ball_2];
}

// 测试前5个ID
console.log('使用错误的公式：');
for (let id = 1; id <= 10; id++) {
    const [b1, b2] = wrongFormula(id);
    const isDuplicate = b1 === b2 ? ' ⚠️ 重复！' : '';
    console.log(`  ID=${id} → [${b1}, ${b2}]${isDuplicate}`);
}

console.log('\n应该的正确输出：');
console.log('  ID=1 → [1, 2] ✅');
console.log('  ID=2 → [1, 3] ✅');
console.log('  ID=3 → [1, 4] ✅');
console.log('  ...');

console.log('\n\n=== 问题分析 ===\n');

// ID=1的详细计算
console.log('ID=1的错误计算过程：');
const id1 = 1;
console.log(`  (${id1} - 1) % 12 = ${(id1-1) % 12}`);
console.log(`  ((${id1} - 1) % 12) + 1 = ${((id1-1) % 12) + 1}  ← blue_ball_2`);
console.log(`  Math.floor((${id1} - 1) / 12) = ${Math.floor((id1-1) / 12)}`);
console.log(`  Math.floor((${id1} - 1) / 12) + 1 = ${Math.floor((id1-1) / 12) + 1}  ← blue_ball_1`);
console.log(`  结果: [${Math.floor((id1-1) / 12) + 1}, ${((id1-1) % 12) + 1}] = [1, 1] ❌\n`);

console.log('\n=== 正确的蓝球ID映射 ===\n');

// 正确的映射应该是：
// ID=1  → [1, 2]
// ID=2  → [1, 3]
// ...
// ID=11 → [1, 12]
// ID=12 → [2, 3]
// ID=13 → [2, 4]
// ...

const correctMapping = [];
let id = 1;
for (let i = 1; i <= 11; i++) {
    for (let j = i + 1; j <= 12; j++) {
        correctMapping.push({ id, balls: [i, j] });
        id++;
    }
}

console.log('正确的ID映射 (前15个):');
correctMapping.slice(0, 15).forEach(({ id, balls }) => {
    console.log(`  ID=${id} → [${balls[0]}, ${balls[1]}]`);
});

console.log('\n\n=== 验证：使用错误公式会产生多少个重复? ===\n');

let duplicateCount = 0;
for (let id = 1; id <= 66; id++) {
    const [b1, b2] = wrongFormula(id);
    if (b1 === b2) {
        duplicateCount++;
        console.log(`  ID=${id} → [${b1}, ${b2}] ⚠️ 重复`);
    }
}

console.log(`\n总共 ${duplicateCount} 个重复的组合！`);

console.log('\n\n=== 正确的公式应该是什么？ ===\n');
console.log('由于蓝球组合的生成顺序是:');
console.log('  for (let i = 1; i <= 11; i++)');
console.log('    for (let j = i + 1; j <= 12; j++)');
console.log('      combinations.push([i, j])');
console.log('');
console.log('所以从ID反推的正确公式需要找到 (i, j) 使得:');
console.log('  i < j, 且组合序号 = ID');
console.log('');
console.log('推荐方案：不要尝试计算，直接查数据库或使用预先构建的数组！');
