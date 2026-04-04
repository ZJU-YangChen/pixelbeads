
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
    exportGridCSV: (grid, hexToBeadId = {}) => {
        let csvContent = "";
        grid.forEach(row => {
            const rowStr = row.map(cell => {
                if (cell.empty) return -1;
                const beadId = hexToBeadId[cell.hex.toUpperCase()];
                return beadId !== undefined ? beadId : cell.paletteIndex;
            }).join(",");
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
     * Generate a canvas with grid lines, rulers and numbers for export
     */
    generatePrintableCanvas: (grid, opts = {}) => {
        const cellSize = opts.cellSize || 20;
        const hexToBeadId = opts.hexToBeadId || {};
        const h = grid.length;
        const w = grid[0].length;

        // Ruler at top and left
        const rulerSize = Math.max(16, cellSize);
        const labelInterval = 5;
        const totalWidth  = rulerSize + w * cellSize;
        const totalHeight = rulerSize + h * cellSize;

        const canvas = document.createElement('canvas');
        canvas.width  = totalWidth;
        canvas.height = totalHeight;
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, totalWidth, totalHeight);

        // Ruler style
        const rulerFont = `${Math.max(8, Math.floor(rulerSize * 0.52))}px Arial`;
        ctx.fillStyle = '#888';
        ctx.font = rulerFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Column numbers (top ruler, every labelInterval, always show 1st)
        for (let x = 0; x < w; x++) {
            if (x === 0 || (x + 1) % labelInterval === 0) {
                ctx.fillText(x + 1, rulerSize + x * cellSize + cellSize / 2, rulerSize / 2);
            }
        }

        // Row numbers (left ruler, every labelInterval, always show 1st)
        for (let y = 0; y < h; y++) {
            if (y === 0 || (y + 1) % labelInterval === 0) {
                ctx.fillText(y + 1, rulerSize / 2, rulerSize + y * cellSize + cellSize / 2);
            }
        }

        // Draw cells
        grid.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell.empty) return;

                const px = rulerSize + x * cellSize;
                const py = rulerSize + y * cellSize;

                // Fill
                ctx.fillStyle = cell.hex;
                ctx.fillRect(px, py, cellSize, cellSize);

                // Grid line
                ctx.strokeStyle = '#ccc';
                ctx.strokeRect(px, py, cellSize, cellSize);

                // Number label (optional)
                if (opts.showNumbers) {
                    const beadId = hexToBeadId[cell.hex.toUpperCase()];
                    const label  = beadId !== undefined ? beadId : cell.paletteIndex;

                    const r   = parseInt(cell.hex.substr(1, 2), 16);
                    const g   = parseInt(cell.hex.substr(3, 2), 16);
                    const b   = parseInt(cell.hex.substr(5, 2), 16);
                    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
                    ctx.fillStyle = (yiq >= 128) ? 'black' : 'white';

                    ctx.font = `${Math.floor(cellSize / 2.5)}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(label, px + cellSize / 2, py + cellSize / 2);
                }
            });
        });

        return canvas;
    }
};
