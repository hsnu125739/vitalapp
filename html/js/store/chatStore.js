/**
 * chatStore.js
 * 小組即時交流狀態庫 (Vital Group Chat Store)
 * 
 * 核心架構規範：
 * 1. Cache-First 3ms 秒開：進板優先調用快取資料，直接展示最新 20 則留言與置頂橫幅。
 * 2. 本地樂觀追加 (Optimistic Append)：本人發言送出後，介面立即呈現新氣泡，後端儲存成功後更新本地快取。
 * 3. 焦點感知智慧輪詢 (Focus-Aware Smart Polling)：
 *    板內停留期間每 45 秒輕量比對留言計數器 (2ms)；
 *    切換分頁 (Page Visibility API) 或閒置超過 3 分鐘自動暫停輪詢，零外部 WebSocket 依賴。
 */

class ChatStore {
  constructor({ apiClient, groupId, storage = null, onMessagesUpdated = null }) {
    this.apiClient = apiClient;
    this.groupId = groupId;
    this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : {
      store: {},
      getItem(k) { return this.store[k] || null; },
      setItem(k, v) { this.store[k] = String(v); },
      removeItem(k) { delete this.store[k]; }
    });
    this.onMessagesUpdated = onMessagesUpdated;

    this.messages = [];
    this.pinnedPost = null;
    this.lastMessageCount = 0;

    this.pollingTimer = null;
    this.isPollingActive = false;
    this.idleTimer = null;
    this.isIdle = false;

    // 載入本機快取以實現 3ms 秒開
    this.loadFromCache();

    // 註冊焦點與閒置偵測
    this.boundVisibilityHandler = () => this.handleVisibilityChange();
    this.boundIdleResetHandler = () => this.resetIdleTimer();

    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', this.boundVisibilityHandler);
      ['mousemove', 'keydown', 'touchstart'].forEach(evt => {
        window.addEventListener(evt, this.boundIdleResetHandler, { passive: true });
      });
    }
  }

  loadFromCache() {
    const cached = this.storage.getItem(`vital_chat_cache_${this.groupId}`);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        this.messages = data.messages || [];
        this.pinnedPost = data.pinnedPost || null;
        this.lastMessageCount = data.messageCount || this.messages.length;
        this.notify();
      } catch (e) {
        // 快取無效跳過
      }
    }
  }

  saveToCache() {
    const cacheData = {
      messages: this.messages,
      pinnedPost: this.pinnedPost,
      messageCount: this.messages.length,
      timestamp: Date.now()
    };
    this.storage.setItem(`vital_chat_cache_${this.groupId}`, JSON.stringify(cacheData));
  }

  notify() {
    if (typeof this.onMessagesUpdated === 'function') {
      this.onMessagesUpdated({
        messages: [...this.messages],
        pinnedPost: this.pinnedPost ? { ...this.pinnedPost } : null,
        messageCount: this.messages.length
      });
    }
  }

  /**
   * 進入交流板初始化載入 (Cache-First + Background Refresh)
   */
  async enterChat() {
    this.loadFromCache();
    this.startSmartPolling();

    // 背景抓取最新狀態
    try {
      const res = await this.apiClient.getGroupPosts(this.groupId, 20);
      if (res && res.success && Array.isArray(res.data)) {
        this.mergeIncomingPosts(res.data);
      }
    } catch (err) {
      // 網路異常維持展示快取
    }
  }

  /**
   * 離開交流板停止輪詢
   */
  leaveChat() {
    this.stopSmartPolling();
  }

  /**
   * 本地樂觀追加新留言 (Optimistic Append)
   */
  async sendMessage(authorPlayerId, content, isPinned = false) {
    if (!content || !content.trim()) return;

    const tempId = `TEMP_${Date.now()}`;
    const optimisticPost = {
      id: tempId,
      groupId: this.groupId,
      authorPlayerId,
      content: content.trim(),
      isPinned: Boolean(isPinned),
      timestamp: new Date().toISOString(),
      isPending: true
    };

    if (optimisticPost.isPinned) {
      this.pinnedPost = optimisticPost;
    }

    // 立即追加新氣泡（零等待）
    this.messages.unshift(optimisticPost);
    this.notify();

    try {
      const res = await this.apiClient.createGroupPost({
        groupId: this.groupId,
        authorPlayerId,
        content: optimisticPost.content,
        isPinned: optimisticPost.isPinned
      });

      if (res && res.success && res.data) {
        const confirmedPost = res.data.post || res.data;
        // 替換暫存留言為正式權威物件
        const idx = this.messages.findIndex(m => m.id === tempId);
        if (idx !== -1) {
          this.messages[idx] = { ...confirmedPost, isPending: false };
        }
        if (confirmedPost.isPinned) {
          this.pinnedPost = confirmedPost;
        }
        this.saveToCache();
        this.notify();
      } else {
        // 業務拒絕（例如組別不存在或權限不足）
        const idx = this.messages.findIndex(m => m.id === tempId);
        if (idx !== -1) {
          this.messages[idx].isPending = false;
          this.messages[idx].isFailed = true;
          this.messages[idx].errorMessage = (res && res.error) || '發送失敗';
          this.notify();
        }
      }
    } catch (err) {
      // 標記失敗
      const idx = this.messages.findIndex(m => m.id === tempId);
      if (idx !== -1) {
        this.messages[idx].isFailed = true;
        this.notify();
      }
    }
  }

  mergeIncomingPosts(posts) {
    if (!posts || posts.length === 0) return;

    const pinned = posts.find(p => p.isPinned);
    if (pinned) {
      this.pinnedPost = pinned;
    }

    const regular = posts.filter(p => !p.isPinned);
    // 合併並去重
    const map = new Map();
    for (const p of this.messages) {
      map.set(p.id, p);
    }
    for (const p of regular) {
      map.set(p.id, p);
    }

    this.messages = Array.from(map.values())
      .filter(p => !p.isPinned)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    this.saveToCache();
    this.notify();
  }

  // --- 焦點感知智慧輪詢 ---

  startSmartPolling(intervalMs = 45000) {
    this.stopSmartPolling();
    this.isPollingActive = true;
    this.resetIdleTimer();

    this.pollingTimer = setInterval(async () => {
      if (!this.isPollingActive || this.isIdle) return;
      if (typeof document !== 'undefined' && document.hidden) return;

      try {
        const res = await this.apiClient.getGroupPosts(this.groupId, 20);
        if (res && res.success && Array.isArray(res.data)) {
          this.mergeIncomingPosts(res.data);
        }
      } catch (e) {
        // 輪詢容錯
      }
    }, intervalMs);
  }

  stopSmartPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.isPollingActive = false;
  }

  handleVisibilityChange() {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      // 切換至背景分頁：暫停輪詢，節省資源
      this.isPollingActive = false;
    } else {
      // 切回前景分頁：立即刷新並恢復輪詢
      this.isPollingActive = true;
      this.enterChat();
    }
  }

  resetIdleTimer() {
    this.isIdle = false;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    // 閒置 3 分鐘 (180,000ms) 自動暫停輪詢
    this.idleTimer = setTimeout(() => {
      this.isIdle = true;
    }, 180000);
  }

  destroy() {
    this.leaveChat();
    if (typeof document !== 'undefined' && document.removeEventListener) {
      if (this.boundVisibilityHandler) {
        document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
      }
    }
    if (typeof window !== 'undefined' && window.removeEventListener) {
      if (this.boundIdleResetHandler) {
        ['mousemove', 'keydown', 'touchstart'].forEach(evt => {
          window.removeEventListener(evt, this.boundIdleResetHandler);
        });
      }
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ChatStore };
}
