
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
        const width = w * cellSize;
        const height = h * cellSize;
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // Draw cells
        grid.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell.empty) return; // Skip drawing empty cells

                const px = x * cellSize;
                const py = y * cellSize;
                
                // Fill
                ctx.fillStyle = cell.hex;
                ctx.fillRect(px, py, cellSize, cellSize);

                // Grid line
                ctx.strokeStyle = '#ccc';
                ctx.strokeRect(px, py, cellSize, cellSize);

                // Number (optional)
                if (opts.showNumbers) {
                    ctx.fillStyle = '#000'; // Need contrast logic? Simplified for now
                    // Simple contrast check
                    const r = parseInt(cell.hex.substr(1,2),16);
                    const g = parseInt(cell.hex.substr(3,2),16);
                    const b = parseInt(cell.hex.substr(5,2),16);
                    const yiq = ((r*299)+(g*587)+(b*114))/1000;
                    ctx.fillStyle = (yiq >= 128) ? 'black' : 'white';
                    
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
