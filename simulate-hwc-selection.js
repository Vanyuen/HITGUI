const { MongoClient } = require('mongodb');

async function simulate() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('lottery');

  // 1. 获取25140期的遗漏数据（用于预测25141期）
  const missingColl = db.collection('hit_dlt_basictrendchart_redballmissing_histories');
  const missing25140 = await missingColl.findOne({ Issue: '25140' });

  if (!missing25140) {
    console.log('❌ 找不到25140期的遗漏数据');
    await client.close();
    return;
  }

  console.log('=== 使用25140期遗漏数据模拟热温冷比筛选 ===');
  console.log('目标热温冷比: 3:1:1 (3热1温1冷)');

  // 构建遗漏值映射
  const missingMap = {};
  for (let i = 1; i <= 35; i++) {
    missingMap[i] = missing25140[String(i)] || 0;
  }

  // 统计每个球的热温冷分类
  let hotBalls = [], warmBalls = [], coldBalls = [];
  for (let i = 1; i <= 35; i++) {
    const miss = missingMap[i];
    if (miss <= 4) hotBalls.push(i);
    else if (miss <= 9) warmBalls.push(i);
    else coldBalls.push(i);
  }

  console.log(`\n基于25140期遗漏的热温冷分类:`);
  console.log(`  热球(遗漏≤4): ${hotBalls.length}个 - ${hotBalls.join(', ')}`);
  console.log(`  温球(5≤遗漏≤9): ${warmBalls.length}个 - ${warmBalls.join(', ')}`);
  console.log(`  冷球(遗漏≥10): ${coldBalls.length}个 - ${coldBalls.join(', ')}`);

  // 2. 读取红球组合表，计算符合3:1:1的组合数
  const redCombColl = db.collection('hit_dlt_redcombinations');
  const totalRedComb = await redCombColl.countDocuments();
  console.log(`\n红球组合表总数: ${totalRedComb}`);

  // 遍历组合，统计热温冷比
  const cursor = redCombColl.find({});
  const hwcCounts = {};
  let processedCount = 0;
  let match311Count = 0;

  while (await cursor.hasNext()) {
    const combo = await cursor.next();
    const balls = [combo.red_ball_1, combo.red_ball_2, combo.red_ball_3, combo.red_ball_4, combo.red_ball_5];

    let hot = 0, warm = 0, cold = 0;
    for (const ball of balls) {
      const miss = missingMap[ball];
      if (miss <= 4) hot++;
      else if (miss <= 9) warm++;
      else cold++;
    }

    const ratio = `${hot}:${warm}:${cold}`;
    hwcCounts[ratio] = (hwcCounts[ratio] || 0) + 1;

    if (hot === 3 && warm === 1 && cold === 1) {
      match311Count++;
    }

    processedCount++;
    if (processedCount % 50000 === 0) {
      console.log(`  处理中: ${processedCount}/${totalRedComb}`);
    }
  }

  console.log(`\n=== 热温冷比分布统计 ===`);
  const sortedRatios = Object.entries(hwcCounts).sort((a, b) => b[1] - a[1]);
  sortedRatios.forEach(([ratio, count]) => {
    const marker = ratio === '3:1:1' ? ' ★ (选中)' : '';
    console.log(`  ${ratio}: ${count}个组合${marker}`);
  });

  console.log(`\n✅ 符合3:1:1热温冷比的组合数: ${match311Count}`);

  // 3. 对比25139期（用于预测25140期）
  const missing25139 = await missingColl.findOne({ Issue: '25139' });
  if (missing25139) {
    const missingMap25139 = {};
    for (let i = 1; i <= 35; i++) {
      missingMap25139[i] = missing25139[String(i)] || 0;
    }

    let match311Count25139 = 0;
    const cursor2 = redCombColl.find({});
    while (await cursor2.hasNext()) {
      const combo = await cursor2.next();
      const balls = [combo.red_ball_1, combo.red_ball_2, combo.red_ball_3, combo.red_ball_4, combo.red_ball_5];

      let hot = 0, warm = 0, cold = 0;
      for (const ball of balls) {
        const miss = missingMap25139[ball];
        if (miss <= 4) hot++;
        else if (miss <= 9) warm++;
        else cold++;
      }

      if (hot === 3 && warm === 1 && cold === 1) {
        match311Count25139++;
      }
    }

    console.log(`\n对比: 使用25139期遗漏数据，符合3:1:1的组合数: ${match311Count25139}`);
    console.log(`(这应该与25140期的结果相近: step1_count≈61047)`);
  }

  await client.close();
}

simulate().catch(console.error);
