use ouka2_app_lib::run_server_mode;

#[tokio::main]
async fn main() {
    // 解析命令行参数
    let args: Vec<String> = std::env::args().collect();
    
    // 简单的参数解析
    let mut port = 3001;
    let mut data_dir = None;
    let mut ffmpeg_path = None;
    
    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--port" | "-p" => {
                if i + 1 < args.len() {
                    if let Ok(p) = args[i + 1].parse() {
                        port = p;
                    }
                    i += 1;
                }
            }
            "--data-dir" | "-d" => {
                if i + 1 < args.len() {
                    data_dir = Some(std::path::PathBuf::from(&args[i + 1]));
                    i += 1;
                }
            }
            "--ffmpeg" | "-f" => {
                if i + 1 < args.len() {
                    ffmpeg_path = Some(std::path::PathBuf::from(&args[i + 1]));
                    i += 1;
                }
            }
            "--help" | "-h" => {
                println!("欧卡2中国电台 - 服务器模式");
                println!("用法: ouka2-server [选项]");
                println!("选项:");
                println!("  -p, --port <PORT>        设置监听端口 (默认: 3001)");
                println!("  -d, --data-dir <DIR>     设置数据目录 (默认: ./data)");
                println!("  -f, --ffmpeg <PATH>      设置 FFmpeg 路径 (默认: 自动检测)");
                println!("  -h, --help               显示帮助信息");
                return;
            }
            _ => {}
        }
        i += 1;
    }

    run_server_mode(port, data_dir, ffmpeg_path).await;
}
