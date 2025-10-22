/**
 * 大乐透走势图统计面板功能
 * 显示号码出现次数、平均遗漏、最大遗漏、最大连出等统计信息
 */

/**
 * 计算号码统计数据
 * @param {Array} data - 走势图数据
 * @returns {Object} 统计数据对象
 */
function calculateDLTNumberStatistics(data) {
    const stats = {
        appearance: {},      // 出现次数
        totalMissing: {},    // 总遗漏值（用于计算平均）
        maxMissing: {},      // 最大遗漏
        maxConsecutive: {},  // 最大连出
        currentConsecutive: {} // 当前连出（用于计算最大连出）
    };

    // 初始化所有号码的统计
    for (let i = 1; i <= 35; i++) {
        const key = `front_${i}`;
        stats.appearance[key] = 0;
        stats.totalMissing[key] = 0;
        stats.maxMissing[key] = 0;
        stats.maxConsecutive[key] = 0;
        stats.currentConsecutive[key] = 0;
    }
    for (let i = 1; i <= 12; i++) {
        const key = `back_${i}`;
        stats.appearance[key] = 0;
        stats.totalMissing[key] = 0;
        stats.maxMissing[key] = 0;
        stats.maxConsecutive[key] = 0;
        stats.currentConsecutive[key] = 0;
    }

    // 遍历数据计算统计（从旧到新）
    if (data && data.length > 0) {
        data.forEach(item => {
            const frontBalls = item.frontZone || item.redBalls || [];
            const backBalls = item.backZone || item.blueBalls || [];

            // 处理前区号码
            for (let i = 1; i <= 35; i++) {
                const key = `front_${i}`;
                const ball = frontBalls.find(b => b.number === i);

                if (ball) {
                    if (ball.isDrawn) {
                        // 号码出现
                        stats.appearance[key]++;
                        stats.currentConsecutive[key]++;
                        if (stats.currentConsecutive[key] > stats.maxConsecutive[key]) {
                            stats.maxConsecutive[key] = stats.currentConsecutive[key];
                        }
                    } else {
                        // 号码未出现
                        stats.totalMissing[key] += ball.missing;
                        if (ball.missing > stats.maxMissing[key]) {
                            stats.maxMissing[key] = ball.missing;
                        }
                        stats.currentConsecutive[key] = 0;
                    }
                }
            }

            // 处理后区号码
            for (let i = 1; i <= 12; i++) {
                const key = `back_${i}`;
                const ball = backBalls.find(b => b.number === i);

                if (ball) {
                    if (ball.isDrawn) {
                        stats.appearance[key]++;
                        stats.currentConsecutive[key]++;
                        if (stats.currentConsecutive[key] > stats.maxConsecutive[key]) {
                            stats.maxConsecutive[key] = stats.currentConsecutive[key];
                        }
                    } else {
                        stats.totalMissing[key] += ball.missing;
                        if (ball.missing > stats.maxMissing[key]) {
                            stats.maxMissing[key] = ball.missing;
                        }
                        stats.currentConsecutive[key] = 0;
                    }
                }
            }
        });
    }

    // 计算平均遗漏
    const avgMissing = {};
    const totalPeriods = data.length;
    Object.keys(stats.appearance).forEach(key => {
        const appearance = stats.appearance[key];
        const totalMissingPeriods = totalPeriods - appearance;  // 总遗漏期数

        if (appearance > 0) {
            // 平均遗漏 = 总遗漏期数 / (出现次数 + 1)，向上取整
            avgMissing[key] = Math.ceil(totalMissingPeriods / (appearance + 1));
        } else {
            // 如果一次都没开出，平均遗漏就是总期数
            avgMissing[key] = totalPeriods;
        }
    });

    return {
        appearance: stats.appearance,
        avgMissing,
        maxMissing: stats.maxMissing,
        maxConsecutive: stats.maxConsecutive
    };
}

