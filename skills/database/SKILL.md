# Database Schema Skill

This skill assists with managing the MySQL database schema for PixelBeads.

## 🗄️ Schema Overview
File: `schema.sql`

### Core Tables
- **`history`**: Stores user projects/generated patterns.
  - `id`: PK
  - `details`: JSON column for storing grid data/palette used.
  - `created_at`: Timestamp.

## 🔄 Migration Workflow
When modifying the database structure:
1. **Edit `schema.sql`**: Add the new `CREATE TABLE` or `ALTER TABLE` statement.
2. **Migration Script**: If the database already has data, create a migration check in `server.js` (inside `initDb` function).
   - *Example Pattern*:
     ```javascript
     try {
         await db.query("ALTER TABLE history ADD COLUMN new_col VARCHAR(255)");
     } catch (e) { /* Ignore if exists */ }
     ```

## 📝 Common Queries
- **Get Recent Projects**:
  ```sql
  SELECT * FROM history ORDER BY created_at DESC LIMIT 10;
  ```
- **Reset Data**:
  ```sql
  TRUNCATE TABLE history;
  ```
