
const API_BASE = ''; // Same origin

// Generate High Fidelity Default Colors
const generateDefaultInventory = () => {
    const list = [];
    const steps = [0, 51, 102, 153, 204, 255];
    let id = 1;

    const toHex = (n) => {
        const hex = n.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    // 1. RGB Logic
    for (let r of steps) {
        for (let g of steps) {
            for (let b of steps) {
                const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
                list.push({ id: id++, name: hex, hex, count: 1000 });
            }
        }
    }
    // 2. Grays
    for (let i = 0; i < 256; i += 16) {
        const hex = `#${toHex(i)}${toHex(i)}${toHex(i)}`.toUpperCase();
        list.push({ id: id++, name: `Gray-${i}`, hex, count: 1000 });
    }
    return list;
};

const StorageService = {
    currentUser: null,
    inventory: [],
    history: [],
    
    // Default Inventory
    defaultInventory: generateDefaultInventory(),

    // --- Auth ---
    async login(username, password) {
        try {
            const res = await fetch(`${API_BASE}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            
            this.currentUser = data;
            await this.loadData();
            return data;
        } catch (e) {
            throw e;
        }
    },

    async register(username, password) {
        try {
            const res = await fetch(`${API_BASE}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            // Auto login after register
            return this.login(username, password);
        } catch (e) {
            throw e;
        }
    },

    logout() {
        this.currentUser = null;
        this.inventory = [];
        this.history = [];
        // Reload page to show login
        window.location.reload();
    },

    isLoggedIn() {
        return !!this.currentUser;
    },

    getCurrentUser() {
        return this.currentUser ? this.currentUser.username : null;
    },

    // --- Data ---
    async loadData() {
        if (!this.currentUser) return;
        try {
            // Load Inventory
            const invRes = await fetch(`${API_BASE}/api/inventory/${this.currentUser.id}`);
            const invData = await invRes.json();
            
            if (invData.length > 0) {
                // Sort by Count ascending (Less stock first)
                this.inventory = invData.sort((a, b) => a.count - b.count);
            } else {
                this.inventory = JSON.parse(JSON.stringify(this.defaultInventory));
            }

            // Load History
            const histRes = await fetch(`${API_BASE}/api/history/${this.currentUser.id}`);
            this.history = await histRes.json();
            
            // Parse details if string
            this.history.forEach(h => {
                if (typeof h.details === 'string') {
                    try { h.details = JSON.parse(h.details); } catch(e) {}
                }
            });
            
        } catch (e) {
            console.error("Failed to load data", e);
            alert("数据加载失败，请检查网络");
        }
    },

    // Sync Synchronous interfaces for main.js compatibility
    getInventory() {
        return this.inventory;
    },

    saveInventory(inv) {
        this.inventory = inv;
        // Async update
        if (this.currentUser) {
            fetch(`${API_BASE}/api/inventory/${this.currentUser.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(inv)
            }).catch(e => console.error("Save failed", e));
        }
    },

    checkStock(requiredCounts) {
        const missing = [];
        const invMap = {};
        this.inventory.forEach(i => invMap[i.hex.toUpperCase()] = i);

        for (const req of requiredCounts) {
            const hex = req.hex.toUpperCase();
            const item = invMap[hex];
            // If item doesn't exist in inventory, treat as stock 0 or ignore?
            // Assuming strict check:
            if (!item || item.count < req.count) {
                missing.push({
                    hex: req.hex,
                    name: item ? item.name : 'Unknown',
                    needed: req.count,
                    have: item ? item.count : 0
                });
            }
        }
        return { valid: missing.length === 0, missing };
    },

    deductStock(requiredCounts) {
        const invMap = {};
        this.inventory.forEach(i => invMap[i.hex.toUpperCase()] = i);

        requiredCounts.forEach(req => {
            const item = invMap[req.hex.toUpperCase()];
            if (item) {
                item.count = Math.max(0, item.count - req.count);
            }
        });
        this.saveInventory(this.inventory);
    },

    getHistory() {
        return this.history;
    },

    addHistory(record) {
        record.timestamp = new Date().toISOString();
        this.history.unshift(record);
        if (this.currentUser) {
            fetch(`${API_BASE}/api/history/${this.currentUser.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(record)
            }).catch(e => console.error("Save history failed", e));
        }
    },

    async deleteHistory(historyId) {
        if (!this.currentUser) return;
        
        const record = this.history.find(h => h.id === historyId);
        if (!record) return;

        // 1. Restore Stock (if details exist)
        if (record.details && Array.isArray(record.details)) {
            const invMap = {};
            this.inventory.forEach(i => invMap[i.hex.toUpperCase()] = i);
            
            record.details.forEach(d => {
                const item = invMap[d.hex.toUpperCase()];
                if (item) {
                     item.count += d.count;
                }
            });
            this.saveInventory(this.inventory); // Sync restored stock
        }

        // 2. Delete Remote
        try {
            await fetch(`${API_BASE}/api/history/${historyId}`, { method: 'DELETE' });
            this.history = this.history.filter(h => h.id !== historyId);
        } catch (e) {
            console.error("Delete failed", e);
            alert("删除失败");
        }
    },

    checkDuplicateHistory(newRecord) {
        // Use loose check for imgSrc length or similar because base64 strings might be massive and identical
        // Checking title + beadCount + colorsUsed + first 100 chars of image + timestamp diff?
        // Actually, just title name is "拼豆作品 + time". If user clicks twice fast, time might differ by second?
        // Let's rely on beadCount and colorsUsed matching existing record EXACTLY
        // combined with a timestamp check (within last 1 minute?)
        // Or check if exact same image data exists.
        
        return this.history.some(h => 
            h.beadCount === newRecord.beadCount && 
            h.colorsUsed === newRecord.colorsUsed && 
            // Check if details match length if present
            (newRecord.details && h.details ? JSON.stringify(newRecord.details) === JSON.stringify(h.details) : true) &&
            // Check if Image matches (CPU expensive but accurate)
            (h.imgSrc === newRecord.imgSrc || h.img_src === newRecord.imgSrc)
        );
    },

    getPaletteForPixelIt() {
        // Return array of [r,g,b] arrays, NOT objects
        return this.getInventory().map(item => {
            const rgb = this.hexToRgb(item.hex);
            return rgb ? [rgb.r, rgb.g, rgb.b] : [0,0,0];
        });
    },

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }
};