/**
 * 更新统计面板
 * @param {Array} data - 走势图数据
 */
function updateDLTStatisticsPanel(data) {
    console.log('更新统计面板，数据条数:', data?.length);
    const stats = calculateDLTNumberStatistics(data);
    const totalPeriods = data?.length || 0;

    // 调试：检查平均遗漏数据
    console.log('平均遗漏数据keys数量:', Object.keys(stats.avgMissing).length);
    console.log('平均遗漏前3个:', Object.entries(stats.avgMissing).slice(0, 3));

    // 更新出现次数行
    updateStatisticsRow('appearanceRow', stats.appearance, 'appearance', totalPeriods, stats.appearance);

    // 更新平均遗漏行
    updateStatisticsRow('avgMissingRow', stats.avgMissing, 'avgMissing', totalPeriods, stats.avgMissing);

    // 更新最大遗漏行
    updateStatisticsRow('maxMissingRow', stats.maxMissing, 'maxMissing', totalPeriods, stats.maxMissing);

    // 更新最大连出行
    updateStatisticsRow('maxConsecutiveRow', stats.maxConsecutive, 'maxConsecutive', totalPeriods, stats.maxConsecutive);
}

/**
 * 更新统计行数据
 * @param {string} rowId - 行ID
 * @param {Object} data - 统计数据
 * @param {string} type - 统计类型
 * @param {number} totalPeriods - 总期数
 * @param {Object} allData - 完整的统计数据对象
 */
function updateStatisticsRow(rowId, data, type, totalPeriods, allData) {
    const row = document.getElementById(rowId);
    if (!row) {
        console.warn(`统计行未找到: ${rowId}`);
        return;
    }

    // 方案1：更精确的选择器，只选择当前行的直接子元素 td.stat-cell
    const cells = Array.from(row.children).filter(cell => cell.classList.contains('stat-cell'));

    // 调试：检查单元格数量和父元素
    if (type === 'avgMissing') {
        console.log(`${rowId} 单元格数量:`, cells.length);
        console.log(`前3个单元格的父元素ID:`, cells[0]?.parentElement?.id, cells[1]?.parentElement?.id, cells[2]?.parentElement?.id);
        console.log(`所有单元格都属于 ${rowId}:`, cells.every(c => c.parentElement.id === rowId));
    }

    let cellIndex = 0;

    // 收集前区所有号码的值
    const frontValues = [];
    for (let i = 1; i <= 35; i++) {
        frontValues.push(allData[`front_${i}`] || 0);
    }

    // 收集后区所有号码的值
    const backValues = [];
    for (let i = 1; i <= 12; i++) {
        backValues.push(allData[`back_${i}`] || 0);
    }

    // 前区35个号码
    for (let i = 1; i <= 35; i++) {
        const key = `front_${i}`;
        const value = data[key];
        const displayValue = (value !== undefined && !isNaN(value)) ? value : '-';
        if (cells[cellIndex]) {
            // 调试：记录第7个单元格的赋值
            if (type === 'avgMissing' && cellIndex === 6) {
                console.log(`准备给第7个单元格(cellIndex=${cellIndex})赋值: ${displayValue}, key=${key}, value=${value}`);
            }
            // 方案3：先清空再赋值，防止堆叠
            cells[cellIndex].innerHTML = '';
            cells[cellIndex].textContent = displayValue;
            cells[cellIndex].className = `stat-cell ${getStatisticsCellClass(value, type, totalPeriods, 'front', frontValues)}`;

            if (type === 'avgMissing' && cellIndex === 6) {
                console.log(`第7个单元格赋值后内容:`, cells[cellIndex].textContent);
            }
        }
        cellIndex++;
    }

    if (type === 'avgMissing') {
        console.log(`前区处理完毕，cellIndex=${cellIndex}，准备处理后区`);
    }

    // 后区12个号码
    for (let i = 1; i <= 12; i++) {
        const key = `back_${i}`;
        const value = data[key];
        const displayValue = (value !== undefined && !isNaN(value)) ? value : '-';
        if (cells[cellIndex]) {
            // 方案3：先清空再赋值，防止堆叠
            cells[cellIndex].innerHTML = '';
            cells[cellIndex].textContent = displayValue;
            let className = `stat-cell ${getStatisticsCellClass(value, type, totalPeriods, 'back', backValues)}`;
            if (i === 1) {
                className += ' blue-section-start';
            }
            cells[cellIndex].className = className;
        } else {
            if (type === 'avgMissing') {
                console.warn(`后区${i}号，cellIndex=${cellIndex}，单元格不存在！`);
            }
        }
        cellIndex++;
    }

    if (type === 'avgMissing') {
        console.log(`后区处理完毕，最终cellIndex=${cellIndex}`);
    }
}

