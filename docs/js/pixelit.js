
class pixelit {
    constructor(config = {}) {
        this.drawbydefault = config.drawbydefault || false;
        this.scale = config.scale && config.scale > 0 ? config.scale : 8;
        this.palette = config.palette || [
            [255, 255, 255],
            [0, 0, 0],
            // Basic rainbow
            [255, 0, 0], [255, 127, 0], [255, 255, 0], [0, 255, 0],
            [0, 0, 255], [75, 0, 130], [148, 0, 211]
        ];
        this.maxHeight = config.maxHeight;
        this.maxWidth = config.maxWidth;
        this.from = config.from || document.getElementById("pixelitimg");
        this.to = config.to || document.getElementById("pixelitcanvas");
        this.ctx = this.to.getContext("2d");
        this.gridResponse = null;

        // Label configs
        this.drawLabels = false;
        this.labelInterval = 5;
        this.startOffsetX = 0;
        this.startOffsetY = 0;
        this.margin = 25; // Margin for external labels
    }

    /**
     * @param {HTMLElement} elem 
     */
    setDrawFrom(elem) {
        this.from = elem;
        return this;
    }

    /**
     * @param {HTMLElement} elem 
     */
    setDrawTo(elem) {
        this.to = elem;
        this.ctx = this.to.getContext("2d");
        return this;
    }

    /**
     * @param {string} src 
     */
    setFromImgSource(src) {
        this.from.src = src;
        return this;
    }

    /**
     * @param {Array} arr [[r,g,b],...]
     */
    setPalette(arr) {
        this.palette = arr;
        return this;
    }

    setMaxWidth(width) {
        this.maxWidth = width;
        return this;
    }

    setMaxHeight(height) {
        this.maxHeight = height;
        return this;
    }

    setScale(scale) {
        this.scale = scale && scale > 0 ? scale : 1;
        return this;
    }

    getPalette() {
        return this.palette;
    }

    /**
     * Draw the original image to the canvas, handling resizing
     */
    draw() {
        // Calculate dimensions
        this.to.width = this.from.naturalWidth;
        this.to.height = this.from.naturalHeight;

        // Resize if needed
        let w = this.to.width;
        let h = this.to.height;

        if (this.maxWidth && w > this.maxWidth) {
            h = (h * this.maxWidth) / w;
            w = this.maxWidth;
        }
        if (this.maxHeight && h > this.maxHeight) {
            w = (w * this.maxHeight) / h;
            h = this.maxHeight;
        }

        this.to.width = w;
        this.to.height = h;

        // Draw original
        this.ctx.drawImage(this.from, 0, 0, this.to.width, this.to.height);
        return this;
    }

