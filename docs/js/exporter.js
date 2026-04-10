
const Exporter = {
    /**
     * Count colors in the grid
     */
    countColors: (grid) => {
        const counts = {};
        let validPixels = 0;

        // Flatten grid
        grid.forEach(row => {
            row.forEach(cell => {
                if (cell.empty) return; // Skip empty
                
                validPixels++;
                const key = cell.hex;
                if (!counts[key]) {
                    counts[key] = {
                        hex: key,
                        rgb: { r: cell.r, g: cell.g, b: cell.b },
                        paletteIndex: cell.paletteIndex,
                        count: 0,
                        percent: 0,
                        label: `Color ${cell.paletteIndex}`
                    };
                }
                counts[key].count++;
            });
        });

        const result = Object.values(counts).map(c => {
            c.percent = ((c.count / validPixels) * 100).toFixed(2) + "%";
            return c;
        });

        // Sort by count desc
        return result.sort((a, b) => b.count - a.count);
    },

    /**
     * Download content as file
     */
    downloadFile: (content, filename, type = "text/csv;charset=utf-8;") => {
        const blob = new Blob([content], { type: type });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    },

    /**
     * Export Grid as CSV
     */
    exportGridCSV: (grid) => {
        let csvContent = "";
        grid.forEach(row => {
            const rowStr = row.map(cell => cell.empty ? -1 : cell.paletteIndex).join(",");
            csvContent += rowStr + "\n";
        });
        Exporter.downloadFile(csvContent, `pixelbeads_pattern_${new Date().getTime()}.csv`);
    },

    /**
     * Export Color Usage
     */
    exportColorUsageCSV: (counts) => {
        let csvContent = "HEX,PaletteIndex,Count,Percent\n";
        counts.forEach(c => {
            csvContent += `${c.hex},${c.paletteIndex},${c.count},${c.percent}\n`;
        });
        Exporter.downloadFile(csvContent, `pixelbeads_colors_${new Date().getTime()}.csv`);
    },

    /**
     * Generate a canvas with grid lines and numbers for export
     */
    generatePrintableCanvas: (grid, opts = {}) => {
        const cellSize = opts.cellSize || 20;
        const h = grid.length;
        const w = grid[0].length;

        // 与预览画布一致：25px 标注边距，每5格显示一个标号
        const MARGIN = 25;
        const LABEL_INTERVAL = 5;

        const canvas = document.createElement('canvas');
        canvas.width  = MARGIN + w * cellSize;
        canvas.height = MARGIN + h * cellSize;
        const ctx = canvas.getContext('2d');

        // 白色背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // ── 格子填色 ──
        grid.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell.empty) return;
                ctx.fillStyle = cell.hex;
                ctx.fillRect(MARGIN + x * cellSize, MARGIN + y * cellSize, cellSize, cellSize);
            });
        });

        // ── 网格线（与预览一致：每5格加粗）──
        ctx.save();
        ctx.translate(MARGIN, MARGIN);
        ctx.strokeStyle = '#cccccc';

        for (let x = 1; x < w; x++) {
            ctx.lineWidth = (x % LABEL_INTERVAL === 0) ? 1.5 : 0.5;
            ctx.beginPath();
            ctx.moveTo(x * cellSize, 0);
            ctx.lineTo(x * cellSize, h * cellSize);
            ctx.stroke();
        }
        for (let y = 1; y < h; y++) {
            ctx.lineWidth = (y % LABEL_INTERVAL === 0) ? 1.5 : 0.5;
            ctx.beginPath();
            ctx.moveTo(0, y * cellSize);
            ctx.lineTo(w * cellSize, y * cellSize);
            ctx.stroke();
        }
        // 外框
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, w * cellSize, h * cellSize);
        ctx.restore();

        // ── 调色板编号（可选）──
        if (opts.showNumbers) {
            grid.forEach((row, y) => {
                row.forEach((cell, x) => {
                    if (cell.empty) return;
                    const r = parseInt(cell.hex.substr(1,2),16);
                    const g = parseInt(cell.hex.substr(3,2),16);
                    const b = parseInt(cell.hex.substr(5,2),16);
                    const yiq = ((r*299)+(g*587)+(b*114))/1000;
                    ctx.fillStyle = (yiq >= 128) ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.9)';
                    ctx.font = `${Math.floor(cellSize / 2.5)}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(cell.paletteIndex,
                        MARGIN + x * cellSize + cellSize / 2,
                        MARGIN + y * cellSize + cellSize / 2);
                });
            });
        }

        // ── 行列标号（与预览一致：数字，每5格+首格）──
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 列号（顶部）
        for (let x = 0; x < w; x++) {
            const globalX = x + 1;
            if (globalX === 1 || globalX % LABEL_INTERVAL === 0) {
                ctx.fillText(globalX,
                    MARGIN + x * cellSize + cellSize / 2,
                    MARGIN / 2);
            }
        }
        // 行号（左侧）
        for (let y = 0; y < h; y++) {
            const globalY = y + 1;
            if (globalY === 1 || globalY % LABEL_INTERVAL === 0) {
                ctx.fillText(globalY,
                    MARGIN / 2,
                    MARGIN + y * cellSize + cellSize / 2);
            }
        }

        return canvas;
    },

    /**
     * Generate 1080x1080 personality card canvas (MBTI style)
     * @param {string} pixelImageBase64 - pixel art data URL
     * @param {{code:string, name:string, emoji:string, tagline:string, grad:string[]}} personality
     * @param {string} comment - AI generated personalized comment
     * @param {{beadCount:number, colorCount:number}} stats
     * @returns {Promise<HTMLCanvasElement>}
     */
    generatePersonalityCard: async (pixelImageBase64, personality, comment, stats) => {
        const W = 1080, H = 1080;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');

        const rr = (x, y, w, h, r) => {
            r = Math.min(r, w / 2, h / 2);
            ctx.beginPath();
            ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
            ctx.arcTo(x + w, y, x + w, y + r, r);
            ctx.lineTo(x + w, y + h - r);
            ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
            ctx.lineTo(x + r, y + h);
            ctx.arcTo(x, y + h, x, y + h - r, r);
            ctx.lineTo(x, y + r);
            ctx.arcTo(x, y, x + r, y, r);
            ctx.closePath();
        };

        await document.fonts.ready;

        const grad1 = personality.grad?.[0] || '#7a9e98';
        const grad2 = personality.grad?.[1] || '#5d8880';

        // ── 背景（浅米色） ──
        ctx.fillStyle = '#f5f2ee';
        ctx.fillRect(0, 0, W, H);

        // 顶部彩色条带
        const TOP_H = 360;
        const topGrad = ctx.createLinearGradient(0, 0, W, TOP_H);
        topGrad.addColorStop(0, grad1);
        topGrad.addColorStop(1, grad2);
        ctx.fillStyle = topGrad;
        ctx.fillRect(0, 0, W, TOP_H);

        // 顶部点阵装饰
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        for (let x = 30; x < W; x += 38) {
            for (let y = 20; y < TOP_H; y += 38) {
                ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
            }
        }

        // ── Emoji ──
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '80px serif';
        ctx.fillText(personality.emoji || '🟦', W / 2, 80);

        // ── 人格代码 ──
        ctx.font = 'bold 120px "Bebas Neue", "Arial Black", Impact, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fillText(personality.code || 'PIXEL', W / 2, 215);

        // ── 中文名称 ──
        ctx.font = 'bold 38px "Noto Sans SC", "Microsoft YaHei", sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.fillText(personality.name || '标准像素人', W / 2, 300);

        // ── 圆弧衔接（顶部底边→白色） ──
        ctx.fillStyle = '#f5f2ee';
        ctx.beginPath();
        ctx.ellipse(W / 2, TOP_H + 30, W / 2 + 20, 50, 0, 0, Math.PI);
        ctx.fill();

        // ── 像素图（正方形，居中，悬浮在分界处） ──
        const PIX_SIZE = 300;
        const PIX_X = (W - PIX_SIZE) / 2;
        const PIX_Y = TOP_H - 10;

        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.15)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 10;
        ctx.fillStyle = '#ffffff';
        rr(PIX_X - 16, PIX_Y - 16, PIX_SIZE + 32, PIX_SIZE + 32, 16);
        ctx.fill();
        ctx.restore();

        const pixelImg = new Image();
        pixelImg.src = pixelImageBase64;
        await new Promise(r => { pixelImg.onload = r; pixelImg.onerror = r; });
        ctx.save();
        rr(PIX_X, PIX_Y, PIX_SIZE, PIX_SIZE, 8);
        ctx.clip();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(pixelImg, PIX_X, PIX_Y, PIX_SIZE, PIX_SIZE);
        ctx.restore();

        // ── 标语 ──
        const TAG_Y = PIX_Y + PIX_SIZE + 52;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.font = 'bold 26px "Noto Sans SC", "Microsoft YaHei", sans-serif';
        ctx.fillStyle = grad1;
        ctx.fillText(personality.tagline || '', W / 2, TAG_Y);

        // ── AI 解读（换行，每行≤20字） ──
        ctx.fillStyle = '#6b6560';
        ctx.font = '24px "Noto Sans SC", "Microsoft YaHei", sans-serif';
        const MAX_LINE = 20;
        const COM_Y = TAG_Y + 50;
        if (comment.length <= MAX_LINE) {
            ctx.fillText(comment, W / 2, COM_Y);
        } else {
            ctx.fillText(comment.slice(0, MAX_LINE), W / 2, COM_Y);
            ctx.fillText(comment.slice(MAX_LINE), W / 2, COM_Y + 36);
        }

        // ── 分隔线 ──
        const DIV_Y = COM_Y + 80;
        ctx.strokeStyle = 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(W * 0.12, DIV_Y); ctx.lineTo(W * 0.88, DIV_Y);
        ctx.stroke();

        // ── 数据行 ──
        const STAT_Y = DIV_Y + 62;
        const statItems = [
            { label: '豆子总量', value: (stats.beadCount || 0).toLocaleString() },
            { label: '颜色种数', value: String(stats.colorCount || 0) },
            { label: '人格代码', value: personality.code || 'PIXEL' }
        ];
        const SW = W / 3;
        statItems.forEach((item, i) => {
            const x = SW * i + SW / 2;
            ctx.fillStyle = (i % 2 === 0) ? grad1 : grad2;
            ctx.font = 'bold 42px "Bebas Neue", "Arial Black", Impact, sans-serif';
            ctx.fillText(item.value, x, STAT_Y);
            ctx.fillStyle = '#999';
            ctx.font = '20px "Noto Sans SC", "Microsoft YaHei", sans-serif';
            ctx.fillText(item.label, x, STAT_Y + 34);
        });

        // ── 品牌 ──
        ctx.fillStyle = '#bbb';
        ctx.font = '20px "Noto Sans SC", "Microsoft YaHei", sans-serif';
        ctx.fillText('PixelBeads 拼豆助手', W / 2, H - 36);

        return canvas;
    }
};
