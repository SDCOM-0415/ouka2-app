
import { invoke } from '@tauri-apps/api/core'
import type { Station, ServerStatus, CrawlProgress, ProvinceStats } from '../types'
import { generateSiiContent, downloadFile } from '../utils/siiGenerator'

// 检测是否在 Tauri 环境中
const isTauri = !!(window as any).__TAURI__

export const api = {
    isTauri,

    async loadStations(): Promise<Station[]> {
        if (isTauri) {
            return await invoke('load_saved_stations')
        } else {
            const res = await fetch('/api/stations')
            if (!res.ok) throw new Error('Failed to fetch stations')
            const stations: Station[] = await res.json()
            
            // 修正 Web 模式下的流地址 (虽然前端播放可能不需要，但 UI 显示可能需要)
            const currentHost = window.location.hostname
            const currentPort = window.location.port || '80'
            
            return stations.map(s => {
                // 如果后端返回的地址是 localhost，尝试替换为当前访问的 host
                // 注意：这里我们假设流媒体端口和 Web 端口一致（因为我们合并了服务）
                if (s.mp3_play_url_high) {
                    try {
                        const url = new URL(s.mp3_play_url_high)
                        if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
                            url.hostname = currentHost
                            url.port = currentPort
                            s.mp3_play_url_high = url.toString()
                        }
                    } catch (e) {
                        // ignore invalid url
                    }
                }
                return s
            })
        }
    },

    async crawlStations(): Promise<Station[]> {
        if (isTauri) {
            return await invoke('crawl_stations')
        } else {
            throw new Error('Web 模式下暂不支持爬取数据，请使用桌面版或等待服务端自动更新')
        }
    },

    async startServer(): Promise<void> {
        if (isTauri) {
            await invoke('start_server')
        } else {
            // Web 模式下服务器已经在运行
            console.log('Web mode: server is already running')
        }
    },

    async stopServer(): Promise<void> {
        if (isTauri) {
            await invoke('stop_server')
        } else {
            throw new Error('Web 模式下无法停止服务器')
        }
    },

    async getServerStatus(): Promise<ServerStatus> {
        if (isTauri) {
            return await invoke('get_server_status')
        } else {
            try {
                const res = await fetch('/health')
                if (!res.ok) throw new Error('Failed to get server status')
                return await res.json()
            } catch (e) {
                // 如果 fetch 失败，说明服务器挂了？但在 Web 模式下页面都打不开。
                // 可能是网络问题。
                return {
                    running: true, // 假设它在运行，因为我们能看到页面
                    port: parseInt(window.location.port || '80'),
                    active_streams: 0,
                    total_stations: 0
                }
            }
        }
    },
    
    async generateSii(): Promise<string> {
        if (isTauri) {
            return await invoke('generate_sii')
        } else {
            // Web 模式：获取数据并生成
            const stations = await api.loadStations()
            return generateSiiContent(stations)
        }
    },

    async installToEts2(): Promise<string> {
        if (isTauri) {
            return await invoke('install_sii_to_ets2')
        } else {
            // Web 模式：下载文件
            const stations = await api.loadStations()
            const content = generateSiiContent(stations)
            downloadFile('live_streams.sii', content)
            return '配置文件已下载，请手动放入欧卡2文档目录'
        }
    },
    
    async getEts2Paths(): Promise<string[]> {
        if (isTauri) {
            return await invoke('get_ets2_paths')
        } else {
            return []
        }
    },
    
    async checkFfmpeg(): Promise<string> {
        if (isTauri) {
            return await invoke('check_ffmpeg')
        } else {
            return 'Web Mode (Server-side FFmpeg)'
        }
    },
    
    async getProvinceStats(): Promise<ProvinceStats> {
        if (isTauri) {
            return await invoke('get_province_statistics')
        } else {
            // 简单统计
            const stations = await api.loadStations()
            const stats: Record<string, number> = {}
            stations.forEach(s => {
                stats[s.province] = (stats[s.province] || 0) + 1
            })
            return Object.entries(stats).sort((a, b) => b[1] - a[1])
        }
    },

    listenCrawlProgress(callback: (progress: CrawlProgress) => void): () => void {
        if (isTauri) {
            // 需要异步引入 listen，这里简化处理，或者由调用方处理
            // 这里返回一个空的 cleanup 函数
            // 实际在 radio.ts 里直接调用了 listen
            return () => {}
        } else {
            return () => {}
        }
    }
}