    /**
     * Draw a predefined grid directly to the canvas
     * @param {Array} grid - 2D Array of pixel objects {r,g,b,empty}
     */
    drawGrid(grid) {
        if (!grid || !grid.length) return;
        
        const h = grid.length;
        const w = grid[0].length;

        // NEW: Margin Logic
        const margin = this.drawLabels ? this.margin : 0;
        
        // Resize canvas to match grid * scale + margin
        this.to.width = (w * this.scale) + margin;
        this.to.height = (h * this.scale) + margin;
        
        this.ctx.clearRect(0, 0, this.to.width, this.to.height);

        // Fill background white if labels (for print/view)
        if (this.drawLabels) {
            this.ctx.fillStyle = "white";
            this.ctx.fillRect(0, 0, this.to.width, this.to.height);
        }
        
        // 1. Draw Pixels
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const cell = grid[y][x];
                if (cell && !cell.empty) {
                    this.ctx.fillStyle = `rgb(${cell.r}, ${cell.g}, ${cell.b})`;
                    // Offset by margin
                    this.ctx.fillRect(margin + x * this.scale, margin + y * this.scale, this.scale, this.scale);
                }
            }
        }
        
        this.gridResponse = grid;
        this.drawGridLines(w, h); // Draw grid lines by default
    }

    /**
     * Draw grid lines over the pixels
     * Adaptive color: Using 'difference' mode to ensure visibility (White on Dark, Black on Light)
     */
    drawGridLines(cols, rows) {
        const ctx = this.ctx;
        const scale = this.scale;
        const margin = this.drawLabels ? this.margin : 0;
        
        ctx.save();
        ctx.translate(margin, margin); // Shift origin for grid lines

        ctx.globalCompositeOperation = 'difference';
        ctx.strokeStyle = 'white'; // Difference with white inverts the color
        
        // Vertical lines
        for (let x = 1; x < cols; x++) {
            ctx.beginPath();
            ctx.lineWidth = (x % 5 === 0) ? 2 : 0.5; // Thicker every 5
            ctx.moveTo(x * scale, 0);
            ctx.lineTo(x * scale, rows * scale);
            ctx.stroke();
        }

        // Horizontal lines
        for (let y = 1; y < rows; y++) {
            ctx.beginPath();
            ctx.lineWidth = (y % 5 === 0) ? 2 : 0.5; // Thicker every 5
            ctx.moveTo(0, y * scale);
            ctx.lineTo(cols * scale, y * scale);
            ctx.stroke();
        }

        // Border around pixels
        ctx.strokeRect(0, 0, cols * scale, rows * scale);

        ctx.restore(); // Undo translate

        // Labels
        if (this.drawLabels) {
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = "black";
            ctx.font = "bold 10px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            // No shadow needed as it is on white margin
            ctx.shadowBlur = 0;
            
            // Top numbers
            for (let x = 0; x < cols; x++) {
                const globalX = x + this.startOffsetX + 1;
                // For interval 5: show 1, 5, 10, 15...
                const show = (this.labelInterval === 1) ? true : (globalX % this.labelInterval === 0 || globalX === 1);
                
                if (show) {
                    // x position: margin + cell_offset + half_cell
                    const px = margin + (x * scale) + (scale / 2);
                    const py = margin / 2; // Center in top margin
                    ctx.fillText(globalX, px, py);
                }
            }
            
            // Left numbers
            for (let y = 0; y < rows; y++) {
                const globalY = y + this.startOffsetY + 1;
                const show = (this.labelInterval === 1) ? true : (globalY % this.labelInterval === 0 || globalY === 1);
                
                if (show) {
                    const px = margin / 2; // Center in left margin
                    const py = margin + (y * scale) + (scale / 2);
                    ctx.fillText(globalY, px, py);
                }
            }
        }
    }

    /**
     * Highlight a specific color
     * @param {Object} targetColor {r,g,b} or null to reset
     */
    highlightColor(targetColor) {
        if (!this.gridResponse) return;
        
        // Re-draw normal grid first
        // We can't just call drawGrid because it resets everything.
        // We need to draw dimmed overlay on everything EXCEPT targetColor
        
        // 1. Clear and Redraw Base
        this.drawGrid(this.gridResponse);
        
        if (!targetColor) return;
        
        const ctx = this.ctx;
        const h = this.gridResponse.length;
        const w = this.gridResponse[0].length;
        const scale = this.scale;
        
        ctx.save();
        // Dimming layer
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'; // Whitewash non-selected
        
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const cell = this.gridResponse[y][x];
                if (!cell || cell.empty) continue;
                
                // Compare colors
                if (cell.r !== targetColor.r || cell.g !== targetColor.g || cell.b !== targetColor.b) {
                    // Dim this pixel
                    ctx.fillRect(x * scale, y * scale, scale, scale);
                } else {
                    // Highlight logic? 
                    // Since others are dimmed, this one stands out. 
                    // Maybe add a border?
                    ctx.strokeStyle = 'red';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x * scale, y * scale, scale, scale);
                }
            }
        }
        ctx.restore();
        
        // Re-draw grid lines on top to keep context
        this.drawGridLines(w, h);
    }

    /**
     * Update a single pixel
     */
    updatePixel(x, y, color) {
        if (!this.gridResponse || y >= this.gridResponse.length || x >= this.gridResponse[0].length) return;
        
        this.gridResponse[y][x] = color;
        // Redraw full grid (simplest way to ensure layers)
        this.drawGrid(this.gridResponse);
    }

    /**
     * Core pixelation logic
     * @param {Object} opts 
     */
    pixelate(opts = {}) {
        this.draw(); // Ensure we start with fresh image on canvas

        const w = this.to.width;
        const h = this.to.height;
        const ctx = this.ctx;

        // Get image data
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        // Prepare grid response
        const gridWidth = Math.ceil(w / this.scale);
        const gridHeight = Math.ceil(h / this.scale);
        
        let grid = []; // 2D array
        const returnGrid = opts.returnGrid || false;

        // Temporary canvas logic could be used for cleaner code, but we'll modify buffer directly or draw rects
        // To strictly follow "blocks", we iterate grid cells
        
        for (let y = 0; y < gridHeight; y++) {
            let row = [];
            for (let x = 0; x < gridWidth; x++) {
                // Determine block boundaries
                const posX = x * this.scale;
                const posY = y * this.scale;
                
                // Sample color from the center of the block (simple approach) or average
                const centerX = Math.min(Math.floor(posX + this.scale / 2), w - 1);
                const centerY = Math.min(Math.floor(posY + this.scale / 2), h - 1);
                
                const pixelIndex = (centerY * w + centerX) * 4;
                
                let r = data[pixelIndex];
                let g = data[pixelIndex + 1];
                let b = data[pixelIndex + 2];
                let a = data[pixelIndex + 3];

                // --- Transparency Check ---
                // If alpha is low, consider it empty/background
                if (a < 128) {
                    row.push({ empty: true });
                    // Clear the rect on canvas to show transparency
                    ctx.clearRect(posX, posY, this.scale, this.scale); 
                    continue; 
                }

                // Map to palette if provided
                let mappedColor = this.mapToPalette(r, g, b);
                
                // Store in grid
                row.push({
                    empty: false,
                    paletteIndex: mappedColor.index,
                    hex: mappedColor.hex,
                    r: mappedColor.r,
                    g: mappedColor.g,
                    b: mappedColor.b
                });

                // Draw Rect on Canvas
                ctx.fillStyle = mappedColor.rgbString;
                ctx.fillRect(posX, posY, this.scale, this.scale);
            }
            grid.push(row);
        }

        if (returnGrid) {
            this.gridResponse = grid; 
        }

        this.drawGridLines(gridWidth, gridHeight);

        return this;
    }

    getGrid() {
        return this.gridResponse;
    }

    /**
     * Helper to find nearest color
     */
    mapToPalette(r, g, b) {
        if (!this.palette || this.palette.length === 0) {
            return {
                r, g, b, 
                hex: this.rgbToHex(r, g, b), 
                rgbString: `rgb(${r},${g},${b})`,
                index: -1
            };
        }

        let minDistance = Infinity;
        let nearestIndex = 0;

        for (let i = 0; i < this.palette.length; i++) {
            const pr = this.palette[i][0];
            const pg = this.palette[i][1];
            const pb = this.palette[i][2];

            // Simple Euclidean distance
            const dist = Math.sqrt(
                Math.pow(r - pr, 2) + 
                Math.pow(g - pg, 2) + 
                Math.pow(b - pb, 2)
            );

            if (dist < minDistance) {
                minDistance = dist;
                nearestIndex = i;
            }
        }

        const bestColor = this.palette[nearestIndex];
        return {
            index: nearestIndex,
            r: bestColor[0],
            g: bestColor[1],
            b: bestColor[2],
            hex: this.rgbToHex(bestColor[0], bestColor[1], bestColor[2]),
            rgbString: `rgb(${bestColor[0]},${bestColor[1]},${bestColor[2]})`
        };
    }

    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }
    
    // Convert current palette to object structure for response
    formatPaletteForResponse() {
        return this.palette.map(c => ({
            r: c[0], g: c[1], b: c[2],
            hex: this.rgbToHex(c[0], c[1], c[2])
        }));
    }
}
