/**
 * 诊断动态计算fallback失败的原因
 */
require('dotenv').config();
const mongoose = require('mongoose');

async function diagnose() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/lottery');
    console.log('✅ 数据库连接成功\n');

    const DLTRedMissing = mongoose.connection.collection('hit_dlt_basictrendchart_redballmissing_histories');
    const DLTRedCombinations = mongoose.connection.collection('hit_dlt_redcombinations');

    // 1. 检查遗漏值表
    console.log('===== 遗漏值表检查 =====');
    const missingCount = await DLTRedMissing.countDocuments();
    console.log('总记录数:', missingCount);

    // 检查25114的遗漏值数据（用于预测25115）
    const missing25114 = await DLTRedMissing.findOne({ Issue: '25114' });
    const missing25114Int = await DLTRedMissing.findOne({ Issue: 25114 });
    console.log('\nIssue=25114 (字符串):', missing25114 ? '存在' : '不存在');
    console.log('Issue=25114 (整数):', missing25114Int ? '存在' : '不存在');

    // 检查Issue字段的类型
    const sampleMissing = await DLTRedMissing.findOne({});
    console.log('\n遗漏值表Issue字段类型:', typeof sampleMissing?.Issue);
    console.log('示例Issue值:', sampleMissing?.Issue);

    // 检查最新几条遗漏值记录
    console.log('\n最新5条遗漏值记录（按ID降序）:');
    const latestMissing = await DLTRedMissing.find({}).sort({ ID: -1 }).limit(5).toArray();
    latestMissing.forEach(r => {
      console.log(`  ID=${r.ID}, Issue=${r.Issue} (type: ${typeof r.Issue})`);
    });

    // 2. 检查红球组合表
    console.log('\n===== 红球组合表检查 =====');
    const combosCount = await DLTRedCombinations.countDocuments();
    console.log('总记录数:', combosCount);

    if (combosCount === 0) {
      console.log('❌ 红球组合表为空！这是导致combination_count=0的直接原因！');
    } else {
      const sampleCombo = await DLTRedCombinations.findOne({});
      console.log('示例组合:', JSON.stringify(sampleCombo, null, 2));
    }

    // 3. 模拟动态计算过程
    console.log('\n===== 模拟动态计算 =====');

    // 获取base_issue=25114的遗漏值
    const baseIssue = '25114';
    let missingData = await DLTRedMissing.findOne({ Issue: baseIssue });
    if (!missingData) {
      missingData = await DLTRedMissing.findOne({ Issue: parseInt(baseIssue) });
    }

    if (!missingData) {
      console.log(`❌ 找不到期号${baseIssue}的遗漏值数据`);
      console.log('尝试查找最新的遗漏值记录...');
      const latest = await DLTRedMissing.findOne({}, { sort: { ID: -1 } });
      console.log('最新记录:', latest?.Issue);
    } else {
      console.log(`✅ 找到期号${baseIssue}的遗漏值数据`);

      // 检查遗漏值字段
      console.log('\n遗漏值字段检查（部分）:');
      for (let ball = 1; ball <= 5; ball++) {
        console.log(`  红球${ball}遗漏值:`, missingData[String(ball)] || missingData[ball] || 'N/A');
      }

      // 模拟计算热温冷比
      if (combosCount > 0) {
        const sampleCombos = await DLTRedCombinations.find({}).limit(5).toArray();
        console.log('\n示例组合热温冷计算:');

        for (const combo of sampleCombos) {
          const balls = [combo.red_ball_1, combo.red_ball_2, combo.red_ball_3, combo.red_ball_4, combo.red_ball_5];
          let hot = 0, warm = 0, cold = 0;

          for (const ball of balls) {
            const missing = missingData[String(ball)] || missingData[ball] || 0;
            if (missing <= 4) hot++;
            else if (missing <= 9) warm++;
            else cold++;
          }

          console.log(`  组合ID ${combo.combination_id}: [${balls.join(',')}] → ${hot}:${warm}:${cold}`);
        }
      }
    }

    await mongoose.disconnect();
    console.log('\n✅ 诊断完成');
  } catch (error) {
    console.error('❌ 错误:', error);
  }
}

diagnose();
