//! 欧卡2中国电台桌面应用
//!
//! 将云听电台转换为欧卡2可用格式的桌面应用

#[cfg(feature = "desktop")]
mod commands;
pub mod radio;
pub mod utils;

use std::path::PathBuf;
use std::sync::Arc;
#[cfg(feature = "desktop")]
use tauri::Manager;
use tokio::sync::Mutex;

#[cfg(feature = "desktop")]
use commands::*;
use radio::{Crawler, StreamServer};
use utils::FFmpegManager;
#[cfg(feature = "desktop")]
use utils::check_ffmpeg;

/// 应用全局状态
pub struct AppState {
    pub crawler: Crawler,
    pub server: StreamServer,
}

impl AppState {
    pub fn new(data_dir: PathBuf, ffmpeg_path: PathBuf, server_port: u16) -> Self {
        Self {
            crawler: Crawler::new(data_dir),
            server: StreamServer::new(server_port, ffmpeg_path),
        }
    }
}

#[cfg(feature = "desktop")]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化日志
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // 获取应用数据目录
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("无法获取应用数据目录");

            // 确保目录存在
            std::fs::create_dir_all(&data_dir).ok();

            log::info!("📁 应用数据目录: {:?}", data_dir);

            // 检测 FFmpeg
            let resource_dir = app.path().resource_dir().ok();
            let ffmpeg_path = FFmpegManager::detect_ffmpeg(resource_dir.as_ref())
                .unwrap_or_else(|| PathBuf::from("ffmpeg"));

            // 创建应用状态
            // 默认端口 3001，如果被占用会自动递增
            let state = Arc::new(Mutex::new(AppState::new(data_dir, ffmpeg_path, 3001)));

            // 管理状态
            app.manage(state.clone());

            // 尝试加载已保存的电台数据
            let state_clone = state.clone();
            tauri::async_runtime::spawn(async move {
                let state = state_clone.lock().await;
                if let Ok(stations) = state.crawler.load_stations() {
                    if !stations.is_empty() {
                        state.crawler.set_stations(stations.clone()).await;
                        state.server.state().load_stations(stations).await;
                        log::info!("✅ 已加载保存的电台数据");
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 爬虫命令
            get_stations,
            crawl_stations,
            get_province_statistics,
            load_saved_stations,
            // 服务器命令
            start_server,
            stop_server,
            get_server_status,
            // 配置命令
            generate_sii,
            install_sii_to_ets2,
            get_ets2_paths,
            get_app_data_dir,
            // 工具命令
            check_ffmpeg,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// 以服务器模式运行（无 GUI）
pub async fn run_server_mode(port: u16, data_dir: Option<PathBuf>, ffmpeg_path: Option<PathBuf>) {
    // 初始化日志
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    log::info!("🚀 正在启动无头服务器模式...");

    // 1. 确定数据目录
    let data_dir = data_dir.unwrap_or_else(|| {
        let path = std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")).join("data");
        log::info!("   未指定数据目录，使用默认: {:?}", path);
        path
    });

    // 确保目录存在
    if let Err(e) = std::fs::create_dir_all(&data_dir) {
        log::error!("❌ 无法创建数据目录: {}", e);
        return;
    }

    // 2. 确定 FFmpeg 路径
    let ffmpeg_path = ffmpeg_path.unwrap_or_else(|| {
        // 尝试检测
        FFmpegManager::detect_ffmpeg(None).unwrap_or_else(|| PathBuf::from("ffmpeg"))
    });
    
    log::info!("   FFmpeg 路径: {:?}", ffmpeg_path);

    // 3. 创建应用状态
    let state = Arc::new(Mutex::new(AppState::new(data_dir.clone(), ffmpeg_path, port)));

    // 4. 加载并爬取数据
    {
        let state = state.lock().await;
        if let Ok(saved_stations) = state.crawler.load_stations() {
            if !saved_stations.is_empty() {
                state.crawler.set_stations(saved_stations.clone()).await;
                state.server.state().load_stations(saved_stations).await;
                log::info!("✅ 已加载保存的电台数据");
            } else {
                log::info!("   没有保存的电台数据，开始爬取...");
                
                // 爬取所有电台数据
                let new_stations = state.crawler.crawl_all(|progress| {
                    log::info!("   📻 爬取进度: {}/{} - {} (已找到 {} 个电台)", 
                        progress.current, progress.total, progress.province, progress.stations_found);
                }).await.unwrap_or_else(|e| {
                    log::error!("   ❌ 爬取失败: {}", e);
                    vec![]
                });
                
                if !new_stations.is_empty() {
                    state.crawler.set_stations(new_stations.clone()).await;
                    state.server.state().load_stations(new_stations).await;
                    log::info!("✅ 爬取完成，共 {} 个电台", new_stations.len());
                } else {
                    log::warn!("   ⚠️ 爬取结果为空");
                }
            }
        } else {
            log::info!("   开始爬取电台数据...");
            
            // 爬取所有电台数据
            let new_stations = state.crawler.crawl_all(|progress| {
                log::info!("   📻 爬取进度: {}/{} - {} (已找到 {} 个电台)", 
                    progress.current, progress.total, progress.province, progress.stations_found);
            }).await.unwrap_or_else(|e| {
                log::error!("   ❌ 爬取失败: {}", e);
                vec![]
            });
            
            if !new_stations.is_empty() {
                state.crawler.set_stations(new_stations.clone()).await;
                state.server.state().load_stations(new_stations).await;
                log::info!("✅ 爬取完成，共 {} 个电台", new_stations.len());
            } else {
                log::warn!("   ⚠️ 爬取结果为空");
            }
        }
    }

    // 5. 启动服务器
    log::info!("🔄 正在启动 Web 服务...");
    {
        let mut state_guard = state.lock().await;
        if let Err(e) = state_guard.server.start().await {
            log::error!("❌ 服务器启动失败: {}", e);
            return;
        }
    }

    // 获取实际端口
    let actual_port = {
        let state = state.lock().await;
        *state.server.state().port.read().await
    };

    println!("\n========================================================");
    println!("   欧卡2中国电台 - 服务器模式");
    println!("   Web 访问地址: http://127.0.0.1:{}", actual_port);
    println!("   数据目录: {:?}", data_dir);
    println!("   按 Ctrl+C 停止服务器");
    println!("========================================================\n");

    // 6. 等待退出信号
    match tokio::signal::ctrl_c().await {
        Ok(()) => {
            log::info!("🛑 收到退出信号，正在停止...");
        }
        Err(err) => {
            log::error!("❌ 监听 Ctrl+C 失败: {}", err);
        }
    }

    // 7. 清理资源
    {
        let mut state = state.lock().await;
        state.server.stop().await;
    }
    
    log::info!("👋 再见！");
}
