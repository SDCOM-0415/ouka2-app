/**
 * FFmpeg 自动下载脚本
 * 在打包前检测并自动下载 FFmpeg
 * 支持 Windows x64 和 macOS ARM64 (M 芯片)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');
const os = require('os');

// FFmpeg 下载配置
const FFMPEG_CONFIGS = {
    'win32-x64': {
        url: 'https://ghdown.hydun.com/https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
        binary: 'ffmpeg.exe',
        archiveType: 'zip',
        extractPattern: /ffmpeg.*\/bin\/ffmpeg\.exe$/
    },
    'darwin-arm64': {
        // 使用 evermeet.cx 提供的 macOS FFmpeg 构建
        url: 'https://evermeet.cx/ffmpeg/getrelease/zip',
        binary: 'ffmpeg',
        archiveType: 'zip',
        extractPattern: /^ffmpeg$/
    },
    'darwin-x64': {
        // Intel Mac 也使用相同的源（通用二进制）
        url: 'https://evermeet.cx/ffmpeg/getrelease/zip',
        binary: 'ffmpeg',
        archiveType: 'zip',
        extractPattern: /^ffmpeg$/
    }
};

const BINARIES_DIR = path.join(__dirname, '..', 'src-tauri', 'binaries');

/**
 * 获取当前平台的配置
 */
function getPlatformConfig() {
    const platform = os.platform();
    const arch = os.arch();
    const key = `${platform}-${arch}`;
    
    if (FFMPEG_CONFIGS[key]) {
        return { key, config: FFMPEG_CONFIGS[key] };
    }
    
    // 尝试回退到通用配置
    if (platform === 'darwin') {
        return { key: 'darwin-arm64', config: FFMPEG_CONFIGS['darwin-arm64'] };
    }
    
    return null;
}

/**
 * 下载文件（支持重定向）
 */
