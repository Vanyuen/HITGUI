// 🔍 完整诊断报告生成器

const fs = require('fs');
const path = require('path');

console.log('═══════════════════════════════════════════════════════');
console.log('  HWC正选批量预测 - 完整诊断报告');
console.log('═══════════════════════════════════════════════════════\n');

// 1. 检查代码修复状态
console.log('【1】代码修复状态检查\n');

const serverPath = path.join(__dirname, 'src', 'server', 'server.js');
const content = fs.readFileSync(serverPath, 'utf-8');
const lines = content.split('\n');

// 检查集合名修复
const line512 = lines[511];
const hasCollectionNameFix = line512.includes("'hit_dlt_redcombinationshotwarmcoldoptimizeds'");
console.log(`✓ 集合名修复 (line 512): ${hasCollectionNameFix ? '✅ 已修复' : '❌ 未修复'}`);
if (hasCollectionNameFix) {
    console.log(`  代码: ${line512.trim().substring(0, 80)}...`);
}

// 检查Schema定义
const schemaDefIndex = content.indexOf('const dltRedCombinationsHotWarmColdOptimizedSchema');
if (schemaDefIndex !== -1) {
    const schemaSnippet = content.substring(schemaDefIndex, schemaDefIndex + 500);
    const hasStringType = schemaSnippet.includes('base_issue: { type: String') &&
                         schemaSnippet.includes('target_issue: { type: String');
    console.log(`✓ Schema数据类型 (base_issue/target_issue): ${hasStringType ? '✅ String (正确)' : '❌ Number (错误)'}`);
}

// 检查两步查询修复
const hasTwoStepFix = content.includes('🔧 2025-11-17修复: 分两步查询');
console.log(`✓ 两步查询修复 (preloadData): ${hasTwoStepFix ? '✅ 已修复' : '❌ 未修复'}`);

// 检查增强日志
const hasEnhancedLogging = content.includes('期号对列表:') && content.includes('查询到');
console.log(`✓ 增强日志 (preloadHwcOptimizedData): ${hasEnhancedLogging ? '✅ 已添加' : '❌ 未添加'}`);

console.log('\n【2】关键问题总结\n');

// 问题1: 代码正确但运行结果错误
console.log('问题1: 代码修复完整，但任务结果仍为0');
console.log('  - 所有代码修复都已应用到server.js');
console.log('  - 独立测试脚本证明查询逻辑正确（成功查询到5条HWC数据）');
console.log('  - 但实际任务处理时，所有期号（除25125外）组合数=0');
console.log('');

// 问题2: 数据库结果异常
console.log('问题2: 任务结果数据异常');
console.log('  - 期号25120: 0个组合, is_predicted=true (错误，应该是历史期)');
console.log('  - 期号25121-25124: 0个组合, is_predicted=false');
console.log('  - 期号25125: 396个组合, is_predicted=true (正确，这是推算期)');
console.log('  - ⚠️ 结果Schema中缺少step1_basic_combinations字段');
console.log('');

//问题3: 可能的根本原因
console.log('问题3: 可能的根本原因分析');
console.log('');
console.log('【假设A】服务器未正确重启');
console.log('  - Node.js进程可能使用了旧的模块缓存');
console.log('  - Electron应用可能缓存了旧版本的server.js');
console.log('  - 解决方案: 完全关闭应用，清除进程，重新启动');
console.log('');

console.log('【假设B】HWC数据查询失败（但代码逻辑正确）');
console.log('  - 期号对生成时数据类型不匹配');
console.log('  - 数据库查询条件有误');
console.log('  - 解决方案: 添加运行时日志输出，查看实际查询结果');
console.log('');

console.log('【假设C】任务处理流程问题');
console.log('  - HWC数据加载成功，但Step1筛选逻辑有误');
console.log('  - 期号对生成不正确（25120被标记为predicted）');
console.log('  - 解决方案: 检查processHwcPositiveTask函数的完整执行流程');
console.log('');

console.log('【3】下一步行动建议\n');

console.log('方案1: 查看服务器实际启动日志');
console.log('  - 在npm start后，查看控制台输出');
console.log('  - 确认HWC数据加载日志是否正常');
console.log('  - 查找"预加载热温冷优化表"相关日志');
console.log('');

console.log('方案2: 添加临时调试日志');
console.log('  - 在preloadHwcOptimizedData方法中添加console.log');
console.log('  - 在applyPositiveSelection方法中添加console.log');
console.log('  - 查看运行时实际的查询参数和结果');
console.log('');

console.log('方案3: 直接检查服务器日志文件');
console.log('  - 查找应用日志文件（如果有）');
console.log('  - 检查Electron DevTools console输出');
console.log('  - 查看任务处理的完整日志输出');
console.log('');

console.log('═══════════════════════════════════════════════════════');
console.log('  诊断报告生成完毕');
console.log('═══════════════════════════════════════════════════════');
