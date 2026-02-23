// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    
    // 简单的参数检查
    let is_headless = args.iter().any(|arg| arg == "--headless" || arg == "--server");
    
    if is_headless {
        // 创建 Tokio 运行时并运行服务器模式
        let rt = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("Failed to create Tokio runtime");
            
        rt.block_on(async {
            // 使用默认端口 3001，其他参数使用默认值
            ouka2_app_lib::run_server_mode(3001, None, None).await;
        });
    } else {
        ouka2_app_lib::run()
    }
}
