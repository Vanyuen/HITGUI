/**
 * 验证大乐透中奖规则是否正确
 */

// 正确的大乐透中奖规则
const correctRules = [
    { red: 5, blue: 2, prize: '一等奖', amount: 10000000 },
    { red: 5, blue: 1, prize: '二等奖', amount: 100000 },
    { red: 5, blue: 0, prize: '三等奖', amount: 10000 },
    { red: 4, blue: 2, prize: '四等奖', amount: 3000 },
    { red: 4, blue: 1, prize: '五等奖', amount: 300 },
    { red: 3, blue: 2, prize: '六等奖', amount: 200 },
    { red: 4, blue: 0, prize: '七等奖', amount: 100 },
    { red: 3, blue: 1, prize: '八等奖', amount: 15 },
    { red: 2, blue: 2, prize: '八等奖', amount: 15 },
    { red: 3, blue: 0, prize: '九等奖', amount: 5 },
    { red: 1, blue: 2, prize: '九等奖', amount: 5 },
    { red: 2, blue: 1, prize: '九等奖', amount: 5 },
    { red: 0, blue: 2, prize: '九等奖', amount: 5 },
    // 不中奖的情况
    { red: 2, blue: 0, prize: '未中奖', amount: 0 },
    { red: 1, blue: 1, prize: '未中奖', amount: 0 },
    { red: 1, blue: 0, prize: '未中奖', amount: 0 },
    { red: 0, blue: 1, prize: '未中奖', amount: 0 },
    { red: 0, blue: 0, prize: '未中奖', amount: 0 }
];

// 复制修复后的 judgePrize 函数
function judgePrize(redHit, blueHit) {
    // 一等奖：5+2
    if (redHit === 5 && blueHit === 2) return '一等奖';

    // 二等奖：5+1
    if (redHit === 5 && blueHit === 1) return '二等奖';

    // 三等奖：5+0
    if (redHit === 5 && blueHit === 0) return '三等奖';

    // 四等奖：4+2
    if (redHit === 4 && blueHit === 2) return '四等奖';

    // 五等奖：4+1
    if (redHit === 4 && blueHit === 1) return '五等奖';

    // 六等奖：3+2
    if (redHit === 3 && blueHit === 2) return '六等奖';

    // 七等奖：4+0
    if (redHit === 4 && blueHit === 0) return '七等奖';

    // 八等奖：3+1 或 2+2
    if (redHit === 3 && blueHit === 1) return '八等奖';
    if (redHit === 2 && blueHit === 2) return '八等奖';

    // 九等奖：3+0 或 1+2 或 2+1 或 0+2
    if (redHit === 3 && blueHit === 0) return '九等奖';
    if (redHit === 1 && blueHit === 2) return '九等奖';
    if (redHit === 2 && blueHit === 1) return '九等奖';
    if (redHit === 0 && blueHit === 2) return '九等奖';

    return '未中奖';
}

// 验证函数
console.log('========================================');
console.log('   大乐透中奖规则验证');
console.log('========================================\n');

let passCount = 0;
let failCount = 0;
const errors = [];

for (const rule of correctRules) {
    const result = judgePrize(rule.red, rule.blue);
    const status = result === rule.prize ? '✅ PASS' : '❌ FAIL';

    if (result === rule.prize) {
        passCount++;
    } else {
        failCount++;
        errors.push({
            input: `${rule.red}红+${rule.blue}蓝`,
            expected: rule.prize,
            actual: result
        });
    }

    console.log(`${status} | ${rule.red}红+${rule.blue}蓝 => 期望: ${rule.prize}, 实际: ${result}`);
}

console.log('\n========================================');
console.log(`测试结果: ${passCount} 通过, ${failCount} 失败`);
console.log('========================================\n');

if (failCount > 0) {
    console.log('❌ 失败的测试用例：\n');
    errors.forEach((err, index) => {
        console.log(`${index + 1}. ${err.input}`);
        console.log(`   期望: ${err.expected}`);
        console.log(`   实际: ${err.actual}\n`);
    });
    process.exit(1);
} else {
    console.log('✅ 所有测试通过！中奖规则判断正确。\n');
    process.exit(0);
}
