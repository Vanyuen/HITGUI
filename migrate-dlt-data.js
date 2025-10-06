/**
 * 大乐透数据迁移脚本
 * 功能：
 * 1. 重命名字段：Sales -> TotalSales, Pool -> PoolPrize, drawDate -> DrawDate
 * 2. 删除废弃字段：DrawingDay, DrawingWeek
 * 3. 按Issue升序重新分配ID (从1开始连续递增)
 */

require('dotenv').config();
const mongoose = require('mongoose');

// 连接数据库
async function connectDB() {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lottery';
    await mongoose.connect(mongoURI);
    console.log('✅ 数据库连接成功');
}

// 迁移脚本
async function migrateDLTData() {
    try {
        await connectDB();

        const db = mongoose.connection.db;
        const collection = db.collection('hit_dlts'); // MongoDB集合名通常是小写复数

        console.log('\n开始数据迁移...\n');

        // 1. 获取所有记录，按Issue升序排序
        const allRecords = await collection.find({}).sort({ Issue: 1 }).toArray();
        console.log(`📊 找到 ${allRecords.length} 条记录`);

        if (allRecords.length === 0) {
            console.log('⚠️  没有数据需要迁移');
            return;
        }

        // 2. 批量更新操作
        const bulkOps = [];

        allRecords.forEach((record, index) => {
            const newID = index + 1; // 从1开始连续递增

            const updateFields = {
                ID: newID
            };

            // 重命名字段
            if (record.Sales !== undefined) {
                updateFields.TotalSales = record.Sales;
            }
            if (record.Pool !== undefined) {
                updateFields.PoolPrize = record.Pool;
            }
            if (record.drawDate !== undefined) {
                updateFields.DrawDate = record.drawDate;
            }

            // 删除废弃字段
            const unsetFields = {};
            if (record.DrawingDay !== undefined) unsetFields.DrawingDay = "";
            if (record.DrawingWeek !== undefined) unsetFields.DrawingWeek = "";
            if (record.Sales !== undefined) unsetFields.Sales = "";
            if (record.Pool !== undefined) unsetFields.Pool = "";
            if (record.drawDate !== undefined) unsetFields.drawDate = "";

            const updateOp = {
                updateOne: {
                    filter: { _id: record._id },
                    update: {
                        $set: updateFields,
                        $unset: unsetFields
                    }
                }
            };

            bulkOps.push(updateOp);
        });

        // 3. 执行批量更新
        if (bulkOps.length > 0) {
            console.log(`🔄 开始批量更新 ${bulkOps.length} 条记录...`);
            const result = await collection.bulkWrite(bulkOps);
            console.log(`✅ 更新完成: ${result.modifiedCount} 条记录已修改`);
        }

        // 4. 验证结果
        console.log('\n验证迁移结果:');
        const sample = await collection.findOne({ Issue: allRecords[0].Issue });
        console.log('示例记录:', JSON.stringify(sample, null, 2));

        // 检查ID连续性
        const idCheck = await collection.find({}).sort({ ID: 1 }).project({ ID: 1, Issue: 1 }).toArray();
        const idGaps = [];
        for (let i = 0; i < idCheck.length; i++) {
            if (idCheck[i].ID !== i + 1) {
                idGaps.push(`期号 ${idCheck[i].Issue} 的ID应为 ${i + 1}，实际为 ${idCheck[i].ID}`);
            }
        }

        if (idGaps.length === 0) {
            console.log('✅ ID连续性检查通过');
        } else {
            console.log('⚠️  ID不连续:', idGaps);
        }

        console.log('\n✅ 数据迁移完成！');

    } catch (error) {
        console.error('❌ 迁移失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('数据库连接已关闭');
    }
}

// 执行迁移
migrateDLTData();
