<template>
  <div class="ai-chat">
    <div class="chat-header">
      <h2>AI 图片编辑</h2>
      <button @click="$emit('close')" class="close-btn">×</button>
    </div>

    <div class="chat-content">
      <!-- 图片选择区域 -->
      <div class="image-section">
        <h3>选择源图片</h3>
        <div v-if="selectedImage" class="selected-image">
          <img :src="selectedImageUrl" :alt="selectedImage.name" />
          <div class="image-details">
            <p><strong>{{ selectedImage.name }}</strong></p>
            <p>{{ selectedImage.width }}×{{ selectedImage.height }} | {{ formatFileSize(selectedImage.size) }}</p>
          </div>
          <button @click="openImagePicker" class="change-image-btn">更换图片</button>
        </div>
        <div v-else class="no-image">
          <p>请选择一张图片进行编辑</p>
          <button @click="openImagePicker" class="select-image-btn">选择图片</button>
        </div>
      </div>

      <!-- 提示词输入区域 -->
      <div class="prompt-section">
        <h3>编辑指令</h3>
        <div class="prompt-input">
          <label>正向提示词：</label>
          <textarea
            v-model="prompt"
            placeholder="描述你想要对图片进行的修改，比如：去掉某某..."
            rows="3"
          ></textarea>
        </div>
        <div class="prompt-input">
          <label>反向提示词（可选）：</label>
          <textarea
            v-model="negativePrompt"
            placeholder="描述你不希望出现的内容，比如：虚幻、动漫风格、卡通风格..."
            rows="2"
          ></textarea>
        </div>
        <div class="api-input">
          <label>API Key：</label>
          <div class="api-key-container">
            <input
              type="password"
              v-model="apiKey"
              @input="onApiKeyChange"
              placeholder="请输入您的阿里云 API Key"
            />
            <button 
              v-if="apiKey" 
              @click="clearApiKey" 
              class="clear-api-btn"
              title="清除API Key"
            >
              ×
            </button>
            <span v-if="apiKeySaved" class="api-saved-indicator">已保存</span>
          </div>
          <small class="api-hint">API Key 将自动保存到本地存储</small>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="action-section">
        <button
          @click="generateImage"
          :disabled="!canGenerate || isGenerating"
          class="generate-btn"
        >
          {{ isGenerating ? '生成中...' : '生成图片' }}
        </button>
      </div>

      <!-- 结果显示区域 -->
      <div v-if="generatedImage" class="result-section">
        <h3>生成结果</h3>
        
        <!-- 视图模式切换 -->
        <div class="view-mode-tabs">
          <button
            @click="viewMode = 'single'"
            :class="{ active: viewMode === 'single' }"
            class="mode-tab"
          >
            单图查看
          </button>
          <button
            @click="viewMode = 'compare'"
            :class="{ active: viewMode === 'compare' }"
            class="mode-tab"
          >
            左右对比
          </button>
          <button
            @click="viewMode = 'diff'"
            :class="{ active: viewMode === 'diff' }"
            class="mode-tab"
          >
            差异对比
          </button>
        </div>

        <!-- 图片显示 -->
        <div class="image-display" :class="`mode-${viewMode}`">
          <!-- 单图模式 -->
          <div v-if="viewMode === 'single'" class="single-view">
            <img :src="generatedImageUrl" alt="生成的图片" />
          </div>

          <!-- 左右对比模式 -->
          <div v-if="viewMode === 'compare'" class="compare-view">
            <div class="compare-item">
              <h4>原图</h4>
              <img :src="selectedImageUrl" alt="原图" />
            </div>
            <div class="compare-item">
              <h4>生成图</h4>
              <img :src="generatedImageUrl" alt="生成图" />
            </div>
          </div>

          <!-- 差异对比模式 -->
          <div v-if="viewMode === 'diff'" class="diff-view">
            <div class="diff-labels">
              <div class="diff-label diff-label-left">原图</div>
              <div class="diff-label diff-label-right">生成图</div>
            </div>
            <div class="diff-container" ref="diffContainer">
              <div class="diff-original">
                <img :src="selectedImageUrl" alt="原图" />
              </div>
              <div class="diff-generated" :style="{ clipPath: `inset(0 ${100 - diffPosition}% 0 0)` }">
                <img :src="generatedImageUrl" alt="生成图" />
              </div>
              <div
                class="diff-slider"
                :style="{ left: `${diffPosition}%` }"
                @mousedown="startDiffDrag"
              ></div>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="result-actions">
          <button @click="downloadImage" class="download-btn">
            下载图片
          </button>
        </div>
      </div>

      <!-- 错误显示 -->
      <div v-if="error" class="error-message">
        <p>{{ error }}</p>
        <button @click="error = ''" class="close-error">关闭</button>
      </div>
    </div>

    <!-- 图片选择弹窗 -->
    <div v-if="showImagePicker" class="image-picker-overlay" @click="closeImagePicker">
      <div class="image-picker-modal" @click.stop>
        <h3>选择图片</h3>
        <ImageLibrary @image-selected="onImageSelected" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { imageService, type ImageMetadata } from '../services/imageService'
