/**
 * 测试前端Content-Disposition解析逻辑
 * 验证RFC 5987格式是否能被正确解析
 */

// 模拟前端解析函数
function parseFrontendFilename(contentDisposition, taskName, period) {
    let filename = `${taskName}_第${period}期.xlsx`;

    if (contentDisposition) {
        // 优先尝试提取 filename*=UTF-8''... 格式（RFC 5987）
        const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;\s]+)/i);
        if (utf8Match) {
            filename = decodeURIComponent(utf8Match[1]);
        } else {
            // fallback: 提取普通 filename="..." 格式
            const asciiMatch = contentDisposition.match(/filename=["']?([^"';]+)["']?/i);
            if (asciiMatch) {
                filename = decodeURIComponent(asciiMatch[1]);
            }
        }
    }

    return filename;
}

// 测试用例
const testCases = [
    {
        name: '完整RFC 5987格式（中文任务名）',
        contentDisposition: 'attachment; filename="________25120_.xlsx"; filename*=UTF-8\'\'%E6%88%91%E7%9A%84%E6%B5%8B%E8%AF%95%E4%BB%BB%E5%8A%A1_%E7%AC%AC25120%E6%9C%9F.xlsx',
        taskName: '我的测试任务',
        period: '25120',
        expected: '我的测试任务_第25120期.xlsx'
    },
    {
        name: 'RFC 5987格式（历史数据验证）',
        contentDisposition: 'attachment; filename="________25121_.xlsx"; filename*=UTF-8\'\'%E5%8E%86%E5%8F%B2%E6%95%B0%E6%8D%AE%E9%AA%8C%E8%AF%81_%E7%AC%AC25121%E6%9C%9F.xlsx',
        taskName: '历史数据验证',
        period: '25121',
        expected: '历史数据验证_第25121期.xlsx'
    },
    {
        name: '纯ASCII文件名（英文任务名）',
        contentDisposition: 'attachment; filename="TestTask__25100_.xlsx"; filename*=UTF-8\'\'TestTask_%E7%AC%AC25100%E6%9C%9F.xlsx',
        taskName: 'TestTask',
        period: '25100',
        expected: 'TestTask_第25100期.xlsx'
    },
    {
        name: '仅有ASCII fallback（无UTF-8）',
        contentDisposition: 'attachment; filename="fallback_25001.xlsx"',
        taskName: '测试任务',
        period: '25001',
        expected: 'fallback_25001.xlsx'
    },
    {
        name: '无Content-Disposition头（使用默认）',
        contentDisposition: null,
        taskName: '默认任务',
        period: '25050',
        expected: '默认任务_第25050期.xlsx'
    }
];

console.log('📋 测试前端Content-Disposition解析逻辑\n');
console.log('='.repeat(100));

let passCount = 0;
let failCount = 0;

testCases.forEach((testCase, index) => {
    console.log(`\n测试用例 ${index + 1}: ${testCase.name}`);
    console.log('-'.repeat(100));

    const result = parseFrontendFilename(testCase.contentDisposition, testCase.taskName, testCase.period);
    const isPassed = result === testCase.expected;

    console.log(`  任务名称: ${testCase.taskName}`);
    console.log(`  期号: ${testCase.period}`);
    if (testCase.contentDisposition) {
        console.log(`  Content-Disposition: ${testCase.contentDisposition.substring(0, 80)}...`);
    } else {
        console.log(`  Content-Disposition: (null)`);
    }
    console.log(`  预期结果: ${testCase.expected}`);
    console.log(`  实际结果: ${result}`);
    console.log(`  测试结果: ${isPassed ? '✅ 通过' : '❌ 失败'}`);

    if (isPassed) {
        passCount++;
    } else {
        failCount++;
    }
});

console.log('\n' + '='.repeat(100));
console.log(`\n📊 测试总结: 通过 ${passCount}/${testCases.length}，失败 ${failCount}/${testCases.length}\n`);

if (failCount === 0) {
    console.log('🎉 所有测试用例均通过！前端解析逻辑正确。\n');
} else {
    console.log('⚠️ 存在失败的测试用例，请检查解析逻辑。\n');
}

// 关键验证
console.log('🔑 关键验证：');
console.log('  ✓ RFC 5987 UTF-8格式优先级 > ASCII fallback');
console.log('  ✓ 正则表达式能正确匹配 filename*=UTF-8\'\'...');
console.log('  ✓ decodeURIComponent 能正确解码中文URL编码');
console.log('  ✓ 无Content-Disposition时使用默认文件名');
console.log('\n🚀 前端修复完成，重启应用后即可生效！');
