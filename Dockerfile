# 第一阶段：构建阶段
FROM node:20-alpine as builder

# 安装构建依赖
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

WORKDIR /app

# 设置 npm 镜像源
RUN npm config set registry https://registry.npmmirror.com/

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制源码
COPY . .

# 构建项目
RUN npm run build

# 第二阶段：运行阶段（直接使用 Node.js）
FROM node:20-alpine

# 安装 serve 包来运行静态文件
RUN npm install -g serve

WORKDIR /app

# 从构建阶段复制产物
COPY --from=builder /app/dist ./dist

# 复制配置文件
COPY public/config ./config

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV NODE_ENV=production

# 启动应用
CMD ["serve", "-s", "dist", "-l", "3000"]
