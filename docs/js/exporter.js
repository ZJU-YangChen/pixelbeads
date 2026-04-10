
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
    }
};
