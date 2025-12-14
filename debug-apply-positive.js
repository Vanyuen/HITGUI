const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;

  // 模拟 hwcOptimizedCache 构建
  const hwcDataList = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').find({
    target_id: { $gte: 2778, $lte: 2807 }
  }).toArray();

  const hwcOptimizedCache = new Map();
  for (const data of hwcDataList) {
    const key = `${data.base_issue}-${data.target_issue}`;
    if (data.hot_warm_cold_data) {
      const hwcMap = new Map();
      for (const [ratio, ids] of Object.entries(data.hot_warm_cold_data)) {
        hwcMap.set(ratio, ids);
      }
      hwcOptimizedCache.set(key, hwcMap);
    }
  }
  console.log('hwcOptimizedCache size:', hwcOptimizedCache.size);

  // 模拟 applyPositiveSelection
  const baseIssue = '25109';
  const targetIssue = '25110';
  const selectedHwcRatios = [{ hot: 4, warm: 1, cold: 0 }];

  const hwcKey = `${baseIssue}-${targetIssue}`;
  const hwcMap = hwcOptimizedCache.get(hwcKey);

  console.log('\n=== applyPositiveSelection 模拟 ===');
  console.log('hwcKey:', hwcKey);
  console.log('hwcMap exists:', !!hwcMap);

  if (hwcMap) {
    // 转换 ratio 对象为字符串
    const selectedRatioKeys = selectedHwcRatios.map(r => {
      if (typeof r === 'string') {
        return r;
      } else {
        return `${r.hot}:${r.warm}:${r.cold}`;
      }
    });
    console.log('selectedRatioKeys:', selectedRatioKeys);

    // 获取组合 ID
    const candidateIds = new Set();
    for (const ratioKey of selectedRatioKeys) {
      const ids = hwcMap.get(ratioKey) || [];
      console.log(`  ${ratioKey}: ${ids.length} ids`);
      ids.forEach(id => candidateIds.add(id));
    }
    console.log('candidateIds size:', candidateIds.size);
  } else {
    console.log('hwcMap is null - will use fallback');
  }

  // 测试多个期号对
  console.log('\n=== 测试多个期号对 ===');
  const testPairs = [
    ['25109', '25110'],
    ['25110', '25111'],
    ['25138', '25139'],
  ];

  for (const [base, target] of testPairs) {
    const key = `${base}-${target}`;
    const map = hwcOptimizedCache.get(key);
    if (map) {
      const ids = map.get('4:1:0') || [];
      console.log(`${key}: 4:1:0 has ${ids.length} ids`);
    } else {
      console.log(`${key}: hwcMap is null`);
    }
  }

  mongoose.disconnect();
});
