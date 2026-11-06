import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Increase payload limit for base64 meter photos
  app.use(express.json({ limit: "15mb" }));

  // POST /api/ocr-meter - Recognize 6-digit mechanical counter values using Gemini
  app.post("/api/ocr-meter", async (req, res) => {
    try {
      const { imageBase64, mimeType = "image/jpeg" } = req.body;
      if (!imageBase64) {
        res.status(400).json({ error: "缺少錶頭照片資料 (imageBase64)" });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({
          error: "尚未設定 GEMINI_API_KEY，請確認 AI Studio Secrets 設定。",
        });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text:
                "這是一張夾娃娃機內部機械式 6 位數類比計數器（投幣錶 Coin Counter 與/或 出貨錶 Prize Counter）的照片。" +
                "請辨識畫面中的 6 位數滾輪讀數（範圍 0 到 999999，請忽略前導零並轉為整數）。" +
                "若畫面中有兩個計數器，通常上方或標示 COIN/投幣 的是 coinCounter，下方或標示 PRIZE/出貨/GIFT 的是 prizeCounter。" +
                "若畫面只有一個計數器，請填入 coinCounter 並將 prizeCounter 設為 -1。" +
                "請同時回傳簡短的辨識說明 note 與信心度 confidence ('HIGH' | 'MEDIUM' | 'LOW')。",
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              coinCounter: {
                type: Type.INTEGER,
                description: "辨識出的投幣錶整數讀數 (0~999999)，若未拍到則為 -1",
              },
              prizeCounter: {
                type: Type.INTEGER,
                description: "辨識出的出貨錶整數讀數 (0~999999)，若未拍到則為 -1",
              },
              confidence: {
                type: Type.STRING,
                description: "HIGH, MEDIUM, or LOW",
              },
              note: {
                type: Type.STRING,
                description: "辨識結果簡短說明（繁體中文）",
              },
            },
            required: ["coinCounter", "prizeCounter", "confidence", "note"],
          },
        },
      });

      const rawText = (response.text ?? "{}").trim();
      const parsed = JSON.parse(rawText);
      res.json(parsed);
    } catch (error: any) {
      console.error("OCR Meter Error:", error);
      res.status(500).json({
        error: error?.message || "AI 錶頭辨識失敗，請稍後再試或改用手動滾輪輸入。",
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ClawOps Pro server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