import ImageLibrary from './ImageLibrary.vue'

const emit = defineEmits<{
  close: []
}>()

const props = defineProps<{
  initialImage?: ImageMetadata
}>()

// 状态管理
const selectedImage = ref<ImageMetadata | null>(null)
const selectedImageUrl = ref<string>('')
const prompt = ref<string>('')
const negativePrompt = ref<string>('')
const apiKey = ref<string>('')
const apiKeySaved = ref<boolean>(false)
const isGenerating = ref<boolean>(false)
const generatedImage = ref<string>('')
const generatedImageUrl = ref<string>('')
const error = ref<string>('')
const showImagePicker = ref<boolean>(false)
const viewMode = ref<'single' | 'compare' | 'diff'>('single')
const diffPosition = ref<number>(50)

// 计算属性
const canGenerate = computed(() => {
  return selectedImage.value && prompt.value.trim() && apiKey.value.trim() && !isGenerating.value
})

// 初始化
onMounted(() => {
  if (props.initialImage) {
    selectImage(props.initialImage)
  }
  
  // 从 localStorage 加载 API Key
  const savedApiKey = localStorage.getItem('qwen-api-key')
  if (savedApiKey) {
    apiKey.value = savedApiKey
    apiKeySaved.value = true
  }
})

// API Key 相关方法
function onApiKeyChange() {
  apiKeySaved.value = false
  if (apiKey.value.trim()) {
    // 延迟保存，避免频繁操作
    setTimeout(() => {
      localStorage.setItem('qwen-api-key', apiKey.value)
      apiKeySaved.value = true
      // 3秒后隐藏保存提示
      setTimeout(() => {
        apiKeySaved.value = false
      }, 3000)
    }, 1000)
  } else {
    localStorage.removeItem('qwen-api-key')
  }
}

function clearApiKey() {
  apiKey.value = ''
  apiKeySaved.value = false
  localStorage.removeItem('qwen-api-key')
}

// 图片选择
function selectImage(image: ImageMetadata) {
  selectedImage.value = image
  selectedImageUrl.value = URL.createObjectURL(image.blob)
}

function openImagePicker() {
  showImagePicker.value = true
}

function closeImagePicker() {
  showImagePicker.value = false
}

function onImageSelected(image: ImageMetadata) {
  selectImage(image)
  closeImagePicker()
}

// AI 生成
async function generateImage() {
  if (!selectedImage.value || !prompt.value.trim() || !apiKey.value.trim()) {
    return
  }

  isGenerating.value = true
  error.value = ''

  try {
    // 保存 API Key 到 localStorage
    localStorage.setItem('qwen-api-key', apiKey.value)

    const result = await imageService.callQwenImageEdit(
      selectedImage.value.blob,
      prompt.value,
      negativePrompt.value,
      apiKey.value
    )

    generatedImage.value = result
    generatedImageUrl.value = result

  } catch (err) {
    error.value = err instanceof Error ? err.message : '生成图片时发生未知错误'
    console.error('生成图片失败:', err)
  } finally {
    isGenerating.value = false
  }
}

