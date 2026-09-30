/**
 * apiClient.js
 * 前端統一 API 客戶端閘道 (Unified API Client Deep Module)
 * 
 * 依據 codebase-design 與 ADR-0001 規範實作：
 * 1. 深度封裝（Depth）：以極簡介面 request(action, data) 隱藏 Session 簽署、逾時重試與多通道適配器。
 * 2. 雙棲適配器（Adapters at the Seam）：
 *    - IframeRpcAdapter：線上環境（GitHub Pages）透過 Core/Chat/Progression 3 微服務 Iframe Bridge，徹底消除 GAS 302 跨域重定向。
 *    - DirectGatewayAdapter：測試與同構環境直接注入 index.doPost。
 *    - FetchAdapter：標準 HTTP POST 呼叫。
 * 3. 內建 Stale-While-Revalidate 快取（例如照顧區選單 0ms 秒開）。
 * 4. 401 鑑權過期統一攔截與自動清理。
 */

(function(global) {
  'use strict';

  const DEFAULT_TIMEOUT_MS = 45 * 1000;

  const CHAT_ACTIONS = new Set([
    'getGroupPosts',
    'createGroupPost',
    'pinGroupPost',
    'deleteGroupPost',
    'setGroupAnnouncement',
    'clearGroupAnnouncement'
  ]);

  const PROGRESSION_ACTIONS = new Set([
    'getPlayerChestCollection',
    'claimPlayerChestReward',
    'claimChest',
    'getMyGroupContributionSummary',
    'getMilestonesConfig',
    'getPointsConfig',
    'getGroupJourney',
    'getGroupJourneyList',
    'settleMemberDeparture',
    'archiveAnnualGroupProgress',
    'grantTargetedReward'
  ]);

  const DEFAULT_DISTRICTS = [
    {
      careDistrict: '西照顧區',
      districtSortOrder: 1,
      careAreas: [{ careArea: '西一區' }, { careArea: '西二區' }, { careArea: '鼓山大區' }]
    },
    {
      careDistrict: '東照顧區',
      districtSortOrder: 2,
      careAreas: [{ careArea: '東一區' }, { careArea: '東二區' }, { careArea: '鳳山大區' }]
    },
    {
      careDistrict: '北照顧區',
      districtSortOrder: 3,
      careAreas: [{ careArea: '北一區' }, { careArea: '北二區' }, { careArea: '三民大區' }]
    },
    {
      careDistrict: '南照顧區',
      districtSortOrder: 4,
      careAreas: [{ careArea: '南一區' }, { careArea: '南二區' }, { careArea: '前鎮大區' }]
    }
  ];

  class ApiClient {
    constructor({ baseUrl = '', directGateway = null, storage = null, onSessionExpired = null } = {}) {
      this.baseUrl = baseUrl;
      this.directGateway = directGateway;
      this.onSessionExpired = onSessionExpired;

      this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : {
        store: {},
        getItem(k) { return this.store[k] || null; },
        setItem(k, v) { this.store[k] = String(v); },
        removeItem(k) { delete this.store[k]; }
      });

      this.token = this.storage.getItem('vital_session_token') || null;
      this.requestSeq = 0;
      this.pendingRequests = new Map();

      // Iframe 通道池
      this.channels = {
        CORE: { name: 'CORE', url: '', frame: null, source: null, readyPromise: null, readyResolve: null },
        CHAT: { name: 'CHAT', url: '', frame: null, source: null, readyPromise: null, readyResolve: null },
        PROGRESSION: { name: 'PROGRESSION', url: '', frame: null, source: null, readyPromise: null, readyResolve: null }
      };

      // 照顧區快取 SWR
      this.cachedAreaOptions = null;
      try {
        const stored = this.storage.getItem('vital_area_options_cache');
        if (stored) this.cachedAreaOptions = JSON.parse(stored);
      } catch (e) {}

      // 若在瀏覽器中且具備 window.APP_RUNTIME_CONFIG，自動初始化 Iframe Bridge 監聽
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        this.initIframeBridge_();
      }
    }

    setSessionToken(token) {
      this.token = token;
      if (token) {
        this.storage.setItem('vital_session_token', token);
      } else {
        this.storage.removeItem('vital_session_token');
      }
    }

    getSessionToken() {
      return this.token;
    }

    getPlayerIdFromToken() {
      if (this.token && typeof this.token === 'string') {
        try {
          const parts = this.token.split('::');
          if (parts.length >= 1 && parts[0]) {
            if (typeof atob === 'function') {
              return atob(parts[0]);
            } else if (typeof Buffer !== 'undefined') {
              return Buffer.from(parts[0], 'base64').toString('utf8');
            }
          }
        } catch (e) {}
      }
      try {
        const userStr = this.storage.getItem('vital_current_player');
        if (userStr) {
          const u = JSON.parse(userStr);
          return u.playerId || u.id || u.username || '';
        }
      } catch (e) {}
      return '';
    }

    getMatrixColIndexFromStorage() {
      try {
        const userStr = this.storage.getItem('vital_current_player');
        if (userStr) {
          const u = JSON.parse(userStr);
          const col = Number(u.matrixColIndex || u.colIndex);
          if (!isNaN(col) && col >= 2) return col;
        }
      } catch (e) {}
      return null;
    }

    getPostsColIndexFromStorage() {
      try {
        const userStr = this.storage.getItem('vital_current_player');
        if (userStr) {
          const u = JSON.parse(userStr);
          const col = Number(u.postsColIndex || u.groupPostsColIndex);
          if (!isNaN(col) && col >= 2) return col;
        }
      } catch (e) {}
      try {
        const groupStr = this.storage.getItem('vital_current_group');
        if (groupStr) {
          const g = JSON.parse(groupStr);
          const col = Number(g.postsColIndex);
          if (!isNaN(col) && col >= 2) return col;
        }
      } catch (e) {}
      return null;
    }

    getGroupIdFromStorage() {
      try {
        const userStr = this.storage.getItem('vital_current_player');
        if (userStr) {
          const u = JSON.parse(userStr);
          if (u.groupId) return String(u.groupId).trim();
        }
      } catch (e) {}
      try {
        const groupStr = this.storage.getItem('vital_current_group');
        if (groupStr) {
          const g = JSON.parse(groupStr);
          if (g.groupId) return String(g.groupId).trim();
        }
      } catch (e) {}
      return null;
    }

    clearSessionToken() {
      this.token = null;
      this.storage.removeItem('vital_session_token');
      this.storage.removeItem('vital_current_player');
    }

    handleSessionExpired_() {
      this.clearSessionToken();
      if (typeof this.onSessionExpired === 'function') {
        this.onSessionExpired();
      } else if (typeof window !== 'undefined' && window.location) {
        if (typeof window.showAuthView === 'function') {
          window.showAuthView();
        }
      }
    }

    // --- Iframe Bridge 核心實作 ---

    initIframeBridge_() {
      window.addEventListener('message', (event) => {
        const msg = event.data;
        if (!msg || typeof msg !== 'object') return;

        // 1. 橋接就緒廣播
        if (msg.type === 'GAS_BRIDGE_READY') {
          const sName = (msg.service || '').toUpperCase();
          if (this.channels[sName]) {
            this.channels[sName].source = event.source;
            if (this.channels[sName].readyResolve) this.channels[sName].readyResolve(event.source);
          } else {
            Object.keys(this.channels).forEach(k => {
              if (!this.channels[k].source) {
                this.channels[k].source = event.source;
                if (this.channels[k].readyResolve) this.channels[k].readyResolve(event.source);
              }
            });
          }
          return;
        }

        // 2. RPC 回應
        if (msg.id && this.pendingRequests.has(String(msg.id))) {
          const { resolve, reject, timer } = this.pendingRequests.get(String(msg.id));
          clearTimeout(timer);
          this.pendingRequests.delete(String(msg.id));

          if (msg.success) {
            let outData = msg.data;
            if (outData !== undefined && typeof outData === 'object' && outData !== null) {
              resolve({ success: true, ...msg, ...outData });
            } else {
              resolve(msg.data !== undefined ? msg.data : msg);
            }
          } else {
            const err = new Error(msg.error || 'GAS RPC 執行失敗');
            err.code = msg.code || 'GAS_RPC_ERROR';
            if (msg.code === 401 || String(msg.error).includes('SESSION')) {
              this.handleSessionExpired_();
            }
            reject(err);
          }
        }
      });

      // 自動預熱通道
      if (window.APP_RUNTIME_CONFIG) {
        this.ensureChannel_('CORE');
        this.ensureChannel_('CHAT');
        this.ensureChannel_('PROGRESSION');
      }
    }

    getTargetService_(action) {
      if (CHAT_ACTIONS.has(action)) return 'CHAT';
      if (PROGRESSION_ACTIONS.has(action)) return 'PROGRESSION';
      return 'CORE';
    }

    getServiceUrl_(serviceName) {
      const config = (typeof window !== 'undefined' && window.APP_RUNTIME_CONFIG) || {};
      if (serviceName === 'CHAT') return String(config.chatGasWebAppUrl || '').trim();
      if (serviceName === 'PROGRESSION') return String(config.progressionGasWebAppUrl || '').trim();
      return String(config.coreGasWebAppUrl || '').trim();
    }

    ensureChannel_(serviceName) {
      const channel = this.channels[serviceName];
      if (!channel) return Promise.reject(new Error('Unknown service: ' + serviceName));
      if (channel.readyPromise) return channel.readyPromise;

      const url = this.getServiceUrl_(serviceName);
      channel.url = url;

      channel.readyPromise = new Promise((resolve) => {
        channel.readyResolve = resolve;
        if (!url || typeof document === 'undefined') return;

        const mount = () => {
          if (channel.frame || !document.body) return;
          const iframe = document.createElement('iframe');
          iframe.id = 'gas_bridge_' + serviceName.toLowerCase();
          iframe.setAttribute('aria-hidden', 'true');
          iframe.setAttribute('tabindex', '-1');
          iframe.style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;border:0;opacity:0;pointer-events:none;';
          iframe.src = url;
          channel.frame = iframe;
          document.body.appendChild(iframe);
        };

        if (document.body) mount();
        else document.addEventListener('DOMContentLoaded', mount, { once: true });
      });

      return channel.readyPromise;
    }

    async invokeIframeRpc_(action, data) {
      const serviceName = this.getTargetService_(action);
      const channel = this.channels[serviceName];

      await this.ensureChannel_(serviceName);

      if (!channel.source) {
        await Promise.race([
          channel.readyPromise,
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`微服務 [${serviceName}] 連線逾時`)), 15000);
          })
        ]);
      }

      const reqId = 'req_' + serviceName.toLowerCase() + '_' + Date.now().toString(36) + '_' + (++this.requestSeq);
      const payload = {
        action,
        token: this.token,
        sessionToken: this.token,
        ...data
      };

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pendingRequests.delete(reqId);
          reject(new Error(`呼叫 [${action}] 回應逾時 (${Math.round(DEFAULT_TIMEOUT_MS / 1000)}s)`));
        }, DEFAULT_TIMEOUT_MS);

        this.pendingRequests.set(reqId, { resolve, reject, timer });

        try {
          const pId = (payload && payload.playerId) || (data && (data.playerId || data.targetId)) || this.getPlayerIdFromToken() || '';
          const colIdx = (payload && payload.matrixColIndex) || (data && (data.matrixColIndex || data.colIndex)) || this.getMatrixColIndexFromStorage();
          const grpId = (payload && payload.groupId) || (data && data.groupId) || this.getGroupIdFromStorage() || '';
          const pColIdx = (payload && payload.postsColIndex) || (data && (data.postsColIndex || data.groupPostsColIndex)) || this.getPostsColIndexFromStorage();
          channel.source.postMessage({
            type: 'GAS_CALL',
            id: reqId,
            targetService: serviceName,
            action: action,
            token: this.token,
            sessionToken: this.token,
            playerId: pId,
            groupId: grpId,
            matrixColIndex: colIdx,
            postsColIndex: pColIdx,
            args: [payload],
            payload: payload
          }, '*');
        } catch (err) {
          clearTimeout(timer);
          this.pendingRequests.delete(reqId);
          reject(err);
        }
      });
    }

    // --- 統一 RPC 派發核心 (Request Core) ---

    async request(action, data = {}) {
      const pId = (data && (data.playerId || data.targetId)) || this.getPlayerIdFromToken() || '';
      const colIndex = (data && (data.matrixColIndex || data.colIndex)) || this.getMatrixColIndexFromStorage();
      const grpId = (data && data.groupId) || this.getGroupIdFromStorage() || '';
      const postsColIndex = (data && (data.postsColIndex || data.groupPostsColIndex)) || this.getPostsColIndexFromStorage();
      const payload = {
        action,
        token: this.token,
        sessionToken: this.token,
        playerId: pId,
        groupId: grpId,
        matrixColIndex: colIndex,
        postsColIndex: postsColIndex,
        data: data || {}
      };
      if (typeof data === 'object' && data !== null) {
        Object.assign(payload, data);
        if (!payload.playerId && pId) {
          payload.playerId = pId;
        }
        if (!payload.groupId && grpId) {
          payload.groupId = grpId;
        }
        if (!payload.matrixColIndex && colIndex) {
          payload.matrixColIndex = colIndex;
        }
        if (!payload.postsColIndex && postsColIndex) {
          payload.postsColIndex = postsColIndex;
        }
      }

      // 照顧區特例：0ms SWR 秒開
      if (action === 'getRegistrationAreaOptions') {
        const activeOptions = (this.cachedAreaOptions && this.cachedAreaOptions.length)
          ? this.cachedAreaOptions
          : DEFAULT_DISTRICTS;

        // 背景非同步向後端同步最新定義
        this.requestRaw_('getRegistrationAreaOptions', data).then((res) => {
          const dList = res && (res.districts || (res.data && res.data.districts));
          if (Array.isArray(dList) && dList.length > 0) {
            this.cachedAreaOptions = dList;
            try {
              this.storage.setItem('vital_area_options_cache', JSON.stringify(dList));
            } catch (e) {}
          }
        }).catch(() => {});

        return {
          success: true,
          districts: activeOptions,
          data: { districts: activeOptions }
        };
      }

      return this.requestRaw_(action, payload);
    }

    async requestRaw_(action, payload) {
      // 1. 若有直接注入的後端網關（Node/GAS 整合測試）
      if (this.directGateway) {
        const res = this.directGateway.doPost(payload);
        if (res && (res.code === 401 || (res.error && res.error.includes('SESSION')))) {
          this.handleSessionExpired_();
        }
        return res;
      }

      // 2. 若運行於瀏覽器且有 Iframe Bridge 設定
      const hasBridgeConfig = typeof window !== 'undefined' &&
        window.APP_RUNTIME_CONFIG &&
        (window.APP_RUNTIME_CONFIG.coreGasWebAppUrl || window.APP_RUNTIME_CONFIG.chatGasWebAppUrl);

      if (hasBridgeConfig) {
        try {
          const res = await this.invokeIframeRpc_(action, payload);
          return res;
        } catch (rpcErr) {
          // 若為 Session 錯誤，觸發清理
          if (rpcErr.code === 401 || String(rpcErr.message).includes('SESSION')) {
            this.handleSessionExpired_();
          }
          throw rpcErr;
        }
      }

      // 3. 標準瀏覽器 fetch
      try {
        const resp = await fetch(this.baseUrl || '/api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await resp.json();
        if (result && (result.code === 401 || (result.error && String(result.error).includes('SESSION')))) {
          this.handleSessionExpired_();
        }
        return result;
      } catch (netErr) {
        return {
          success: false,
          error: '網路連線異常：' + netErr.message,
          isNetworkError: true
        };
      }
    }

    // --- 領域便利方法 (Domain Methods) ---

    ping() { return this.request('ping'); }

    async register(userData) {
      const res = await this.request('register', userData);
      const token = res && res.token;
      if (token) this.setSessionToken(token);
      return res;
    }

    async login(username, password) {
      const res = await this.request('login', { username, password });
      const token = res && res.token;
      if (token) this.setSessionToken(token);
      return res;
    }

    async getProfile() {
      return await this.request('getProfile');
    }

    updateProfile(updates) { return this.request('updateProfile', { updates }); }
    async updatePassword(currentPassword, newPassword) {
      const pId = this.getPlayerIdFromToken();
      const payload = {
        currentPassword: currentPassword,
        currentPasswordCode: currentPassword,
        newPassword: newPassword,
        newPasswordCode: newPassword,
        playerId: pId,
        token: this.token,
        sessionToken: this.token
      };
      try {
        const res = await this.request('updateMyPassword', payload);
        return res;
      } catch (err) {
        const msg = String(err.message || '');
        if (msg.includes('UNKNOWN_ACTION') || msg.includes('未知的 Action') || msg.includes('updateMyPassword')) {
          try {
            return await this.request('updatePassword', payload);
          } catch (err2) {
            throw new Error('核心微服務尚未部署更新版本（未支援 updateMyPassword）。請管理者至 Google Apps Script 貼上最新 dist/core/Code.gs 並重新部署！');
          }
        }
        throw err;
      }
    }
    updateAvatar(avatarUrl) { return this.request('updatePlayerAvatar', { avatarUrl }); }

    getRegistrationAreaOptions() { return this.request('getRegistrationAreaOptions'); }

    // 操練與聚會打卡
    submitDailyPractice(data) {
      const col = (data && (data.matrixColIndex || data.colIndex)) || this.getMatrixColIndexFromStorage();
      return this.request('submitDailyPractice', { ...data, matrixColIndex: col });
    }
    submitMeetingPractice(data) {
      const col = (data && (data.matrixColIndex || data.colIndex)) || this.getMatrixColIndexFromStorage();
      return this.request('submitMeetingPractice', { ...data, matrixColIndex: col });
    }

    getFootprints(playerId = null, matrixColIndex = null) {
      const resolvedPlayerId = playerId || this.getPlayerIdFromToken() || '';
      const col = matrixColIndex || this.getMatrixColIndexFromStorage();
      return this.request('getFootprints', { playerId: resolvedPlayerId, matrixColIndex: col });
    }

    getHomeDashboard(playerId = null, matrixColIndex = null) {
      const resolvedPlayerId = playerId || this.getPlayerIdFromToken() || '';
      const col = matrixColIndex || this.getMatrixColIndexFromStorage();
      return this.request('getHomeDashboard', { playerId: resolvedPlayerId, matrixColIndex: col });
    }

    // 活力組與成長篇章
    createGroup(data) { return this.request('createGroup', data); }
    joinGroup(groupId, joinedDate = null) {
      if (typeof groupId === 'object' && groupId !== null) {
        return this.request('joinGroup', groupId);
      }
      return this.request('joinGroup', { groupId, joinedDate });
    }
    leaveGroup(groupId = null) { return this.request('leaveGroup', { groupId }); }
    getGroupJourney(groupId = null) {
      let resolvedGroupId = groupId;
      if (!resolvedGroupId) {
        try {
          const userStr = this.storage.getItem('vital_current_player');
          if (userStr) {
            const u = JSON.parse(userStr);
            resolvedGroupId = u.groupId || u.currentGroupId || '';
          }
        } catch (e) {}
      }
      const pId = this.getPlayerIdFromToken() || '';
      return this.request('getGroupJourney', { groupId: resolvedGroupId, playerId: pId });
    }
    getMyGroupContributionSummary(groupId = null, playerId = null) {
      const resolvedPlayerId = playerId || this.getPlayerIdFromToken() || '';
      return this.request('getMyGroupContributionSummary', { groupId, playerId: resolvedPlayerId });
    }

    // 小組交流板
    createGroupPost(data) {
      const col = (data && data.postsColIndex) || this.getPostsColIndexFromStorage();
      return this.request('createGroupPost', {
        ...data,
        postsColIndex: col
      });
    }
    pinGroupPost(data) {
      const col = (data && data.postsColIndex) || this.getPostsColIndexFromStorage();
      return this.request('pinGroupPost', { ...data, postsColIndex: col });
    }
    setGroupAnnouncement(data) {
      const col = (data && data.postsColIndex) || this.getPostsColIndexFromStorage();
      return this.request('setGroupAnnouncement', { ...data, postsColIndex: col });
    }
    clearGroupAnnouncement(groupId, postsColIndex = null) {
      const col = postsColIndex || this.getPostsColIndexFromStorage();
      return this.request('clearGroupAnnouncement', { groupId, postsColIndex: col });
    }
    getGroupPosts(groupId, limit = 30, postsColIndex = null) {
      const col = postsColIndex || this.getPostsColIndexFromStorage();
      return this.request('getGroupPosts', { groupId, limit, postsColIndex: col });
    }
    deleteGroupPost(postId) { return this.request('deleteGroupPost', { postId }); }

    // 成就與寶箱
    claimChest(tierId, playerId = null) {
      const resolvedPlayerId = playerId || this.getPlayerIdFromToken() || '';
      return this.request('claimChest', {
        tierId: tierId,
        chestTier: tierId,
        playerId: resolvedPlayerId,
        targetId: resolvedPlayerId
      });
    }
    getPlayerChestCollection() { return this.request('getPlayerChestCollection'); }

    // 系統公告
    getAnnouncements(currentDate = null) {
      return this.request('getAnnouncements', { currentDate });
    }
  }

  // 匯出至全域與模組環境
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ApiClient };
  }
  global.ApiClient = ApiClient;

  // 舊版 GasBackend 相容門面
  if (typeof window !== 'undefined') {
    window.GasBackend = {
      invoke(action, args) {
        if (!window.activeApiClient) {
          window.activeApiClient = new ApiClient();
        }
        const data = (args && typeof args[0] === 'object') ? args[0] : (args || {});
        return window.activeApiClient.request(action, data);
      }
    };
  }

})(typeof window !== 'undefined' ? window : global);
