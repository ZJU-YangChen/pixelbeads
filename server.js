const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const fs = require('fs');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Allow large images

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'docs')));

// Init DB
const ensureDatabaseExists = async () => {
    const config = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'password',
        port: process.env.DB_PORT || 3306
    };
    try {
        const conn = await mysql.createConnection(config);
        const dbName = process.env.DB_NAME || 'pixelbeads';
        await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        await conn.end();
        console.log(`Database '${dbName}' ensured.`);
    } catch (err) {
        console.error('Initial DB Check Error:', err.message);
    }
};

const initDb = async () => {
    await ensureDatabaseExists();
    try {
        const schema = fs.readFileSync('./schema.sql', 'utf8');
        const statements = schema.split(';').filter(s => s.trim());
        for (const sql of statements) {
            await db.query(sql);
        }

        // 2. Migration: Ensure 'details' column exists in history table
        try {
            await db.query("ALTER TABLE history ADD COLUMN details JSON");
            console.log("Migrated: Added 'details' column to history table.");
        } catch (err) {
            // Ignore error 1060 (Duplicate column name) means already exists
            // MySQL error for duplicate column is usually 1060 or 42S21
            if (err.code !== 'ER_DUP_FIELDNAME' && err.errno !== 1060) {
                 // Succeeded or failed elsewhere, just log it softly
                console.log("Migration check (details column):", err.code);
            }
        }

        console.log('Database initialized');
    } catch (err) {
        console.error('Database init error:', err);
    }
};
initDb();

// --- Auth APIs ---

