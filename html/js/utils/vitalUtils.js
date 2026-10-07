/**
 * vitalUtils.js
 * 前端共用核心工具模組 (Vital Shared Core Utilities)
 * 職責：
 * 1. 提供統一且安全的 XSS 防禦字串轉義函式 (escapeHtml, escapeAttr)
 * 2. 支援雙環境載入：瀏覽器全域物件 (window.VitalUtils / window.escapeHtml) 與 Node.js (module.exports)
 */

(function(global) {
  'use strict';

  const HTML_ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  const HTML_ESCAPE_REGEX = /[&<>"']/g;

  /**
   * 安全轉義 HTML 特殊字元以防禦 XSS 注入攻擊
   * @param {any} str 要轉義的字串或變數
   * @returns {string} 轉義後的純淨字串
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char]);
  }

  const escapeAttr = escapeHtml;

  const VitalUtils = {
    escapeHtml,
    escapeAttr
  };

  // 匯出至 Node.js CommonJS 環境
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      VitalUtils,
      escapeHtml,
      escapeAttr
    };
  }

  // 匯出至瀏覽器全域環境
  global.VitalUtils = VitalUtils;
  if (!global.escapeHtml) {
    global.escapeHtml = escapeHtml;
  }
  if (!global.escapeAttr) {
    global.escapeAttr = escapeAttr;
  }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
