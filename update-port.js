const fs = require('fs');
const path = require('path');

function updatePortInFile(filePath) {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        const oldContent = content;

        // 替换所有的 localhost:3002 为 localhost:3003
        content = content.replace(/localhost:3002/g, 'localhost:3003');

        if (content !== oldContent) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ 更新端口: ${filePath}`);
        }
    } catch (error) {
        console.error(`❌ 处理文件失败 ${filePath}:`, error.message);
    }
}

// 需要更新的文件
const filesToUpdate = [
    'src/renderer/app.js',
    'src/renderer/dlt-module.js'
];

console.log('开始更新API端口从3001到3002...\n');

filesToUpdate.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
        updatePortInFile(fullPath);
    } else {
        console.log(`⚠️  文件不存在: ${fullPath}`);
    }
});

console.log('\n端口更新完成！');