/**
 * storageGateway.js
 * 快取存取接縫收斂模組 (Unified Storage Gateway)
 *
 * 職責：
 * 1. 封裝 Web Storage (localStorage) 與記憶體降級適配器 (MemoryFallbackAdapter)。
 * 2. 提供型別安全之 getJSON / setJSON 存取。
 * 3. 實作原子登出雙階掃除演算法 (Dual-Phase Purge)：
 *    - Phase 1: 標靶清除當前身分物件、Token 與會話標記。
 *    - Phase 2: 全域掃描 vital_ 前綴快取，白名單保護全域設定 (章節/點數/成就/任務/快取日期/記住登入)，
 *               徹底清除私有用戶資料與離線佇列，消滅殭屍殘留與跨用戶離線串供。
 */

(function (global) {
  'use strict';

  /**
   * 記憶體降級適配器 (MemoryFallbackAdapter)
   * 當 localStorage 不可用、被禁用 (Safari 無痕模式) 或 Node.js 測試無 localStorage 時無縫接管。
   */
  class MemoryFallbackAdapter {
    constructor() {
      this._store = new Map();
    }

    getItem(key) {
      const k = String(key);
      return this._store.has(k) ? this._store.get(k) : null;
    }

    setItem(key, value) {
      this._store.set(String(key), String(value));
    }

    removeItem(key) {
      this._store.delete(String(key));
    }

    clear() {
      this._store.clear();
    }

    key(index) {
      const keys = Array.from(this._store.keys());
      return keys[index] !== undefined ? keys[index] : null;
    }

    get length() {
      return this._store.size;
    }
  }

  /**
   * 統一存儲接縫閘道 (StorageGateway)
   */
  class StorageGateway {
    constructor(storageBackend = null) {
      this.storage = storageBackend || StorageGateway._detectStorage();
    }

    static _detectStorage() {
      try {
        const candidate = (typeof window !== 'undefined' && window.localStorage)
          ? window.localStorage
          : (typeof localStorage !== 'undefined' ? localStorage : null);

        if (candidate) {
          const probe = '__vital_storage_probe__';
          candidate.setItem(probe, '1');
          candidate.removeItem(probe);
          return candidate;
        }
      } catch (_) {
        // localStorage 受限或拋錯時進入記憶體降級
      }
      return new MemoryFallbackAdapter();
    }

    static getInstance() {
      if (!StorageGateway._instance) {
        StorageGateway._instance = new StorageGateway();
      }
      return StorageGateway._instance;
    }

    getItem(key) {
      try {
        return this.storage.getItem(key);
      } catch (_) {
        return null;
      }
    }

    setItem(key, value) {
      this.storage.setItem(key, String(value));
    }

    removeItem(key) {
      try {
        this.storage.removeItem(key);
      } catch (_) {}
    }

    clear() {
      try {
        this.storage.clear();
      } catch (_) {}
    }

    key(index) {
      if (typeof this.storage.key === 'function') {
        return this.storage.key(index);
      }
      const keys = this._getAllKeys();
      return keys[index] !== undefined ? keys[index] : null;
    }

    get length() {
      if (typeof this.storage.length === 'number') {
        return this.storage.length;
      }
      return this._getAllKeys().length;
    }

    /**
     * 讀取並解析 JSON 資料
     * 若鍵不存在或為 null 則回傳 defaultValue；若資料語法損毀則直接拋出錯誤。
     */
    getJSON(key, defaultValue = null) {
      const raw = this.getItem(key);
      if (raw === null || raw === undefined) {
        return defaultValue;
      }
      return JSON.parse(raw);
    }

    /**
     * 序列化並寫入 JSON 資料
     */
    setJSON(key, value) {
      this.setItem(key, JSON.stringify(value));
    }

    /**
     * 內部工具：跨儲存後端取得所有 key 清單
     */
    _getAllKeys() {
      const keys = new Set();
      try {
        if (typeof this.storage.length === 'number' && typeof this.storage.key === 'function') {
          for (let i = 0; i < this.storage.length; i++) {
            const k = this.storage.key(i);
            if (k) keys.add(k);
          }
        }
      } catch (_) {}

      try {
        if (this.storage._store instanceof Map) {
          for (const k of this.storage._store.keys()) {
            keys.add(k);
          }
        }
      } catch (_) {}

      try {
        if (this.storage.store && typeof this.storage.store === 'object') {
          for (const k of Object.keys(this.storage.store)) {
            keys.add(k);
          }
        }
      } catch (_) {}

      try {
        for (const k of Object.keys(this.storage)) {
          if (typeof this.storage[k] !== 'function') {
            keys.add(k);
          }
        }
      } catch (_) {}

      return Array.from(keys);
    }

    /**
     * 原子登出雙階掃除 (Dual-Phase Purge)
     * @param {string|null} playerId 當前玩家 ID
     * @param {string|null} groupId 當前小組 ID
     */
    purgeUserSession(playerId = null, groupId = null) {
      // Phase 1: 標靶清除特定會話項目
      const targetKeys = [
        'vital_current_player',
        'vital_session_token',
        'vital_current_group',
        'vital_group_journey',
        'vital_offline_queue',
        'vital_footprints_cache_guest'
      ];

      if (playerId) {
        targetKeys.push(
          `vital_player_milestones_${playerId}`,
          `vital_daily_records_${playerId}`,
          `vital_meeting_records_${playerId}`,
          `vital_footprints_cache_${playerId}`,
          `vital_tasks_prompt_date_${playerId}`
        );
      }

      if (groupId) {
        targetKeys.push(
          `vital_group_progress_${groupId}`,
          `vital_group_milestones_${groupId}`,
          `vital_group_profile_${groupId}`,
          `vital_group_members_${groupId}`,
          `vital_chat_cache_${groupId}`
        );
      }

      for (const k of targetKeys) {
        this.removeItem(k);
      }

      // Phase 2: 全域掃描 vital_ 前綴快取，白名單保護全域設定
      const WHITELIST = new Set([
        'vital_chapters_config',
        'vital_points_config',
        'vital_achievements_config',
        'vital_tasks_config',
        'vital_configs_cached_date',
        'vital_keep_login',
        'vital_area_options_cache',
        'vital_announcements'
      ]);

      const allKeys = this._getAllKeys();
      for (const k of allKeys) {
        if (typeof k === 'string' && k.startsWith('vital_') && !WHITELIST.has(k)) {
          this.removeItem(k);
        }
      }
    }

    // 靜態轉發捷徑
    static getItem(key) {
      return StorageGateway.getInstance().getItem(key);
    }
    static setItem(key, value) {
      StorageGateway.getInstance().setItem(key, value);
    }
    static removeItem(key) {
      StorageGateway.getInstance().removeItem(key);
    }
    static clear() {
      StorageGateway.getInstance().clear();
    }
    static getJSON(key, defaultValue = null) {
      return StorageGateway.getInstance().getJSON(key, defaultValue);
    }
    static setJSON(key, value) {
      StorageGateway.getInstance().setJSON(key, value);
    }
    static purgeUserSession(playerId = null, groupId = null) {
      StorageGateway.getInstance().purgeUserSession(playerId, groupId);
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StorageGateway, MemoryFallbackAdapter };
  }
  global.StorageGateway = StorageGateway;
  global.MemoryFallbackAdapter = MemoryFallbackAdapter;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : global));