// Register
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ error: '用户名只能包含英文字母、数字和下划线' });
    }
    if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: '用户名长度须在 3-20 位之间' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: '密码至少需要 6 位' });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO users (username, password_hash) VALUES (?, ?)',
            [username, password] // In real app, hash password here!
        );
        res.json({ id: result.insertId, username });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'Username taken' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await db.query(
            'SELECT * FROM users WHERE username = ? AND password_hash = ?',
            [username, password]
        );
        if (rows.length > 0) {
            const user = rows[0];
            res.json({ id: user.id, username: user.username, avatar: user.avatar });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Profile (Avatar)
app.post('/api/user/profile', async (req, res) => {
    const { userId, avatar } = req.body;
    try {
        await db.query('UPDATE users SET avatar = ? WHERE id = ?', [avatar, userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// --- Inventory APIs ---

app.get('/api/inventory/:userId', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM inventory WHERE user_id = ?', [req.params.userId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/inventory/:userId', async (req, res) => {
    const userId = req.params.userId;
    const items = req.body; // Expecting array of items
    
    if (!Array.isArray(items)) return res.status(400).json({ error: 'Expected array' });

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        
        // Full replace strategy for simplicity or Upsert
        // Let's use Upsert (ON DUPLICATE KEY UPDATE)
        for (const item of items) {
            await connection.query(
                `INSERT INTO inventory (user_id, bead_id, name, hex, count)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE count = VALUES(count), name = VALUES(name), hex = VALUES(hex)`,
                [userId, item.id, item.name, item.hex, item.count]
            );
        }
        // Handle deletions? Current logic is user manages list locally. 
        // If user deleted an item locally, it won't be sent here if we only send updates.
        // For sync, usually we wipe and rewrite or send diffs.
        // To support deletion, we might need a "delete" endpoint or user sends FULL list and we delete others.
        // For now, let's assume we are saving the full list state.
        
        // Delete items not in the payload
        const currentIds = items.map(i => i.id);
        if (currentIds.length > 0) {
            await connection.query(
                `DELETE FROM inventory WHERE user_id = ? AND bead_id NOT IN (?)`,
                [userId, currentIds]
            );
        }

        await connection.commit();
        res.json({ success: true });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: err.message });
    } finally {
        connection.release();
    }
});

// --- History APIs ---

app.get('/api/history/:userId', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM history WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50', [req.params.userId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/history/:userId', async (req, res) => {
    const userId = req.params.userId;
    const record = req.body;
    try {
        const [result] = await db.query(
            'INSERT INTO history (user_id, title, img_src, bead_count, colors_used, details, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
                userId, 
                record.title, 
                record.imgSrc, 
                record.beadCount, 
                record.colorsUsed, 
                JSON.stringify(record.details || []), 
                new Date(record.timestamp || Date.now())
            ]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/history/:id', async (req, res) => {
    try {
        await db.query('DELETE FROM history WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- AI 调色 ---

const STYLE_PROMPTS = {
    simple: {
        name: '极简拼豆',
        prompt: `优化目标：减少颜色种类至8-12种，降低制作难度。
处理策略（按优先级）：
① 处理孤立噪点：颜色与周围像素格格不入的孤立点，归并到周围主色
② 合并低频色：使用比例低于总像素1.5%的颜色，合并到色差最小的主色中
③ 参考原始照片确认哪些颜色是图案核心，优先保留这些颜色
不要改动超过35%的颜色种类，保留图案整体视觉结构。`
    },
    standard: {
        name: '标准图纸',
        prompt: `优化目标：局部修正为主，轻度整理颜色，目标12-16种。
处理策略（按优先级）：
① 处理孤立噪点：孤立的单像素异色点归并到周围主色
② 平滑边缘过渡：两色块交界处若颜色跳跃过大，替换为色板中更接近的中间色
③ 合并色差小于10的极相近重复色
参考原始照片保持图案主要色彩结构不变，不要做整体色调的改变。`
    },
    detailed: {
        name: '细腻还原',
        prompt: `优化目标：最小改动，只修正最明显的局部问题，最大程度保留原始效果。
处理策略（按优先级）：
① 只处理最明显的孤立噪点（周围4格颜色均不同的单像素）
② 只合并色差小于6的几乎相同颜色（纯去重复）
参考原始照片验证修改方向。宁可不改也不改错，边缘过渡保留像素画固有风格。`
    },
    cartoon: {
        name: '卡通硬边',
        prompt: `优化目标：强化卡通平涂效果，每个视觉区域颜色统一，目标8-12种。
处理策略（按优先级）：
① 参考原始照片识别主要色彩区域（背景/主体/轮廓等）
② 消除每个色块内部的渐变过渡色，统一为该区域主色
③ 过渡区像素归并到色差更小的一侧主色，强调硬边分区
保留清晰的轮廓线颜色，不要将轮廓色合并到背景色。`
    },
    gradient: {
        name: '柔和渐变',
        prompt: `优化目标：修正生硬的颜色跳跃，使过渡更自然，不减少颜色总数。
处理策略（按优先级）：
① 参考原始照片识别明暗渐变区域和过渡方向
② 检查两色块交界的边缘像素，若色差过大，替换为色板中更接近的中间过渡色
③ 处理色块内部的孤立异色噪点
重在让已有颜色的分布更合理，相邻像素色差更平滑，不做大范围颜色替换。`
    }
};

const BASE_SYSTEM_PROMPT = `你是专业的拼豆图纸像素修正师。拼豆（Perler Beads）是用彩色塑料珠在网格板上拼出图案的手工艺品。

我会提供两张图：第一张是原始照片（用于理解图案的色彩意图），第二张是像素化处理后的图纸（需要修正的对象）。

核心原则：
1. 以原始照片为参考，理解图案真实的颜色分布和结构
2. 对像素图进行最小化修改，不要做整体色调替换
3. 重点修正局部问题：孤立噪点像素、边缘过渡生硬处
4. 绝对禁止引入色板中不存在的新颜色，目标色必须是已有色板中的hex值
5. 如果某颜色不需要改变，不要将其写入输出

输出格式：严格的JSON对象，key为原hex（含#，全大写），value为目标hex（含#，全大写）。
不要输出任何解释，不要使用markdown代码块，直接输出JSON。
示例：{"#A1B2C3": "#C5A882"}`;

app.post('/api/ai/colorize', async (req, res) => {
    const apiKey = process.env.QWEN_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'QWEN_API_KEY 未配置，请在环境变量中设置' });

    const { imageBase64, originalImageBase64, colors, style } = req.body;
    if (!imageBase64 || !colors || !style) {
        return res.status(400).json({ error: '缺少必要参数: imageBase64, colors, style' });
    }

    const styleConfig = STYLE_PROMPTS[style];
    if (!styleConfig) return res.status(400).json({ error: `未知风格: ${style}` });

    const systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n当前优化风格：【${styleConfig.name}】\n${styleConfig.prompt}`;
    const colorList = colors.map(c => `${c.hex}(${c.count}px)`).join(', ');
    const userText = `第一张图是原始照片，第二张图是像素化处理后的图纸。\n当前色板共 ${colors.length} 种颜色：${colorList}\n\n请按照【${styleConfig.name}】风格修正像素图的配色，返回颜色替换JSON。`;

    // 构建图片内容：原图（若有）+ 像素图
    const imageContent = [];
    if (originalImageBase64) {
        imageContent.push({ type: 'image_url', image_url: { url: originalImageBase64 } });
    }
    imageContent.push({ type: 'image_url', image_url: { url: imageBase64 } });
    imageContent.push({ type: 'text', text: userText });

    try {
        const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'qwen-vl-plus',
                messages: [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: imageContent
                    }
                ],
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            return res.status(502).json({ error: `Qwen API 错误 (${response.status}): ${errText}` });
        }

        const data = await response.json();
        const rawText = (data.choices?.[0]?.message?.content || '').trim();

        // 提取 JSON，兼容 Qwen 偶尔包裹 markdown 代码块的情况
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return res.status(502).json({ error: 'AI返回格式异常，无法解析', raw: rawText.slice(0, 200) });
        }

        const replacements = JSON.parse(jsonMatch[0]);

        // 安全校验：确保 value 都在原始色板中（防止 AI 生成幻觉颜色）
        const validHexSet = new Set(colors.map(c => c.hex.toUpperCase()));
        const safeReplacements = {};
        for (const [from, to] of Object.entries(replacements)) {
            const toUpper = to.toUpperCase();
            if (validHexSet.has(toUpper)) {
                safeReplacements[from.toUpperCase()] = toUpper;
            }
        }

        res.json({ replacements: safeReplacements });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 色卡识别 ---

app.post('/api/ai/extract-colorcard', async (req, res) => {
    const apiKey = process.env.QWEN_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'QWEN_API_KEY 未配置' });

    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: '缺少 imageBase64' });

    const prompt = `这是一张拼豆品牌色卡图片，每个颜色方块旁印有编号（如 A12、B3、001 等）。
请识别图片中每个独立颜色方块，提取其编号和颜色值。
只输出纯 JSON，不要任何解释，不要 markdown 代码块：
{"colors":[{"id":"A12","hex":"#AABBCC"},{"id":"B3","hex":"#DDEEFF"},...]}`;

    try {
        const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'qwen-vl-plus',
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'image_url', image_url: { url: imageBase64 } },
                        { type: 'text', text: prompt }
                    ]
                }],
                max_tokens: 3000
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            return res.status(502).json({ error: `Qwen API 错误 (${response.status}): ${errText}` });
        }

        const data = await response.json();
        const rawText = (data.choices?.[0]?.message?.content || '').trim();

        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return res.status(502).json({ error: 'AI 返回格式异常，无法解析', raw: rawText.slice(0, 200) });
        }

        const parsed = JSON.parse(jsonMatch[0]);
        // 过滤非法 hex 格式，避免脏数据进库存
        const colors = (parsed.colors || []).filter(c =>
            c && typeof c.hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c.hex)
        ).map(c => ({ id: String(c.id || c.hex), hex: c.hex.toUpperCase() }));

        res.json({ colors });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- 拼豆人格鉴定 ---

app.post('/api/ai/personality', async (req, res) => {
    const apiKey = process.env.QWEN_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'QWEN_API_KEY 未配置' });

    const { typeCode, typeName, tagline, beadCount, colorCount } = req.body;
    if (!typeCode) return res.status(400).json({ error: '缺少 typeCode' });

    const prompt = `你是拼豆人格测评师，用户的拼豆人格已被鉴定为【${typeName}】（代码：${typeCode}）。
人格标签：${tagline}
用户数据：共用了 ${beadCount} 颗豆子，${colorCount} 种颜色。

请用15-25个中文字写一句极具个性的人格解读，要求：
- 幽默有梗，要有网络感，稍微有点损但亲切
- 必须包含豆子数量或颜色数量等具体数字
- 直接输出一句话，不加引号，不加解释`;

    try {
        const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'qwen-turbo',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 120
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            return res.status(502).json({ error: `Qwen API 错误 (${response.status}): ${errText}` });
        }

        const data = await response.json();
        let comment = (data.choices?.[0]?.message?.content || '').trim();
        // Strip quotes if AI added them
        comment = comment.replace(/^["'"'「」]|["'"'「」]$/g, '').trim().slice(0, 60);
        if (!comment) comment = `用${colorCount}种颜色拼了${beadCount}颗豆，你的认真程度令人敬畏。`;

        res.json({ comment });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Events API ---

app.post('/api/events', async (req, res) => {
    const { event, userId, properties } = req.body;
    if (!event) return res.status(400).json({ error: 'Missing event name' });
    try {
        await db.query(
            'INSERT INTO events (user_id, event_name, properties) VALUES (?, ?, ?)',
            [userId || null, event, JSON.stringify(properties || {})]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Admin Stats ---

// --- Feedback ---

app.post('/api/feedback', async (req, res) => {
    const { user_id, content } = req.body;
    if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: '反馈内容不能为空' });
    }
    if (content.trim().length > 100) {
        return res.status(400).json({ error: '反馈内容不能超过100字' });
    }
    try {
        await db.query('INSERT INTO feedback (user_id, content) VALUES (?, ?)', [user_id || null, content.trim()]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Admin Stats ---

const ADMIN_PWD = process.env.ADMIN_PWD || 'yangchen1215';

app.get('/api/admin/stats', async (req, res) => {
    if (req.query.pwd !== ADMIN_PWD) {
        return res.status(401).json({ error: '密码错误' });
    }
    try {
        const [[{ total_users }]] = await db.query('SELECT COUNT(*) as total_users FROM users');
        const [[{ today_users }]] = await db.query('SELECT COUNT(*) as today_users FROM users WHERE DATE(created_at) = CURDATE()');
        const [[{ week_users }]] = await db.query("SELECT COUNT(*) as week_users FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)");

        const [eventCounts] = await db.query(
            'SELECT event_name, COUNT(*) as count FROM events GROUP BY event_name ORDER BY count DESC'
        );

        const [dailyEvents] = await db.query(
            `SELECT DATE(created_at) as date, COUNT(*) as count FROM events
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
             GROUP BY DATE(created_at) ORDER BY date`
        );

        const [dailyUsers] = await db.query(
            `SELECT DATE(created_at) as date, COUNT(*) as count FROM users
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
             GROUP BY DATE(created_at) ORDER BY date`
        );

        const [feedbackList] = await db.query(
            `SELECT f.id, f.content, f.created_at, u.username
             FROM feedback f LEFT JOIN users u ON f.user_id = u.id
             ORDER BY f.created_at DESC LIMIT 50`
        );

        res.json({
            users: { total: total_users, today: today_users, week: week_users },
            events: Object.fromEntries(eventCounts.map(r => [r.event_name, Number(r.count)])),
            daily_events: dailyEvents,
            daily_users: dailyUsers,
            feedback: feedbackList
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
