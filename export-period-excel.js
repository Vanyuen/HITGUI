#!/usr/bin/env node
/**
 * Excel格式单期组合数据导出工具
 * 支持中文、配对模式、中奖分析
 */

const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// MongoDB连接配置
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lottery';

// 解析命令行参数
function parseArgs() {
    const args = {};
    process.argv.slice(2).forEach(arg => {
        if (arg.startsWith('--')) {
            const [key, value] = arg.substring(2).split('=');
            args[key] = value || true;
        }
    });
    return args;
}

// MongoDB Schema定义
const predictionTaskSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_predictiontasks' });
const predictionTaskResultSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_predictiontaskresults' });
const dltRedCombinationsSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_redcombinations' });
const dltBlueCombinationsSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_bluecombinations' });
const dltRedMissingSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlt_redballmissing_histories' });
const dltSchema = new mongoose.Schema({}, { strict: false, collection: 'hit_dlts' });

const PredictionTask = mongoose.model('PredictionTask', predictionTaskSchema);
const PredictionTaskResult = mongoose.model('PredictionTaskResult', predictionTaskResultSchema);
const DLTRedCombinations = mongoose.model('DLTRedCombinations', dltRedCombinationsSchema);
const DLTBlueCombinations = mongoose.model('DLTBlueCombinations', dltBlueCombinationsSchema);
const DLTRedMissing = mongoose.model('DLTRedMissing', dltRedMissingSchema);
const DLT = mongoose.model('DLT', dltSchema);

// 计算热温冷比
function calculateHotWarmColdRatio(redBalls, missingData) {
    if (!missingData) return '-';

    let hotCount = 0, warmCount = 0, coldCount = 0;
    redBalls.forEach(num => {
        const missingValue = missingData[num.toString()] || 0;
        if (missingValue <= 4) {
            hotCount++;
        } else if (missingValue >= 5 && missingValue <= 9) {
            warmCount++;
        } else {
            coldCount++;
        }
    });
    return `${hotCount}:${warmCount}:${coldCount}`;
}

