import Compressor from 'compressorjs';

// 壓縮圖片
export const compressImage = (file: File | null): Promise<File> | null => {
  if (!file) return null;

  return new Promise((resolve, reject) => {
    new Compressor(file, {
      // 壓縮設定
      quality: 0.95, // 圖片品質 (0-1)
      maxWidth: 1920, // 最大寬度
      maxHeight: 1920, // 最大高度
      convertSize: 1000000, // 超過 1MB 的圖片會轉換格式
      convertTypes: ['image/png'], // 將 PNG 轉換為 JPEG 以減少檔案大小

      // 壓縮成功回調
      success: (compressedFile: File) => {
        resolve(compressedFile);
      },

      // 壓縮失敗回調
      error: (error: Error) => {
        console.error('壓縮圖片時發生錯誤:', error);
        reject(error);
      },
    });
  });
};