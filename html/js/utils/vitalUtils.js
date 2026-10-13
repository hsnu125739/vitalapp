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

  /**
   * 容錯解析標準化日曆日期為 'YYYY-MM-DD'
   * 遵循 TemporalMath 規範，支援 Date 物件、時間戳、斜線 (2026/10/02)、未補零 (2026-10-2) 與 ISO 字串
   * @param {any} val
   * @returns {string} 'YYYY-MM-DD' 或 ''
   */
  function toDateString(val) {
    if (typeof TemporalMath !== 'undefined' && typeof TemporalMath.toDateString === 'function') {
      return TemporalMath.toDateString(val);
    }
    if (!val && val !== 0) return '';
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return '';
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    if (typeof val === 'number') {
      if (isNaN(val)) return '';
      const d = new Date(val);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dt = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dt}`;
    }
    const s = String(val).trim();
    if (!s) return '';
    const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (m) {
      return m[1] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[3]).padStart(2, '0');
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const dt = String(d.getDate()).padStart(2, '0');
      return `${y}-${mo}-${dt}`;
    }
    const matchPrefix = s.replace(/\//g, '-').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (matchPrefix) {
      return matchPrefix[1] + '-' + String(matchPrefix[2]).padStart(2, '0') + '-' + String(matchPrefix[3]).padStart(2, '0');
    }
    return '';
  }

  const normalizeDateString = toDateString;

  /**
   * 輕量級全域 Toast 提示系統 (VitalToast)
   * 支援頂部 (top)、中央 (center)、底部 (bottom) 三段動態位置
   * 支援四大配色：'info' (深石灰), 'gold' (尊榮金光), 'success' (翡翠薄荷綠), 'error' (柔和珊瑚紅)
   * 支援「純文字無圖示」與「自訂圖示/Emoji (icon: '👑')」模式
   */
  const VitalToast = {
    show: function(message, options) {
      if (typeof document === 'undefined') return null;
      var opts = options || {};
      var type = opts.type || 'info';
      var icon = opts.icon || null;

      // 位置決策：若未指定，gold 預設居中，error 預設頂部，其餘預設底部
      var pos = opts.position || (type === 'gold' ? 'center' : (type === 'error' && opts.position !== 'bottom' ? 'top' : 'bottom'));
      if (pos !== 'top' && pos !== 'center' && pos !== 'bottom') {
        pos = 'bottom';
      }

      var duration = typeof opts.duration === 'number' ? opts.duration : (type === 'error' ? 3500 : 3000);

      var container = document.querySelector('.vital-toast-container');
      if (!container) {
        container = document.createElement('div');
        container.className = 'vital-toast-container';
        (document.body || document).appendChild(container);
      }

      // 清除前一個計時器與舊 Toast 節點 (防重疊收斂)
      if (container._activeTimer) {
        clearTimeout(container._activeTimer);
        container._activeTimer = null;
      }
      var existing = container.querySelectorAll ? container.querySelectorAll('.vital-toast') : [];
      Array.from(existing).forEach(function(t) {
        if (typeof t.remove === 'function') {
          t.remove();
        } else if (t.parentNode) {
          t.parentNode.removeChild(t);
        }
      });

      // 設定容器位置類別 (同時兼顧既有 test 的 toast-center / toast-bottom)
      if (container.classList && typeof container.classList.remove === 'function') {
        container.classList.remove('pos-top', 'pos-center', 'pos-bottom', 'toast-center', 'toast-bottom', 'toast-top');
        container.classList.add('pos-' + pos);
        if (pos === 'center') container.classList.add('toast-center');
        if (pos === 'bottom') container.classList.add('toast-bottom');
        if (pos === 'top') container.classList.add('toast-top');
      }

      var toast = document.createElement('div');
      toast.className = 'vital-toast toast-' + type;

      if (icon) {
        var iconSpan = document.createElement('span');
        iconSpan.className = 'toast-icon';
        iconSpan.textContent = icon;
        toast.appendChild(iconSpan);

        var textSpan = document.createElement('span');
        textSpan.className = 'toast-text';
        textSpan.textContent = String(message || '');
        toast.appendChild(textSpan);
      } else {
        // 純文字模式：無多餘 span 標籤包裹，簡潔純粹
        toast.textContent = String(message || '');
      }

      if (typeof toast.setAttribute === 'function') {
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
      }
      if (!toast.remove) {
        toast.remove = function() {
          if (this.parentNode && typeof this.parentNode.removeChild === 'function') {
            this.parentNode.removeChild(this);
          }
        };
      }

      container.appendChild(toast);
      if (!toast.parentNode) toast.parentNode = container;

      // 動畫觸發
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(function() { toast.classList.add('show'); });
      } else {
        setTimeout(function() { toast.classList.add('show'); }, 10);
      }

      // 自動淡出與銷毀
      if (duration > 0) {
        container._activeTimer = setTimeout(function() {
          if (toast.classList && typeof toast.classList.remove === 'function') {
            toast.classList.remove('show');
          }
          setTimeout(function() {
            if (typeof toast.remove === 'function') {
              toast.remove();
            } else if (toast.parentNode) {
              toast.parentNode.removeChild(toast);
            }
          }, 250);
        }, duration);
      }

      return toast;
    },

    info: function(msg, opts) {
      var o = Object.assign({}, opts, { type: 'info' });
      return this.show(msg, o);
    },

    gold: function(msg, opts) {
      var o = Object.assign({ position: 'center' }, opts, { type: 'gold' });
      return this.show(msg, o);
    },

    success: function(msg, opts) {
      var o = Object.assign({}, opts, { type: 'success' });
      return this.show(msg, o);
    },

    error: function(msg, opts) {
      var o = Object.assign({ position: 'top' }, opts, { type: 'error' });
      return this.show(msg, o);
    },

    dismiss: function(immediate) {
      if (typeof document === 'undefined') return;
      var container = document.querySelector('.vital-toast-container');
      if (!container) return;
      if (container._activeTimer) {
        clearTimeout(container._activeTimer);
        container._activeTimer = null;
      }
      var existing = container.querySelectorAll ? container.querySelectorAll('.vital-toast') : [];
      var isImmediate = immediate === true || (immediate && immediate.immediate === true);
      Array.from(existing).forEach(function(t) {
        if (t.classList && typeof t.classList.remove === 'function') {
          t.classList.remove('show');
        }
        if (isImmediate) {
          if (typeof t.remove === 'function') {
            t.remove();
          } else if (t.parentNode) {
            t.parentNode.removeChild(t);
          }
        } else {
          setTimeout(function() {
            if (typeof t.remove === 'function') {
              t.remove();
            } else if (t.parentNode) {
              t.parentNode.removeChild(t);
            }
          }, 200);
        }
      });
    }
  };

  const VitalUtils = {
    escapeHtml,
    escapeAttr,
    toDateString,
    normalizeDateString,
    VitalToast,
    showToast: VitalToast.show.bind(VitalToast)
  };

  // 匯出至 Node.js CommonJS 環境
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      VitalUtils,
      escapeHtml,
      escapeAttr,
      toDateString,
      normalizeDateString,
      VitalToast
    };
  }

  // 匯出至瀏覽器全域環境
  global.VitalUtils = VitalUtils;
  global.VitalToast = VitalToast;
  if (!global.escapeHtml) {
    global.escapeHtml = escapeHtml;
  }
  if (!global.escapeAttr) {
    global.escapeAttr = escapeAttr;
  }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
