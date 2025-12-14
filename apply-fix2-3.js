// 应用修复点2和3：Schema添加error字段，保存逻辑添加error字段

const fs = require('fs');

const filePath = 'E:/HITGUI/src/server/server.js';
let content = fs.readFileSync(filePath, 'utf8');

// 修复点2: Schema添加error字段
const schemaSearch = `    // ⭐ 2025-11-28新增：排除详情保存标记
    has_exclusion_details: { type: Boolean, default: false },  // 是否已保存排除详情
    hit_rank: { type: Number },                                 // 命中排名（用于筛选保存排除详情的期号）

    created_at: { type: Date, default: Date.now } // 创建时间
});`;

const schemaReplacement = `    // ⭐ 2025-11-28新增：排除详情保存标记
    has_exclusion_details: { type: Boolean, default: false },  // 是否已保存排除详情
    hit_rank: { type: Number },                                 // 命中排名（用于筛选保存排除详情的期号）

    // 🐛 2025-12-08新增：错误信息字段（便于调试）
    error: { type: String },                                    // 处理错误信息（如果有）

    created_at: { type: Date, default: Date.now } // 创建时间
});`;

if (content.includes(schemaSearch)) {
    content = content.replace(schemaSearch, schemaReplacement);
    console.log('✅ 修复点2 已应用: Schema添加error字段');
} else {
    console.log('❌ 修复点2: 未找到Schema目标代码');
}

// 修复点3: 保存逻辑添加error字段
const saveSearch = `                positive_selection_details: periodResult.positive_selection_details || {},
                created_at: new Date()
            });`;

const saveReplacement = `                positive_selection_details: periodResult.positive_selection_details || {},
                error: periodResult.error || null,  // 🐛 2025-12-08: 保存错误信息
                created_at: new Date()
            });`;

if (content.includes(saveSearch)) {
    content = content.replace(saveSearch, saveReplacement);
    console.log('✅ 修复点3 已应用: 保存逻辑添加error字段');
} else {
    console.log('❌ 修复点3: 未找到保存逻辑目标代码');
}

// 保存文件
fs.writeFileSync(filePath, content, 'utf8');
console.log('\n✅ 所有修复已写入文件');
