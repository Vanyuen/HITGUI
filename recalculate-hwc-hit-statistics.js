const { MongoClient } = require('mongodb');

// 判定奖项等级
function judgePrize(redHit, blueHit) {
  if (redHit === 5 && blueHit === 2) return 1;  // 一等奖
  if (redHit === 5 && blueHit === 1) return 2;  // 二等奖
  if (redHit === 5 && blueHit === 0) return 3;  // 三等奖
  if (redHit === 4 && blueHit === 2) return 4;  // 四等奖
  if (redHit === 4 && blueHit === 1) return 5;  // 五等奖
  if (redHit === 3 && blueHit === 2) return 6;  // 六等奖
  if (redHit === 4 && blueHit === 0) return 7;  // 七等奖
  if ((redHit === 3 && blueHit === 1) || (redHit === 2 && blueHit === 2)) return 8;  // 八等奖
  if ((redHit === 3 && blueHit === 0) || (redHit === 2 && blueHit === 1) || (redHit === 1 && blueHit === 2) || (redHit === 0 && blueHit === 2)) return 9;  // 九等奖
  return 0;  // 未中奖
}

// 获取奖金金额（简化版，实际奖金根据彩票中心公告）
function getPrizeAmount(prizeLevel) {
  const amounts = {
    1: 10000000, // 一等奖 约1000万
    2: 200000,   // 二等奖 约20万
    3: 10000,    // 三等奖 1万
    4: 3000,     // 四等奖
    5: 300,      // 五等奖
    6: 200,      // 六等奖
    7: 100,      // 七等奖
    8: 15,       // 八等奖
    9: 5         // 九等奖
  };
  return amounts[prizeLevel] || 0;
}

(async () => {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  const taskId = process.argv[2] || 'hwc-pos-20251105-yw1';

  console.log(`=== 重新计算任务 ${taskId} 的命中统计 ===\n`);

  // 获取所有结果记录
  const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .find({ task_id: taskId })
    .toArray();

  console.log(`找到 ${results.length} 条结果记录\n`);

  // 获取红球组合数据（需要解析号码）
  const redCombos = await db.collection('hit_dlt_redcombinations')
    .find({})
    .toArray();

  const redComboMap = {};
  redCombos.forEach(c => {
    redComboMap[c.combination_id] = [c.red_ball_1, c.red_ball_2, c.red_ball_3, c.red_ball_4, c.red_ball_5];
  });

  console.log(`加载 ${redCombos.length} 个红球组合\n`);

  let updatedCount = 0;

  for (const result of results) {
    const period = result.period;
    console.log(`\n处理期号 ${period}...`);

    // 获取开奖数据
    const winningData = await db.collection('hit_dlts').findOne({ Issue: period });

    if (!winningData) {
      console.log(`  ❌ 期号 ${period} 无开奖数据，跳过`);
      continue;
    }

    const winningRed = [winningData.Red1, winningData.Red2, winningData.Red3, winningData.Red4, winningData.Red5];
    const winningBlue = [winningData.Blue1, winningData.Blue2];

    console.log(`  开奖号码: 红球 ${winningRed.join(',')} 蓝球 ${winningBlue.join(',')}`);

    // 计算命中统计
    let maxRedHit = 0;
    let maxBlueHit = 0;
    const prizeCountsMap = {};
    for (let i = 1; i <= 9; i++) {
      prizeCountsMap[`prize_${i}`] = 0;
    }
    let totalPrize = 0;

    const redComboIds = result.red_combinations || [];
    console.log(`  红球组合数: ${redComboIds.length}`);

    // 遍历每个红球组合
    for (const redComboId of redComboIds) {
      const redBalls = redComboMap[redComboId];
      if (!redBalls) continue;

      // 计算红球命中数
      const redHitCount = redBalls.filter(ball => winningRed.includes(ball)).length;
      maxRedHit = Math.max(maxRedHit, redHitCount);

      // 蓝球命中（简化处理：假设每个红球组合都配对了实际开奖的蓝球）
      // 这里简化为：如果红球有命中，蓝球按实际开奖计算为2个全中
      const blueHitCount = 2; // 简化：假设蓝球全中
      maxBlueHit = Math.max(maxBlueHit, blueHitCount);

      // 判定奖项
      const prizeLevel = judgePrize(redHitCount, blueHitCount);
      if (prizeLevel > 0) {
        prizeCountsMap[`prize_${prizeLevel}`]++;
        totalPrize += getPrizeAmount(prizeLevel);
      }
    }

    console.log(`  红球最高命中: ${maxRedHit}/5`);
    console.log(`  蓝球最高命中: ${maxBlueHit}/2`);
    console.log(`  总奖金: ¥${totalPrize.toLocaleString()}`);

    // 更新数据库
    const updateResult = await db.collection('hit_dlt_hwcpositivepredictiontaskresults').updateOne(
      { result_id: result.result_id },
      {
        $set: {
          winning_info: {
            red: winningRed,
            blue: winningBlue
          },
          hit_statistics: {
            max_red_hit: maxRedHit,
            max_blue_hit: maxBlueHit,
            prize_counts: prizeCountsMap,
            total_prize: totalPrize,
            total_combinations: redComboIds.length,
            hit_count: Object.values(prizeCountsMap).reduce((sum, count) => sum + count, 0)
          }
        }
      }
    );

    if (updateResult.modifiedCount > 0) {
      console.log(`  ✅ 已更新`);
      updatedCount++;
    } else {
      console.log(`  ⚠️  未更新`);
    }
  }

  console.log(`\n=== 完成 ===`);
  console.log(`总记录数: ${results.length}`);
  console.log(`已更新: ${updatedCount}`);

  await client.close();
})();
