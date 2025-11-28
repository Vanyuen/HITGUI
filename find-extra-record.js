const mongoose = require('mongoose');

console.log('🔍 查找多余的记录...\n');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;
  const collection = 'hit_dlt_redcombinationshotwarmcoldoptimizeds';

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 策略: 检查期号连续性，找出重复或异常记录');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 获取所有记录
  const allDocs = await db.collection(collection)
    .find({})
    .project({ _id: 1, base_issue: 1, target_issue: 1, is_predicted: 1 })
    .toArray();

  // 按 target_issue 数字排序
  allDocs.sort((a, b) => {
    const targetA = parseInt(a.target_issue);
    const targetB = parseInt(b.target_issue);
    return targetA - targetB;
  });

  console.log(`总记录数: ${allDocs.length}\n`);

  // 统计每个 target_issue 出现的次数
  const targetIssueCounts = {};
  allDocs.forEach(doc => {
    const target = doc.target_issue;
    if (!targetIssueCounts[target]) {
      targetIssueCounts[target] = [];
    }
    targetIssueCounts[target].push(doc);
  });

  // 查找重复的 target_issue
  console.log('🔍 查找重复的 target_issue:\n');
  const duplicates = Object.entries(targetIssueCounts)
    .filter(([issue, docs]) => docs.length > 1);

  if (duplicates.length > 0) {
    console.log(`找到 ${duplicates.length} 个重复的 target_issue:\n`);
    duplicates.forEach(([issue, docs]) => {
      console.log(`期号 ${issue}:`);
      docs.forEach((doc, idx) => {
        console.log(`  ${idx + 1}. ${doc.base_issue}→${doc.target_issue} (predicted: ${doc.is_predicted}, _id: ${doc._id})`);
      });
      console.log('');
    });
  } else {
    console.log('✅ 未发现重复的 target_issue\n');
  }

  // 检查期号连续性（仅检查 is_predicted=false 的记录）
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 检查已开奖期的连续性');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const drawnDocs = allDocs.filter(doc => !doc.is_predicted);
  console.log(`已开奖期记录数: ${drawnDocs.length}（预期2790）\n`);

  // 检查是否有间断
  const gaps = [];
  for (let i = 0; i < drawnDocs.length - 1; i++) {
    const current = parseInt(drawnDocs[i].target_issue);
    const next = parseInt(drawnDocs[i + 1].target_issue);

    // 检查是否跨年份（如 9153→10001）
    const isYearChange = (Math.floor(current / 1000) !== Math.floor(next / 1000));

    if (!isYearChange && next - current !== 1) {
      gaps.push({
        from: current,
        to: next,
        gap: next - current - 1
      });
    }
  }

  if (gaps.length > 0) {
    console.log(`发现 ${gaps.length} 处间断:\n`);
    gaps.forEach((gap, idx) => {
      console.log(`${idx + 1}. ${gap.from} → ${gap.to} (缺少${gap.gap}期)`);
    });
    console.log('');
  } else {
    console.log('✅ 已开奖期连续性正常（跨年份除外）\n');
  }

  // 检查第一期和最后一期
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 检查期号范围');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const firstDrawn = drawnDocs[0];
  const lastDrawn = drawnDocs[drawnDocs.length - 1];

  console.log(`第一个已开奖期: ${firstDrawn.base_issue}→${firstDrawn.target_issue}`);
  console.log(`最后已开奖期: ${lastDrawn.base_issue}→${lastDrawn.target_issue}`);
  console.log(`推算期: 25124→25125\n`);

  // 计算预期的记录数
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 计算预期记录数');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // hit_dlts 有 2792 条记录（期号 7001-25124）
  // 期号对应该是: 7001→7002, 7002→7003, ..., 25123→25124 (2790对已开奖)
  // 加上 25124→25125 (1对推算)
  // 总计: 2791 对

  console.log('hit_dlts表: 2792条记录（期号7001-25124）');
  console.log('预期期号对:');
  console.log('  - 已开奖期对: 7001→7002, 7002→7003, ..., 25123→25124 (2790对)');
  console.log('  - 推算期对: 25124→25125 (1对)');
  console.log('  - 总计: 2791对\n');

  console.log(`实际已开奖期对: ${drawnDocs.length}条`);
  console.log(`实际推算期对: ${allDocs.length - drawnDocs.length}条`);
  console.log(`实际总计: ${allDocs.length}条\n`);

  if (drawnDocs.length > 2790) {
    console.log(`❌ 已开奖期多了 ${drawnDocs.length - 2790} 条！\n`);

    // 尝试找出多余的记录
    // 检查是否有 7000→7001 这样的记录（不应该存在）
    const invalid = allDocs.filter(doc => {
      const base = parseInt(doc.base_issue);
      const target = parseInt(doc.target_issue);
      return target <= 7001; // 第一个有效的 target_issue 应该是 7002
    });

    if (invalid.length > 0) {
      console.log('发现无效记录（target_issue <= 7001）:\n');
      invalid.forEach(doc => {
        console.log(`  ${doc.base_issue}→${doc.target_issue} (_id: ${doc._id})`);
      });
      console.log('\n建议删除这些记录\n');
    }
  }

  await mongoose.connection.close();
}).catch(err => {
  console.error('❌ 数据库连接失败:', err.message);
  process.exit(1);
});
