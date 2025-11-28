/**
 * 诊断热温冷正选批量预测任务结果统计
 * 检查保留组合数为0的根本原因
 */

const mongoose = require('mongoose');

async function diagnose() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    console.log('✅ 已连接到MongoDB\n');

    const db = mongoose.connection.db;

    // 任务参数（从用户描述中提取）
    const taskParams = {
      issueRange: { start: '25115', end: '25125' },
      hwcRatio: { hot: 4, warm: 1, cold: 0 },
      zoneRatio: { zone1: 2, zone2: 1, zone3: 2 },
      oddEvenRatio: [
        { odd: 2, even: 3 },
        { odd: 3, even: 2 }
      ]
    };

    console.log('📋 任务参数:');
    console.log('  期号范围:', taskParams.issueRange);
    console.log('  热温冷比:', taskParams.hwcRatio);
    console.log('  区间比:', taskParams.zoneRatio);
    console.log('  奇偶比:', taskParams.oddEvenRatio);
    console.log('');

    // ========== 第一步: 检查期号范围数据 ==========
    console.log('🔍 第一步: 检查期号范围数据完整性');
    console.log('='.repeat(60));

    const issuesInRange = await db.collection('hit_dlts')
      .find({
        Issue: {
          $gte: taskParams.issueRange.start,
          $lte: taskParams.issueRange.end
        }
      })
      .sort({ Issue: 1 })
      .toArray();

    console.log(`✅ 期号范围内共有 ${issuesInRange.length} 期数据`);
    console.log(`   期号: ${issuesInRange.map(d => d.Issue).join(', ')}`);
    console.log('');

    // 检查缺失值数据
    const issuesWithMissing = issuesInRange.filter(d =>
      d.Red_Missing && d.Red_Missing.length === 35
    );
    console.log(`✅ 有缺失值数据的期数: ${issuesWithMissing.length}/${issuesInRange.length}`);

    if (issuesWithMissing.length < issuesInRange.length) {
      const missingIssues = issuesInRange
        .filter(d => !d.Red_Missing || d.Red_Missing.length !== 35)
        .map(d => d.Issue);
      console.log(`⚠️  缺少缺失值数据的期号: ${missingIssues.join(', ')}`);
    }
    console.log('');

    // ========== 第二步: 测试热温冷比4:1:0条件 ==========
    console.log('🔍 第二步: 测试热温冷比4:1:0的筛选条件');
    console.log('='.repeat(60));

    // 随机抽取100个组合进行测试
    const sampleCombos = await db.collection('hit_dlts')
      .aggregate([
        { $sample: { size: 100 } }
      ])
      .toArray();

    console.log(`📦 随机抽取 ${sampleCombos.length} 个组合进行测试\n`);

    // 对每个组合检查热温冷分类
    let passCount = 0;
    let failReasons = {
      noMissingData: 0,
      wrongHotCount: 0,
      wrongWarmCount: 0,
      wrongColdCount: 0
    };

    for (const combo of sampleCombos) {
      const balls = [combo.R1, combo.R2, combo.R3, combo.R4, combo.R5];

      // 使用最新期号（25125或25124）的缺失值数据
      const latestIssue = issuesWithMissing[issuesWithMissing.length - 1];

      if (!latestIssue || !latestIssue.Red_Missing) {
        failReasons.noMissingData++;
        continue;
      }

      // 计算热温冷
      let hotCount = 0, warmCount = 0, coldCount = 0;

      for (const ball of balls) {
        const missing = latestIssue.Red_Missing[ball - 1];
        if (missing <= 4) {
          hotCount++;
        } else if (missing >= 5 && missing <= 9) {
          warmCount++;
        } else {
          coldCount++;
        }
      }

      // 检查是否符合4:1:0
      const matches = (
        hotCount === taskParams.hwcRatio.hot &&
        warmCount === taskParams.hwcRatio.warm &&
        coldCount === taskParams.hwcRatio.cold
      );

      if (matches) {
        passCount++;
      } else {
        if (hotCount !== taskParams.hwcRatio.hot) failReasons.wrongHotCount++;
        if (warmCount !== taskParams.hwcRatio.warm) failReasons.wrongWarmCount++;
        if (coldCount !== taskParams.hwcRatio.cold) failReasons.wrongColdCount++;
      }
    }

    console.log(`✅ 符合热温冷比4:1:0的组合: ${passCount}/${sampleCombos.length} (${(passCount/sampleCombos.length*100).toFixed(2)}%)`);
    console.log(`❌ 不符合的原因统计:`);
    console.log(`   - 无缺失值数据: ${failReasons.noMissingData}`);
    console.log(`   - 热数不符: ${failReasons.wrongHotCount}`);
    console.log(`   - 温数不符: ${failReasons.wrongWarmCount}`);
    console.log(`   - 冷数不符: ${failReasons.wrongColdCount}`);
    console.log('');

    // ========== 第三步: 检查优化表数据 ==========
    console.log('🔍 第三步: 检查热温冷优化表数据');
    console.log('='.repeat(60));

    // 查找相关的优化表记录
    const optimizedRecords = await db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized')
      .find({
        base_issue: { $in: issuesInRange.map(d => d.Issue) }
      })
      .limit(10)
      .toArray();

    console.log(`✅ 优化表中找到 ${optimizedRecords.length} 条相关记录`);

    if (optimizedRecords.length > 0) {
      const sample = optimizedRecords[0];
      console.log(`   示例记录:`);
      console.log(`   - base_issue: ${sample.base_issue}`);
      console.log(`   - target_issue: ${sample.target_issue}`);
      console.log(`   - combination_id: ${sample.combination_id}`);
      console.log(`   - hwc_ratio: ${sample.hwc_ratio}`);
    } else {
      console.log(`⚠️  优化表中没有该期号范围的数据！`);
      console.log(`   这可能是导致0组合输出的原因之一`);
    }
    console.log('');

    // ========== 第四步: 直接统计符合条件的组合数 ==========
    console.log('🔍 第四步: 统计符合所有条件的组合数');
    console.log('='.repeat(60));

    // 构建查询条件（不包含热温冷）
    const baseQuery = {
      $or: [
        {
          Zone1_Count: 2,
          Zone2_Count: 1,
          Zone3_Count: 2,
          $or: [
            { Odd_Count: 2, Even_Count: 3 },
            { Odd_Count: 3, Even_Count: 2 }
          ]
        }
      ]
    };

    const baseMatchCount = await db.collection('hit_dlts')
      .countDocuments(baseQuery);

    console.log(`✅ 符合区间比和奇偶比的组合: ${baseMatchCount}`);
    console.log('');

    // 计算理论上符合热温冷4:1:0的组合数
    console.log('📊 理论计算: 符合热温冷4:1:0的组合概率');
    console.log('   假设最新期号缺失值数据完整...');

    const latestIssue = issuesWithMissing[issuesWithMissing.length - 1];
    if (latestIssue && latestIssue.Red_Missing) {
      // 统计热温冷球的数量
      let hotBalls = 0, warmBalls = 0, coldBalls = 0;

      for (let i = 0; i < 35; i++) {
        const missing = latestIssue.Red_Missing[i];
        if (missing <= 4) hotBalls++;
        else if (missing >= 5 && missing <= 9) warmBalls++;
        else coldBalls++;
      }

      console.log(`   - 热球(缺失≤4): ${hotBalls}个`);
      console.log(`   - 温球(缺失5-9): ${warmBalls}个`);
      console.log(`   - 冷球(缺失≥10): ${coldBalls}个`);

      // 计算C(hot,4) * C(warm,1) * C(cold,0)
      const comb = (n, k) => {
        if (k > n) return 0;
        if (k === 0 || k === n) return 1;
        let result = 1;
        for (let i = 0; i < k; i++) {
          result *= (n - i);
          result /= (i + 1);
        }
        return Math.round(result);
      };

      const theoreticalCount = comb(hotBalls, 4) * comb(warmBalls, 1) * comb(coldBalls, 0);
      console.log(`   - 理论符合热温冷4:1:0的组合数: ${theoreticalCount}`);
      console.log(`   - 结合区间比和奇偶比后的预期: ${Math.round(theoreticalCount * baseMatchCount / 324632)}`);
    }
    console.log('');

    // ========== 第五步: 检查实际任务处理逻辑 ==========
    console.log('🔍 第五步: 检查任务执行记录');
    console.log('='.repeat(60));

    const recentTasks = await db.collection('PredictionTask')
      .find({
        task_name: /热温冷正选/
      })
      .sort({ created_at: -1 })
      .limit(5)
      .toArray();

    console.log(`✅ 找到 ${recentTasks.length} 个相关任务\n`);

    for (const task of recentTasks) {
      console.log(`📝 任务: ${task.task_name}`);
      console.log(`   - 状态: ${task.status}`);
      console.log(`   - 创建时间: ${task.created_at}`);
      console.log(`   - 完成时间: ${task.completed_at || 'N/A'}`);
      console.log(`   - 期号范围: ${task.base_issue} - ${task.target_issue}`);

      if (task.results) {
        console.log(`   - 结果统计:`);
        console.log(`     * retained: ${task.results.retained || 0}`);
        console.log(`     * excluded: ${task.results.excluded || 0}`);
        console.log(`     * 排除原因: ${JSON.stringify(task.results.exclusion_summary || {})}`);
      }
      console.log('');
    }

    // ========== 总结和建议 ==========
    console.log('📊 诊断总结');
    console.log('='.repeat(60));

    const issues = [];

    if (issuesWithMissing.length < issuesInRange.length) {
      issues.push('⚠️  期号范围内存在缺失值数据不完整的问题');
    }

    if (optimizedRecords.length === 0) {
      issues.push('⚠️  优化表中没有该期号范围的数据');
    }

    if (passCount === 0) {
      issues.push('❌ 热温冷比4:1:0条件过于严格，随机100个组合中0个符合');
    } else if (passCount < 5) {
      issues.push('⚠️  热温冷比4:1:0条件较为严格，符合率低于5%');
    }

    if (issues.length > 0) {
      console.log('发现以下问题:');
      issues.forEach(issue => console.log(issue));
    } else {
      console.log('✅ 未发现明显的数据或配置问题');
      console.log('   问题可能出在任务处理逻辑中');
    }
    console.log('');

    console.log('💡 建议:');
    if (passCount < 5) {
      console.log('1. 热温冷比4:1:0过于严格，建议放宽条件:');
      console.log('   - 尝试3:2:0或4:0:1等其他比例');
      console.log('   - 或使用范围条件：热≥3, 温≥1, 冷≤1');
    }
    if (optimizedRecords.length === 0) {
      console.log('2. 优化表数据缺失，需要重新生成:');
      console.log('   运行: node update-hwc-optimized.js');
    }
    console.log('3. 检查server.js中热温冷正选的筛选逻辑');
    console.log('4. 查看任务执行日志，确认排除原因');

  } catch (error) {
    console.error('❌ 诊断失败:', error);
  } finally {
    await client.close();
    console.log('\n✅ 诊断完成，数据库连接已关闭');
  }
}

diagnose();
