/**
 * 诊断脚本：测试applyPositiveSelection中Step 1的热温冷比筛选
 */
const { MongoClient } = require('mongodb');

async function test() {
  const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db = client.db('lottery');

  const baseIssue = '25041';
  const targetIssue = '25042';
  const selectedHwcRatios = [{ hot: 3, warm: 1, cold: 1 }];

  console.log('测试参数:');
  console.log('  baseIssue:', baseIssue);
  console.log('  targetIssue:', targetIssue);
  console.log('  selectedHwcRatios:', selectedHwcRatios);

  // 1. 查询HWC优化表
  const hwcKey = `${baseIssue}-${targetIssue}`;
  const hwcData = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
    .findOne({ base_issue: baseIssue, target_issue: targetIssue });

  console.log('\nHWC数据存在:', !!hwcData);

  if (hwcData && hwcData.hot_warm_cold_data) {
    console.log('HWC数据中的比例键:', Object.keys(hwcData.hot_warm_cold_data));

    // 转换selectedHwcRatios为字符串格式
    const selectedRatioKeys = selectedHwcRatios.map(r => {
      if (typeof r === 'string') {
        return r;
      } else {
        return `${r.hot}:${r.warm}:${r.cold}`;
      }
    });
    console.log('选择的比例键:', selectedRatioKeys);

    // 查找匹配的组合
    let candidateIds = new Set();
    for (const ratioKey of selectedRatioKeys) {
      const ids = hwcData.hot_warm_cold_data[ratioKey] || [];
      console.log(`  比例 ${ratioKey}: ${ids.length} 个组合`);
      ids.forEach(id => candidateIds.add(id));
    }

    console.log('\n总计Step 1筛选出:', candidateIds.size, '个组合');
  }

  await client.close();
}

test().catch(console.error);
