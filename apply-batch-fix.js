/**
 * 修复脚本：修复HWC正选批量预测的批次边界处理Bug
 * Bug描述：每个批次的第一期(i===0)都使用firstIssuePreviousRecord
 *          导致批次2/3的第一期使用了整个任务第一期的上一期，造成缓存key不匹配
 * 修复方案：统一使用ID-1规则确定baseIssue
 */
const fs = require('fs');

const serverPath = 'E:/HITGUI/src/server/server.js';

// 读取文件
let content = fs.readFileSync(serverPath, 'utf8');

// 要替换的旧代码
const oldCode = `            // 🔧 修复：基于缓存的上一期确定正确的baseIssue
            let baseIssue, baseID;

            if (i === 0) {
                // 第一个期号：使用预加载时缓存的上一期（ID-1）
                if (this.firstIssuePreviousRecord) {
                    baseIssue = this.firstIssuePreviousRecord.issue;
                    baseID = this.firstIssuePreviousRecord.id;
                    log(\`  📌 [\${this.sessionId}] 期号\${targetIssue}使用上一期\${baseIssue} (ID \${baseID}→\${targetID})\`);
                } else {
                    // 如果没有上一期，跳过该期
                    log(\`  ⚠️ [\${this.sessionId}] 期号\${targetIssue}没有上一期，跳过\`);

                    // 添加错误记录
                    batchResults.push({
                        target_issue: targetIssue,
                        base_issue: null,
                        is_predicted: true,
                        red_combinations: [],
                        blue_combinations: [],
                        pairing_mode: combinationMode || 'truly-unlimited',
                        error: '没有上一期数据',
                        winning_numbers: null,
                        hit_analysis: {},
                        exclusion_summary: {},
                        positive_selection_details: {},
                        exclusions_to_save: [],
                        red_count: 0,
                        blue_count: 0
                    });

                    continue;
                }
            } else {
                // 🐛 BUG修复 2025-11-27: 使用ID-1规则（与preloadData一致）
                // 此前使用数组索引 issueToIDArray[i-1]，导致缓存key不匹配
                // 正确做法：根据当前期号的ID-1找到上一期记录
                const baseRecord = this.idToRecordMap?.get(targetID - 1);

                if (baseRecord) {
                    baseIssue = baseRecord.Issue.toString();
                    baseID = baseRecord.ID;
                    log(\`  📌 [\${this.sessionId}] 期号\${targetIssue}使用ID-1规则找到上一期\${baseIssue} (ID \${baseID}→\${targetID})\`);
                } else {
                    // Fallback: 使用数组索引（兼容性，但可能不准确）
                    baseIssue = issueToIDArray[i - 1].issue;
                    baseID = issueToIDArray[i - 1].id;
                    log(\`  ⚠️ [\${this.sessionId}] 期号\${targetIssue}的ID-1记录不存在，使用数组fallback: \${baseIssue}\`);
                }
            }`;

