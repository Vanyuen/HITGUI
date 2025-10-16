// 测试相克排除bug修复
const mongoose = require('mongoose');

// 连接数据库
mongoose.connect('mongodb://localhost:27017/lottery', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const DLTRedCombinations = mongoose.model('DLTRedCombinations', new mongoose.Schema({}, { collection: 'hit_dlt_redcombinations', strict: false }));

async function testExclusionBugFix() {
  try {
    console.log('🧪 开始测试相克排除bug修复...\n');

    const targetIssue = '25083';
    const redNumber = 5;          // 每个组合有5个红球
    const excludeNumber = 2;      // 允许最多2个红球被排除
    const redMvPercentLow = 1;    // 遗漏值下限百分位
    const redMvPercentHigh = 50;   // 遗漏值上限百分位
    const maxCount = 10;           // 最多返回10个组合

    // 1. 获取遗漏数据
    console.log(`1️⃣ 获取期号 ${targetIssue} 的红球遗漏数据...`);
    const mvDoc = await mongoose.connection.db.collection('hit_dlt_redballmissing_histories').findOne({ Issue: targetIssue });

    if (!mvDoc) {
      console.log(`❌ 找不到期号 ${targetIssue} 的遗漏数据`);
      process.exit(1);
    }

    // 将遗漏数据从对象转换为数组 (1-35号球)
    const mvArray = [];
    for (let i = 1; i <= 35; i++) {
      mvArray.push(mvDoc[i.toString()] || 0);
    }
    console.log(`✅ 遗漏数据: [${mvArray.slice(0, 10).join(', ')}...]`);

    // 2. 计算遗漏百分位
    const sortedMv = [...mvArray].sort((a, b) => a - b);
    const lowIndex = Math.floor(sortedMv.length * redMvPercentLow / 100);
    const highIndex = Math.ceil(sortedMv.length * redMvPercentHigh / 100) - 1;
    const minMv = sortedMv[lowIndex];
    const maxMv = sortedMv[highIndex];

    console.log(`\n2️⃣ 遗漏值筛选范围: [${minMv}, ${maxMv}] (百分位 ${redMvPercentLow}% - ${redMvPercentHigh}%)`);

    // 3. 获取符合遗漏条件的红球
    const candidateBalls = mvArray
      .map((mv, idx) => ({ ball: idx + 1, mv }))
      .filter(item => item.mv >= minMv && item.mv <= maxMv)
      .map(item => item.ball);

    console.log(`✅ 候选红球 (${candidateBalls.length}个): [${candidateBalls.slice(0, 20).join(', ')}${candidateBalls.length > 20 ? '...' : ''}]`);

    // 4. 从RedCombinations中筛选红球组合
    console.log(`\n3️⃣ 从RedCombinations筛选符合条件的组合...`);
    console.log(`   条件: 红球数=${redNumber}, 排除数<=${excludeNumber}`);
    console.log(`   逻辑: 至少需要 ${redNumber - excludeNumber} 个球在候选范围内`);

    const combos = await DLTRedCombinations.aggregate([
      {
        $addFields: {
          redBalls: ['$red_ball_1', '$red_ball_2', '$red_ball_3', '$red_ball_4', '$red_ball_5'],
        }
      },
      {
        $addFields: {
          matchingBalls: {
            $size: {
              $setIntersection: ['$redBalls', candidateBalls]
            }
          },
          excludedBalls: {
            $size: {
              $setDifference: ['$redBalls', candidateBalls]
            }
          }
        }
      },
      {
        $match: {
          matchingBalls: { $gte: redNumber - excludeNumber },  // 关键修复: 至少要有 (redNumber - excludeNumber) 个球在候选范围内
          excludedBalls: { $lte: excludeNumber }                // 排除的球数不超过 excludeNumber
        }
      },
      { $limit: maxCount },
      {
        $project: {
          redBalls: 1,
          matchingBalls: 1,
          excludedBalls: 1,
          _id: 0
        }
      }
    ]).exec();

    console.log(`\n✅ 找到 ${combos.length} 个符合条件的红球组合:`);
    combos.forEach((combo, idx) => {
      const matching = combo.redBalls.filter(b => candidateBalls.includes(b));
      const excluded = combo.redBalls.filter(b => !candidateBalls.includes(b));
      console.log(`   ${idx + 1}. 红球: [${combo.redBalls.join(', ')}]`);
      console.log(`      - 匹配球数: ${combo.matchingBalls}, 球号: [${matching.join(', ')}]`);
      console.log(`      - 排除球数: ${combo.excludedBalls}, 球号: [${excluded.join(', ')}]`);
    });

    // 5. 验证逻辑
    console.log(`\n4️⃣ 验证修复逻辑:`);
    let allValid = true;
    combos.forEach((combo, idx) => {
      const isValid = combo.excludedBalls <= excludeNumber;
      const status = isValid ? '✅' : '❌';
      console.log(`   ${status} 组合 ${idx + 1}: 排除球数=${combo.excludedBalls} ${isValid ? '<=' : '>'} ${excludeNumber}`);
      if (!isValid) allValid = false;
    });

    if (allValid) {
      console.log(`\n🎉 测试通过! 所有组合的排除球数都不超过 ${excludeNumber}`);
    } else {
      console.log(`\n❌ 测试失败! 存在排除球数超过 ${excludeNumber} 的组合`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 测试出错:', error);
    process.exit(1);
  }
}

// 等待数据库连接
mongoose.connection.once('open', () => {
  console.log('✅ 已连接到MongoDB数据库\n');
  testExclusionBugFix();
});

mongoose.connection.on('error', (err) => {
  console.error('❌ 数据库连接错误:', err);
  process.exit(1);
});