// 计算奖项和奖金
function calculatePrize(redHitCount, blueHitCount) {
    const prizeTable = [
        { red: 5, blue: 2, level: '一等奖', amount: 10000000 },
        { red: 5, blue: 1, level: '二等奖', amount: 100000 },
        { red: 5, blue: 0, level: '三等奖', amount: 10000 },
        { red: 4, blue: 2, level: '四等奖', amount: 3000 },
        { red: 4, blue: 1, level: '五等奖', amount: 300 },
        { red: 3, blue: 2, level: '六等奖', amount: 200 },
        { red: 4, blue: 0, level: '七等奖', amount: 100 },
        { red: 3, blue: 1, level: '八等奖', amount: 15 },
        { red: 2, blue: 2, level: '八等奖', amount: 15 },
        { red: 3, blue: 0, level: '九等奖', amount: 5 },
        { red: 1, blue: 2, level: '九等奖', amount: 5 },
        { red: 2, blue: 1, level: '九等奖', amount: 5 },
        { red: 0, blue: 2, level: '九等奖', amount: 5 }
    ];

    const prize = prizeTable.find(p => p.red === redHitCount && p.blue === blueHitCount);
    return prize || { level: '未中奖', amount: 0 };
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

// 主导出函数
async function exportPeriodDataAsExcel(taskId, period, options = {}) {
    const outputDir = options.output || './exports';
    const startTime = Date.now();

    console.log('\n🚀 开始导出Excel格式组合数据...');
    console.log(`📋 任务ID: ${taskId}`);
    console.log(`📅 期号: ${period}`);
    console.log(`📁 输出目录: ${path.resolve(outputDir)}`);
    console.log('');

    try {
        // 创建输出目录
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 1. 查询任务信息
        console.log('⏳ 正在查询任务信息...');
        const task = await PredictionTask.findOne({ task_id: taskId }).lean();
        if (!task) {
            throw new Error(`任务不存在: ${taskId}`);
        }
        console.log(`✅ 找到任务: ${task.task_name}`);

        // 2. 查询期号结果
        console.log('⏳ 正在查询期号结果...');
        const result = await PredictionTaskResult.findOne({
            task_id: taskId,
            period: parseInt(period)
        }).lean();
        if (!result) {
            throw new Error(`未找到期号 ${period} 的结果`);
        }
        console.log(`✅ 找到期号结果`);

        // 3. 查询红球组合
        console.log('⏳ 正在查询红球组合...');
        const redCombinations = await DLTRedCombinations.find({
            combination_id: { $in: result.red_combinations }
        }).lean();
        console.log(`✅ 找到 ${redCombinations.length.toLocaleString()} 个红球组合`);

        // 4. 查询蓝球组合
        console.log('⏳ 正在查询蓝球组合...');
        const blueCombinations = await DLTBlueCombinations.find({
            combination_id: { $in: result.blue_combinations }
        }).lean();
        console.log(`✅ 找到 ${blueCombinations.length.toLocaleString()} 个蓝球组合`);

        // 5. 查询遗漏数据
        console.log('⏳ 正在查询遗漏数据...');
        const missingData = await DLTRedMissing.findOne({
            Issue: period.toString()
        }).lean();

        // 6. 查询开奖号码
        console.log('⏳ 正在查询开奖号码...');
        const drawResult = await DLT.findOne({ Issue: parseInt(period) }).lean();
        const winningNumbers = drawResult ? {
            red: [drawResult.Red1, drawResult.Red2, drawResult.Red3, drawResult.Red4, drawResult.Red5],
            blue: [drawResult.Blue1, drawResult.Blue2]
        } : null;

        if (winningNumbers) {
            console.log(`✅ 开奖号码: ${winningNumbers.red.map(n => n.toString().padStart(2, '0')).join(' ')} + ${winningNumbers.blue.map(n => n.toString().padStart(2, '0')).join(' ')}`);
        }

        // 获取配对模式
        const pairingMode = result.pairing_mode || 'truly-unlimited';
        const bluePairingIndices = result.blue_pairing_indices || null;
        console.log(`📋 配对模式: ${pairingMode}`);

        // 计算总组合数
        let totalCombinations;
        if (pairingMode === 'unlimited' && bluePairingIndices && bluePairingIndices.length > 0) {
            totalCombinations = redCombinations.length;
            console.log(`   使用1:1配对模式`);
        } else {
            totalCombinations = redCombinations.length * blueCombinations.length;
            console.log(`   使用笛卡尔积模式`);
        }

        console.log(`\n📊 总组合数: ${totalCombinations.toLocaleString()} 条`);
        console.log('');

        // 7. 创建Excel工作簿
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('预测组合');

        // 设置列定义
        worksheet.columns = [
            { header: '序号', key: 'index', width: 8 },
            { header: '红球1', key: 'red1', width: 8 },
            { header: '红球2', key: 'red2', width: 8 },
            { header: '红球3', key: 'red3', width: 8 },
            { header: '红球4', key: 'red4', width: 8 },
            { header: '红球5', key: 'red5', width: 8 },
            { header: '前区和值', key: 'sum', width: 10 },
            { header: '前区跨度', key: 'span', width: 10 },
            { header: '区间比', key: 'zone_ratio', width: 10 },
            { header: '前区奇偶', key: 'odd_even', width: 10 },
            { header: '热温冷比', key: 'hot_warm_cold', width: 10 },
            { header: '蓝球1', key: 'blue1', width: 8 },
            { header: '蓝球2', key: 'blue2', width: 8 },
            { header: '配对模式', key: 'pairing', width: 12 },
            { header: '红球命中', key: 'red_hit', width: 10 },
            { header: '蓝球命中', key: 'blue_hit', width: 10 },
            { header: '奖项等级', key: 'prize_level', width: 12 },
            { header: '奖金(元)', key: 'prize_amount', width: 12 }
        ];

        // 设置表头样式
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD9E1F2' }
        };

        // 8. 生成数据行
        console.log('📝 正在生成Excel数据...');

        const blueComboMap = {};
        blueCombinations.forEach(bc => {
            blueComboMap[bc.combination_id] = bc;
        });

        let rowNumber = 1;
        const pairingLabel = pairingMode === 'unlimited' ? '1:1配对' : '笛卡尔积';

        if (pairingMode === 'unlimited' && bluePairingIndices && bluePairingIndices.length > 0) {
            // 1:1配对模式
            for (let i = 0; i < redCombinations.length; i++) {
                const red = redCombinations[i];
                const blueIndex = bluePairingIndices[i];
                const blueComboId = result.blue_combinations[blueIndex];
                const blue = blueComboMap[blueComboId];

                if (!blue) continue;

                const redBalls = [red.red_ball_1, red.red_ball_2, red.red_ball_3, red.red_ball_4, red.red_ball_5];
                const blueBalls = [blue.blue_ball_1, blue.blue_ball_2];

                let redHit = '-', blueHit = '-', prizeLevel = '-', prizeAmount = 0;
                if (winningNumbers) {
                    const redHitCount = redBalls.filter(n => winningNumbers.red.includes(n)).length;
                    const blueHitCount = blueBalls.filter(n => winningNumbers.blue.includes(n)).length;
                    redHit = `${redHitCount}个`;
                    blueHit = `${blueHitCount}个`;
                    const prize = calculatePrize(redHitCount, blueHitCount);
                    prizeLevel = prize.level;
                    prizeAmount = prize.amount;
                }

                worksheet.addRow({
                    index: rowNumber++,
                    red1: red.red_ball_1,
                    red2: red.red_ball_2,
                    red3: red.red_ball_3,
                    red4: red.red_ball_4,
                    red5: red.red_ball_5,
                    sum: red.sum,
                    span: red.span,
                    zone_ratio: red.zone_ratio || '-',
                    odd_even: red.odd_even_ratio || '-',
                    hot_warm_cold: calculateHotWarmColdRatio(redBalls, missingData),
                    blue1: blue.blue_ball_1,
                    blue2: blue.blue_ball_2,
                    pairing: pairingLabel,
                    red_hit: redHit,
                    blue_hit: blueHit,
                    prize_level: prizeLevel,
                    prize_amount: prizeAmount
                });

                // 进度显示
                if (i > 0 && i % 1000 === 0) {
                    const progress = Math.floor((i / redCombinations.length) * 100);
                    console.log(`   进度: ${progress}% (${i.toLocaleString()}/${redCombinations.length.toLocaleString()})`);
                }
            }
        } else {
            // 笛卡尔积模式
            for (const red of redCombinations) {
                for (const blue of blueCombinations) {
                    const redBalls = [red.red_ball_1, red.red_ball_2, red.red_ball_3, red.red_ball_4, red.red_ball_5];
                    const blueBalls = [blue.blue_ball_1, blue.blue_ball_2];

                    let redHit = '-', blueHit = '-', prizeLevel = '-', prizeAmount = 0;
                    if (winningNumbers) {
                        const redHitCount = redBalls.filter(n => winningNumbers.red.includes(n)).length;
                        const blueHitCount = blueBalls.filter(n => winningNumbers.blue.includes(n)).length;
                        redHit = `${redHitCount}个`;
                        blueHit = `${blueHitCount}个`;
                        const prize = calculatePrize(redHitCount, blueHitCount);
                        prizeLevel = prize.level;
                        prizeAmount = prize.amount;
                    }

                    worksheet.addRow({
                        index: rowNumber++,
                        red1: red.red_ball_1,
                        red2: red.red_ball_2,
                        red3: red.red_ball_3,
                        red4: red.red_ball_4,
                        red5: red.red_ball_5,
                        sum: red.sum,
                        span: red.span,
                        zone_ratio: red.zone_ratio || '-',
                        odd_even: red.odd_even_ratio || '-',
                        hot_warm_cold: calculateHotWarmColdRatio(redBalls, missingData),
                        blue1: blue.blue_ball_1,
                        blue2: blue.blue_ball_2,
                        pairing: pairingLabel,
                        red_hit: redHit,
                        blue_hit: blueHit,
                        prize_level: prizeLevel,
                        prize_amount: prizeAmount
                    });

                    if (rowNumber % 1000 === 0) {
                        const progress = Math.floor((rowNumber / totalCombinations) * 100);
                        console.log(`   进度: ${progress}% (${rowNumber.toLocaleString()}/${totalCombinations.toLocaleString()})`);
                    }
                }
            }
        }

        // 9. 保存Excel文件
        const filename = `预测任务_${task.task_name}_期号_${period}_组合明细.xlsx`;
        const filepath = path.join(outputDir, filename);

        console.log('\n💾 正在保存Excel文件...');
        await workbook.xlsx.writeFile(filepath);

        const fileSize = fs.statSync(filepath).size;
        const elapsed = (Date.now() - startTime) / 1000;

        console.log(`\n✅ Excel文件生成完成!`);
        console.log(`📄 文件路径: ${filepath}`);
        console.log(`📊 文件大小: ${formatFileSize(fileSize)}`);
        console.log(`⏱️  耗时: ${elapsed.toFixed(2)} 秒`);
        console.log(`⚡ 平均速度: ${Math.floor(totalCombinations / elapsed).toLocaleString()} 行/秒`);
        console.log('\n🎉 导出完成！');

    } catch (error) {
        console.error(`\n❌ 导出失败: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

// 主函数
async function main() {
    const args = parseArgs();

    if (!args['task-id'] || !args.period) {
        console.error('❌ 错误: 缺少必需参数');
        console.log('使用方法: node export-period-excel.js --task-id=<任务ID> --period=<期号> [--output=<路径>]');
        process.exit(1);
    }

    try {
        // 连接MongoDB
        console.log('🔌 正在连接MongoDB...');
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB连接成功');

        // 执行导出
        await exportPeriodDataAsExcel(args['task-id'], args.period, args);

        // 关闭连接
        await mongoose.disconnect();
        console.log('👋 数据库连接已关闭');
        process.exit(0);

    } catch (error) {
        console.error('❌ 发生错误:', error.message);
        process.exit(1);
    }
}

// 运行主函数
if (require.main === module) {
    main();
}
