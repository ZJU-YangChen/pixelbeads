
const StorageService = {
    // 默认 24 色豆子库
    defaultInventory: [
        { id: 1, name: "黑色", hex: "#000000", count: 1000 },
        { id: 2, name: "白色", hex: "#FFFFFF", count: 1000 },
        { id: 3, name: "灰色", hex: "#808080", count: 1000 },
        { id: 4, name: "红色", hex: "#FF0000", count: 1000 },
        { id: 5, name: "橙色", hex: "#FFA500", count: 1000 },
        { id: 6, name: "黄色", hex: "#FFFF00", count: 1000 },
        { id: 7, name: "绿色", hex: "#008000", count: 1000 },
        { id: 8, name: "深蓝", hex: "#0000FF", count: 1000 },
        { id: 9, name: "浅蓝", hex: "#ADD8E6", count: 1000 },
        { id: 10, name: "紫色", hex: "#800080", count: 1000 },
        { id: 11, name: "粉色", hex: "#FFC0CB", count: 1000 },
        { id: 12, name: "棕色", hex: "#A52A2A", count: 1000 },
        { id: 13, name: "肉色", hex: "#FFDAB9", count: 1000 },
        { id: 14, name: "青色", hex: "#00FFFF", count: 1000 },
        { id: 15, name: "洋红", hex: "#FF00FF", count: 1000 },
        { id: 16, name: "深绿", hex: "#006400", count: 1000 },
        { id: 17, name: "米色", hex: "#F5F5DC", count: 1000 },
        { id: 18, name: "天呈蓝", hex: "#87CEEB", count: 1000 },
        { id: 19, name: "薰衣草", hex: "#E6E6FA", count: 1000 },
        { id: 20, name: "金黄", hex: "#FFD700", count: 1000 },
        { id: 21, name: "银色", hex: "#C0C0C0", count: 1000 },
        { id: 22, name: "深红", hex: "#8B0000", count: 1000 },
        { id: 23, name: "巧克力", hex: "#D2691E", count: 1000 },
        { id: 24, name: "半透明", hex: "#F0F8FF", count: 1000 }
    ],

    KEYS: {
        INVENTORY: 'pixelbeads_inventory',
        HISTORY: 'pixelbeads_history'
    },

    init() {
        if (!localStorage.getItem(this.KEYS.INVENTORY)) {
            this.saveInventory(this.defaultInventory);
        }
        if (!localStorage.getItem(this.KEYS.HISTORY)) {
            localStorage.setItem(this.KEYS.HISTORY, JSON.stringify([]));
        }
    },

    getInventory() {
        const data = localStorage.getItem(this.KEYS.INVENTORY);
        return data ? JSON.parse(data) : this.defaultInventory;
    },

    saveInventory(data) {
        localStorage.setItem(this.KEYS.INVENTORY, JSON.stringify(data));
    },

    getHistory() {
        const data = localStorage.getItem(this.KEYS.HISTORY);
        return data ? JSON.parse(data) : [];
    },

    addHistory(record) {
        const history = this.getHistory();
        record.timestamp = new Date().toISOString();
        record.id = Date.now();
        history.unshift(record); // Add to top
        localStorage.setItem(this.KEYS.HISTORY, JSON.stringify(history));
    },

    // 检查库存是否充足
    checkStock(requiredCounts) {
        const inventory = this.getInventory();
        const missing = [];
        const inventoryMap = {}; 
        
        // 建立 hex -> inventory item 映射
        inventory.forEach(item => {
            inventoryMap[item.hex.toUpperCase()] = item;
        });

        requiredCounts.forEach(req => {
            const hex = req.hex.toUpperCase();
            const invItem = inventoryMap[hex];
            
            // 如果这个颜色在库存里找不到（可能是自定义或者匹配算法生成的其他色），暂且允许或者视为0
            // 这里我们假设 palette 已经限制在库存范围内，或者只匹配 HEX
            if (invItem) {
                if (invItem.count < req.count) {
                    missing.push({
                        name: invItem.name,
                        needed: req.count,
                        have: invItem.count,
                        diff: req.count - invItem.count
                    });
                }
            } else {
                // 如果是库存里没有的颜色，无法扣除，视为一种“缺货”
                // 但实际场景中，pixelit 可能生成相近色。
                // 如果用户选择了“使用库存色板”，那么 hex 应该能对应上。
                // 如果没有，这部分逻辑可以暂时忽略，或者提示未知颜色。
            }
        });

        return { valid: missing.length === 0, missing };
    },

    // 扣除库存
    deductStock(requiredCounts) {
        const inventory = this.getInventory();
        const inventoryMap = {}; 
        inventory.forEach((item, idx) => {
            inventoryMap[item.hex.toUpperCase()] = idx; 
        });

        requiredCounts.forEach(req => {
            const hex = req.hex.toUpperCase();
            const idx = inventoryMap[hex];
            if (idx !== undefined) {
                inventory[idx].count = Math.max(0, inventory[idx].count - req.count);
            }
        });

        this.saveInventory(inventory);
        return inventory;
    },

    // 获得用于 PixelIt 的 palette 数组 [[r,g,b], ...]
    getPaletteForPixelIt() {
        const inventory = this.getInventory();
        const result = [];
        inventory.forEach(item => {
            // Hex to RGB
            const r = parseInt(item.hex.slice(1, 3), 16);
            const g = parseInt(item.hex.slice(3, 5), 16);
            const b = parseInt(item.hex.slice(5, 7), 16);
            result.push([r, g, b]);
        });
        return result;
    }
};

// 立即初始化
StorageService.init();
