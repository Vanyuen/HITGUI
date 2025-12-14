/**
 * V4优化脚本 - 方案A-5和方案B
 */
const fs = require('fs');
const path = 'E:/HITGUI/src/server/server.js';

let content = fs.readFileSync(path, 'utf8');

// ========== 方案A-5: 修改进度更新频率 ==========
const oldProgressUpdate = `                // 更新进度
                const percentage = Math.round((savedCount / periodsToSave.size) * 100);
                await HwcPositivePredictionTask.updateOne(
                    { task_id: taskId },
                    {
                        $set: {
                            'exclusion_details_progress.current': savedCount,
                            'exclusion_details_progress.percentage': percentage,
                            'exclusion_details_progress.current_period': period
                        }
                    }
                );

                // 推送进度
                io.emit('hwc-exclusion-details-progress', {
                    task_id: taskId,
                    current: savedCount,
                    total: periodsToSave.size,
                    percentage: percentage,
                    current_period: period,
                    message: \`正在保存期号 \${period} 的排除详情 (\${savedCount}/\${periodsToSave.size})\`
                });`;

const newProgressUpdate = `                // ⭐ V4优化: 每3期或最后一期才更新进度（减少数据库IO）
                const percentage = Math.round((savedCount / periodsToSave.size) * 100);
                if (savedCount % 3 === 0 || savedCount === periodsToSave.size) {
                    await HwcPositivePredictionTask.updateOne(
                        { task_id: taskId },
                        {
                            $set: {
                                'exclusion_details_progress.current': savedCount,
                                'exclusion_details_progress.percentage': percentage,
                                'exclusion_details_progress.current_period': period
                            }
                        }
                    );

                    // 推送进度
                    io.emit('hwc-exclusion-details-progress', {
                        task_id: taskId,
                        current: savedCount,
                        total: periodsToSave.size,
                        percentage: percentage,
                        current_period: period,
                        message: \`正在保存期号 \${period} 的排除详情 (\${savedCount}/\${periodsToSave.size})\`
                    });
                }`;

if (content.includes(oldProgressUpdate)) {
    content = content.replace(oldProgressUpdate, newProgressUpdate);
    console.log('✅ 方案A-5: 进度更新频率优化完成');
} else {
    console.log('⚠️ 方案A-5: 未找到匹配的代码块，可能已修改或格式不同');
}

// ========== 方案B: 轻量详情并行保存 ==========
// 查找轻量详情保存的代码块
const oldLightweightSave = `        // 分批处理轻量详情
        for (let batchStart = 0; batchStart < lightweightArray.length; batchStart += LIGHTWEIGHT_BATCH_SIZE) {
            const batchEnd = Math.min(batchStart + LIGHTWEIGHT_BATCH_SIZE, lightweightArray.length);
            const batch = lightweightArray.slice(batchStart, batchEnd);
            const batchNum = Math.floor(batchStart / LIGHTWEIGHT_BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(lightweightArray.length / LIGHTWEIGHT_BATCH_SIZE);

            log(\`    [\${taskId}] 轻量详情保存批次 \${batchNum}/\${totalBatches}\`);

            for (const period of batch) {
                const result = allResults.find(r => String(r.target_issue) === period);
                if (!result || !result.exclusions_to_save?.length) continue;

                let retryCount = 0;
                let success = false;

                while (!success && retryCount < MAX_RETRIES) {
                    try {
                        const resultId = \`\${taskId}-\${period}\`;
                        // 轻量保存：仅excludedIds，清空detailsMap
                        const lightweightExclusions = result.exclusions_to_save.map(e => ({
                            ...e,
                            detailsMap: null  // 不保存detailsMap，后续按需生成
                        }));
                        await saveExclusionDetailsBatch(taskId, resultId, period, lightweightExclusions);
                        await HwcPositivePredictionTaskResult.updateOne(
                            { result_id: resultId },
                            { $set: { has_exclusion_details: true, lightweight_only: true } }
                        );
                        lightweightSaved++;
                        success = true;
                    } catch (error) {
                        retryCount++;
                        if (retryCount < MAX_RETRIES) {
                            log(\`    [\${taskId}] 期号\${period}保存失败，第\${retryCount}次重试...\`);
                            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
                        } else {
                            log(\`    [\${taskId}] 期号\${period}轻量详情保存失败: \${error.message}\`);
                            lightweightFailed++;
                        }
                    }
                }
            }

            // 批次间延迟，避免连接池压力
            if (batchEnd < lightweightArray.length) {
                await new Promise(resolve => setTimeout(resolve, 100));  // ⭐ V4优化: 100ms延迟(原500ms)
            }
        }`;

const newLightweightSave = `        // ⭐ V4优化: 并行保存轻量详情（使用p-limit控制并发）
        const lightweightLimit = pLimit(5);  // 最大5并发
        log(\`    [\${taskId}] 开始并行保存轻量详情: \${lightweightArray.length}期 (最大5并发)\`);

        const lightweightPromises = lightweightArray.map(period => {
            return lightweightLimit(async () => {
                const result = allResults.find(r => String(r.target_issue) === period);
                if (!result || !result.exclusions_to_save?.length) return { success: true, skipped: true };

                let retryCount = 0;
                while (retryCount < MAX_RETRIES) {
                    try {
                        const resultId = \`\${taskId}-\${period}\`;
                        // 轻量保存：仅excludedIds，清空detailsMap
                        const lightweightExclusions = result.exclusions_to_save.map(e => ({
                            ...e,
                            detailsMap: null  // 不保存detailsMap，后续按需生成
                        }));
                        await saveExclusionDetailsBatch(taskId, resultId, period, lightweightExclusions);
                        await HwcPositivePredictionTaskResult.updateOne(
                            { result_id: resultId },
                            { $set: { has_exclusion_details: true, lightweight_only: true } }
                        );
                        return { success: true, period };
                    } catch (error) {
                        retryCount++;
                        if (retryCount < MAX_RETRIES) {
                            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * retryCount));
                        } else {
                            log(\`    [\${taskId}] 期号\${period}轻量详情保存失败: \${error.message}\`);
                            return { success: false, period, error: error.message };
                        }
                    }
                }
            });
        });

        const lightweightResults = await Promise.all(lightweightPromises);
        lightweightSaved = lightweightResults.filter(r => r.success && !r.skipped).length;
        lightweightFailed = lightweightResults.filter(r => !r.success).length;`;

if (content.includes(oldLightweightSave)) {
    content = content.replace(oldLightweightSave, newLightweightSave);
    console.log('✅ 方案B: 轻量详情并行保存优化完成');
} else {
    console.log('⚠️ 方案B: 未找到匹配的代码块，可能已修改或格式不同');
}

// 写回文件
fs.writeFileSync(path, content);
console.log('\n✅ V4优化脚本执行完成');
