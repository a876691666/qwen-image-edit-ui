export interface ImageMetadata {
  id: string;
  name: string;
  size: number;
  width: number;
  height: number;
  uploadTime: number;
  isAiGenerated: boolean;
  mimeType: string;
  blob: Blob;
}

export interface QwenResponse {
  output: {
    choices: Array<{
      message: {
        content: Array<{
          image?: string;
        }>;
      };
    }>;
  };
}

export class ImageService {
  private dbName = 'ImageLibrary';
  private dbVersion = 1;
  private storeName = 'images';

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('uploadTime', 'uploadTime', { unique: false });
          store.createIndex('isAiGenerated', 'isAiGenerated', { unique: false });
        }
      };
    });
  }

  private async getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };
      
      img.src = url;
    });
  }

  async saveImage(file: File, isAiGenerated: boolean = false): Promise<ImageMetadata> {
    const db = await this.openDB();
    const { width, height } = await this.getImageDimensions(file);
    
    const metadata: ImageMetadata = {
      id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: file.name,
      size: file.size,
      width,
      height,
      uploadTime: Date.now(),
      isAiGenerated,
      mimeType: file.type,
      blob: file
    };

    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.add(metadata);
      request.onsuccess = () => resolve(metadata);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllImages(): Promise<ImageMetadata[]> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteImage(id: string): Promise<void> {
    const db = await this.openDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async callQwenImageEdit(
    imageBlob: Blob, 
    prompt: string, 
    negativePrompt: string = "",
    apiKey: string
  ): Promise<string> {
    try {
      // 生产环境（如 GitHub Pages）会因跨域无法直接调用接口，这里直接提示并中断
      if (import.meta.env.PROD) {
        window.alert('受限于跨域问题，请克隆代码在本地运行');
        throw new Error('生产环境下已阻止调用：受限于跨域问题，请在本地 dev 环境运行');
      }

      const imageBase64 = await this.blobToBase64(imageBlob);
      
      const messages = [{
        "role": "user",
        "content": [
          { "image": imageBase64 },
          { "text": prompt }
        ]
      }];

      const requestData = {
        model: "qwen-image-edit",
        input: { messages: messages },
        parameters: {
          negative_prompt: negativePrompt,
          watermark: false
        }
      };

      const response = await fetch(
        '/api/v1/services/aigc/multimodal-generation/generation',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData)
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API 请求失败: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const data: QwenResponse = await response.json();
      
      if (data.output?.choices?.length > 0) {
        const choice = data.output.choices[0];
        const imageContent = choice.message.content.find(item => item.image);
        
        if (imageContent?.image) {
          return imageContent.image;
        }
      }
      
      throw new Error('API 响应中未找到生成的图片');
      
    } catch (error) {
      console.error('API 调用错误:', error);
      throw error;
    }
  }

  async base64ToBlob(base64String: string): Promise<Blob> {
    const response = await fetch(base64String);
    return response.blob();
  }
}

export const imageService = new ImageService();