// 新代码
const newCode = `            // 🐛 BUG修复 2025-12-11: 统一使用ID-1规则确定baseIssue
            // 修复问题：此前对每批第一期(i===0)使用firstIssuePreviousRecord
            // 导致批次2/3的第一期使用了整个任务第一期的上一期，造成缓存key不匹配
            let baseIssue, baseID;

            if (targetID !== null) {
                // 情况1：当前期号在数据库中存在，使用ID-1规则
                const baseRecord = this.idToRecordMap?.get(targetID - 1);

                if (baseRecord) {
                    baseIssue = baseRecord.Issue.toString();
                    baseID = baseRecord.ID;
                    log(\`  📌 [\${this.sessionId}] 期号\${targetIssue}使用ID-1规则找到上一期\${baseIssue} (ID \${baseID}→\${targetID})\`);
                } else if (i > 0) {
                    // ID-1记录不存在且不是第一个，使用数组fallback
                    baseIssue = issueToIDArray[i - 1].issue;
                    baseID = issueToIDArray[i - 1].id;
                    log(\`  ⚠️ [\${this.sessionId}] 期号\${targetIssue}的ID-1记录不存在，使用数组fallback: \${baseIssue}\`);
                } else if (this.firstIssuePreviousRecord) {
                    // 是第一个且ID-1不存在（仅当整个任务第一期），使用预加载缓存
                    baseIssue = this.firstIssuePreviousRecord.issue;
                    baseID = this.firstIssuePreviousRecord.id;
                    log(\`  📌 [\${this.sessionId}] 期号\${targetIssue}使用预加载的上一期\${baseIssue} (ID \${baseID}→\${targetID})\`);
                } else {
                    // 无法确定上一期，跳过
                    log(\`  ⚠️ [\${this.sessionId}] 期号\${targetIssue}无法确定上一期，跳过\`);
                    batchResults.push({
                        target_issue: targetIssue,
                        base_issue: null,
                        is_predicted: true,
                        red_combinations: [],
                        blue_combinations: [],
                        pairing_mode: combinationMode || 'truly-unlimited',
                        error: '无法确定上一期',
                        winning_numbers: null,
                        hit_analysis: {},
                        exclusion_summary: {},
                        positive_selection_details: {},
                        exclusions_to_save: [],
                        red_count: 0,
                        blue_count: 0
                    });
                    continue;
                }
            } else {
                // 情况2：当前期号不在数据库中（推算期）
                // 需要通过前一个期号推算
                if (i > 0) {
                    // 使用数组中前一个期号作为基准
                    baseIssue = issueToIDArray[i - 1].issue;
                    baseID = issueToIDArray[i - 1].id;
                    log(\`  🔮 [\${this.sessionId}] 推算期\${targetIssue}使用前一期\${baseIssue}作为基准\`);
                } else {
                    // 推算期是批次第一个，查找数据库中最新的期号
                    const latestRecord = await hit_dlts.findOne({}).sort({ ID: -1 }).select('Issue ID').lean();
                    if (latestRecord) {
                        baseIssue = latestRecord.Issue.toString();
                        baseID = latestRecord.ID;
                        log(\`  🔮 [\${this.sessionId}] 推算期\${targetIssue}使用数据库最新期\${baseIssue}作为基准\`);
                    } else {
                        log(\`  ❌ [\${this.sessionId}] 推算期\${targetIssue}无法找到基准期，跳过\`);
                        batchResults.push({
                            target_issue: targetIssue,
                            base_issue: null,
                            is_predicted: true,
                            red_combinations: [],
                            blue_combinations: [],
                            pairing_mode: combinationMode || 'truly-unlimited',
                            error: '无法找到基准期',
                            winning_numbers: null,
                            hit_analysis: {},
                            exclusion_summary: {},
                            positive_selection_details: {},
                            exclusions_to_save: [],
                            red_count: 0,
                            blue_count: 0
                        });
                        continue;
                    }
                }
            }`;

// 检查是否包含旧代码
if (content.includes(oldCode)) {
    // 替换
    content = content.replace(oldCode, newCode);

    // 备份原文件
    const backupPath = serverPath + '.backup_batch_fix_' + Date.now();
    fs.copyFileSync(serverPath, backupPath);
    console.log('✅ 备份已创建:', backupPath);

    // 写入修改后的文件
    fs.writeFileSync(serverPath, content, 'utf8');
    console.log('✅ 修复已应用到 server.js');
    console.log('\n修复内容:');
    console.log('- 统一使用ID-1规则确定baseIssue');
    console.log('- 对已开奖期号: 使用idToRecordMap.get(targetID - 1)');
    console.log('- 对推算期: 使用数组前一期或查询数据库最新期');
} else {
    console.log('❌ 未找到要替换的代码，可能已经修复或代码结构已变化');
    console.log('请手动检查 processBatch 函数中 baseIssue 的处理逻辑');
}
