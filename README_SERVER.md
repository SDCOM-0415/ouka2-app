# 欧卡2中国电台 - Linux 服务器版构建指南

本文档介绍如何构建和部署适用于 Linux 服务器的独立版本（无 GUI，仅 Web 服务）。

## 1. 简介

服务器版是一个独立的二进制文件，不依赖 GTK 或 WebKit，可以直接在 Linux 服务器（如 CentOS, Ubuntu, Debian）上运行。它提供了一个 Web 界面，让你可以通过浏览器管理电台和下载配置文件。

## 2. 构建要求

由于您是在 Windows 环境下开发，要生成 Linux 二进制文件 (`ELF` 格式)，您有以下两种选择：

### 方法 A: 在 Linux 环境下构建 (推荐)
如果您有 Linux 服务器或 WSL (Windows Subsystem for Linux)：

1.  **安装 Rust**:
    ```bash
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
    ```

2.  **安装构建依赖**:
    *   Ubuntu/Debian: `sudo apt install build-essential pkg-config libssl-dev`
    *   CentOS/RHEL: `sudo yum groupinstall "Development Tools" && sudo yum install openssl-devel`

3.  **上传代码**:
    将整个项目目录上传到 Linux 服务器。

4.  **构建前端**:
    ```bash
    # 安装 Node.js 和依赖
    npm install
    # 构建前端资源 (这一步会生成 dist 目录，服务器版需要嵌入这些文件)
    npm run build
    ```

5.  **构建后端**:
    ```bash
    cd src-tauri
    # 构建服务器专用版本 (禁用默认的 desktop 特性，启用 server 特性)
    cargo build --release --bin ouka2-server --no-default-features --features server
    ```

6.  **获取产物**:
    构建完成后，二进制文件位于 `src-tauri/target/release/ouka2-server`。

### 方法 B: 使用 Cross 进行交叉编译
如果您想在 Windows 上直接编译出 Linux 程序：

1.  安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)。
2.  安装 `cross`: `cargo install cross`。
3.  运行构建命令:
    ```bash
    cd src-tauri
    cross build --target x86_64-unknown-linux-gnu --release --bin ouka2-server --no-default-features
    ```

## 3. 部署与运行

将生成的 `ouka2-server` 文件上传到您的服务器。

### 运行参数

```bash
# 赋予执行权限
chmod +x ouka2-server

# 启动服务
./ouka2-server
```

支持的命令行参数：
- `-p, --port <PORT>`: 指定端口 (默认 3001)
- `-d, --data-dir <DIR>`: 指定数据存储目录 (默认 ./data)
- `-f, --ffmpeg <PATH>`: 指定 FFmpeg 路径 (默认尝试自动检测系统 ffmpeg)

### 示例

```bash
# 在后台运行，端口 8080
nohup ./ouka2-server -p 8080 > server.log 2>&1 &
```

### FFmpeg 依赖

服务器版仍然需要 `ffmpeg` 来进行流媒体转码。
- **Ubuntu/Debian**: `sudo apt install ffmpeg`
- **CentOS**: `sudo yum install ffmpeg` (可能需要启用 RPM Fusion 源)
- 或者下载静态编译的 `ffmpeg` 二进制文件放到程序同级目录。

## 4. 功能验证

启动后，访问 `http://服务器IP:3001`：
1.  应该能看到 Web 界面。
2.  点击“安装到欧卡2”应该能下载修改好 IP 的 `live_streams.sii`。
3.  点击播放按钮，服务器后台应该有 FFmpeg 转码日志。