function downloadFile(url, dest, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) {
            reject(new Error('重定向次数过多'));
            return;
        }

        console.log(`📥 正在下载: ${url.substring(0, 80)}...`);

        const protocol = url.startsWith('https') ? https : http;

        protocol.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; FFmpegDownloader/1.0)'
            }
        }, (response) => {
            // 处理重定向
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                console.log(`   ↪ 重定向...`);
                // 解析重定向 URL（支持相对路径）
                let redirectUrl = response.headers.location;
                if (!redirectUrl.startsWith('http://') && !redirectUrl.startsWith('https://')) {
                    // 相对路径，需要拼接基础 URL
                    const baseUrl = new URL(url);
                    redirectUrl = new URL(redirectUrl, baseUrl.origin).href;
                }
                downloadFile(redirectUrl, dest, maxRedirects - 1)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`下载失败: HTTP ${response.statusCode}`));
                return;
            }

            const file = fs.createWriteStream(dest);
            const totalSize = parseInt(response.headers['content-length'], 10) || 0;
            let downloadedSize = 0;
            let lastPercent = 0;

            response.on('data', (chunk) => {
                downloadedSize += chunk.length;
                if (totalSize > 0) {
                    const percent = Math.floor((downloadedSize / totalSize) * 100);
                    if (percent > lastPercent) {
                        lastPercent = percent;
                        process.stdout.write(`\r   进度: ${percent}% (${(downloadedSize / 1024 / 1024).toFixed(1)} MB)`);
                    }
                } else {
                    process.stdout.write(`\r   已下载: ${(downloadedSize / 1024 / 1024).toFixed(1)} MB`);
                }
            });

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log('\n   ✅ 下载完成');
                resolve();
            });

            file.on('error', (err) => {
                fs.unlink(dest, () => { });
                reject(err);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * 解压 FFmpeg (Windows)
 */
async function extractFFmpegWindows(tempZip, binaryName) {
    console.log('📦 正在解压 FFmpeg (Windows)...');

    try {
        // 使用 tar 解压 (Windows 10+ 自带)
        execSync(`tar -xf "${tempZip}" -C "${BINARIES_DIR}"`, {
            stdio: 'pipe'
        });

        // 查找解压后的 ffmpeg.exe
        const extractedDirs = fs.readdirSync(BINARIES_DIR).filter(f => {
            const fullPath = path.join(BINARIES_DIR, f);
            return fs.statSync(fullPath).isDirectory() && f.includes('ffmpeg');
        });

        if (extractedDirs.length > 0) {
            const ffmpegSrc = path.join(BINARIES_DIR, extractedDirs[0], 'bin', 'ffmpeg.exe');
            const ffmpegDest = path.join(BINARIES_DIR, binaryName);
            if (fs.existsSync(ffmpegSrc)) {
                fs.copyFileSync(ffmpegSrc, ffmpegDest);
                console.log('   ✅ FFmpeg 已提取');

                // 清理解压的文件夹和 zip
                fs.rmSync(path.join(BINARIES_DIR, extractedDirs[0]), { recursive: true, force: true });
                fs.unlinkSync(tempZip);
                console.log('   🧹 已清理临时文件');
                return true;
            }
        }

        console.error('   ⚠️ 未能找到 ffmpeg.exe，请手动解压');
        return false;
    } catch (error) {
        console.error('   ❌ 解压失败:', error.message);
        throw error;
    }
}

/**
 * 解压 FFmpeg (macOS)
 */
async function extractFFmpegMacOS(tempZip, binaryName) {
    console.log('📦 正在解压 FFmpeg (macOS)...');

    try {
        // 使用 unzip 解压
        execSync(`unzip -o "${tempZip}" -d "${BINARIES_DIR}"`, {
            stdio: 'pipe'
        });

        const ffmpegSrc = path.join(BINARIES_DIR, 'ffmpeg');
        const ffmpegDest = path.join(BINARIES_DIR, binaryName);

        if (fs.existsSync(ffmpegSrc)) {
            // 如果目标文件名不同，则移动
            if (ffmpegSrc !== ffmpegDest) {
                fs.renameSync(ffmpegSrc, ffmpegDest);
            }
            
            // 确保文件可执行
            execSync(`chmod +x "${ffmpegDest}"`, { stdio: 'pipe' });
            
            console.log('   ✅ FFmpeg 已提取');

            // 清理 zip
            fs.unlinkSync(tempZip);
            console.log('   🧹 已清理临时文件');
            return true;
        }

        console.error('   ⚠️ 未能找到 ffmpeg，请手动解压');
        return false;
    } catch (error) {
        console.error('   ❌ 解压失败:', error.message);
        throw error;
    }
}

/**
 * 主函数
 */
async function main() {
    console.log('\n🔍 检查 FFmpeg...\n');

    // 获取平台配置
    const platformInfo = getPlatformConfig();
    if (!platformInfo) {
        console.error(`❌ 不支持的平台: ${os.platform()}-${os.arch()}`);
        console.error('   支持的平台: Windows x64, macOS ARM64/x64');
        process.exit(1);
    }

    const { key, config } = platformInfo;
    console.log(`📍 检测到平台: ${key}`);

    // 确保 binaries 目录存在
    if (!fs.existsSync(BINARIES_DIR)) {
        fs.mkdirSync(BINARIES_DIR, { recursive: true });
    }

    const ffmpegPath = path.join(BINARIES_DIR, config.binary);
    const tempZip = path.join(BINARIES_DIR, 'ffmpeg.zip');

    // 检查 FFmpeg 是否已存在
    if (fs.existsSync(ffmpegPath)) {
        console.log('✅ FFmpeg 已存在');
        console.log('   跳过下载\n');
        return;
    }

    console.log('⚠️  FFmpeg 未找到，开始自动下载...\n');

    try {
        // 下载
        await downloadFile(config.url, tempZip);

        // 根据平台解压
        if (os.platform() === 'win32') {
            await extractFFmpegWindows(tempZip, config.binary);
        } else if (os.platform() === 'darwin') {
            await extractFFmpegMacOS(tempZip, config.binary);
        } else {
            throw new Error(`不支持的平台: ${os.platform()}`);
        }

        console.log('\n✅ FFmpeg 准备完成!\n');
    } catch (error) {
        console.error('\n❌ 错误:', error.message);
        console.error('\n请手动下载 FFmpeg:');
        
        if (os.platform() === 'darwin') {
            console.error('1. 访问 https://evermeet.cx/ffmpeg/');
            console.error('2. 下载最新的 FFmpeg');
            console.error('3. 解压并将 ffmpeg 复制到 src-tauri/binaries/');
        } else {
            console.error('1. 访问 https://github.com/BtbN/FFmpeg-Builds/releases');
            console.error('2. 下载 ffmpeg-master-latest-win64-gpl.zip');
            console.error('3. 解压并将 bin/ffmpeg.exe 复制到 src-tauri/binaries/');
        }
        
        process.exit(1);
    }
}

main();
