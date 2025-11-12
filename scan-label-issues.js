/**
 * 扫描HTML文件中label标签嵌套input的问题
 */

const fs = require('fs');
const path = require('path');

const htmlFile = path.join(__dirname, 'src', 'renderer', 'index.html');
const content = fs.readFileSync(htmlFile, 'utf-8');
const lines = content.split('\n');

console.log('🔍 开始扫描 label 标签嵌套 input 的问题...\n');

// 存储所有问题
const problems = [];
const categories = {
    'batch-radio-option': [],
    'batch-checkbox-wrapper': [],
    'inline-input-wrapper': [],
    'other': []
};

// 逐行扫描，跟踪label的开始和结束
let inLabel = false;
let labelStartLine = 0;
let labelClassName = '';
let labelContent = '';
let labelIndent = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // 检测label开始
    const labelStart = line.match(/<label([^>]*)>/);
    if (labelStart) {
        inLabel = true;
        labelStartLine = lineNum;
        labelContent = line;
        labelIndent = line.match(/^(\s*)/)[1].length;

        // 提取class
        const classMatch = labelStart[1].match(/class=["']([^"']+)["']/);
        labelClassName = classMatch ? classMatch[1] : 'no-class';
    } else if (inLabel) {
        labelContent += '\n' + line;
    }

    // 检测label结束
    if (inLabel && line.includes('</label>')) {
        inLabel = false;

        // 分析这个label的内容
        const inputs = [];
        const inputRegex = /<input\s+([^>]+)>/g;
        let match;

        while ((match = inputRegex.exec(labelContent)) !== null) {
            const attrs = match[1];
            const typeMatch = attrs.match(/type=["']([^"']+)["']/);
            const idMatch = attrs.match(/id=["']([^"']+)["']/);
            const type = typeMatch ? typeMatch[1] : 'unknown';
            const id = idMatch ? idMatch[1] : 'no-id';

            inputs.push({ type, id, attrs });
        }

        // 检查是否有问题：label内同时包含控制型input和文本型input
        const hasControl = inputs.some(inp => inp.type === 'radio' || inp.type === 'checkbox');
        const hasText = inputs.some(inp => inp.type === 'number' || inp.type === 'text' || inp.type === 'date');

        if (inputs.length > 1 && hasControl && hasText) {
            const problem = {
                line: labelStartLine,
                className: labelClassName,
                inputs: inputs.map(inp => `${inp.type}#${inp.id}`).join(', '),
                preview: labelContent.substring(0, 150).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
            };

            problems.push(problem);

            // 分类
            if (labelClassName.includes('batch-radio-option')) {
                categories['batch-radio-option'].push(problem);
            } else if (labelClassName.includes('batch-checkbox-wrapper')) {
                categories['batch-checkbox-wrapper'].push(problem);
            } else if (labelClassName.includes('inline')) {
                categories['inline-input-wrapper'].push(problem);
            } else {
                categories['other'].push(problem);
            }
        }

        // 重置
        labelContent = '';
        labelClassName = '';
    }
}

// 输出结果
console.log(`📊 总共找到 ${problems.length} 个问题实例\n`);
console.log('=' .repeat(80));

// 按类别输出
for (const [category, items] of Object.entries(categories)) {
    if (items.length > 0) {
        console.log(`\n📁 类别: ${category} (${items.length} 个)`);
        console.log('-'.repeat(80));

        items.forEach((item, index) => {
            console.log(`\n${index + 1}. 行 ${item.line}: class="${item.className}"`);
            console.log(`   包含: ${item.inputs}`);
            console.log(`   预览: ${item.preview}...`);
        });
    }
}

// 输出详细列表
console.log('\n\n' + '='.repeat(80));
console.log('📋 所有问题行号列表（用于批量修复）：\n');
problems.forEach(p => {
    console.log(`行 ${p.line}: ${p.className}`);
});

console.log('\n\n' + '='.repeat(80));
console.log('🔧 修复建议：\n');
console.log('将以下 class 的 <label> 标签改为 <div> 标签：');
console.log('  1. batch-radio-option (最严重)');
console.log('  2. batch-checkbox-wrapper (如果包含其他input)');
console.log('  3. 其他嵌套情况\n');
console.log('修复后保持class名称不变，不影响CSS样式。');
console.log('='.repeat(80));
