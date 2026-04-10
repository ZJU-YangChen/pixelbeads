
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

        // 行列标号边距
        const LABEL = 20;
        const totalW = LABEL + w * cellSize;
        const totalH = LABEL + h * cellSize;

        const canvas = document.createElement('canvas');
        canvas.width = totalW;
        canvas.height = totalH;
        const ctx = canvas.getContext('2d');

        // 背景
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, totalW, totalH);

        // 标号区背景
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, totalW, LABEL);       // 顶部列标
        ctx.fillRect(0, 0, LABEL, totalH);        // 左侧行标

        // 列字母函数（A-Z, AA-AZ, ...）
        const colLabel = (n) => {
            let label = '';
            let idx = n + 1;
            while (idx > 0) {
                idx--;
                label = String.fromCharCode(65 + (idx % 26)) + label;
                idx = Math.floor(idx / 26);
            }
            return label;
        };

        // 绘制标号文字
        const labelFontSize = Math.max(6, Math.min(10, cellSize - 4));
        ctx.font = `bold ${labelFontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#555555';

        // 列标（顶部）
        for (let x = 0; x < w; x++) {
            ctx.fillText(colLabel(x), LABEL + x * cellSize + cellSize / 2, LABEL / 2);
        }
        // 行标（左侧）
        for (let y = 0; y < h; y++) {
            ctx.fillText(String(y + 1), LABEL / 2, LABEL + y * cellSize + cellSize / 2);
        }

        // 边框线：分隔标号区和内容区
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(LABEL, 0); ctx.lineTo(LABEL, totalH);
        ctx.moveTo(0, LABEL); ctx.lineTo(totalW, LABEL);
        ctx.stroke();

        // Draw cells
        grid.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell.empty) return;

                const px = LABEL + x * cellSize;
                const py = LABEL + y * cellSize;

                // Fill
                ctx.fillStyle = cell.hex;
                ctx.fillRect(px, py, cellSize, cellSize);

                // Grid line
                ctx.strokeStyle = '#cccccc';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(px, py, cellSize, cellSize);

                // Palette index (optional)
                if (opts.showNumbers) {
                    const r = parseInt(cell.hex.substr(1,2),16);
                    const g = parseInt(cell.hex.substr(3,2),16);
                    const b = parseInt(cell.hex.substr(5,2),16);
                    const yiq = ((r*299)+(g*587)+(b*114))/1000;
                    ctx.fillStyle = (yiq >= 128) ? 'rgba(0,0,0,0.75)' : 'rgba(255,255,255,0.9)';
                    ctx.font = `${Math.floor(cellSize/2.5)}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(cell.paletteIndex, px + cellSize/2, py + cellSize/2);
                }
            });
        });

        return canvas;
    }
};
