const fs = require('fs');
const path = 'E:/HITGUI/src/server/server.js';

// 读取文件
let content = fs.readFileSync(path, 'utf8');

// 查找要替换的位置 - 使用正则表达式
const searchPattern = /\/\/ 🔧 修复：基于缓存的上一期确定正确的baseIssue\s+let baseIssue, baseID;\s+if \(i === 0\) \{[\s\S]*?else \{[\s\S]*?const baseRecord = this\.idToRecordMap\?\.get\(targetID - 1\);[\s\S]*?log\(`  ⚠️ \[\$\{this\.sessionId\}\] 期号\$\{targetIssue\}的ID-1记录不存在，使用数组fallback: \$\{baseIssue\}`\);[\s\S]*?\}\s+\}/;

const newCode = `// 🐛 BUG修复 2025-12-11: 统一使用ID-1规则确定baseIssue
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

// 简化查找：按行号查找替换
const lines = content.split('\n');
let startLine = -1;
let endLine = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('// 🔧 修复：基于缓存的上一期确定正确的baseIssue')) {
        startLine = i;
    }
    if (startLine !== -1 && lines[i].includes('log(`  ⚠️ [${this.sessionId}] 期号${targetIssue}的ID-1记录不存在，使用数组fallback: ${baseIssue}`)')) {
        // 找到结尾的花括号
        for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].trim() === '}' && lines[j+1] && lines[j+1].trim() === '}') {
                endLine = j + 1;
                break;
            }
        }
        break;
    }
}

console.log('查找结果: startLine=' + startLine + ', endLine=' + endLine);

if (startLine !== -1 && endLine !== -1) {
    // 替换
    const newLines = [
        ...lines.slice(0, startLine),
        '            ' + newCode,
        ...lines.slice(endLine + 1)
    ];
    fs.writeFileSync(path, newLines.join('\n'), 'utf8');
    console.log('✅ 修复已应用! 替换了第' + (startLine+1) + '行到第' + (endLine+1) + '行');
} else {
    console.log('❌ 未找到要替换的代码');
}
