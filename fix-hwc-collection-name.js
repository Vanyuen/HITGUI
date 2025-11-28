const fs = require('fs');
const path = require('path');

console.log('🔧 开始修复热温冷集合名称BUG...\n');

// 1. 备份原文件
const serverPath = path.join(__dirname, 'src', 'server', 'server.js');
const backupPath = path.join(__dirname, 'src', 'server', `server.js.backup_hwc_fix_${Date.now()}`);

console.log('📋 步骤1: 备份原文件');
const serverContent = fs.readFileSync(serverPath, 'utf-8');
fs.writeFileSync(backupPath, serverContent, 'utf-8');
console.log(`   ✅ 已备份到: ${backupPath}`);

// 2. 修复集合名称
console.log('\n📝 步骤2: 修复集合名称映射');

// 查找并替换模型定义行
const lines = serverContent.split('\n');
let modified = false;
let fixedContent = '';

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 查找目标行 (第512行附近)
    if (line.includes("mongoose.model('HIT_DLT_RedCombinationsHotWarmColdOptimized'") &&
        line.includes("dltRedCombinationsHotWarmColdOptimizedSchema")) {

        console.log(`   找到目标行 (行号 ${i + 1}): ${line.substring(0, 80)}...`);

        // 检查是否已经指定了集合名
        if (!line.includes("'hit_dlt_redcombinationshotwarmcoldoptimizeds'")) {
            // 替换为正确的定义
            const newLine = "const DLTRedCombinationsHotWarmColdOptimized = mongoose.model('HIT_DLT_RedCombinationsHotWarmColdOptimized', dltRedCombinationsHotWarmColdOptimizedSchema, 'hit_dlt_redcombinationshotwarmcoldoptimizeds');";
            fixedContent += newLine + '\n';
            console.log('   ✅ 已修复: 添加正确的集合名参数');
            modified = true;
        } else {
            fixedContent += line + '\n';
            console.log('   ℹ️ 已经包含正确的集合名，无需修改');
        }
    } else {
        fixedContent += line + '\n';
    }
}

// 3. 写入修复后的内容
if (modified) {
    console.log('\n📤 步骤3: 保存修复后的文件');
    fs.writeFileSync(serverPath, fixedContent, 'utf-8');
    console.log('   ✅ 文件已更新');

    console.log('\n✅ 修复完成！');
    console.log('\n下一步操作：');
    console.log('1. 重启服务器: npm start');
    console.log('2. 创建测试任务验证修复效果');
    console.log('3. 检查25115-25124期是否有正常的组合数（非0）');
} else {
    console.log('\n⚠️ 未找到需要修改的代码，请手动检查 server.js 第512行附近');
    console.log('需要修改的位置:');
    console.log('const DLTRedCombinationsHotWarmColdOptimized = mongoose.model(...)');
    console.log('添加第三个参数: "hit_dlt_redcombinationshotwarmcoldoptimizeds"');
}

// 4. 输出验证命令
console.log('\n📋 验证命令:');
console.log('node verify-hwc-data-location.js');
console.log('\n测试API:');
console.log(`curl -X POST http://localhost:3003/api/dlt/hwc-positive-prediction-task/create \\
  -H "Content-Type: application/json" \\
  -d '{
    "task_name": "修复验证测试",
    "period_range": {
      "type": "custom",
      "start": "25115",
      "end": "25125",
      "total": 11
    },
    "positive_selection": {
      "red_hot_warm_cold_ratios": [{"hot": 4, "warm": 1, "cold": 0}],
      "zone_ratios": ["2:1:2"],
      "sum_ranges": [{"min": 80, "max": 120}]
    },
    "exclusion_conditions": {
      "sum": {"historical": {"enabled": true, "count": 1}},
      "span": {"historical": {"enabled": true, "count": 1}}
    },
    "output_config": {
      "pairingMode": "unlimited",
      "enableHitAnalysis": true
    }
  }'`);