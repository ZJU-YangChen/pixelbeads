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
    
    // Validate username (letters only for consistency with previous discussion)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ error: 'Invalid username format' });
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
        await db.query(
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
        res.json({ success: true });
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

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
