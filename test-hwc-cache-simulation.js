const { MongoClient } = require('mongodb');

async function simulate() {
  const client = new MongoClient('mongodb://127.0.0.1:27017');
  await client.connect();
  const db = client.db('lottery');

  // 模拟代码中的缓存构建
  const issuePairs = [{base_issue: '25141', target_issue: '25142'}];

  // 1. 执行与代码相同的查询
  const hwcDataList = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').find({
    $or: issuePairs.map(p => ({
      base_issue: p.base_issue,
      target_issue: p.target_issue
    }))
  }).toArray();

  console.log('查询结果数量:', hwcDataList.length);

  // 2. 构建缓存（与代码一致）
  const hwcOptimizedCache = new Map();
  for (const data of hwcDataList) {
    const key = `${data.base_issue}-${data.target_issue}`;
    console.log('构建缓存key:', key);

    if (data.hot_warm_cold_data) {
      const hwcMap = new Map();
      for (const [ratio, ids] of Object.entries(data.hot_warm_cold_data)) {
        hwcMap.set(ratio, ids);
      }
      hwcOptimizedCache.set(key, hwcMap);
      console.log('  热温冷比数量:', hwcMap.size);
      console.log('  3:1:1组合数:', hwcMap.get('3:1:1')?.length || 0);
    }
  }

  console.log('\n缓存大小:', hwcOptimizedCache.size);

  // 3. 测试缓存访问（与代码一致）
  const baseIssue = '25141';
  const targetIssue = '25142';
  const hwcKey = `${baseIssue}-${targetIssue}`;
  console.log('\n测试访问key:', hwcKey);

  const hwcMap = hwcOptimizedCache.get(hwcKey);
  console.log('hwcMap存在:', !!hwcMap);

  if (hwcMap) {
    // 模拟正选筛选
    const selectedRatios = [{hot: 3, warm: 1, cold: 1}];
    const selectedRatioKeys = selectedRatios.map(r => `${r.hot}:${r.warm}:${r.cold}`);
    console.log('selectedRatioKeys:', selectedRatioKeys);

    let candidateIds = new Set();
    for (const ratioKey of selectedRatioKeys) {
      const ids = hwcMap.get(ratioKey) || [];
      console.log('  ' + ratioKey + ' 组合数:', ids.length);
      ids.forEach(id => candidateIds.add(id));
    }
    console.log('candidateIds总数:', candidateIds.size);
  }

  await client.close();
}

simulate().catch(console.error);
