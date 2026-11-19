/**
 * ClawOps Pro 工程後台功能設定檔 (Feature Flags)
 * 供工程團隊於後台配置實驗性模組與功能開關。
 */

export interface AppFeatureFlags {
  /**
   * AI 拍錶 OCR 辨識模組
   * 目前技術演算法與現場光影泛化待深化，工程後台預設隱藏 (false)。
   * 頁面上不呈現任何提示或開啟按鈕，等待後續技術就緒再行開啟。
   */
  ENABLE_AI_METER_OCR: boolean;
}

export const FEATURE_FLAGS: AppFeatureFlags = {
  ENABLE_AI_METER_OCR: false,
};
