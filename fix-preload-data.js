/**
 * 修复脚本：修复 preloadData 方法中的 ID 范围查询问题
 *
 * 问题：当期号不连续时（如 25077 → 25124），中间期号的 ID-1 记录不在查询结果中
 * 解决：使用 ID 范围查询而不是期号列表查询
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'src/server/server.js');

// 读取文件
let content = fs.readFileSync(serverPath, 'utf-8');

// 要替换的旧代码
const oldCode = `        // 查询所有期号（包括第一个期号的上一期）
        const allIssueNums = [firstIssueRecord.ID - 1, ...issueNumbers];
        const allRecords = await hit_dlts.find({
            $or: [
                { ID: { $in: allIssueNums } },
                { Issue: { $in: issueNumbers } }
            ]
        })
            .select('Issue ID')
            .sort({ ID: 1 })
            .lean();`;

// 新代码
const newCode = `        // 🐛 BUG修复 2025-11-29: 使用ID范围查询而不是期号列表查询
        // 问题：当期号不连续时（如 25077 → 25124），中间期号的 ID-1 记录不在查询结果中
        // 解决：先获取所有目标期号的ID范围，然后查询完整的ID范围

        // 2.2 查询所有目标期号获取它们的 ID
        const targetRecords = await hit_dlts.find({ Issue: { $in: issueNumbers } })
            .select('Issue ID')
            .sort({ ID: 1 })
            .lean();

        if (targetRecords.length === 0) {
            log(\`⚠️ [\${this.sessionId}] 没有找到任何目标期号，跳过HWC预加载\`);
            this.hwcOptimizedCache = new Map();
            this.idToRecordMap = new Map();
            this.issueToIdMap = new Map();
            return;
        }

        // 2.3 计算ID范围（minID-1 到 maxID，确保包含所有基准期）
        const minID = targetRecords[0].ID;
        const maxID = targetRecords[targetRecords.length - 1].ID;
        log(\`  📊 目标期号ID范围: \${minID} - \${maxID}，共\${targetRecords.length}个目标期号\`);

        // 2.4 使用ID范围查询，包含所有可能的基准期记录
        const allRecords = await hit_dlts.find({
            ID: { $gte: minID - 1, $lte: maxID }
        })
            .select('Issue ID')
            .sort({ ID: 1 })
            .lean();

        log(\`  📋 ID范围查询结果: \${allRecords.length}条记录 (ID \${minID-1} ~ \${maxID})\`);`;

// 检查是否存在旧代码
if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(serverPath, content, 'utf-8');
    console.log('✅ 代码修复成功！');
    console.log('');
    console.log('修改说明：');
    console.log('- 将 $or 条件查询改为 ID 范围查询');
    console.log('- 确保所有目标期号的基准期（ID-1）都在查询结果中');
    console.log('- 即使期号不连续（如 25077 → 25124），也能正确找到每个期号的基准期');
} else {
    console.log('⚠️ 未找到需要替换的代码，可能已经修复或代码结构已变化');
    console.log('');
    console.log('正在检查代码是否已经包含修复...');

    if (content.includes('2.2 查询所有目标期号获取它们的 ID')) {
        console.log('✅ 代码已经修复！');
    } else {
        console.log('❌ 代码结构可能已改变，需要手动检查');

        // 输出相关代码位置以供参考
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('查询所有期号') || lines[i].includes('allIssueNums')) {
                console.log(`行 ${i + 1}: ${lines[i].substring(0, 100)}...`);
            }
        }
    }
}
