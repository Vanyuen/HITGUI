const fs = require('fs');
const path = require('path');

function modifyIssueRangeFunction(fileContent) {
    // 使用更精确的正则表达式匹配 'custom' case 代码块
    const customCaseRegex = /(case 'custom':[\s\S]*?\/\/ 🔹 查询已开奖期号范围[\s\S]*?)const actualEndIssue = Math\.min\(normalizedEnd, latestIssue\);([\s\S]*?return customIssues;)/;

    const replacementCode = `$1const actualEndIssue = Math.min(normalizedEnd, latestIssue);
            const customData = await hit_dlts.find({
                Issue: {
                    $gte: normalizedStart,
                    $lte: actualEndIssue
                }
            })
                .sort({ Issue: 1 })
                .select('Issue')
                .lean();

            const customIssues = customData.map(record => record.Issue.toString());

            // 🔹 如果用户请求的结束期号超出已开奖范围，仅追加推算的下一期
            if (normalizedEnd > latestIssue) {
                const nextIssue = await predictNextIssue();
                if (nextIssue) {
                    customIssues.push(nextIssue.toString());
                    log(\`⚠️ 自定义范围包含未开奖期号: 用户请求\${normalizedStart}-\${normalizedEnd}，\` +
                        \`实际返回\${customIssues[0]}-\${customIssues[customIssues.length - 1]}（已开奖）+ \${nextIssue}（推算下一期），共\${customIssues.length}期\`);
                } else {
                    log(\`⚠️ 自定义范围超出已开奖数据，且无法推算下一期，仅返回\${customIssues.length}期已开奖数据\`);
                }
            } else {
                log(\`✅ 自定义范围\${normalizedStart}-\${normalizedEnd}：共\${customIssues.length}期（全部已开奖）\`);
            }

            return customIssues;`;

    const modifiedContent = fileContent.replace(customCaseRegex, replacementCode);
    return modifiedContent;
}

function updateServerFile() {
    const serverFilePath = path.join(__dirname, 'src', 'server', 'server.js');
    let fileContent = fs.readFileSync(serverFilePath, 'utf-8');

    const modifiedContent = modifyIssueRangeFunction(fileContent);

    fs.writeFileSync(serverFilePath, modifiedContent, 'utf-8');
    console.log('✅ 服务器代码已更新');
}

updateServerFile();