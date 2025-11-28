/**
 * 检查HWC优化表结构和数据
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function checkHwcTable() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lottery');
    console.log('✅ 数据库连接成功');

    const HwcOptimized = mongoose.connection.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    // 1. 获取总记录数
    const totalCount = await HwcOptimized.countDocuments();
    console.log('\n===== HWC优化表统计 =====');
    console.log('总记录数:', totalCount);

    // 2. 检查target_id范围
    const minRecord = await HwcOptimized.findOne({ target_id: { $ne: null } }, { sort: { target_id: 1 } });
    const maxRecord = await HwcOptimized.findOne({ target_id: { $ne: null } }, { sort: { target_id: -1 } });
    console.log('\n最小target_id:', minRecord?.target_id, '对应:', minRecord?.base_issue, '->', minRecord?.target_issue);
    console.log('最大target_id:', maxRecord?.target_id, '对应:', maxRecord?.base_issue, '->', maxRecord?.target_issue);

    // 3. 检查特定target_id
    console.log('\n===== 检查特定target_id =====');
    for (const tid of [2783, 2784, 2785, 2790, 2791, 2792]) {
      const record = await HwcOptimized.findOne({ target_id: tid });
      if (record) {
        console.log(`target_id=${tid}: ${record.base_issue} -> ${record.target_issue}`);
      } else {
        console.log(`target_id=${tid}: ❌ 不存在`);
      }
    }

    // 4. 检查特定target_issue
    console.log('\n===== 检查特定target_issue =====');
    for (const ti of ['25115', '25116', '25120', '25124', '25125']) {
      const record = await HwcOptimized.findOne({ target_issue: ti });
      if (record) {
        console.log(`target_issue=${ti}: ${record.base_issue} -> ${ti}, target_id=${record.target_id}, is_predicted=${record.is_predicted}`);
      } else {
        console.log(`target_issue=${ti}: ❌ 不存在`);
      }
    }

    // 5. 检查推算期记录
    console.log('\n===== 检查推算期记录 =====');
    const predictedRecord = await HwcOptimized.findOne({ is_predicted: true });
    if (predictedRecord) {
      console.log('推算期记录存在:');
      console.log('  base_issue:', predictedRecord.base_issue);
      console.log('  target_issue:', predictedRecord.target_issue);
      console.log('  base_id:', predictedRecord.base_id);
      console.log('  target_id:', predictedRecord.target_id);
    } else {
      console.log('❌ 无推算期记录 (is_predicted=true)');
    }

    // 6. 检查最新5条记录
    console.log('\n===== 最新5条记录(按target_id降序) =====');
    const latestRecords = await HwcOptimized.find({ target_id: { $ne: null } }).sort({ target_id: -1 }).limit(5).toArray();
    latestRecords.forEach(r => {
      console.log(`  ${r.base_issue} -> ${r.target_issue} (target_id=${r.target_id})`);
    });

    // 7. 检查hit_dlts表的ID对应关系
    console.log('\n===== hit_dlts表ID对应关系 =====');
    const hitDlts = mongoose.connection.collection('hit_dlts');
    for (const id of [2783, 2784, 2790, 2791, 2792]) {
      const record = await hitDlts.findOne({ ID: id });
      if (record) {
        console.log(`ID=${id}: Issue=${record.Issue}`);
      }
    }

    // 8. 检查HWC表与hit_dlts表的对应关系
    console.log('\n===== 对应关系分析 =====');
    // 对于target_issue=25115，期望的HWC记录应该是 base=25114, target=25115
    // 对应的ID：25114的ID是多少？25115的ID是多少？
    const issue25114 = await hitDlts.findOne({ Issue: 25114 });
    const issue25115 = await hitDlts.findOne({ Issue: 25115 });
    console.log('Issue 25114 的 ID:', issue25114?.ID);
    console.log('Issue 25115 的 ID:', issue25115?.ID);

    // 检查HWC表是否有 25114->25115 的记录
    const hwc25114to25115 = await HwcOptimized.findOne({ base_issue: '25114', target_issue: '25115' });
    console.log('HWC记录 25114->25115:', hwc25114to25115 ? `存在 (target_id=${hwc25114to25115.target_id})` : '❌ 不存在');

    await mongoose.disconnect();
    console.log('\n✅ 检查完成');
  } catch (error) {
    console.error('❌ 错误:', error);
  }
}

checkHwcTable();