// 下载图片
function downloadImage() {
  if (!generatedImage.value) return

  const link = document.createElement('a')
  link.href = generatedImage.value
  link.download = `ai-generated-${Date.now()}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// 差异对比拖拽
let isDragging = false

function startDiffDrag(event: MouseEvent) {
  isDragging = true
  updateDiffPosition(event)
  document.addEventListener('mousemove', updateDiffPosition)
  document.addEventListener('mouseup', stopDiffDrag)
}

function updateDiffPosition(event: MouseEvent) {
  if (!isDragging) return
  
  const container = document.querySelector('.diff-container') as HTMLElement
  if (!container) return

  const rect = container.getBoundingClientRect()
  const x = event.clientX - rect.left
  const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
  diffPosition.value = percentage
}

function stopDiffDrag() {
  isDragging = false
  document.removeEventListener('mousemove', updateDiffPosition)
  document.removeEventListener('mouseup', stopDiffDrag)
}

// 工具函数
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 清理资源
onUnmounted(() => {
  if (selectedImageUrl.value) {
    URL.revokeObjectURL(selectedImageUrl.value)
  }
  if (generatedImageUrl.value && generatedImageUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(generatedImageUrl.value)
  }
})
</script>

<style scoped>
.ai-chat {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: white;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.chat-header h2 {
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  color: #666;
}

.close-btn:hover {
  color: #333;
}

.chat-content {
  flex: 1;
  overflow-y: auto;
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.image-section,
.prompt-section,
.action-section,
.result-section {
  margin-bottom: 2rem;
}

.image-section h3,
.prompt-section h3,
.result-section h3 {
  margin-bottom: 1rem;
  color: #333;
}

/* 图片选择区域 */
.selected-image {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: #f8f9fa;
}

.selected-image img {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: 4px;
}

.image-details {
  flex: 1;
}

.image-details p {
  margin: 0.25rem 0;
}

.change-image-btn,
.select-image-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.no-image {
  text-align: center;
  padding: 2rem;
  border: 2px dashed #ccc;
  border-radius: 8px;
  color: #666;
}

/* 提示词输入区域 */
.prompt-input,
.api-input {
  margin-bottom: 1rem;
}

.prompt-input label,
.api-input label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: bold;
  color: #555;
}

.prompt-input textarea,
.api-input input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-family: inherit;
  resize: vertical;
}

.prompt-input textarea:focus,
.api-input input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

/* API Key 相关样式 */
.api-key-container {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}

.api-key-container input {
  flex: 1;
}

.clear-api-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #6c757d;
  font-size: 18px;
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.clear-api-btn:hover {
  background: #f8f9fa;
  color: #495057;
}

.api-saved-indicator {
  color: #28a745;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  opacity: 0;
  animation: fadeInOut 3s ease-in-out forwards;
}

@keyframes fadeInOut {
  0% { opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { opacity: 0; }
}

.api-hint {
  display: block;
  color: #6c757d;
  font-size: 11px;
  margin-top: 4px;
}

/* 生成按钮 */
.generate-btn {
  background: #28a745;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1.1rem;
  transition: background-color 0.2s;
}

.generate-btn:hover:not(:disabled) {
  background: #218838;
}

.generate-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

/* 视图模式切换 */
.view-mode-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.mode-tab {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.mode-tab.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.mode-tab:hover:not(.active) {
  background: #f8f9fa;
}

/* 图片显示 */
.image-display {
  margin-bottom: 1rem;
}

.single-view img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.compare-view {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.compare-item h4 {
  text-align: center;
  margin-bottom: 0.5rem;
  color: #666;
}

.compare-item img {
  width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.diff-view {
  /* 禁用文本选择，防止拖拽时产生选中效果 */
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}

.diff-labels {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
  position: relative;
}

.diff-label {
  position: absolute;
  top: -2rem;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  z-index: 20;
  pointer-events: none;
}

.diff-label-left {
  left: 1rem;
}

.diff-label-right {
  right: 1rem;
}

.diff-container {
  position: relative;
  display: inline-block;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  /* 禁用拖拽选择 */
  -webkit-user-drag: none;
  -khtml-user-drag: none;
  -moz-user-drag: none;
  -o-user-drag: none;
}

.diff-original,
.diff-generated {
  position: relative;
}

.diff-generated {
  position: absolute;
  top: 0;
  left: 0;
}

.diff-original img,
.diff-generated img {
  display: block;
  max-width: 100%;
  height: auto;
  /* 禁用图片拖拽和选择 */
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  -webkit-user-drag: none;
  -khtml-user-drag: none;
  -moz-user-drag: none;
  -o-user-drag: none;
  pointer-events: none;
}

.diff-slider {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #007bff;
  cursor: ew-resize;
  z-index: 10;
}

.diff-slider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: -6px;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  background: #007bff;
  border-radius: 50%;
}

/* 结果操作按钮 */
.result-actions {
  display: flex;
  gap: 1rem;
}

.download-btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s;
  background: #6c757d;
  color: white;
}

.download-btn:hover {
  background: #545b62;
}

/* 错误消息 */
.error-message {
  background: #f8d7da;
  color: #721c24;
  padding: 1rem;
  border-radius: 4px;
  border: 1px solid #f5c6cb;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.close-error {
  background: none;
  border: none;
  color: #721c24;
  cursor: pointer;
  font-weight: bold;
}

/* 图片选择弹窗 */
.image-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.image-picker-modal {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  height: 80%;
  padding: 1rem;
  display: flex;
  flex-direction: column;
}

.image-picker-modal h3 {
  margin: 0 0 1rem 0;
  text-align: center;
}

.image-picker-modal .image-library {
  flex: 1;
}
</style>
