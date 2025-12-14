const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'src/server/server.js');
const content = fs.readFileSync(serverPath, 'utf8');

// 查找所有位置
const searchStr = '共生成${issuePairs.length}个期号对';
let idx = 0;
let count = 0;
while ((idx = content.indexOf(searchStr, idx)) > -1) {
    count++;
    console.log(`\n=== 位置 ${count} (字符位置: ${idx}) ===`);
    console.log(content.substring(idx - 200, idx + 200));
    idx++;
}

console.log('\n总共找到:', count, '处');
