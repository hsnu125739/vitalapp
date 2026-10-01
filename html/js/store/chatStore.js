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

(function(global) {
  'use strict';

class ChatStore {
  constructor({ apiClient, groupId, postsColIndex = null, storage = null, onMessagesUpdated = null }) {
    this.apiClient = apiClient;
    this.groupId = groupId;
    this.postsColIndex = postsColIndex ? Number(postsColIndex) : null;
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
   * 初始化小組 ID 並進入交流板
   */
  init(groupId, postsColIndex = null) {
    if (groupId) {
      this.groupId = groupId;
      if (postsColIndex) this.postsColIndex = Number(postsColIndex);
      this.loadFromCache();
      this.enterChat();
    }
  }

  /**
   * 背景抓取最新貼文與置頂公告（共用核心）
   */
  async fetchLatestPosts_() {
    if (!this.groupId) return;
    try {
      const res = await this.apiClient.getGroupPosts(this.groupId, 20, this.postsColIndex, this.lastMessageCount || null);
      if (res && res.success) {
        if (res.status === 304 || (res.data && res.data.status === 304)) return;
        if (res.postsColIndex) this.postsColIndex = Number(res.postsColIndex);
        if (res.data && res.data.messageCount !== undefined) this.lastMessageCount = res.data.messageCount;
        else if (res.messageCount !== undefined) this.lastMessageCount = res.messageCount;

        const incomingPosts = Array.isArray(res.data) ? res.data : (res.posts || (res.data && res.data.posts) || []);
        let ann = res.announcement !== undefined ? res.announcement : (res.data?.announcement !== undefined ? res.data.announcement : (res.pinnedPost !== undefined ? res.pinnedPost : res.data?.pinnedPost));
        this.mergeIncomingPosts(incomingPosts, ann);
      }
    } catch (err) {
      // 網路異常維持展示快取
    }
  }

  /**
   * 背景預載聊天室最新狀態 (供首頁切換時呼叫)
   */
  async prefetch() {
    this.loadFromCache();
    await this.fetchLatestPosts_();
  }

  /**
   * 進入交流板初始化載入 (Cache-First + Background Refresh)
   */
  async enterChat() {
    this.loadFromCache();
    this.startSmartPolling();
    await this.fetchLatestPosts_();
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
  async sendMessage(authorPlayerId, content, authorName = '', postsColIndex = null) {
    if (!content || !content.trim()) return;

    const col = postsColIndex || this.postsColIndex;
    const tempId = `TEMP_${Date.now()}`;
    const optimisticPost = {
      id: tempId,
      groupId: this.groupId,
      authorPlayerId: authorPlayerId,
      authorName: authorName || '聖徒',
      content: content.trim(),
      isPinned: false, // 留言發布與置頂解耦，所有留言皆發布為常態留言
      timestamp: new Date().toISOString(),
      isPending: true
    };

    // 立即追加新氣泡（零等待）
    this.messages.unshift(optimisticPost);
    this.notify();

    try {
      const res = await this.apiClient.createGroupPost({
        groupId: this.groupId,
        authorPlayerId: authorPlayerId,
        authorName: authorName,
        content: optimisticPost.content,
        postsColIndex: col
      });

      if (res && res.success && res.data) {
        if (res.postsColIndex) this.postsColIndex = Number(res.postsColIndex);
        const confirmedPost = res.data.post || res.data;
        // 替換暫存留言為正式權威物件
        const idx = this.messages.findIndex(m => m.id === tempId);
        if (idx !== -1) {
          const ts = confirmedPost.timestamp || (confirmedPost.createdAt ? new Date(confirmedPost.createdAt).toISOString() : this.messages[idx].timestamp);
          this.messages[idx] = {
            ...confirmedPost,
            id: confirmedPost.id || confirmedPost.postId || tempId,
            timestamp: ts,
            authorPlayerId: confirmedPost.authorPlayerId || confirmedPost.authorId || authorPlayerId,
            authorName: confirmedPost.authorName || authorName || '聖徒',
            isPending: false
          };
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

  async setAnnouncement(content, authorName = '', authorPlayerId = '', sourcePostId = '', postsColIndex = null) {
    if (!content || !content.trim()) return;
    const col = postsColIndex || this.postsColIndex;
    const annObj = {
      content: content.trim(),
      authorName: authorName || '聖徒',
      authorPlayerId: authorPlayerId,
      sourcePostId: sourcePostId,
      updatedAt: Date.now()
    };
    // 立即樂觀更新
    this.pinnedPost = annObj;
    this.saveToCache();
    this.notify();

    try {
      const res = await this.apiClient.setGroupAnnouncement({
        groupId: this.groupId,
        content: annObj.content,
        authorName: annObj.authorName,
        authorPlayerId: annObj.authorPlayerId,
        sourcePostId: annObj.sourcePostId,
        postsColIndex: col
      });
      if (res && res.postsColIndex) {
        this.postsColIndex = Number(res.postsColIndex);
      }
    } catch (err) {
      console.warn('[ChatStore] 設定小組公告失敗', err);
    }
  }

  async clearAnnouncement(postsColIndex = null) {
    const col = postsColIndex || this.postsColIndex;
    // 立即樂觀清除本機置頂公告
    this.pinnedPost = null;
    this.saveToCache();
    this.notify();

    try {
      const res = await this.apiClient.clearGroupAnnouncement(this.groupId, col);
      if (res && res.postsColIndex) {
        this.postsColIndex = Number(res.postsColIndex);
      }
      return res;
    } catch (err) {
      console.warn('[ChatStore] 清除小組公告失敗', err);
    }
  }

  mergeIncomingPosts(posts, announcement = undefined) {
    if (announcement !== undefined) {
      if (announcement && announcement.content) {
        this.pinnedPost = announcement;
      } else if (announcement === null) {
        this.pinnedPost = null;
      }
    }

    if (!posts || posts.length === 0) {
      this.saveToCache();
      this.notify();
      return;
    }

    const pinnedFromPosts = posts.find(p => p.isPinned);
    if (pinnedFromPosts && !this.pinnedPost) {
      this.pinnedPost = pinnedFromPosts;
    }

    const regular = posts.filter(p => !p.isPinned);
    const map = new Map();
    for (const p of this.messages) {
      const pid = p.id || p.postId;
      const ts = p.timestamp || (p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString());
      map.set(pid, { ...p, id: pid, timestamp: ts, authorPlayerId: p.authorPlayerId || p.authorId || '' });
    }
    for (const p of regular) {
      const pid = p.id || p.postId;
      const ts = p.timestamp || (p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString());
      map.set(pid, { ...p, id: pid, timestamp: ts, authorPlayerId: p.authorPlayerId || p.authorId || '' });
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
        const res = await this.apiClient.getGroupPosts(this.groupId, 20, this.postsColIndex, this.lastMessageCount || null);
        if (res && res.success) {
          if (res.status === 304 || (res.data && res.data.status === 304)) {
            // Nothing changed in posts, but maybe announcement did? Actually we can skip merge.
            return;
          }
          if (res.postsColIndex) this.postsColIndex = Number(res.postsColIndex);
          if (res.data && res.data.messageCount !== undefined) this.lastMessageCount = res.data.messageCount;
          else if (res.messageCount !== undefined) this.lastMessageCount = res.messageCount;

          const incomingPosts = Array.isArray(res.data) ? res.data : (res.posts || (res.data && res.data.posts) || []);
          let ann = undefined;
          if (res.announcement !== undefined) ann = res.announcement;
          else if (res.data && res.data.announcement !== undefined) ann = res.data.announcement;
          else if (res.pinnedPost !== undefined) ann = res.pinnedPost;
          else if (res.data && res.data.pinnedPost !== undefined) ann = res.data.pinnedPost;
          this.mergeIncomingPosts(incomingPosts, ann);
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
  global.ChatStore = ChatStore;

})(typeof window !== 'undefined' ? window : global);
