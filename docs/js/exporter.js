
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
     * Generate 1080x1080 personality card canvas
     * @param {string} pixelImageBase64 - pixel art data URL
     * @param {{personality:string, title:string, comment:string}} aiResult
     * @param {{beadCount:number, colorCount:number, dominantColor:string}} stats
     * @returns {Promise<HTMLCanvasElement>}
     */
    generatePersonalityCard: async (pixelImageBase64, aiResult, stats) => {
        const SIZE = 1080;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');

        // Polyfill roundRect for older browsers
        const roundRect = (c, x, y, w, h, r) => {
            r = Math.min(r, w / 2, h / 2);
            c.beginPath();
            c.moveTo(x + r, y);
            c.lineTo(x + w - r, y);
            c.arcTo(x + w, y, x + w, y + r, r);
            c.lineTo(x + w, y + h - r);
            c.arcTo(x + w, y + h, x + w - r, y + h, r);
            c.lineTo(x + r, y + h);
            c.arcTo(x, y + h, x, y + h - r, r);
            c.lineTo(x, y + r);
            c.arcTo(x, y, x + r, y, r);
            c.closePath();
        };

        // Wait for fonts
        await document.fonts.ready;

        // --- Background: deep dark gradient ---
        const bgGrad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
        bgGrad.addColorStop(0, '#1a1a2e');
        bgGrad.addColorStop(0.5, '#16213e');
        bgGrad.addColorStop(1, '#0f3460');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, SIZE, SIZE);

        // --- Dot grid decoration ---
        ctx.fillStyle = 'rgba(255,255,255,0.045)';
        const DOT_SPACING = 40;
        for (let x = DOT_SPACING; x < SIZE; x += DOT_SPACING) {
            for (let y = DOT_SPACING; y < SIZE; y += DOT_SPACING) {
                ctx.beginPath();
                ctx.arc(x, y, 2.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // --- Dominant color glow at top ---
        const domColor = stats.dominantColor || '#7ac8c0';
        const glowGrad = ctx.createRadialGradient(SIZE / 2, 0, 0, SIZE / 2, 0, SIZE * 0.6);
        glowGrad.addColorStop(0, domColor + '44');
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, 0, SIZE, SIZE);

        // --- Polaroid frame ---
        const CARD_W = 430;
        const CARD_H = 430;
        const CARD_X = (SIZE - CARD_W) / 2;
        const CARD_Y = 65;

        // Shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 48;
        ctx.shadowOffsetY = 12;
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        roundRect(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, 14);
        ctx.fill();
        ctx.restore();

        // White frame fill (clean, no shadow)
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, 14);
        ctx.fill();

        // Pixel art inside polaroid
        const IMG_PAD = 14;
        const IMG_BOTTOM = 68; // space at bottom for polaroid label
        const IMG_W = CARD_W - IMG_PAD * 2;
        const IMG_H = CARD_H - IMG_PAD - IMG_BOTTOM;
        const IMG_X = CARD_X + IMG_PAD;
        const IMG_Y = CARD_Y + IMG_PAD;

        const pixelImg = new Image();
        pixelImg.src = pixelImageBase64;
        await new Promise(resolve => {
            pixelImg.onload = resolve;
            pixelImg.onerror = resolve;
        });

        ctx.save();
        roundRect(ctx, IMG_X, IMG_Y, IMG_W, IMG_H, 6);
        ctx.clip();
        ctx.imageSmoothingEnabled = false; // keep pixels crisp
        ctx.drawImage(pixelImg, IMG_X, IMG_Y, IMG_W, IMG_H);
        ctx.restore();

        // Polaroid label area
        ctx.fillStyle = '#555';
        ctx.font = 'bold 20px "Noto Sans SC", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('我的拼豆作品', CARD_X + CARD_W / 2, CARD_Y + CARD_H - 32);

        // --- Personality code (Bebas Neue, big) ---
        const PERS_Y = CARD_Y + CARD_H + 90;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';

        const textGrad = ctx.createLinearGradient(SIZE * 0.2, 0, SIZE * 0.8, 0);
        textGrad.addColorStop(0, '#7ac8c0');
        textGrad.addColorStop(1, '#e8a5a0');
        ctx.fillStyle = textGrad;
        ctx.font = 'bold 108px "Bebas Neue", "Arial Black", Impact, sans-serif';
        ctx.fillText(aiResult.personality || 'PIXEL', SIZE / 2, PERS_Y);

        // --- Title ---
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = 'bold 30px "Noto Sans SC", "Microsoft YaHei", sans-serif';
        ctx.fillText(aiResult.title || '拼豆爱好者', SIZE / 2, PERS_Y + 56);

        // --- Comment (word wrap at 22 chars) ---
        ctx.fillStyle = 'rgba(255,255,255,0.60)';
        ctx.font = '22px "Noto Sans SC", "Microsoft YaHei", sans-serif';
        const comment = aiResult.comment || '';
        const MAX_COMMENT_LINE = 22;
        if (comment.length <= MAX_COMMENT_LINE) {
            ctx.fillText(comment, SIZE / 2, PERS_Y + 106);
        } else {
            ctx.fillText(comment.slice(0, MAX_COMMENT_LINE), SIZE / 2, PERS_Y + 102);
            ctx.fillText(comment.slice(MAX_COMMENT_LINE), SIZE / 2, PERS_Y + 132);
        }

        // --- Divider line ---
        const DIV_Y = PERS_Y + 168;
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(SIZE * 0.15, DIV_Y);
        ctx.lineTo(SIZE * 0.85, DIV_Y);
        ctx.stroke();

        // --- Stats row ---
        const STATS_Y = DIV_Y + 60;
        const statItems = [
            { label: '拼豆总量', value: (stats.beadCount || 0).toLocaleString() },
            { label: '颜色种数', value: String(stats.colorCount || 0) },
            { label: '像素感值', value: '100%' }
        ];
        const statW = SIZE / 3;
        ctx.textBaseline = 'alphabetic';
        statItems.forEach((item, i) => {
            const x = statW * i + statW / 2;
            ctx.fillStyle = domColor;
            ctx.font = 'bold 38px "Bebas Neue", "Arial Black", Impact, sans-serif';
            ctx.fillText(item.value, x, STATS_Y);
            ctx.fillStyle = 'rgba(255,255,255,0.40)';
            ctx.font = '18px "Noto Sans SC", "Microsoft YaHei", sans-serif';
            ctx.fillText(item.label, x, STATS_Y + 30);
        });

        // --- Branding ---
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.font = '18px "Noto Sans SC", "Microsoft YaHei", sans-serif';
        ctx.fillText('PixelBeads 拼豆助手', SIZE / 2, SIZE - 38);

        return canvas;
    }
};
