/**
 * SSE连接测试脚本
 * 用于验证进度推送服务端点是否正常工作
 */

const http = require('http');

const API_BASE_URL = 'http://localhost:3003';

console.log('🧪 开始测试SSE连接...\n');

// 创建SSE连接
const req = http.get(`${API_BASE_URL}/api/dlt/update-progress-stream`, (res) => {
    console.log('✅ 连接已建立');
    console.log(`状态码: ${res.statusCode}`);
    console.log(`Content-Type: ${res.headers['content-type']}`);
    console.log(`Connection: ${res.headers['connection']}\n`);

    let messageCount = 0;

    res.on('data', (chunk) => {
        const data = chunk.toString();
        messageCount++;

        console.log(`📨 收到消息 #${messageCount}:`);
        console.log(data);
        console.log('---');

        // 解析数据
        const lines = data.split('\n');
        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const jsonStr = line.substring(6);
                try {
                    const progress = JSON.parse(jsonStr);
                    console.log('📊 解析后的进度数据:');
                    console.log(`   步骤: ${progress.step}/${progress.totalSteps} (${progress.percentage}%)`);
                    console.log(`   状态: ${progress.status}`);
                    console.log(`   消息: ${progress.message}`);
                    console.log(`   已用时: ${progress.elapsedTime}ms\n`);
                } catch (err) {
                    console.error('❌ JSON解析失败:', err.message);
                }
            }
        }
    });

    res.on('end', () => {
        console.log('❌ 连接已关闭');
        console.log(`共收到 ${messageCount} 条消息\n`);
    });

    res.on('error', (error) => {
        console.error('❌ 连接错误:', error.message);
    });
});

req.on('error', (error) => {
    console.error('❌ 请求失败:', error.message);
    console.log('\n💡 提示: 请确保服务器正在运行 (npm start)');
});

// 30秒后自动断开测试
setTimeout(() => {
    console.log('\n⏱️ 测试时长已达30秒，断开连接...');
    req.destroy();
    process.exit(0);
}, 30000);

console.log('⏳ 测试将持续30秒，或按Ctrl+C手动停止...\n');
