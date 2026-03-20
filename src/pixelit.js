
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
            this.gridResponse = {
                width: gridWidth,
                height: gridHeight,
                palette: this.formatPaletteForResponse(),
                grid: grid,
                metadata: {
                    scale: this.scale,
                    sourceFilename: this.from.src ? this.from.src.split('/').pop() : 'image',
                    date: new Date().toISOString()
                }
            };
        }

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
