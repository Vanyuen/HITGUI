/**
 * 模拟Excel导出中的蓝球数据处理
 * 尝试复现 [01, 01] 重复BUG
 */

console.log('=== 模拟场景1: blueComboIds是数组的数组 ===\n');

const blueComboIds1 = [[1,2], [1,3], [1,4]];  // 从result.blue_combinations获取
const pairingIndex1 = 0;

const blueComboId1 = blueComboIds1[pairingIndex1];
console.log(`blueComboId = ${JSON.stringify(blueComboId1)}`);
console.log(`类型: ${Array.isArray(blueComboId1) ? 'Array' : typeof blueComboId1}`);

// 模拟数据库查询（返回空）
const allBlueCombos1 = [];  // 查询失败，空数组

// 尝试查找
const blueCombo1 = allBlueCombos1.find(bc => bc.combination_id === blueComboId1);
console.log(`blueCombo = ${blueCombo1}`);

// 写入Excel的值
const blue1_1 = blueCombo1 ? blueCombo1.blue_ball_1 : '-';
const blue2_1 = blueCombo1 ? blueCombo1.blue_ball_2 : '-';
console.log(`Excel中的值: blue1=${blue1_1}, blue2=${blue2_1}`);
console.log(`预期: -, - ✅`);
console.log(`实际问题: 01, 01 ❌\n`);

console.log('\n=== 模拟场景2: blueComboId本身被当作对象使用 ===\n');

const blueComboIds2 = [[1,2], [1,3], [1,4]];
const pairingIndex2 = 0;
const blueComboId2 = blueComboIds2[pairingIndex2];  // [1, 2]

// ⚠️ 如果代码错误地把数组当作对象
console.log(`如果把 [1,2] 当作对象:`);
console.log(`  blueComboId2[0] = ${blueComboId2[0]}`);  // 1
console.log(`  blueComboId2[1] = ${blueComboId2[1]}`);  // 2

// ⚠️ 但如果代码尝试访问对象属性
console.log(`如果访问对象属性:`);
console.log(`  blueComboId2.blue_ball_1 = ${blueComboId2.blue_ball_1}`);  // undefined
console.log(`  blueComboId2.blue_ball_2 = ${blueComboId2.blue_ball_2}`);  // undefined

console.log('\n=== 模拟场景3: blueComboId被错误地赋值为数组本身 ===\n');

// 如果在某处代码中，blueCombo被错误地设置为blueComboId
const blueCombo3 = blueComboId2;  // 错误：把数组赋给blueCombo
console.log(`blueCombo = ${JSON.stringify(blueCombo3)}`);
console.log(`blueCombo.blue_ball_1 = ${blueCombo3.blue_ball_1}`);  // undefined
console.log(`blueCombo.blue_ball_2 = ${blueCombo3.blue_ball_2}`);  // undefined
console.log(`blueCombo[0] = ${blueCombo3[0]}`);  // 1
console.log(`blueCombo[1] = ${blueCombo3[1]}`);  // 2

console.log('\n=== 模拟场景4: 数组元素访问错误 ===\n');

// 如果代码错误地使用了数组索引而不是对象属性
const blueBallsArray = [1, 2];
const obj = {
    blue_ball_1: blueBallsArray[0],  // 1
    blue_ball_2: blueBallsArray[0]   // ❌ 错误：应该是blueBallsArray[1]
};
console.log(`如果索引写错了: blue_ball_1=${obj.blue_ball_1}, blue_ball_2=${obj.blue_ball_2}`);
console.log(`结果: 01, 01 ← 这就是BUG！ 🎯\n`);

console.log('\n=== 推测：BUG可能的位置 ===\n');
console.log('可能在某处代码中，从 blueComboIds 提取数据时：');
console.log('错误代码示例：');
console.log('  const blueBalls = blueComboIds[i];  // [1, 2]');
console.log('  blue1: blueBalls[0],  // 1 ✅');
console.log('  blue2: blueBalls[0],  // 1 ❌ 应该是 blueBalls[1]');
console.log('');
console.log('或者在构建blueCombo对象时：');
console.log('  blueCombo = {');
console.log('    blue_ball_1: arr[0],  // 正确');
console.log('    blue_ball_2: arr[0]   // ❌ 错误：应该是 arr[1]');
console.log('  }');
