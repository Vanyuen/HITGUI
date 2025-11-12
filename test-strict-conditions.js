/**
 * 测试严格条件下有多少组合能通过筛选
 *
 * 条件:
 * - 热温冷比: 4:1:0
 * - 区间比: 2:1:2
 * - 奇偶比: 2:3 或 3:2
 * - 和值: 60-90
 * - 跨度: 18-25
 * - AC值: 4, 5, 6
 * - 允许2连号，不允许3连号
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

async function testStrictConditions() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('✅ 已连接到MongoDB\n');

    const db = client.db(DB_NAME);

    console.log('🧪 测试严格条件筛选');
    console.log('='.repeat(100));
    console.log('条件:');
    console.log('  - 区间比: 2:1:2');
    console.log('  - 奇偶比: 2:3 或 3:2');
    console.log('  - 和值: 60-90');
    console.log('  - 跨度: 18-25');
    console.log('  - AC值: 4, 5, 6');
    console.log('  - 最长连号: 2 (不允许3连号)');
    console.log('  - 热温冷比: 4:1:0 (将在下一步基于缺失值数据检查)');
    console.log('');

    // 第一步：基础条件筛选（不包含热温冷）
    console.log('📊 第一步: 基础条件筛选（不含热温冷比）');
    console.log('='.repeat(100));

    const baseQuery = {
      zone_ratio: '2:1:2',
      $or: [
        { odd_even_ratio: '2:3' },
        { odd_even_ratio: '3:2' }
      ],
      sum_value: { $gte: 60, $lte: 90 },
      span_value: { $gte: 18, $lte: 25 },
      ac_value: { $in: [4, 5, 6] },
      max_consecutive_length: { $lte: 2 }
    };

    const baseCount = await db.collection('hit_dlt_redcombinations').countDocuments(baseQuery);
    console.log(`✅ 符合基础条件的组合数: ${baseCount.toLocaleString()}`);

    if (baseCount === 0) {
      console.log('\n❌ 第一步就没有符合条件的组合！');
      console.log('   问题: 基础条件过于严格');
      console.log('');

      // 逐项测试每个条件
      console.log('🔍 逐项测试各条件:');
      console.log('-'.repeat(100));

      const tests = [
        { name: '区间比 2:1:2', query: { zone_ratio: '2:1:2' } },
        { name: '奇偶比 2:3 或 3:2', query: { $or: [{ odd_even_ratio: '2:3' }, { odd_even_ratio: '3:2' }] } },
        { name: '和值 60-90', query: { sum_value: { $gte: 60, $lte: 90 } } },
        { name: '跨度 18-25', query: { span_value: { $gte: 18, $lte: 25 } } },
        { name: 'AC值 4,5,6', query: { ac_value: { $in: [4, 5, 6] } } },
        { name: '最长连号≤2', query: { max_consecutive_length: { $lte: 2 } } }
      ];

      for (const test of tests) {
        const count = await db.collection('hit_dlt_redcombinations').countDocuments(test.query);
        const percentage = ((count / 324632) * 100).toFixed(2);
        console.log(`  ${test.name.padEnd(20)}: ${count.toLocaleString().padStart(10)} (${percentage.padStart(6)}%)`);
      }

      console.log('');

      // 组合测试：逐步添加条件
      console.log('🔍 组合测试: 逐步添加条件');
      console.log('-'.repeat(100));

      const combinations = [
        { name: '区间比', query: { zone_ratio: '2:1:2' } },
        { name: '区间比 + 奇偶比', query: { zone_ratio: '2:1:2', $or: [{ odd_even_ratio: '2:3' }, { odd_even_ratio: '3:2' }] } },
        { name: '+ 和值', query: { ...baseQuery, ac_value: undefined, max_consecutive_length: undefined }, filter: q => {
          delete q.ac_value;
          delete q.max_consecutive_length;
          return q;
        }},
        { name: '+ 跨度', query: { ...baseQuery, ac_value: undefined }, filter: q => {
          delete q.ac_value;
          return q;
        }},
        { name: '+ AC值', query: { ...baseQuery, max_consecutive_length: undefined }, filter: q => {
          delete q.max_consecutive_length;
          return q;
        }},
        { name: '+ 连号限制', query: baseQuery }
      ];

      for (const combo of combinations) {
        let query = combo.query;
        if (combo.filter) {
          query = combo.filter(query);
        }
        const count = await db.collection('hit_dlt_redcombinations').countDocuments(query);
        const percentage = count > 0 ? ((count / 324632) * 100).toFixed(2) : '0.00';
        console.log(`  ${combo.name.padEnd(30)}: ${count.toLocaleString().padStart(10)} (${percentage.padStart(6)}%)`);
      }

      return;
    }

    // 第二步：热温冷比筛选
    console.log('\n📊 第二步: 热温冷比 4:1:0 筛选');
    console.log('='.repeat(100));

    // 获取最新期号的缺失值数据
    const latestIssue = await db.collection('hit_dlts')
      .find({})
      .sort({ Issue: -1 })
      .limit(1)
      .toArray();

    if (latestIssue.length === 0 || !latestIssue[0].statistics || !latestIssue[0].statistics.frontHotWarmColdRatio) {
      console.log('❌ 无法获取最新期号的缺失值数据！');
      return;
    }

    const issue = latestIssue[0];
    console.log(`使用期号: ${issue.Issue}`);
    console.log(`该期热温冷比: ${issue.statistics.frontHotWarmColdRatio}`);
    console.log('');

    // 获取该期的红球缺失值数据
    const missingData = await db.collection('hit_dlt_basictrendchart_redballmissing_histories')
      .findOne({ period: issue.Issue });

    if (!missingData || !missingData.missing_values) {
      console.log('❌ 无法获取缺失值详细数据！');
      return;
    }

    console.log('分析符合条件的组合...');

    // 获取符合基础条件的组合
    const baseCombos = await db.collection('hit_dlt_redcombinations')
      .find(baseQuery)
      .toArray();

    console.log(`基础条件符合: ${baseCombos.length} 个组合`);

    // 计算热温冷分类
    const hotBalls = [];
    const warmBalls = [];
    const coldBalls = [];

    for (let i = 1; i <= 35; i++) {
      const missing = missingData.missing_values[i - 1];
      if (missing <= 4) {
        hotBalls.push(i);
      } else if (missing >= 5 && missing <= 9) {
        warmBalls.push(i);
      } else {
        coldBalls.push(i);
      }
    }

    console.log(`\n球号分类:`);
    console.log(`  热球 (缺失≤4): ${hotBalls.length}个 - ${hotBalls.join(',')}`);
    console.log(`  温球 (缺失5-9): ${warmBalls.length}个 - ${warmBalls.join(',')}`);
    console.log(`  冷球 (缺失≥10): ${coldBalls.length}个 - ${coldBalls.join(',')}`);
    console.log('');

    // 检查符合热温冷比4:1:0的组合
    let hwcMatchCount = 0;

    for (const combo of baseCombos) {
      const balls = [combo.red_ball_1, combo.red_ball_2, combo.red_ball_3, combo.red_ball_4, combo.red_ball_5];

      let hot = 0, warm = 0, cold = 0;
      for (const ball of balls) {
        if (hotBalls.includes(ball)) hot++;
        else if (warmBalls.includes(ball)) warm++;
        else cold++;
      }

      if (hot === 4 && warm === 1 && cold === 0) {
        hwcMatchCount++;
      }
    }

    console.log(`✅ 符合热温冷比 4:1:0 的组合数: ${hwcMatchCount.toLocaleString()}`);

    if (hwcMatchCount === 0) {
      console.log('\n❌ 最终结果: 没有组合同时符合所有条件！');
      console.log('\n💡 建议:');
      console.log('  1. 放宽热温冷比条件 (例如: 3:2:0, 4:0:1)');
      console.log('  2. 放宽AC值范围 (例如: 3-6)');
      console.log('  3. 放宽和值范围 (例如: 55-95)');
      console.log('  4. 放宽跨度范围 (例如: 15-28)');
    } else {
      console.log(`\n✅ 最终符合所有条件的组合数: ${hwcMatchCount.toLocaleString()}`);
      console.log(`   占总组合比例: ${((hwcMatchCount / 324632) * 100).toFixed(4)}%`);
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
  } finally {
    await client.close();
    console.log('\n✅ 测试完成');
  }
}

testStrictConditions();
