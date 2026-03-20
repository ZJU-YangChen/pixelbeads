# PixelBeads Setup Skill

This skill helps you set up and run the PixelBeads development environment.

## 🛠️ Prerequisites
- Node.js (v14+)
- MySQL Server (v8.0+)

## 🚀 Quick Start
1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Database Setup**:
   - Ensure MySQL is running.
   - Create a database named `pixelbeads` (or let the server create it).
   - Import the schema if not using auto-migration:
     ```bash
     mysql -u root -p pixelbeads < schema.sql
     ```

3. **Configuration**:
   - Create a `.env` file (optional, or set env vars):
     ```
     DB_HOST=localhost
     DB_USER=root
     DB_PASSWORD=yourpassword
     DB_NAME=pixelbeads
     ```

4. **Run Server**:
   ```bash
   npm start
   ```
   Server runs at `http://localhost:3000`.

## 🐛 Troubleshooting
- **Connection Refused**: Check if MySQL service is running (`net start mysql` on Windows).
- **Module Not Found**: Run `npm install` again.
- **Port In Use**: Check if port 3000 is occupied.

## 📋 Verification
- Visit `http://localhost:3000` to see the frontend.
- Check console logs for "Database ensured".
