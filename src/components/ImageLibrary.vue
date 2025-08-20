<template>
  <div
    class="image-library"
    @drop="handleDrop"
    @dragover.prevent
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    :class="{ 'drag-over': isDragOver }"
  >
    <!-- 拖拽覆盖层 -->
    <div v-if="isDragOver" class="drag-overlay">
      <div class="drag-content">
        <div class="drag-icon">📁</div>
        <p>松开鼠标上传图片</p>
      </div>
    </div>

    <div class="library-header">
      <h2>素材库</h2>
      <div class="header-actions">
        <input
          type="file"
          ref="fileInput"
          @change="handleFileUpload"
          accept="image/*"
          multiple
          style="display: none"
        />
        <button @click="triggerFileUpload" class="upload-btn"><span>📁</span> 上传图片</button>
        <div class="filter-options">
          <select v-model="filterType" @change="filterImages">
            <option value="all">全部图片</option>
            <option value="uploaded">用户上传</option>
            <option value="ai">AI生成</option>
          </select>
        </div>
      </div>
    </div>

    <div class="library-content">
      <div v-if="loading" class="loading">加载中...</div>

      <div v-else-if="filteredImages.length === 0" class="empty-state">
        <p>暂无图片，点击上传按钮添加图片</p>
      </div>

      <div v-else class="images-grid">
        <div
          v-for="image in filteredImages"
          :key="image.id"
          class="image-item"
          :class="{ selected: selectedImage?.id === image.id }"
          @click="selectImage(image)"
        >
          <div class="image-preview">
            <img :src="getImageUrl(image)" :alt="image.name" />
            <div class="image-overlay">
              <button @click.stop="deleteImage(image.id)" class="delete-btn">🗑️</button>
            </div>
          </div>
          <div class="image-info">
            <p class="image-name" :title="image.name">{{ image.name }}</p>
            <div class="image-meta">
              <span>{{ formatFileSize(image.size) }}</span>
              <span>{{ image.width }}×{{ image.height }}</span>
              <span v-if="image.isAiGenerated" class="ai-badge">AI</span>
            </div>
            <div class="upload-time">
              {{ formatDate(image.uploadTime) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { imageService, type ImageMetadata } from "../services/imageService";

const emit = defineEmits<{
  imageSelected: [image: ImageMetadata];
}>();

// 响应式状态
const fileInput = ref<HTMLInputElement>();
const images = ref<ImageMetadata[]>([]);
const selectedImage = ref<ImageMetadata | null>(null);
const loading = ref(false);
const filterType = ref<"all" | "uploaded" | "ai">("all");
const isDragOver = ref(false);
const dragCounter = ref(0);

// 计算属性
const filteredImages = computed(() => {
  if (filterType.value === "all") return images.value;
  if (filterType.value === "ai") return images.value.filter((img) => img.isAiGenerated);
  return images.value.filter((img) => !img.isAiGenerated);
});

// 方法
const triggerFileUpload = () => {
  fileInput.value?.click();
};

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if (!files) return;

  loading.value = true;
  try {
    for (const file of Array.from(files)) {
      if (file.type.startsWith("image/")) {
        const metadata = await imageService.saveImage(file, false);
        images.value.unshift(metadata);
      }
    }
  } catch (error) {
    console.error("文件上传失败:", error);
    alert("文件上传失败，请重试");
  } finally {
    loading.value = false;
    if (target) target.value = "";
  }
};

const loadImages = async () => {
  loading.value = true;
  try {
    images.value = await imageService.getAllImages();
    // 按时间倒序排列
    images.value.sort((a, b) => b.uploadTime - a.uploadTime);
  } catch (error) {
    console.error("加载图片失败:", error);
  } finally {
    loading.value = false;
  }
};

const deleteImage = async (id: string) => {
  if (!confirm("确定要删除这张图片吗？")) return;

  try {
    await imageService.deleteImage(id);
    images.value = images.value.filter((img) => img.id !== id);
    if (selectedImage.value?.id === id) {
      selectedImage.value = null;
    }
  } catch (error) {
    console.error("删除图片失败:", error);
    alert("删除图片失败，请重试");
  }
};

const selectImage = (image: ImageMetadata) => {
  selectedImage.value = image;
  emit("imageSelected", image);
};

const getImageUrl = (image: ImageMetadata): string => {
  return URL.createObjectURL(image.blob);
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString("zh-CN");
};

const filterImages = () => {
  // 触发重新计算 filteredImages
};

// 拖拽相关方法
const handleDragEnter = (event: DragEvent) => {
  event.preventDefault();
  dragCounter.value++;
  isDragOver.value = true;
};

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault();
  dragCounter.value--;
  if (dragCounter.value === 0) {
    isDragOver.value = false;
  }
};

const handleDrop = async (event: DragEvent) => {
  event.preventDefault();
  dragCounter.value = 0;
  isDragOver.value = false;

  const files = event.dataTransfer?.files;
  if (!files) return;

  loading.value = true;
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith("image/")) {
        const metadata = await imageService.saveImage(file, false);
        images.value.unshift(metadata);
      }
    }
  } catch (error) {
    console.error("拖拽上传失败:", error);
    alert("拖拽上传失败，请重试");
  } finally {
    loading.value = false;
  }
};

// 添加图片到库中（用于AI生成的图片）
const addImage = async (blob: Blob, name: string, isAiGenerated: boolean = true) => {
  try {
    const file = new File([blob], name, { type: blob.type });
    const metadata = await imageService.saveImage(file, isAiGenerated);
    images.value.unshift(metadata);
    return metadata;
  } catch (error) {
    console.error("添加图片失败:", error);
    throw error;
  }
};

// 暴露方法给父组件
defineExpose({
  addImage,
  loadImages,
});

// 生命周期
onMounted(() => {
  loadImages();
});
</script>

<style scoped>
.image-library {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
  position: relative;
}

.image-library.drag-over {
  background: #e3f2fd;
}

.library-header {
  padding: 20px;
  background: white;
  border-bottom: 1px solid #e9ecef;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.library-header h2 {
  margin: 0;
  color: #343a40;
}

.header-actions {
  display: flex;
  gap: 16px;
  align-items: center;
}

.upload-btn {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s;
}

.upload-btn:hover {
  background: #0056b3;
}

.filter-options select {
  padding: 6px 12px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  background: white;
}

.library-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #6c757d;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #6c757d;
}

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.image-item {
  background: white;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 2px solid transparent;
}

.image-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.image-item.selected {
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.image-preview {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
}

.image-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-overlay {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  padding: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-item:hover .image-overlay {
  opacity: 1;
}

.delete-btn {
  background: rgba(255, 255, 255, 0.9);
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.delete-btn:hover {
  background: white;
}

.image-info {
  padding: 12px;
}

.image-name {
  margin: 0 0 8px 0;
  font-weight: 500;
  color: #343a40;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.image-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #6c757d;
  margin-bottom: 4px;
}

.ai-badge {
  background: #28a745;
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: bold;
}

.upload-time {
  font-size: 11px;
  color: #adb5bd;
}

/* 拖拽样式 */
.drag-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(33, 150, 243, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  border: 2px dashed #2196f3;
  border-radius: 8px;
  backdrop-filter: blur(2px);
}

.drag-content {
  text-align: center;
  color: #1976d2;
}

.drag-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.drag-content p {
  font-size: 18px;
  font-weight: 500;
  margin: 0;
}
</style>