/**
 * 获取统计单元格样式类
 * @param {number} value - 统计值
 * @param {string} type - 统计类型
 * @param {number} totalPeriods - 总期数
 * @param {string} zone - 区域（'front' 或 'back'）
 * @param {Array} allValues - 该区域所有号码的值数组
 * @returns {string} CSS类名
 */
function getStatisticsCellClass(value, type, totalPeriods, zone, allValues) {
    if (type === 'appearance') {
        // 出现次数：基于排名显示颜色
        const sortedValues = [...allValues].sort((a, b) => b - a); // 从大到小排序
        const minValue = Math.min(...allValues); // 最小值

        if (zone === 'front') {
            // 前区：前8名绿色，最少的第1名红色
            const topThreshold = sortedValues[7]; // 第8名的值

            if (value >= topThreshold && value > 0) return 'high-frequency';
            if (value === minValue) return 'low-frequency';
        } else {
            // 后区：前3名绿色，最少的第1名红色
            const topThreshold = sortedValues[2]; // 第3名的值

            if (value >= topThreshold && value > 0) return 'high-frequency';
            if (value === minValue) return 'low-frequency';
        }
    } else if (type === 'avgMissing') {
        // 平均遗漏：遗漏小的热号绿色，遗漏大的冷号红色
        const sortedValues = [...allValues].sort((a, b) => a - b); // 从小到大排序
        const maxValue = Math.max(...allValues); // 最大值

        if (zone === 'front') {
            // 前区：遗漏最小的前8名绿色，遗漏最大的第1名红色
            const topThreshold = sortedValues[7]; // 第8名的值

            if (value <= topThreshold && value >= 0) return 'hot-number';
            if (value === maxValue) return 'cold-number';
        } else {
            // 后区：遗漏最小的前3名绿色，遗漏最大的第1名红色
            const topThreshold = sortedValues[2]; // 第3名的值

            if (value <= topThreshold && value >= 0) return 'hot-number';
            if (value === maxValue) return 'cold-number';
        }
    } else if (type === 'maxMissing') {
        // 最大遗漏：遗漏小的稳定号绿色，遗漏大的极冷号红色
        const sortedValues = [...allValues].sort((a, b) => a - b); // 从小到大排序
        const maxValue = Math.max(...allValues); // 最大值

        if (zone === 'front') {
            // 前区：遗漏最小的前8名绿色，遗漏最大的第1名红色
            const topThreshold = sortedValues[7]; // 第8名的值

            if (value <= topThreshold && value >= 0) return 'high-frequency';
            if (value === maxValue) return 'very-cold';
        } else {
            // 后区：遗漏最小的前3名绿色，遗漏最大的第1名红色
            const topThreshold = sortedValues[2]; // 第3名的值

            if (value <= topThreshold && value >= 0) return 'high-frequency';
            if (value === maxValue) return 'very-cold';
        }
    } else if (type === 'maxConsecutive') {
        // 最大连出：只有最大值显示绿色
        const maxValue = Math.max(...allValues);

        if (value === maxValue && value > 0) return 'high-consecutive';
    }
    return '';
}
