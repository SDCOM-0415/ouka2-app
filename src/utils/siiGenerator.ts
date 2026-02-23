
import type { Station } from '../types'

/**
 * 生成欧卡2 live_streams.sii 配置文件内容
 * @param stations 电台列表
 * @returns SII 文件内容字符串
 */
export function generateSiiContent(stations: Station[]): string {
    const host = window.location.hostname
    const port = window.location.port || '80'
    const baseUrl = `http://${host}:${port}/stream`
    
    const now = new Date().toLocaleString()
    
    let content = `SiiNunit
{
# 欧卡2中国电台配置文件
# 由 ouka2-desktop 自动生成 (Web版)
# 生成时间: ${now}
#
# 使用说明:
# 1. 确保本地转发服务器正在运行 (http://${host}:${port})
# 2. 将此文件复制到欧卡2文档目录下的 live_streams.sii
# 3. 重启游戏即可在电台列表中看到中国电台

live_stream_def : .live_streams {
 stream_data: ${stations.length}
`

    stations.forEach((station, index) => {
        const streamUrl = `${baseUrl}/${station.id}`
        // 简单分类逻辑
        let genre = 'Radio'
        if (station.name.includes('音乐')) genre = 'Music'
        else if (station.name.includes('新闻')) genre = 'News'
        else if (station.name.includes('交通')) genre = 'Traffic'
        else if (station.name.includes('经济')) genre = 'Economy'
        else if (station.name.includes('文艺')) genre = 'Arts'
        else if (station.name.includes('相声') || station.name.includes('故事')) genre = 'Talk'
        
        // 欧卡2格式: stream_data[index]: "URL|Name|Genre|Language|Bitrate|Favorite"
        content += ` stream_data[${index}]: "${streamUrl}|${station.name}|${genre}|CN|128|0"\n`
    })

    content += `}
}
`
    return content
}

/**
 * 触发浏览器下载文件
 * @param filename 文件名
 * @param content 文件内容
 */
export function downloadFile(filename: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}
