<script setup lang="ts">
import type { Station } from '../types'

const props = defineProps<{
  station: Station
  streamUrl: string
}>()

const emit = defineEmits<{
  play: [station: Station]
  copy: [url: string]
}>()

const handlePlay = () => {
  emit('play', props.station)
}

const handleCopy = async () => {
  try {
    await navigator.clipboard.writeText(props.streamUrl)
    emit('copy', props.streamUrl)
  } catch (e) {
    console.error('复制失败:', e)
  }
}

// 获取电台类型图标
const getTypeIcon = (name: string) => {
  if (name.includes('新闻') || name.includes('之声')) return '📰'
  if (name.includes('音乐') || name.includes('Music')) return '🎵'
  if (name.includes('交通') || name.includes('高速')) return '🚗'
  if (name.includes('经济') || name.includes('财经')) return '💰'
  if (name.includes('体育')) return '⚽'
  if (name.includes('文艺') || name.includes('故事')) return '📚'
  return '📻'
}
</script>

<template>
  <div class="station-card">
    <div class="station-image">
      <img 
        v-if="station.image" 
        :src="station.image" 
        :alt="station.name"
        @error="($event.target as HTMLImageElement).style.display = 'none'"
      />
      <span v-else class="station-icon">{{ getTypeIcon(station.name) }}</span>
    </div>
    
    <div class="station-info">
      <h3 class="station-name">{{ station.name }}</h3>
      <p class="station-meta">
        <span class="province-tag">{{ station.province }}</span>
        <span v-if="station.subtitle" class="subtitle">{{ station.subtitle }}</span>
      </p>
    </div>
    
    <div class="station-actions">
      <button class="btn btn-play" @click="handlePlay" title="播放">
        <span>▶</span>
      </button>
      <button class="btn btn-copy" @click="handleCopy" title="复制地址">
        <span>📋</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.station-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;
}

.station-card:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(100, 180, 255, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}

.station-image {
  width: 60px;
  height: 60px;
  border-radius: 10px;
  overflow: hidden;
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.station-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.station-icon {
  font-size: 1.8rem;
}

.station-info {
  flex: 1;
  min-width: 0;
}

.station-name {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
  margin: 0 0 0.3rem 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.station-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
}

.province-tag {
  background: linear-gradient(135deg, #4facfe, #00f2fe);
  color: #000;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.subtitle {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.station-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 1rem;
}

.btn-play {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.btn-play:hover {
  background: linear-gradient(135deg, #764ba2, #667eea);
  transform: scale(1.1);
}

.btn-copy {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.btn-copy:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}
</style>
