const mongoose = require('mongoose');

console.log('🔍 正在连接数据库...\n');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  const db = mongoose.connection.db;
  const collection = 'hit_dlt_redcombinationshotwarmcoldoptimizeds';

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 热温冷优化表验证报告');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. 总记录数
  const totalCount = await db.collection(collection).countDocuments();
  console.log(`✅ 总记录数: ${totalCount.toLocaleString()}`);
  console.log(`   预期: 2791条（7002→7003 到 25124→25125）\n`);

  // 2. 最新10条记录
  console.log('📋 最新10条记录:');
  const latest10 = await db.collection(collection)
    .find({})
    .sort({ target_issue: -1 })
    .limit(10)
    .toArray();

  latest10.forEach(r => {
    const hwcDataKeys = r.hot_warm_cold_data ? Object.keys(r.hot_warm_cold_data).length : 0;
    const predictedFlag = r.is_predicted ? '🔮 推算' : '✅ 已开奖';
    console.log(`   ${r.base_issue} → ${r.target_issue}: ${predictedFlag}, ${hwcDataKeys}种比例`);
  });

  // 3. 检查关键期号对
  console.log('\n🔍 检查关键期号对:');
  const keyPairs = [
    { base: 9152, target: 9153, desc: '旧数据最后一对' },
    { base: 9153, target: 9154, desc: '新旧数据分界' },
    { base: 25114, target: 25115, desc: '测试任务起始' },
    { base: 25120, target: 25121, desc: '测试任务中间' },
    { base: 25123, target: 25124, desc: '最新已开奖' },
    { base: 25124, target: 25125, desc: '推算下一期' }
  ];

  for (const pair of keyPairs) {
    const record = await db.collection(collection).findOne({
      base_issue: pair.base,
      target_issue: pair.target
    });

    if (record) {
      const hwcDataKeys = record.hot_warm_cold_data ? Object.keys(record.hot_warm_cold_data).length : 0;
      const predictedFlag = record.is_predicted ? '🔮 推算' : '✅ 已开奖';
      console.log(`   ${pair.base} → ${pair.target} (${pair.desc}): ✅ 存在 | ${predictedFlag} | ${hwcDataKeys}种比例`);
    } else {
      console.log(`   ${pair.base} → ${pair.target} (${pair.desc}): ❌ 不存在`);
    }
  }

  // 4. 检查 is_predicted 字段分布
  console.log('\n📊 is_predicted 字段分布:');
  const drawnCount = await db.collection(collection).countDocuments({ is_predicted: false });
  const predictedCount = await db.collection(collection).countDocuments({ is_predicted: true });

  console.log(`   已开奖期 (is_predicted=false): ${drawnCount.toLocaleString()}`);
  console.log(`   推算期 (is_predicted=true): ${predictedCount.toLocaleString()}`);
  console.log(`   预期: 已开奖期=2790条, 推算期=1条`);

  // 5. 检查数据范围
  console.log('\n📊 数据期号范围:');
  const minRecord = await db.collection(collection).findOne({}, { sort: { base_issue: 1 } });
  const maxRecord = await db.collection(collection).findOne({}, { sort: { target_issue: -1 } });

  console.log(`   最小期号对: ${minRecord?.base_issue} → ${minRecord?.target_issue}`);
  console.log(`   最大期号对: ${maxRecord?.base_issue} → ${maxRecord?.target_issue}`);
  console.log(`   预期: 最小=7002→7003, 最大=25124→25125`);

  // 6. 抽查一条记录的数据结构
  console.log('\n📋 数据结构抽查（25123→25124）:');
  const sampleRecord = await db.collection(collection).findOne({
    base_issue: 25123,
    target_issue: 25124
  });

  if (sampleRecord) {
    console.log(`   base_issue: ${sampleRecord.base_issue}`);
    console.log(`   target_issue: ${sampleRecord.target_issue}`);
    console.log(`   is_predicted: ${sampleRecord.is_predicted}`);
    console.log(`   hot_warm_cold_data: ${Object.keys(sampleRecord.hot_warm_cold_data || {}).length}种比例`);

    // 显示几个热温冷比的样本数据
    if (sampleRecord.hot_warm_cold_data) {
      console.log('\n   样本热温冷比数据:');
      const ratios = ['5:0:0', '4:1:0', '3:2:0', '3:1:1', '2:2:1'];
      ratios.forEach(ratio => {
        const data = sampleRecord.hot_warm_cold_data[ratio];
        if (data) {
          console.log(`      ${ratio}: 热号=${data.hot_balls?.length || 0}个, 温号=${data.warm_balls?.length || 0}个, 冷号=${data.cold_balls?.length || 0}个`);
        }
      });
    }
  } else {
    console.log('   ❌ 记录不存在');
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🎯 验证结果总结');
  console.log('═══════════════════════════════════════════════════════════════\n');

  let allPassed = true;
  const checks = [];

  // 检查1: 总记录数
  if (totalCount === 2791) {
    checks.push('✅ 总记录数正确 (2791)');
  } else {
    checks.push(`❌ 总记录数错误 (实际=${totalCount}, 预期=2791)`);
    allPassed = false;
  }

  // 检查2: 最新期号对
  if (maxRecord?.base_issue === 25124 && maxRecord?.target_issue === 25125) {
    checks.push('✅ 最新期号对正确 (25124→25125)');
  } else {
    checks.push(`❌ 最新期号对错误 (实际=${maxRecord?.base_issue}→${maxRecord?.target_issue})`);
    allPassed = false;
  }

  // 检查3: is_predicted分布
  if (drawnCount === 2790 && predictedCount === 1) {
    checks.push('✅ is_predicted分布正确 (已开奖=2790, 推算=1)');
  } else {
    checks.push(`❌ is_predicted分布错误 (已开奖=${drawnCount}, 推算=${predictedCount})`);
    allPassed = false;
  }

  checks.forEach(check => console.log(check));

  console.log('\n═══════════════════════════════════════════════════════════════\n');

  if (allPassed) {
    console.log('🎉 全量重建成功！所有验证通过！\n');
    console.log('✅ 下一步: 创建测试任务验证预测功能是否正常\n');
  } else {
    console.log('⚠️  验证未完全通过，请检查上述错误项\n');
  }

  await mongoose.connection.close();
}).catch(err => {
  console.error('❌ 数据库连接失败:', err.message);
  process.exit(1);
});
