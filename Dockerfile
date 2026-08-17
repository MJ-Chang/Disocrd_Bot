# Coolify / Docker 部署用 Dockerfile
FROM node:22-slim

# 音樂功能需要 ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先複製依賴清單以利用 Docker 快取
COPY package.json package-lock.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# 複製原始碼
COPY . .

# 控制面板連接埠（需在 Coolify 中公開）
EXPOSE 3000

# data 目錄（掛載持久化磁碟可選，建議掛載保留客服轉錄檔）
VOLUME ["/app/data"]

CMD ["node", "src/index.js"]
