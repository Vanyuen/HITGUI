#!/usr/bin/env node
/**
 * 单期组合数据导出命令行工具
 * 用于导出大量组合数据，不受浏览器限制
 *
 * 使用方法：
 * node export-period.js --task-id=预测任务_2025-9-30_16-38-23 --period=7001
 * node export-period.js --task-id=xxx --period=7001 --compress
 * node export-period.js --task-id=xxx --period=7001 --output=./exports/
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

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

// 显示使用帮助
function showHelp() {
    console.log(`
═══════════════════════════════════════════════════════════
  HIT-大乐透 单期组合数据导出工具
═══════════════════════════════════════════════════════════

使用方法：
  node export-period.js --task-id=<任务ID> --period=<期号> [选项]

必需参数：
  --task-id=<ID>     预测任务ID（例如：预测任务_2025-9-30_16-38-23）
  --period=<期号>    要导出的期号（例如：7001）

可选参数：
  --output=<路径>    输出目录（默认：./exports/）
  --compress         生成ZIP压缩文件
  --batch-size=<N>   每批写入行数（默认：1000）
  --help             显示此帮助信息

示例：
  # 基础导出
  node export-period.js --task-id=预测任务_2025-9-30_16-38-23 --period=7001

  # 导出并压缩
  node export-period.js --task-id=xxx --period=7001 --compress

  # 指定输出目录
  node export-period.js --task-id=xxx --period=7001 --output=D:/exports/

═══════════════════════════════════════════════════════════
`);
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
    let prizeLevel = '-';
    let prizeAmount = 0;

    if (redHitCount === 5 && blueHitCount === 2) {
        prizeLevel = '一等奖';
        prizeAmount = 10000000;
    } else if (redHitCount === 5 && blueHitCount === 1) {
        prizeLevel = '二等奖';
        prizeAmount = 100000;
    } else if (redHitCount === 5 && blueHitCount === 0) {
        prizeLevel = '三等奖';
        prizeAmount = 10000;
    } else if (redHitCount === 4 && blueHitCount === 2) {
        prizeLevel = '四等奖';
        prizeAmount = 3000;
    } else if (redHitCount === 4 && blueHitCount === 1) {
        prizeLevel = '五等奖';
        prizeAmount = 300;
    } else if (redHitCount === 3 && blueHitCount === 2) {
        prizeLevel = '六等奖';
        prizeAmount = 200;
    } else if (redHitCount === 4 && blueHitCount === 0) {
        prizeLevel = '七等奖';
        prizeAmount = 100;
    } else if ((redHitCount === 3 && blueHitCount === 1) || (redHitCount === 2 && blueHitCount === 2)) {
        prizeLevel = '八等奖';
        prizeAmount = 15;
    } else if ((redHitCount === 3 && blueHitCount === 0) ||
               (redHitCount === 1 && blueHitCount === 2) ||
               (redHitCount === 2 && blueHitCount === 1) ||
               (redHitCount === 0 && blueHitCount === 2)) {
        prizeLevel = '九等奖';
        prizeAmount = 5;
    }

    return { prizeLevel, prizeAmount };
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

// 主导出函数
async function exportPeriodData(taskId, period, options = {}) {
    const outputDir = options.output || './exports';
    const batchSize = parseInt(options['batch-size']) || 1000;
    const compress = options.compress || false;

    console.log('\n🚀 开始导出单期组合数据...');
    console.log(`📋 任务ID: ${taskId}`);
    console.log(`📅 期号: ${period}`);
    console.log(`📁 输出目录: ${path.resolve(outputDir)}`);
    console.log(`📦 压缩: ${compress ? '是' : '否'}`);
    console.log('');

    try {
        // 创建输出目录
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log(`✅ 创建输出目录: ${outputDir}`);
        }

        // 1. 查询任务信息
        console.log('⏳ 正在查询任务信息...');
        const task = await PredictionTask.findOne({ task_id: taskId }).lean();
        if (!task) {
            throw new Error(`任务不存在: ${taskId}`);
        }
        console.log(`✅ 找到任务: ${task.task_name}`);

        // 2. 查询该期的结果数据
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
        if (missingData) {
            console.log(`✅ 找到遗漏数据`);
        } else {
            console.log(`⚠️  未找到遗漏数据，热温冷比将显示为"-"`);
        }

        // 6. 查询开奖号码
        console.log('⏳ 正在查询开奖号码...');
        const drawResult = await DLT.findOne({ Issue: parseInt(period) }).lean();
        const winningNumbers = drawResult ? {
            red: [drawResult.Red1, drawResult.Red2, drawResult.Red3, drawResult.Red4, drawResult.Red5],
            blue: [drawResult.Blue1, drawResult.Blue2]
        } : null;
        if (winningNumbers) {
            console.log(`✅ 找到开奖号码: ${winningNumbers.red.map(n => n.toString().padStart(2, '0')).join(' ')} + ${winningNumbers.blue.map(n => n.toString().padStart(2, '0')).join(' ')}`);
        } else {
            console.log(`⚠️  未开奖，命中列将显示为"-"`);
        }

        const totalCombinations = redCombinations.length * blueCombinations.length;
        console.log(`\n📊 总组合数: ${totalCombinations.toLocaleString()} 条`);
        console.log('');

        // 7. 生成CSV文件
        const filename = `预测任务_${task.task_name}_期号_${period}_组合明细.csv`;
        const filepath = path.join(outputDir, filename);
        const tempFilepath = filepath + '.tmp';

        console.log('📝 正在生成CSV文件...');

        const headers = [
            '序号',
            '红球1', '红球2', '红球3', '红球4', '红球5',
            '前区和值', '前区跨度', '区间比', '前区奇偶', '热温冷比',
            '蓝球1', '蓝球2',
            '红球命中', '蓝球命中', '奖项等级', '奖金(元)'
        ];

        const writeStream = fs.createWriteStream(tempFilepath, { encoding: 'utf8' });

        // 写入BOM
        writeStream.write('\ufeff');

        // 写入表头和任务信息
        writeStream.write(headers.join(',') + '\n');
        writeStream.write(`任务名称,${task.task_name}\n`);
        writeStream.write(`期号,${period}\n`);
        writeStream.write(`导出时间,${new Date().toLocaleString('zh-CN')}\n`);
        writeStream.write(`组合总数,${totalCombinations}\n`);
        if (winningNumbers) {
            writeStream.write(`开奖号码,${winningNumbers.red.map(n => n.toString().padStart(2, '0')).join(' ')} + ${winningNumbers.blue.map(n => n.toString().padStart(2, '0')).join(' ')}\n`);
        } else {
            writeStream.write(`开奖号码,未开奖\n`);
        }
        writeStream.write('\n');
        writeStream.write(headers.join(',') + '\n');

        // 生成所有组合数据
        let rowNumber = 1;
        let buffer = '';
        let lastProgress = 0;
        const startTime = Date.now();

        for (let i = 0; i < redCombinations.length; i++) {
            const red = redCombinations[i];
            const redBalls = [red.red_ball_1, red.red_ball_2, red.red_ball_3, red.red_ball_4, red.red_ball_5];
            const hotWarmColdRatio = calculateHotWarmColdRatio(redBalls, missingData);

            for (let j = 0; j < blueCombinations.length; j++) {
                const blue = blueCombinations[j];
                const blueBalls = [blue.blue_ball_1, blue.blue_ball_2];

                let hitRed = '-', hitBlue = '-', prizeLevel = '-', prizeAmount = 0;

                if (winningNumbers) {
                    const redHitCount = redBalls.filter(n => winningNumbers.red.includes(n)).length;
                    const blueHitCount = blueBalls.filter(n => winningNumbers.blue.includes(n)).length;
                    hitRed = `${redHitCount}个`;
                    hitBlue = `${blueHitCount}个`;
                    const prize = calculatePrize(redHitCount, blueHitCount);
                    prizeLevel = prize.prizeLevel;
                    prizeAmount = prize.prizeAmount;
                }

                const row = [
                    rowNumber++,
                    ...redBalls.map(n => n.toString().padStart(2, '0')),
                    red.sum_value || '-',
                    red.span_value || '-',
                    red.zone_ratio || '-',
                    red.odd_even_ratio || '-',
                    hotWarmColdRatio,
                    ...blueBalls.map(n => n.toString().padStart(2, '0')),
                    hitRed,
                    hitBlue,
                    prizeLevel,
                    prizeAmount
                ];

                buffer += row.join(',') + '\n';

                // 每批次写入一次
                if (rowNumber % batchSize === 0) {
                    writeStream.write(buffer);
                    buffer = '';

                    // 显示进度
                    const progress = Math.floor((rowNumber / totalCombinations) * 100);
                    if (progress > lastProgress) {
                        const elapsed = (Date.now() - startTime) / 1000;
                        const speed = rowNumber / elapsed;
                        const remaining = (totalCombinations - rowNumber) / speed;
                        process.stdout.write(`\r⏳ 进度: ${progress}% | 已生成: ${rowNumber.toLocaleString()}/${totalCombinations.toLocaleString()} | 速度: ${Math.floor(speed).toLocaleString()} 行/秒 | 剩余: ${Math.ceil(remaining)}秒  `);
                        lastProgress = progress;
                    }
                }
            }
        }

        // 写入剩余数据
        if (buffer) {
            writeStream.write(buffer);
        }

        writeStream.end();

        // 等待写入完成
        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });

        // 重命名临时文件
        fs.renameSync(tempFilepath, filepath);

        const fileSize = fs.statSync(filepath).size;
        const elapsed = (Date.now() - startTime) / 1000;

        console.log(`\n✅ CSV文件生成完成!`);
        console.log(`📄 文件路径: ${filepath}`);
        console.log(`📊 文件大小: ${formatFileSize(fileSize)}`);
        console.log(`⏱️  耗时: ${elapsed.toFixed(2)} 秒`);
        console.log(`⚡ 平均速度: ${Math.floor(totalCombinations / elapsed).toLocaleString()} 行/秒`);

        // 8. 压缩（可选）
        if (compress) {
            console.log('\n📦 正在压缩文件...');
            const zipFilepath = filepath + '.gz';

            await new Promise((resolve, reject) => {
                const readStream = fs.createReadStream(filepath);
                const writeStream = fs.createWriteStream(zipFilepath);
                const gzip = zlib.createGzip({ level: 6 });

                readStream.pipe(gzip).pipe(writeStream);

                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            const zipSize = fs.statSync(zipFilepath).size;
            const compressRatio = ((1 - zipSize / fileSize) * 100).toFixed(1);

            console.log(`✅ 压缩完成!`);
            console.log(`📄 压缩文件: ${zipFilepath}`);
            console.log(`📊 压缩后大小: ${formatFileSize(zipSize)}`);
            console.log(`📉 压缩率: ${compressRatio}%`);

            // 询问是否删除原文件
            console.log('\n💡 提示: 压缩文件已生成，原CSV文件仍保留');
        }

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

    // 显示帮助
    if (args.help || (!args['task-id'] && !args.period)) {
        showHelp();
        process.exit(0);
    }

    // 验证参数
    if (!args['task-id']) {
        console.error('❌ 错误: 缺少 --task-id 参数');
        console.log('使用 --help 查看使用说明');
        process.exit(1);
    }

    if (!args.period) {
        console.error('❌ 错误: 缺少 --period 参数');
        console.log('使用 --help 查看使用说明');
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
        await exportPeriodData(args['task-id'], args.period, args);

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
    main().catch(error => {
        console.error('❌ 未捕获的错误:', error);
        process.exit(1);
    });
}
