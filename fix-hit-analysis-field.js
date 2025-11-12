const { MongoClient } = require('mongodb');

/**
 * 修复字段名称不匹配问题
 * 将 hit_statistics 的数据复制到 hit_analysis（前端期望的字段）
 */

(async () => {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  const taskId = process.argv[2] || 'hwc-pos-20251105-yw1';

  console.log('=== 修复 hit_analysis 字段 ===\n');

  // 获取所有结果记录
  const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
    .find({ task_id: taskId })
    .toArray();

  console.log(`找到 ${results.length} 条结果记录\n`);

  let updatedCount = 0;

  for (const result of results) {
    const period = result.period;

    // 如果没有 hit_statistics，跳过
    if (!result.hit_statistics) {
      console.log(`期号 ${period}: 跳过（无 hit_statistics）`);
      continue;
    }

    const stats = result.hit_statistics;

    // 构建符合前端期望的 hit_analysis 结构
    const hitAnalysis = {
      max_red_hit: stats.max_red_hit || 0,
      max_blue_hit: stats.max_blue_hit || 0,
      prize_stats: {
        first_prize: {
          count: stats.prize_counts?.prize_1 || 0,
          amount: (stats.prize_counts?.prize_1 || 0) * 10000000
        },
        second_prize: {
          count: stats.prize_counts?.prize_2 || 0,
          amount: (stats.prize_counts?.prize_2 || 0) * 200000
        },
        third_prize: {
          count: stats.prize_counts?.prize_3 || 0,
          amount: (stats.prize_counts?.prize_3 || 0) * 10000
        },
        fourth_prize: {
          count: stats.prize_counts?.prize_4 || 0,
          amount: (stats.prize_counts?.prize_4 || 0) * 3000
        },
        fifth_prize: {
          count: stats.prize_counts?.prize_5 || 0,
          amount: (stats.prize_counts?.prize_5 || 0) * 300
        },
        sixth_prize: {
          count: stats.prize_counts?.prize_6 || 0,
          amount: (stats.prize_counts?.prize_6 || 0) * 200
        },
        seventh_prize: {
          count: stats.prize_counts?.prize_7 || 0,
          amount: (stats.prize_counts?.prize_7 || 0) * 100
        },
        eighth_prize: {
          count: stats.prize_counts?.prize_8 || 0,
          amount: (stats.prize_counts?.prize_8 || 0) * 15
        },
        ninth_prize: {
          count: stats.prize_counts?.prize_9 || 0,
          amount: (stats.prize_counts?.prize_9 || 0) * 5
        }
      },
      hit_rate: stats.total_combinations > 0
        ? (stats.hit_count / stats.total_combinations) * 100
        : 0,
      total_prize: stats.total_prize || 0
    };

    console.log(`期号 ${period}:`);
    console.log(`  max_red_hit: ${hitAnalysis.max_red_hit}`);
    console.log(`  max_blue_hit: ${hitAnalysis.max_blue_hit}`);
    console.log(`  total_prize: ¥${hitAnalysis.total_prize.toLocaleString()}`);

    // 更新数据库
    const updateResult = await db.collection('hit_dlt_hwcpositivepredictiontaskresults').updateOne(
      { result_id: result.result_id },
      { $set: { hit_analysis: hitAnalysis } }
    );

    if (updateResult.modifiedCount > 0) {
      console.log(`  ✅ 已更新\n`);
      updatedCount++;
    } else {
      console.log(`  ⚠️  未更新\n`);
    }
  }

  console.log('=== 完成 ===');
  console.log(`总记录数: ${results.length}`);
  console.log(`已更新: ${updatedCount}`);

  await client.close();
})();
