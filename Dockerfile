# Use Node.js environment
FROM m.daocloud.io/docker.io/library/node:18-alpine

WORKDIR /app

# Copy dependency definitions
COPY package.json ./

# Install dependencies (using taobao registry for speed in China if needed, but daocloud proxied image might have access)
# Using standard npm install
RUN npm install --registry=https://registry.npmmirror.com

# Copy source code
COPY . .

# Expose port (must match server.js)
EXPOSE 3000

# Start server
CMD ["npm", "start"]
