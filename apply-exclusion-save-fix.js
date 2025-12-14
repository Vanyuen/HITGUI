/**
 * 应用排除详情保存修复
 * 修复问题: 推算期没有排除详情数据
 *
 * 修复内容:
 * 1. 方案1: 在saveExclusionDetailsAsync开始时立即更新状态为saving
 * 2. 方案3: 在setImmediate中添加错误恢复机制
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'src/server/server.js');

// 读取文件
let content = fs.readFileSync(serverPath, 'utf-8');

// =====================================================
// 修复1: 在saveExclusionDetailsAsync开始时立即更新状态
// =====================================================

const fix1_old = `async function saveExclusionDetailsAsync(taskId, periodsInfo, allResults, io) {
    try {
        // ⭐ 2025-12-02 重构: 双层保存策略
        const { fullDetailsPeriods, lightweightPeriods } = periodsInfo;

        log(\`📥 [\${taskId}] 开始异步保存排除详情: \${fullDetailsPeriods.size}期完整详情, \${lightweightPeriods.size}期轻量详情...\`);

        // 阶段1: 静默保存轻量详情（仅excludedIds，无进度显示）`;

const fix1_new = `async function saveExclusionDetailsAsync(taskId, periodsInfo, allResults, io) {
    try {
        // ⭐ 2025-12-02 重构: 双层保存策略
        const { fullDetailsPeriods, lightweightPeriods } = periodsInfo;

        log(\`📥 [\${taskId}] 开始异步保存排除详情: \${fullDetailsPeriods.size}期完整详情, \${lightweightPeriods.size}期轻量详情...\`);

        // ⭐ 2025-12-03 修复: 立即更新状态为saving，避免状态停留在pending
        const allPeriods = [...fullDetailsPeriods, ...lightweightPeriods];
        await HwcPositivePredictionTask.updateOne(
            { task_id: taskId },
            {
                $set: {
                    exclusion_details_status: 'saving',
                    exclusion_details_periods: allPeriods,
                    exclusion_details_progress: {
                        current: 0,
                        total: fullDetailsPeriods.size + lightweightPeriods.size,
                        percentage: 0,
                        current_period: null
                    }
                }
            }
        );
        log(\`📝 [\${taskId}] 状态已更新为saving，共\${allPeriods.length}期待保存\`);

        // 阶段1: 静默保存轻量详情（仅excludedIds，无进度显示）`;

if (content.includes(fix1_old)) {
    content = content.replace(fix1_old, fix1_new);
    console.log('✅ 修复1已应用: saveExclusionDetailsAsync开始时立即更新状态');
} else {
    console.log('⚠️ 修复1: 未找到目标代码块，可能已经修复过');
}

// =====================================================
// 修复3: 在setImmediate中添加错误恢复机制
// =====================================================

const fix3_old = `            if (totalPeriods > 0) {
                // 使用setImmediate异步执行，不阻塞当前函数返回
                setImmediate(() => {
                    saveExclusionDetailsAsync(taskId, periodsInfo, result.data, io)
                        .catch(err => {
                            log(\`❌ [\${taskId}] 异步保存排除详情出错: \${err.message}\`);
                        });
                });
                log(\`📥 [\${taskId}] 排除详情异步保存已启动 (后台进行)\`);`;

const fix3_new = `            if (totalPeriods > 0) {
                // 使用setImmediate异步执行，不阻塞当前函数返回
                // ⭐ 2025-12-03 修复: 添加错误恢复机制
                setImmediate(async () => {
                    try {
                        await saveExclusionDetailsAsync(taskId, periodsInfo, result.data, io);
                    } catch (err) {
                        log(\`❌ [\${taskId}] 异步保存排除详情出错: \${err.message}\`);
                        // ⭐ 错误恢复: 更新状态为failed
                        try {
                            await HwcPositivePredictionTask.updateOne(
                                { task_id: taskId },
                                {
                                    $set: {
                                        exclusion_details_status: 'failed',
                                        exclusion_details_errors: [{ period: 'all', error: err.message, timestamp: new Date() }]
                                    }
                                }
                            );
                            log(\`📝 [\${taskId}] 排除详情保存状态已更新为failed\`);
                        } catch (updateErr) {
                            log(\`❌ [\${taskId}] 更新失败状态时出错: \${updateErr.message}\`);
                        }
                    }
                });
                log(\`📥 [\${taskId}] 排除详情异步保存已启动 (后台进行)\`);`;

if (content.includes(fix3_old)) {
    content = content.replace(fix3_old, fix3_new);
    console.log('✅ 修复3已应用: setImmediate错误恢复机制');
} else {
    console.log('⚠️ 修复3: 未找到目标代码块，可能已经修复过');
}

// 保存文件
fs.writeFileSync(serverPath, content, 'utf-8');
console.log('\n✅ 所有修复已写入文件: ' + serverPath);
