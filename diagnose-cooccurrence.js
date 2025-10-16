// 诊断同出排除问题
const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/lottery');

mongoose.connection.once('open', async () => {
  try {
    console.log('✅ 已连接到数据库\n');

    // 1. 检查 hit_dlt_combofeatures 表数据
    const comboFeaturesCol = mongoose.connection.db.collection('hit_dlt_combofeatures');
    const comboCount = await comboFeaturesCol.countDocuments();
    console.log(`📊 hit_dlt_combofeatures 表记录数: ${comboCount}`);

    if (comboCount > 0) {
      const sample = await comboFeaturesCol.findOne({}, { sort: { ID: -1 } });
      console.log(`   最新一条: Issue=${sample.Issue}, ID=${sample.ID}`);
      console.log(`   combo_2示例: [${(sample.combo_2 || []).slice(0, 3).join(', ')}...]`);
    }

    // 2. 检查最近的预测任务
    const tasksCol = mongoose.connection.db.collection('hit_dlt_predictiontasks');
    const latestTask = await tasksCol.findOne(
      { 'exclude_conditions.coOccurrencePerBall.enabled': true },
      { sort: { created_at: -1 } }
    );

    if (latestTask) {
      console.log(`\n📋 最近一个启用"同出排除(按红球)"的任务:`);
      console.log(`   任务ID: ${latestTask._id}`);
      console.log(`   目标期号: ${latestTask.target_issue}`);
      console.log(`   创建时间: ${latestTask.created_at}`);
      console.log(`   同出配置:`, JSON.stringify(latestTask.exclude_conditions.coOccurrencePerBall, null, 2));

      // 3. 检查任务结果
      const resultsCol = mongoose.connection.db.collection('hit_dlt_predictiontaskresults');
      const result = await resultsCol.findOne({ task_id: latestTask._id });

      if (result) {
        console.log(`\n📊 任务结果:`);
        console.log(`   红球组合数: ${result.red_count || 0}`);

        if (result.cooccurrence_perball_data) {
          const data = result.cooccurrence_perball_data;
          console.log(`\n🔗 同出排除(按红球)数据:`);
          console.log(`   启用状态: ${data.enabled}`);
          console.log(`   分析期数: ${data.periods}`);
          console.log(`   排除前组合数: ${data.combinations_before || 0}`);
          console.log(`   排除后组合数: ${data.combinations_after || 0}`);
          console.log(`   实际排除数: ${data.excluded_count || 0}`);
          console.log(`   2码特征数: ${data.exclude_features_2 || 0}`);
          console.log(`   3码特征数: ${data.exclude_features_3 || 0}`);
          console.log(`   4码特征数: ${data.exclude_features_4 || 0}`);
          console.log(`   示例特征数: ${(data.sample_features || []).length}`);
          console.log(`   示例特征: [${(data.sample_features || []).slice(0, 5).join(', ')}...]`);
        } else {
          console.log(`\n⚠️ 任务结果中没有 cooccurrence_perball_data`);
        }
      } else {
        console.log(`\n⚠️ 未找到任务结果`);
      }
    } else {
      console.log(`\n⚠️ 未找到启用"同出排除(按红球)"的任务`);
    }

    // 4. 测试API调用
    console.log(`\n🧪 测试同出API...`);
    const testIssue = '25083';
    const testPeriods = 1;

    const response = await fetch(`http://localhost:3003/api/dlt/cooccurrence-per-ball?targetIssue=${testIssue}&periods=${testPeriods}`);
    const apiResult = await response.json();

    if (apiResult.success) {
      const details = apiResult.data.analyzedDetails || {};
      const detailsArray = Object.values(details);
      console.log(`   ✅ API调用成功`);
      console.log(`   分析的红球数: ${detailsArray.length}`);

      if (detailsArray.length > 0) {
        const first = detailsArray[0];
        console.log(`   示例: 红球${first.ball}, 最近出现期号=${first.lastAppearedIssue || 'N/A'}`);

        // 提取涉及的期号
        const issues = new Set();
        detailsArray.forEach(d => {
          if (d.lastAppearedIssue) issues.add(d.lastAppearedIssue);
        });
        console.log(`   涉及的期号: [${Array.from(issues).join(', ')}]`);

        // 查询这些期号的组合特征
        const issuesArray = Array.from(issues);
        const featuresInDb = await comboFeaturesCol.find({ Issue: { $in: issuesArray } }).toArray();
        console.log(`   数据库中这些期号的特征记录数: ${featuresInDb.length}`);

        if (featuresInDb.length === 0) {
          console.log(`   ❌ 问题找到了！数据库中没有这些期号的组合特征数据`);
          console.log(`   需要的期号: [${issuesArray.join(', ')}]`);

          // 检查数据库中有哪些期号
          const allIssues = await comboFeaturesCol.distinct('Issue');
          console.log(`   数据库中的期号范围: ${allIssues[0]} ~ ${allIssues[allIssues.length - 1]} (共${allIssues.length}个)`);
        }
      }
    } else {
      console.log(`   ❌ API调用失败:`, apiResult.message);
    }

    // 5. 检查最近的所有同出排除结果
    console.log(`\n📊 检查最近的同出排除结果...`);
    const resultsCol = mongoose.connection.db.collection('hit_dlt_predictiontaskresults');
    const recentResults = await resultsCol.find({
      'cooccurrence_perball_data': { $exists: true }
    }).sort({ created_at: -1 }).limit(5).toArray();

    console.log(`   找到 ${recentResults.length} 个包含同出数据的结果`);

    recentResults.forEach((r, i) => {
      const d = r.cooccurrence_perball_data;
      console.log(`\n   结果 ${i + 1}:`);
      console.log(`     任务ID: ${r.task_id}`);
      console.log(`     红球数: ${r.red_count}`);
      console.log(`     启用: ${d.enabled}`);
      console.log(`     排除前: ${d.combinations_before || 0}`);
      console.log(`     排除后: ${d.combinations_after || 0}`);
      console.log(`     实际排除: ${d.excluded_count || 0}`);
      console.log(`     2码: ${d.exclude_features_2 || 0}, 3码: ${d.exclude_features_3 || 0}, 4码: ${d.exclude_features_4 || 0}`);
      console.log(`     示例特征数: ${(d.sample_features || []).length}`);
      console.log(`     配置: combo2=${d.combo2}, combo3=${d.combo3}, combo4=${d.combo4}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error);
    process.exit(1);
  }
});
