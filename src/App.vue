<template>
  <div id="app">
    <header class="app-header">
      <h1>AI 图片编辑工具</h1>
      <nav class="app-nav">
        <button
          @click="currentView = 'library'"
          :class="{ active: currentView === 'library' }"
          class="nav-btn"
        >
          素材库
        </button>
        <button @click="openAiChat" :class="{ active: currentView === 'chat' }" class="nav-btn">
          AI 编辑
        </button>
      </nav>
    </header>

    <main class="app-main">
      <!-- 素材库视图 -->
      <div v-if="currentView === 'library'" class="view library-view">
        <ImageLibrary ref="imageLibraryRef" @image-selected="onImageSelected" />
        <div v-if="selectedImage" class="selected-image-panel">
          <h3>选中的图片</h3>
          <div class="selected-image-info">
            <img :src="selectedImageUrl" :alt="selectedImage.name" />
            <div class="image-details">
              <p>
                <strong>{{ selectedImage.name }}</strong>
              </p>
              <p>尺寸: {{ selectedImage.width }}×{{ selectedImage.height }}</p>
              <p>大小: {{ formatFileSize(selectedImage.size) }}</p>
              <p>上传时间: {{ formatDate(selectedImage.uploadTime) }}</p>
              <p v-if="selectedImage.isAiGenerated" class="ai-tag">AI 生成</p>
            </div>
          </div>
          <button @click="editSelectedImage" class="edit-btn">用 AI 编辑这张图片</button>
        </div>
      </div>

      <!-- AI 对话视图 -->
      <AiChat
        v-if="currentView === 'chat'"
        :initial-image="selectedImage"
        @close="closeAiChat"
        @image-saved="onImageSaved"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import ImageLibrary from "./components/ImageLibrary.vue";
import AiChat from "./components/AiChat.vue";
import type { ImageMetadata } from "./services/imageService";

// 状态管理
const currentView = ref<"library" | "chat">("library");
const selectedImage = ref<ImageMetadata>();
const selectedImageUrl = ref<string>("");
const imageLibraryRef = ref();

// 计算属性
// const hasSelectedImage = computed(() => selectedImage.value !== null)

// 图片选择处理
function onImageSelected(image: ImageMetadata) {
  selectedImage.value = image;
  if (selectedImageUrl.value) {
    URL.revokeObjectURL(selectedImageUrl.value);
  }
  selectedImageUrl.value = URL.createObjectURL(image.blob);
}

// AI 对话处理
function openAiChat() {
  currentView.value = "chat";
}

function closeAiChat() {
  currentView.value = "library";
}

function editSelectedImage() {
  if (selectedImage.value) {
    currentView.value = "chat";
  }
}

// 图片保存处理
function onImageSaved(_image: ImageMetadata) {
  // 刷新素材库
  if (imageLibraryRef.value) {
    imageLibraryRef.value.loadImages();
  }

  // 切换回素材库视图
  currentView.value = "library";
}

// 工具函数
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN");
}

// 清理资源
onUnmounted(() => {
  if (selectedImageUrl.value) {
    URL.revokeObjectURL(selectedImageUrl.value);
  }
});
</script>

<style scoped>
#app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu",
    "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.app-header {
  background: #ffffff;
  border-bottom: 1px solid #e0e0e0;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.app-header h1 {
  margin: 0;
  color: #333;
  font-size: 1.5rem;
}

.app-nav {
  display: flex;
  gap: 1rem;
}

.nav-btn {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  color: #495057;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.nav-btn:hover {
  background: #e9ecef;
  border-color: #adb5bd;
}

.nav-btn.active {
  background: #007bff;
  border-color: #007bff;
  color: white;
}

.app-main {
  flex: 1;
  overflow: hidden;
}

.view {
  height: 100%;
  display: flex;
}

.library-view {
  gap: 2rem;
}

.library-view > :first-child {
  flex: 2;
  min-width: 0;
}

.selected-image-panel {
  flex: 1;
  max-width: 400px;
  background: #f8f9fa;
  border-left: 1px solid #e0e0e0;
  padding: 2rem;
  overflow-y: auto;
}

.selected-image-panel h3 {
  margin: 0 0 1rem 0;
  color: #333;
}

.selected-image-info {
  margin-bottom: 2rem;
}

.selected-image-info img {
  width: 100%;
  height: auto;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 1rem;
}

.image-details p {
  margin: 0.5rem 0;
  color: #666;
}

.image-details strong {
  color: #333;
}

.ai-tag {
  background: #28a745;
  color: white;
  padding: 0.2rem 0.5rem;
  border-radius: 3px;
  font-size: 0.8rem;
  display: inline-block;
}

.edit-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 1rem 2rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  width: 100%;
  transition: background-color 0.2s;
}

.edit-btn:hover {
  background: #0056b3;
}
</style>
