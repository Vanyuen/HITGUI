/**
 * 分析热温冷优化表的实际结构和使用方式
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';

async function analyze() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  console.log('🔍 分析热温冷优化表结构\n');
  console.log('='.repeat(80));

  // 1. 获取最新的大乐透期号
  console.log('\n1️⃣ 大乐透最新期号:');
  const latest = await db.collection('hit_dlts')
    .find({})
    .sort({ Issue: -1 })
    .limit(3)
    .toArray();

  console.log('最近3期:');
  latest.forEach(issue => {
    console.log(`  - 第 ${issue.Issue} 期 (ID: ${issue.ID})`);
  });

  const latestIssue = latest[0].Issue;
  const previousIssue = latest[1].Issue;

  // 2. 查询优化表的期号覆盖
  console.log('\n2️⃣ 热温冷优化表期号覆盖:');
  const hwcColl = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

  const allBaseIssues = await hwcColl.distinct('base_issue');
  console.log(`总期号对数: ${allBaseIssues.length}`);
  console.log(`期号范围: ${allBaseIssues[0]} ~ ${allBaseIssues[allBaseIssues.length - 1]}`);

  // 检查最新期号是否有优化数据
  const latestHwc = await hwcColl.findOne({ base_issue: previousIssue.toString() });

  if (latestHwc) {
    console.log(`\n✅ 找到最新期号的优化数据:`);
    console.log(`  base_issue: ${latestHwc.base_issue}`);
    console.log(`  target_issue: ${latestHwc.target_issue}`);
    console.log(`  total_combinations: ${latestHwc.total_combinations}`);

    // 分析 hot_warm_cold_data 结构
    console.log('\n3️⃣ hot_warm_cold_data 结构分析:');
    const ratios = Object.keys(latestHwc.hot_warm_cold_data);
    console.log(`  包含 ${ratios.length} 种热温冷比例`);
    console.log(`  比例类型示例:`, ratios.slice(0, 10));

    // 统计每种比例的组合数量
    let totalCombos = 0;
    const ratioStats = {};
    ratios.forEach(ratio => {
      const count = latestHwc.hot_warm_cold_data[ratio].length;
      ratioStats[ratio] = count;
      totalCombos += count;
    });

    console.log(`\n  总组合数: ${totalCombos}`);
    console.log('  前10种比例的组合数:');
    Object.entries(ratioStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([ratio, count]) => {
        console.log(`    ${ratio}: ${count.toLocaleString()} 个`);
      });

    // 4. 理解数据使用方式
    console.log('\n4️⃣ 数据使用方式:');
    console.log('  结构说明:');
    console.log('    - base_issue: 基准期号 (用于计算遗漏值)');
    console.log('    - hot_warm_cold_data: 对象结构');
    console.log('      - Key: "热:温:冷" 比例字符串 (如 "5:0:0", "4:1:0")');
    console.log('      - Value: 符合该比例的组合ID数组');
    console.log('  优势:');
    console.log('    - 按比例分组，快速过滤');
    console.log('    - 单个文档存储一个期号对的所有数据');
    console.log('    - 减少文档数量 (324,632 → 期号对数)');

  } else {
    console.log(`\n❌ 未找到最新期号 ${previousIssue} 的优化数据`);
    console.log(`   需要生成 ${previousIssue} → ${latestIssue} 的优化数据`);
  }

  // 5. 检查是否所有最近期号都有覆盖
  console.log('\n5️⃣ 最近10期的覆盖情况:');
  const recent10 = await db.collection('hit_dlts')
    .find({})
    .sort({ Issue: -1 })
    .limit(10)
    .toArray();

  for (let i = 1; i < recent10.length; i++) {
    const baseIssue = recent10[i].Issue.toString();
    const targetIssue = recent10[i - 1].Issue.toString();

    const hasData = await hwcColl.countDocuments({
      base_issue: baseIssue,
      target_issue: targetIssue
    });

    const status = hasData > 0 ? '✅' : '❌';
    console.log(`  ${status} ${baseIssue} → ${targetIssue}: ${hasData > 0 ? '有数据' : '缺失'}`);
  }

  // 6. 生成建议
  console.log('\n6️⃣ 建议:');
  const missingCount = await Promise.all(
    recent10.slice(1).map(async (issue, i) => {
      const baseIssue = issue.Issue.toString();
      const targetIssue = recent10[i].Issue.toString();
      const hasData = await hwcColl.countDocuments({
        base_issue: baseIssue,
        target_issue: targetIssue
      });
      return hasData === 0 ? 1 : 0;
    })
  ).then(results => results.reduce((sum, val) => sum + val, 0));

  if (missingCount > 0) {
    console.log(`  ⚠️  最近10期中有 ${missingCount} 期缺失优化数据`);
    console.log('  建议: 通过API生成缺失的优化数据');
    console.log('  方法: 使用统一更新脚本或直接调用API');
  } else {
    console.log('  ✅ 最近10期的优化数据完整');
  }

  await client.close();
  console.log('\n' + '='.repeat(80));
  console.log('✅ 分析完成');
}

analyze().catch(console.error);
