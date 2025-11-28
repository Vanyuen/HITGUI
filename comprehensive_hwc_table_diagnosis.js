const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function comprehensiveHwcTableDiagnosis() {
  const diagnosticReport = {
    timestamp: new Date().toISOString(),
    issues: [],
    details: {}
  };

  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const hitDltsCollection = mongoose.connection.db.collection('hit_dlts');
    const hwcCollection = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    // 1. 数据库记录基本信息
    const hitDltsCount = await hitDltsCollection.countDocuments();
    const hwcCount = await hwcCollection.countDocuments();

    diagnosticReport.details.hitDltsCount = hitDltsCount;
    diagnosticReport.details.hwcCount = hwcCount;
    diagnosticReport.details.expectedPairs = hitDltsCount - 1;

    // 2. 期号范围检查
    const hitDltsIssues = await hitDltsCollection
      .find({}, { projection: { Issue: 1, _id: 0 } })
      .sort({ Issue: 1 })
      .toArray();

    const issueRange = {
      min: hitDltsIssues[0].Issue,
      max: hitDltsIssues[hitDltsIssues.length - 1].Issue
    };

    diagnosticReport.details.issueRange = issueRange;

    // 3. 热温冷比优化表记录详细分析
    const hwcRecords = await hwcCollection
      .find({})
      .sort({ base_issue: 1 })
      .toArray();

    const baseIssues = new Set(hwcRecords.map(r => r.base_issue));
    const targetIssues = new Set(hwcRecords.map(r => r.target_issue));

    diagnosticReport.details.uniqueBaseIssues = baseIssues.size;
    diagnosticReport.details.uniqueTargetIssues = targetIssues.size;

    // 4. 异常检测
    if (hwcCount !== hitDltsCount - 1) {
      diagnosticReport.issues.push({
        type: 'COUNT_MISMATCH',
        description: `热温冷比优化表记录数(${hwcCount})与预期(${hitDltsCount - 1})不符`,
        severity: 'high'
      });
    }

    // 5. 记录生成时间检查
    const creationTimes = hwcRecords.map(r => r.created_at).filter(Boolean);
    if (creationTimes.length > 0) {
      diagnosticReport.details.recordGenerationTimespan = {
        earliest: new Date(Math.min(...creationTimes)),
        latest: new Date(Math.max(...creationTimes))
      };
    }

    // 6. 记录内容完整性检查
    const incompleteRecords = hwcRecords.filter(record =>
      !record.base_issue ||
      !record.target_issue ||
      record.base_issue === record.target_issue
    );

    if (incompleteRecords.length > 0) {
      diagnosticReport.issues.push({
        type: 'INCOMPLETE_RECORDS',
        description: `发现 ${incompleteRecords.length} 条不完整记录`,
        details: incompleteRecords.slice(0, 5)  // 仅记录前5条
      });
    }

    // 保存诊断报告
    const reportPath = path.join(process.cwd(), 'hwc_table_diagnostic_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(diagnosticReport, null, 2));

    console.log('🔍 诊断报告已生成:', reportPath);
    console.log('\n诊断摘要:');
    console.log(`📊 hit_dlts 记录数: ${hitDltsCount}`);
    console.log(`📊 热温冷比优化表记录数: ${hwcCount}`);
    console.log(`📅 期号范围: ${issueRange.min} - ${issueRange.max}`);

    if (diagnosticReport.issues.length > 0) {
      console.log('\n🚨 发现潜在问题:');
      diagnosticReport.issues.forEach(issue => {
        console.log(`- ${issue.type}: ${issue.description}`);
      });
    }

  } catch (error) {
    console.error('❌ 诊断过程出错:', error);
  } finally {
    await mongoose.connection.close();
  }
}

comprehensiveHwcTableDiagnosis();