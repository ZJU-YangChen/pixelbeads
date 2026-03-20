# Pixel Algorithm Skill

This skill provides expertise modifying the core pixelation logic in `docs/js/pixelit.js`.

## 🎨 Core Logic Overview
The `pixelit` class handles:
1. **Image Loading**: From `<img>` source.
2. **Resizing**: Downscaling to `maxWidth`/`maxHeight` (creating the "pixel" effect).
3. **Palette Mapping**: Matching each pixel to the nearest color in the defined palette.
4. **Drawing**: Rendering to the canvas.

## 🛠️ Common Modifications

### 1. Adding New Colors
Modify the `this.palette` array in the `constructor`:
```javascript
this.palette = [
    [255, 255, 255], // White
    [0, 0, 0],       // Black
    // Add new color [R, G, B]
    [255, 87, 51]    // Example Orange
];
```

### 2. Adjusting Pixel Size
The "pixel" size is determined by the image resolution relative to the canvas.
- **Smaller Blocks**: Increase `maxWidth`/`maxHeight`.
- **Larger Blocks**: Decrease `maxWidth`/`maxHeight`.

### 3. Color Matching Logic
Currently uses simple RGB distance.
- **Idea**: To improve accuracy, implement Lab color space distance.
- **Location**: Look for the `colorSim` or equivalent function (if implemented) or the loop iterating over `imgData`.

## 🧪 Testing
- Refresh `docs/index.html` after changes.
- Use distinct bright colors to debug palette mapping.
