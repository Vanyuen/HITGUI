/**
 * 测试Content-Disposition文件名编码
 * 验证RFC 5987标准格式是否正确生成
 */

// 模拟生成Content-Disposition头
function generateContentDisposition(originalFilename) {
    const asciiFilename = originalFilename.replace(/[^\x00-\x7F]/g, '_');
    const encodedFilename = encodeURIComponent(originalFilename);

    return `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedFilename}`;
}

// 测试用例
const testCases = [
    '我的测试任务_第25120期.xlsx',
    '历史数据验证_第25121期.xlsx',
    '热温冷分析_第25001期.xlsx',
    'TestTask_第25100期.xlsx'
];

console.log('📋 测试Content-Disposition编码格式\n');
console.log('=' .repeat(80));

testCases.forEach((filename, index) => {
    console.log(`\n测试用例 ${index + 1}: ${filename}`);
    console.log('-'.repeat(80));

    const header = generateContentDisposition(filename);
    console.log('Content-Disposition:', header);

    // 解析验证
    const asciiMatch = header.match(/filename="([^"]+)"/);
    const utf8Match = header.match(/filename\*=UTF-8''(.+)$/);

    if (asciiMatch) {
        console.log('  ✓ ASCII fallback:', asciiMatch[1]);
    }

    if (utf8Match) {
        const decoded = decodeURIComponent(utf8Match[1]);
        console.log('  ✓ UTF-8编码:', utf8Match[1]);
        console.log('  ✓ UTF-8解码:', decoded);
        console.log('  ✓ 解码验证:', decoded === filename ? '通过 ✅' : '失败 ❌');
    }
});

console.log('\n' + '='.repeat(80));
console.log('✅ 编码格式测试完成！\n');

// 浏览器兼容性说明
console.log('📌 浏览器兼容性：');
console.log('  • Chrome/Edge: 优先使用 filename*=UTF-8，正确显示中文');
console.log('  • Firefox: 优先使用 filename*=UTF-8，正确显示中文');
console.log('  • Safari: 优先使用 filename*=UTF-8，正确显示中文');
console.log('  • IE11: 使用 filename（ASCII fallback），中文显示为下划线');
console.log('\n🎯 推荐：现代浏览器均能正确显示中文文件名！');
