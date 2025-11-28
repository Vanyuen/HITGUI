const fs = require('fs');
const path = require('path');

function findCodeReferences(rootDir) {
    const dltCollections = [
        'hit_dlts',
        'hit_dlts',
        'hit_dlts',
        'hit_dlts'
    ];

    const results = {
        files: [],
        references: []
    };

    function searchFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');

            // 查找集合名称的正则表达式
            const collectionRegex = new RegExp(`(${dltCollections.join('|')})`, 'g');
            const matches = content.match(collectionRegex);

            if (matches) {
                results.files.push(filePath);
                matches.forEach(match => {
                    results.references.push({
                        file: filePath,
                        collection: match,
                        // 提供一些上下文
                        context: content.split('\n')
                            .filter(line => line.includes(match))
                            .slice(0, 3)  // 限制上下文行数
                    });
                });
            }
        } catch (error) {
            console.error(`读取文件 ${filePath} 失败:`, error);
        }
    }

    function traverseDirectory(dir) {
        const files = fs.readdirSync(dir);

        files.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                // 跳过 node_modules 等目录
                if (!['node_modules', '.git', 'dist', 'build'].includes(file)) {
                    traverseDirectory(fullPath);
                }
            } else if (
                // 检查文件类型
                ['.js', '.ts', '.json', '.md'].includes(path.extname(file)) &&
                // 排除压缩文件和备份文件
                !file.includes('.min.') &&
                !file.includes('.backup')
            ) {
                searchFile(fullPath);
            }
        });
    }

    traverseDirectory(rootDir);

    return results;
}

// 使用绝对路径
const rootDir = 'E:\\HITGUI';
const references = findCodeReferences(rootDir);

console.log('🔍 大乐透集合引用分析报告\n');
console.log(`📁 搜索目录: ${rootDir}`);
console.log(`🔎 包含引用的文件数: ${references.files.length}\n`);

console.log('📊 详细引用情况:');
references.references.forEach(ref => {
    console.log(`\n📄 文件: ${path.relative(rootDir, ref.file)}`);
    console.log(`🎯 集合: ${ref.collection}`);
    console.log('📋 上下文代码片段:');
    ref.context.forEach(line => console.log(`   ${line.trim()}`));
    console.log('─'.repeat(50));
});

// 生成更改建议报告
console.log('\n💡 代码更改建议:');
const uniqueFiles = [...new Set(references.references.map(r => r.file))];
console.log(`1. 需要检查和修改的文件数：${uniqueFiles.length}`);
console.log('2. 推荐更改：');
console.log('   - 将 hit_dlts、hit_dlts、hit_dlts 的查询替换为 hit_dlts');
console.log('   - 在所有相关文件中统一使用 hit_dlts');
console.log('   - 保持大小写敏感');

// 可选：输出到文件以便后续分析
fs.writeFileSync(
    path.join(rootDir, 'dlt-collection-references.json'),
    JSON.stringify(references, null, 2)
);