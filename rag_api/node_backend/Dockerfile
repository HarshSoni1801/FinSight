FROM node:20-slim

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json .
RUN npm install

# Copy source code
COPY . .

# Create uploads folder
RUN mkdir -p uploads

EXPOSE 3000

CMD ["node", "src/index.js"]