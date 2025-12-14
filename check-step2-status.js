// 模拟 recent 模式下 collectDetailsForIssues 的计算

const batchSize = 50;
const recent_count = 1;

// 生成期号列表 (25041-25141, 共101期)
const allIssues = [];
for (let i = 25041; i <= 25141; i++) {
  allIssues.push(i.toString());
}

console.log('=== recent模式(count=1)的collectDetailsForIssues计算 ===\n');
console.log('总期数:', allIssues.length);
console.log('批次大小:', batchSize);
console.log('recent_count:', recent_count);

// 创建批次
const batches = [];
for (let i = 0; i < allIssues.length; i += batchSize) {
  batches.push(allIssues.slice(i, i + batchSize));
}

console.log('批次数:', batches.length);

// 模拟每个批次的collectDetailsForIssues计算
console.log('\n每个批次的collectDetailsForIssues:');
const allCollected = new Set();

for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
  const issuesBatch = batches[batchIndex];

  // recent模式: 最后N期
  const collectDetailsForIssues = new Set();
  const sortedIssues = [...issuesBatch].sort((a, b) => parseInt(b) - parseInt(a));
  for (let i = 0; i < Math.min(recent_count, sortedIssues.length); i++) {
    collectDetailsForIssues.add(sortedIssues[i].toString());
    allCollected.add(sortedIssues[i].toString());
  }

  console.log(`  批次${batchIndex + 1} (${issuesBatch[0]}-${issuesBatch[issuesBatch.length-1]}): 收集 [${Array.from(collectDetailsForIssues).join(', ')}]`);
}

console.log('\n所有批次收集的期号:', Array.from(allCollected).sort((a,b) => parseInt(a) - parseInt(b)));

// 模拟 determinePeriodsToSaveDetails 的选择
console.log('\n=== determinePeriodsToSaveDetails 选择保存的期号 ===');

// 假设25141是推算期
const isPredictedPeriod = '25141';
const periodsToSave = new Set();

// 1. 推算期始终保存
periodsToSave.add(isPredictedPeriod);

// 2. recent模式：选择最近N期
const drawnPeriods = allIssues.filter(p => p !== isPredictedPeriod);
const sortedByIssue = [...drawnPeriods].sort((a, b) => parseInt(b) - parseInt(a));
const recentN = recent_count;
for (let i = 0; i < Math.min(recentN, sortedByIssue.length); i++) {
  periodsToSave.add(sortedByIssue[i].toString());
}

console.log('选择保存的期号:', Array.from(periodsToSave).sort((a,b) => parseInt(a) - parseInt(b)));

// 检查哪些期号有数据
console.log('\n=== 数据可用性分析 ===');
for (const period of periodsToSave) {
  const wasCollected = allCollected.has(period);
  console.log(`  期号${period}: ${wasCollected ? '✅ 在处理时被收集' : '❌ 在处理时未被收集'}`);
}
