// 应用修复：在 applyPositiveSelection 中添加 cachedRedCombinations 检查

const fs = require('fs');

const filePath = 'E:/HITGUI/src/server/server.js';
let content = fs.readFileSync(filePath, 'utf8');

// 要查找的原始代码
const searchPattern = `                statistics: statistics
            };
        }

        // ============ Step 2-6: 使用缓存的红球组合数据逐步筛选 ============`;

// 替换为的新代码
const replacement = `                statistics: statistics
            };
        }

        // 🐛 BUG修复 2025-12-08: 检查 cachedRedCombinations 是否有效（适用于所有路径）
        // 问题: 优化表路径(hwcMap存在)跳过了fallback中的检查，导致历史期号处理失败
        // 修复: 在 Step 2-6 开始前统一检查，确保缓存数据可用
        if (!this.cachedRedCombinations || this.cachedRedCombinations.length === 0) {
            log(\`❌ [\${this.sessionId}] cachedRedCombinations 为空，尝试从全局缓存重新获取...\`);
            const cachedData = globalCacheManager.getCachedData();
            if (cachedData.redCombinations && cachedData.redCombinations.length > 0) {
                this.cachedRedCombinations = cachedData.redCombinations;
                log(\`✅ [\${this.sessionId}] cachedRedCombinations 重新加载成功: \${this.cachedRedCombinations.length}条\`);
            } else {
                throw new Error('红球组合缓存为空，无法继续筛选');
            }
        }

        // ============ Step 2-6: 使用缓存的红球组合数据逐步筛选 ============`;

if (content.includes(searchPattern)) {
    content = content.replace(searchPattern, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ 修复点1 已应用: 在 Step 2-6 前添加 cachedRedCombinations 检查');
} else {
    console.log('❌ 未找到目标代码，可能已修改或代码格式不同');
    console.log('搜索模式的前50个字符:', searchPattern.substring(0, 50));
}
