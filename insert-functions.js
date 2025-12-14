// 脚本：在server.js中插入增量更新函数
const fs = require('fs');
const path = require('path');

const serverJsPath = path.join(__dirname, 'src/server/server.js');
const functionsPath = path.join(__dirname, 'incremental-update-functions.js');

// 读取文件
let content = fs.readFileSync(serverJsPath, 'utf8');
const newFunctions = fs.readFileSync(functionsPath, 'utf8');

// 找到插入位置：在 generateUnifiedMissingTables 函数结束后
const insertMarker = `    return { recordCount: allRecords.length };
}

/**
 * 步骤2: 生成组合特征表`;

const insertReplacement = `    return { recordCount: allRecords.length };
}

${newFunctions}

/**
 * 步骤2: 生成组合特征表`;

if (content.includes(insertMarker)) {
    content = content.replace(insertMarker, insertReplacement);
    fs.writeFileSync(serverJsPath, content, 'utf8');
    console.log('✅ 成功插入增量更新函数');
} else {
    console.log('❌ 未找到插入位置');
    console.log('尝试查找...');

    // 尝试查找位置
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('return { recordCount: allRecords.length }')) {
            console.log(`  行 ${i + 1}: ${lines[i].substring(0, 50)}...`);
        }
    }
}
