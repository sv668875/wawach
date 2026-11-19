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
  /**
   * AI 刮板規律與落點分析模組（未來規劃想法紀錄）
   * 透過已開出中獎號碼之間的分佈與邏輯規律，推測剩餘大獎可能落點位置。
   * 當前僅作想法留存，工程後台預設隱藏 (false)，頁面不呈現任何提示。
   */
  ENABLE_AI_SCRATCH_PATTERN_ANALYSIS: boolean;
}

export const FEATURE_FLAGS: AppFeatureFlags = {
  ENABLE_AI_METER_OCR: false,
  ENABLE_AI_SCRATCH_PATTERN_ANALYSIS: false,
};
