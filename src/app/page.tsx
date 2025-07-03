"use client"

import React, { useState, useCallback } from "react";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { compressImage } from "@/utils/file"

// 定義價目表的型別
interface PriceItem {
  name: string;
  price: string;
  originalPrice?: string;
  group?: string;
}

interface PriceList {
  category: string;
  service: PriceItem[];
  analyzedAt: string;
}

const chatModel = new ChatOpenAI({
  openAIApiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  model: "gpt-4o", // AI 模型
});


export default function Home() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [compressedImage, setCompressedImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<PriceList | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  // const reader = new FileReader(); // 建立 FileReader

  // 處理圖片選擇
  const handleImageSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    // 檢查檔案類型
    if (!file.type.startsWith('image/')) {
      setError('請選擇圖片檔案');
      return;
    }

    setSelectedImage(file);
    setError("");

    try {
      // 壓縮圖片
      const compressed = await compressImage(file);

      if (!compressed) return

      setCompressedImage(compressed)

      // 建立預覽圖 (使用壓縮後的圖片)
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(compressed);
    } catch (error) {
      console.error('壓縮失敗:', error);
      setError('圖片壓縮失敗，將使用原始圖片');

      // 如果壓縮失敗，使用原始圖片
      setCompressedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }

  }, [])

  // 將圖片轉換為 base64
  const convertImageToBase64 = useCallback((file: File | null): Promise<string> | null => {
    if (!file) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        // 移除 data:image/...;base64, 前綴
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  // 分析圖片
  const analyzeImage = useCallback(async () => {
    if (!selectedImage) {
      setError("請先選擇圖片");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // 將壓縮後的圖片轉換為 base64
      const base64Image = await convertImageToBase64(compressedImage);

      // 建立包含圖片的訊息
      const message = new HumanMessage({
        content: [
          {
            type: "text",
            text: `你是一位全方面的美容產業經理，請解析上傳的圖片，分析圖片上的文字，依照區塊的位置、或是表格類別等去分類，並生成一個價目表 JSON 檔。
            請注意：如果同一項目裡有「原價」，或是有刪除線的價格的價格，請放在 originalPrice，而相比的價格則放在 price
            
            請按照以下 JSON 格式回傳：
            {
              "category": "價目表標題",
              "service": [
                {
                  "name": "商品名稱",
                  "price": "價格",
                  "originalPrice": "原價（如果有的話，或是有刪除線的價格）"
                  "price": "分類（如果有的話）",
                }
              ],
              "analyzedAt": "分析時間"
            }
            
            請確保回傳的是有效的 JSON 格式。`
          },
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`
            }
          }
        ]
      });

      // 呼叫 OpenAI API
      const result = await chatModel.invoke([message]);
      console.log('AI 回應:', result.content);

      setIsLoading(false);

      // 解析 JSON 回應
      try {
        // 嘗試從回應中提取 JSON
        const content = result.content as string;
        const jsonStart = content.indexOf('{');
        const jsonEnd = content.lastIndexOf('}') + 1;

        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonString = content.slice(jsonStart, jsonEnd);
          const parsedResult = JSON.parse(jsonString) as PriceList;
          setAnalysisResult(parsedResult);
        } else {
          throw new Error('無法從回應中找到 JSON 格式');
        }
    } catch (parseError) {
        console.error('JSON 解析錯誤:', parseError);
        setError('AI 回應格式錯誤，請重試');
      }
    } catch (error) {
      console.error('分析圖片時發生錯誤:', error);
      setError('分析圖片時發生錯誤，請重試');
      }
    }, [compressedImage, convertImageToBase64, selectedImage])

  // 下載 JSON 檔案
  const downloadJSON = () => {
    if (!analysisResult) return;

    const dataStr = JSON.stringify(analysisResult, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = 'price-list.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col justify-center px-7 py-5">
      <h1 className="text-3xl font-bold text-center mb-8">圖片價目表分析器</h1>

      {/* 圖片上傳區域 */}
      <div className="mb-6">
        <input
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>

      {/* 圖片預覽與壓縮資訊 */}
      {imagePreview && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">圖片預覽</h3>
          <div className="space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt="上傳圖片的預覽"
              className="max-w-full h-64 object-contain border rounded-lg"
            />
          </div>
        </div>
      )}


      <button
        onClick={analyzeImage}
        className="px-2 py-3 bg-blue-500 hover:bg-blue-700 text-white rounded-lg mb-4"
      >
        {isLoading ? '分析中...' : '開始分析圖片'}
      </button>

      {/* 錯誤訊息 */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* 分析結果 */}
      {analysisResult && (
        <React.Fragment>
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">分析結果</h3>
            <button
              onClick={downloadJSON}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-700"
            >
              下載 JSON
            </button>
          </div>

        {/* 原始 JSON 資料 */}
          <div className="mt-4">
            <h4 className="text-sm text-gray-600">
              查看原始 JSON 資料
            </h4>
            <pre className="mt-2 p-3 bg-gray-100 rounded text-sm overflow-x-auto">
              {JSON.stringify(analysisResult, null, 2)}
            </pre>
          </div>
        </React.Fragment>
      )}
    </div>
  );
}
