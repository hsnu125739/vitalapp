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
    // Canonical Actions (6 端點)
    'ping',
    'getMessages',
    'postMessage',
    'setGroupAnnouncement',
    'deleteMessage',
    'clearGroupChat',
    // Legacy Aliases
    'getGroupPosts',
    'createGroupPost',
    'pinGroupPost',
    'deleteGroupPost',
    'clearGroupAnnouncement'
  ]);

  const PROGRESSION_ACTIONS = new Set([
    // Canonical Actions (17 端點)
    'clearProgressionConfigCache',
    'getPointsConfig',
    'getMilestonesConfig',
    'getChapterConfigs',
    'getAchievementConfigs',
    'getTaskConfigs',
    'getProgressBundle',
    'getPlayerProgress',
    'getGroupProgress',
    'getGroupJourney',
    'getGroupJourneyList',
    'syncGroupMembership',
    'archiveAnnualGroupProgress',
    'grantTargetedReward',
    'evaluateTargetMilestones',
    'runDailyMilestoneSettlement',
    // Legacy Aliases
    'getChapterConfig',
    'getAchievementConfig',
    'getTasksConfig',
    'getMyGroupContributionSummary',
    'settleMemberDeparture'
  ]);

  /**
   * 在途請求互斥鎖動作清單 (In-Flight Exclusive Mutating Actions)
   * 規則：同時間僅允許一個同名寫入動作在途傳輸，重複呼叫於前端網路層直接攔截，絕不送至後端。
   * 注意：每日與每週打卡 (submitDailyPractice, submitMeetingPractice) 具備專屬 OptimisticPracticeStore 佇列，嚴格排除於此鎖之外。
   */
  const MUTATING_EXCLUSIVE_ACTIONS = new Set([
    // Canonical Actions
    'createGroup',
    'joinGroup',
    'leaveGroup',
    'transferGroupLeader',
    'updateAvatar',
    'updatePassword',
    'register',
    'login',
    'adminLogin',
    'updateAdminPassword',
    'createAnnouncement',
    'clearSystemCache',
    'postMessage',
    'setGroupAnnouncement',
    'deleteMessage',
    'clearGroupChat',
    'grantTargetedReward',
    'runDailyMilestoneSettlement',
    'syncGroupMembership',
    'archiveAnnualGroupProgress',
    'clearProgressionConfigCache',
    // Legacy Aliases
    'createVitalGroup',
    'leaveVitalGroup',
    'joinVitalGroupByInviteCode',
    'updatePlayerAvatar',
    'updateMyPassword',
    'updateProfile',
    'createGroupPost',
    'pinGroupPost',
    'setPinnedPost',
    'clearGroupAnnouncement',
    'deleteGroupPost'
  ]);

  const DEFAULT_DISTRICTS = [
    {
      careDistrict: '東',
      districtSortOrder: 1,
      careAreas: [
        { careArea: '昌裕' }, { careArea: '文藻' }, { careArea: '建興' },
        { careArea: '大豐' }, { careArea: '文山' }, { careArea: '仁鳥' },
        { careArea: '旗美一' }, { careArea: '旗美二' }, { careArea: '旗美三' }
      ]
    },
    {
      careDistrict: '西',
      districtSortOrder: 2,
      careAreas: [
        { careArea: '左營' }, { careArea: '翠華' }, { careArea: '後驛' },
        { careArea: '明誠' }, { careArea: '博愛' }, { careArea: '重愛' }, { careArea: '裕誠' }
      ]
    },
    {
      careDistrict: '中',
      districtSortOrder: 3,
      careAreas: [
        { careArea: '新盛' }, { careArea: '四維' }, { careArea: '七賢' },
        { careArea: '臺語' }, { careArea: '愛河' }, { careArea: '壽山' }
      ]
    },
    {
      careDistrict: '南A',
      districtSortOrder: 4,
      careAreas: [
        { careArea: '新苓' }, { careArea: '五福' }, { careArea: '文化' },
        { careArea: '民生' }, { careArea: '三多' }, { careArea: '中正' },
        { careArea: '前鎮' }, { careArea: '民權' }, { careArea: '光華' },
        { careArea: '獅甲' }, { careArea: '瑞隆' }
      ]
    },
    {
      careDistrict: '南B',
      districtSortOrder: 5,
      careAreas: [
        { careArea: '五甲' }, { careArea: '曹公' }, { careArea: '青年' },
        { careArea: '中山' }, { careArea: '小港' }, { careArea: '大寮' }, { careArea: '林園' }
      ]
    },
    {
      careDistrict: '北',
      districtSortOrder: 6,
      careAreas: [
        { careArea: '岡山' }, { careArea: '路竹' }, { careArea: '楠梓' },
        { careArea: '右昌' }, { careArea: '梓橋' }
      ]
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
      this.inFlightMutex = new Set();

      // Iframe 通道池
      this.channels = {
        CORE: { name: 'CORE', url: '', frame: null, source: null, readyPromise: null, readyResolve: null },
        CHAT: { name: 'CHAT', url: '', frame: null, source: null, readyPromise: null, readyResolve: null },
        PROGRESSION: { name: 'PROGRESSION', url: '', frame: null, source: null, readyPromise: null, readyResolve: null }
      };

      // 照顧區快取 SWR (若無快取則預設為最新 6 照顧區與 45 大區)
      this.cachedAreaOptions = null;
      try {
        const stored = this.storage.getItem('vital_area_options_cache');
        if (stored) this.cachedAreaOptions = JSON.parse(stored);
      } catch (e) {}
      if (!this.cachedAreaOptions || !this.cachedAreaOptions.length) {
        this.cachedAreaOptions = DEFAULT_DISTRICTS;
      }

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
          return u.playerId || '';
        }
      } catch (e) {}
      return '';
    }

    getMatrixColIndexFromStorage() {
      try {
        const userStr = this.storage.getItem('vital_current_player');
        if (userStr) {
          const u = JSON.parse(userStr);
          const col = Number(u.matrixColIndex);
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
          const col = Number(u.postsColIndex);
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

    getActiveMembersFromStorage(groupId = null) {
      const gid = groupId || this.getGroupIdFromStorage();
      if (gid) {
        try {
          const cachedGp = this.storage.getItem(`vital_group_profile_${gid}`);
          if (cachedGp) {
            const parsed = JSON.parse(cachedGp);
            if (parsed.activeMembers) return parsed.activeMembers;
            if (parsed.activeMembersJson) {
              return typeof parsed.activeMembersJson === 'string' ? JSON.parse(parsed.activeMembersJson) : parsed.activeMembersJson;
            }
          }
        } catch (e) {}
      }
      try {
        const userStr = this.storage.getItem('vital_current_player');
        if (userStr) {
          const u = JSON.parse(userStr);
          if (u.activeMembers) return u.activeMembers;
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

    async invokeIframeRpc_(action, payload) {
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

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pendingRequests.delete(reqId);
          reject(new Error(`呼叫 [${action}] 回應逾時 (${Math.round(DEFAULT_TIMEOUT_MS / 1000)}s)`));
        }, DEFAULT_TIMEOUT_MS);

        this.pendingRequests.set(reqId, { resolve, reject, timer });

        try {
          const { token, playerId, groupId, matrixColIndex, postsColIndex } = payload || {};
          channel.source.postMessage({
            type: 'GAS_CALL',
            id: reqId,
            targetService: serviceName,
            action,
            token,
            playerId,
            groupId,
            matrixColIndex,
            postsColIndex,
            data: payload,
            payload
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
      // 在途請求互斥鎖 (In-Flight Action Mutex)：針對排他性寫入動作，嚴格防重送
      const isExclusive = MUTATING_EXCLUSIVE_ACTIONS.has(action);
      const lockKey = isExclusive ? action : null;

      if (lockKey) {
        if (!this.inFlightMutex) {
          this.inFlightMutex = new Set();
        }
        if (this.inFlightMutex.has(lockKey)) {
          return {
            success: false,
            code: 'IN_FLIGHT_LOCKED',
            error: '操作處理中，請勿重複提交',
            action,
            isBlocked: true
          };
        }
        this.inFlightMutex.add(lockKey);
      }

      try {
        const payload = {
          action,
          token: this.token,
          sessionToken: this.token,
          playerId: (data && data.playerId) || this.getPlayerIdFromToken() || '',
          groupId: (data && data.groupId) || this.getGroupIdFromStorage() || '',
          matrixColIndex: (data && data.matrixColIndex) || this.getMatrixColIndexFromStorage(),
          postsColIndex: (data && data.postsColIndex) || this.getPostsColIndexFromStorage(),
          ...data
        };

        // 照顧區特例：0ms SWR 秒開
        if (action === 'getRegistrationAreaOptions') {
          const force = Boolean(data && (data.forceRefresh || data.bypassCache || data.clearCache));
          const activeOptions = (this.cachedAreaOptions && this.cachedAreaOptions.length)
            ? this.cachedAreaOptions
            : DEFAULT_DISTRICTS;

          // 若要求強制刷新，則直接向後端請求最新資料
          if (force) {
            const res = await this.requestRaw_('getRegistrationAreaOptions', payload);
            const dList = res && (res.districts || (res.data && res.data.districts));
            if (Array.isArray(dList) && dList.length > 0) {
              this.cachedAreaOptions = dList;
              try {
                this.storage.setItem('vital_area_options_cache', JSON.stringify(dList));
              } catch (e) {}
              if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                window.dispatchEvent(new CustomEvent('vital_area_options_updated', { detail: dList }));
              }
              return { success: true, districts: dList };
            }
            return { success: true, districts: activeOptions };
          }

          // SWR：背景非同步向後端同步最新定義，若有異動觸發事件熱更新 UI
          this.requestRaw_('getRegistrationAreaOptions', payload).then((res) => {
            const dList = res && (res.districts || (res.data && res.data.districts));
            if (Array.isArray(dList) && dList.length > 0) {
              const oldStr = JSON.stringify(this.cachedAreaOptions || []);
              const newStr = JSON.stringify(dList);
              this.cachedAreaOptions = dList;
              try {
                this.storage.setItem('vital_area_options_cache', newStr);
              } catch (e) {}
              if (oldStr !== newStr && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                window.dispatchEvent(new CustomEvent('vital_area_options_updated', { detail: dList }));
              }
            }
          }).catch(() => {});

          return {
            success: true,
            districts: activeOptions
          };
        }

        return await this.requestRaw_(action, payload);
      } finally {
        if (lockKey && this.inFlightMutex) {
          this.inFlightMutex.delete(lockKey);
        }
      }
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
          return await this.invokeIframeRpc_(action, payload);
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
      const token = res && (res.token || res.sessionToken || (res.data && (res.data.token || res.data.sessionToken)));
      if (token) this.setSessionToken(token);
      return res;
    }

    async login(username, password) {
      const cleanUser = String(username || '').trim();
      const cleanPass = String(password || '').trim();
      const res = await this.request('login', {
        playerId: cleanUser,
        password: cleanPass
      });

      const token = res && (res.token || res.sessionToken || (res.data && (res.data.token || res.data.sessionToken)));
      if (token) this.setSessionToken(token);
      return res;
    }

    getPractice() {
      return this.request('getPractice');
    }

    getAnnouncements(date = '') {
      const data = {};
      if (date) data.currentDate = date;
      return this.request('getAnnouncements', data);
    }

    getBootstrap() {
      return this.request('getBootstrap');
    }

    async getFootprints(options = {}) {
      const pId = options.playerId || this.getPlayerIdFromToken();
      const weeks = options.weeks || 10;
      const forceRefresh = Boolean(options.forceRefresh);

      const cacheKey = `vital_footprints_cache_${pId || 'guest'}`;
      let cached = null;
      if (!forceRefresh && this.storage) {
        try {
          const raw = this.storage.getItem(cacheKey);
          if (raw) cached = JSON.parse(raw);
        } catch (e) {
          console.warn('[ApiClient] 足跡快取解析失敗，自動清除損毀快取:', e);
          try { this.storage.removeItem(cacheKey); } catch (_) {}
          cached = null;
        }
      }

      // SWR: 背景發起真實網路請求
      const fetchPromise = this.request('getFootprints', {
        playerId: pId,
        weeks: weeks,
        matrixColIndex: options.matrixColIndex || this.getMatrixColIndexFromStorage()
      }).then((res) => {
        if (res && res.success) {
          const data = res.data || res;
          if (this.storage) {
            try {
              this.storage.setItem(cacheKey, JSON.stringify({
                ...data,
                _cachedAt: Date.now()
              }));
            } catch (e) {
              console.warn('[ApiClient] 寫入足跡快取失敗 (可能配額已滿):', e);
            }
          }
          return res;
        }
        return res;
      }).catch((err) => {
        console.warn('[ApiClient] getFootprints 背景非同步更新失敗:', err && err.message ? err.message : err);
        return { success: false, error: (err && err.message) || '背景更新失敗', isBackgroundError: true };
      });

      // SWR: 若本地有快取，立即秒開回傳 (0ms)
      if (cached) {
        return {
          success: true,
          fromCache: true,
          data: cached,
          ...cached,
          revalidatePromise: fetchPromise
        };
      }

      // 無快取則等待網路回傳
      return await fetchPromise;
    }

    getCachedFootprints(playerId = null) {
      const pId = playerId || this.getPlayerIdFromToken();
      const cacheKey = `vital_footprints_cache_${pId || 'guest'}`;
      if (!this.storage) return null;
      try {
        const raw = this.storage.getItem(cacheKey);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        try { this.storage.removeItem(cacheKey); } catch (_) {}
        return null;
      }
    }

    updateFootprintDailyCache(dateStr, practices = {}, playerId = null) {
      const pId = playerId || this.getPlayerIdFromToken();
      const cacheKey = `vital_footprints_cache_${pId || 'guest'}`;
      if (!this.storage || !dateStr) return false;
      try {
        const raw = this.storage.getItem(cacheKey);
        if (!raw) return false;
        const cache = JSON.parse(raw);
        if (!cache.dailyRecords) cache.dailyRecords = {};
        const oldRec = cache.dailyRecords[dateStr] || {};

        const morningVal = practices.morningRevival !== undefined ? Boolean(practices.morningRevival) : (practices.morning !== undefined ? Boolean(practices.morning) : Boolean(oldRec.morning));
        const bibleVal = practices.bibleReading !== undefined ? Boolean(practices.bibleReading) : (practices.bible !== undefined ? Boolean(practices.bible) : Boolean(oldRec.bible));
        const prayerVal = practices.prayer !== undefined ? Boolean(practices.prayer) : Boolean(oldRec.prayer);
        const bookVal = practices.bookPursuit !== undefined ? Boolean(practices.bookPursuit) : (practices.book !== undefined ? Boolean(practices.book) : Boolean(oldRec.book));

        cache.dailyRecords[dateStr] = {
          ...oldRec,
          morning: morningVal,
          bible: bibleVal,
          prayer: prayerVal,
          book: bookVal
        };

        const updateDayInList = (daysList) => {
          if (!Array.isArray(daysList)) return;
          const targetDay = daysList.find(d => d.date === dateStr || d.recordDate === dateStr);
          if (targetDay) {
            targetDay.morningCompleted = morningVal;
            targetDay.bibleCompleted = bibleVal;
            targetDay.prayerCompleted = prayerVal;
            targetDay.readingCompleted = bookVal;
            targetDay.completedCount = (morningVal ? 1 : 0) + (bibleVal ? 1 : 0) + (prayerVal ? 1 : 0) + (bookVal ? 1 : 0);
            targetDay.hasRecord = targetDay.completedCount > 0;
          }
        };

        if (Array.isArray(cache.weeks)) {
          cache.weeks.forEach(w => updateDayInList(w.days));
        }
        if (Array.isArray(cache.weekly)) {
          cache.weekly.forEach(w => updateDayInList(w.days));
        }
        if (Array.isArray(cache.daily)) {
          updateDayInList(cache.daily);
        }

        // 即時增量更新本月成果卡 (monthSummary)
        if (cache.monthSummary) {
          const dNow = new Date();
          const fallbackMKey = `${dNow.getFullYear()}-${String(dNow.getMonth() + 1).padStart(2, '0')}`;
          const targetMonthKey = dateStr ? dateStr.slice(0, 7) : (cache.monthSummary.monthKey || fallbackMKey);

          // 跨月打卡時自動翻頁，重置 monthSummary 為新月份乾淨骨架
          if (cache.monthSummary.monthKey !== targetMonthKey) {
            cache.monthSummary = {
              monthKey: targetMonthKey,
              completedDays: 0,
              fullAttendanceDays: 0,
              perfectDays: 0,
              fullDays: 0,
              morningDays: 0,
              bibleDays: 0,
              prayerDays: 0,
              bookDays: 0,
              readingDays: 0,
              meetingCount: 0,
              visitCount: 0,
              groupMeetingCount: 0,
              prayerMeetingCount: 0,
              lordDayMeetingCount: 0,
              totalScore: 0,
              longestStreak: 0
            };
          }

          const mKey = targetMonthKey;
          if (dateStr.startsWith(mKey)) {
            if (morningVal !== Boolean(oldRec.morning)) {
              cache.monthSummary.morningDays = Math.max(0, (cache.monthSummary.morningDays || 0) + (morningVal ? 1 : -1));
            }
            if (bibleVal !== Boolean(oldRec.bible)) {
              cache.monthSummary.bibleDays = Math.max(0, (cache.monthSummary.bibleDays || 0) + (bibleVal ? 1 : -1));
            }
            if (prayerVal !== Boolean(oldRec.prayer)) {
              cache.monthSummary.prayerDays = Math.max(0, (cache.monthSummary.prayerDays || 0) + (prayerVal ? 1 : -1));
            }
            if (bookVal !== Boolean(oldRec.book)) {
              cache.monthSummary.bookDays = Math.max(0, (cache.monthSummary.bookDays || 0) + (bookVal ? 1 : -1));
              cache.monthSummary.readingDays = cache.monthSummary.bookDays;
            }
            const oldAny = Boolean(oldRec.morning || oldRec.bible || oldRec.prayer || oldRec.book);
            const newAny = Boolean(morningVal || bibleVal || prayerVal || bookVal);
            if (oldAny !== newAny) {
              cache.monthSummary.completedDays = Math.max(0, (cache.monthSummary.completedDays || 0) + (newAny ? 1 : -1));
            }

            const oldFull = Boolean(oldRec.morning && oldRec.bible && oldRec.prayer && oldRec.book);
            const newFull = Boolean(morningVal && bibleVal && prayerVal && bookVal);
            if (oldFull !== newFull) {
              const delta = newFull ? 1 : -1;
              cache.monthSummary.fullAttendanceDays = Math.max(0, (cache.monthSummary.fullAttendanceDays || 0) + delta);
              cache.monthSummary.perfectDays = cache.monthSummary.fullAttendanceDays;
              cache.monthSummary.fullDays = cache.monthSummary.fullAttendanceDays;
            }
          }
        }

        cache._cachedAt = Date.now();
        this.storage.setItem(cacheKey, JSON.stringify(cache));
        return true;
      } catch (e) {
        return false;
      }
    }

    updateFootprintMeetingCache(weekKey, meetings = {}, playerId = null) {
      const pId = playerId || this.getPlayerIdFromToken();
      const cacheKey = `vital_footprints_cache_${pId || 'guest'}`;
      if (!this.storage || !weekKey) return false;
      try {
        const raw = this.storage.getItem(cacheKey);
        if (!raw) return false;
        const cache = JSON.parse(raw);
        if (!cache.meetingRecords) cache.meetingRecords = {};
        const oldRec = cache.meetingRecords[weekKey] || {};

        const groupVal = meetings.group !== undefined ? Boolean(meetings.group) : (meetings.smallGroup !== undefined ? Boolean(meetings.smallGroup) : Boolean(oldRec.group));
        const prayerVal = meetings.prayerMtg !== undefined ? Boolean(meetings.prayerMtg) : (meetings.prayerMeeting !== undefined ? Boolean(meetings.prayerMeeting) : Boolean(oldRec.prayerMtg));
        const lordDayVal = meetings.lordDay !== undefined ? Boolean(meetings.lordDay) : (meetings.lordDayMeeting !== undefined ? Boolean(meetings.lordDayMeeting) : Boolean(oldRec.lordDay));
        const outreachVal = meetings.outreach !== undefined ? Boolean(meetings.outreach) : (meetings.outreachVisit !== undefined ? Boolean(meetings.outreachVisit) : Boolean(oldRec.outreach));

        cache.meetingRecords[weekKey] = {
          ...oldRec,
          group: groupVal,
          prayerMtg: prayerVal,
          lordDay: lordDayVal,
          outreach: outreachVal
        };

        const updateWeekInList = (weekList) => {
          if (!Array.isArray(weekList)) return;
          const targetWeek = weekList.find(w => w.weekKey === weekKey);
          if (targetWeek) {
            targetWeek.groupMeetingCompleted = groupVal;
            targetWeek.prayerMeetingCompleted = prayerVal;
            targetWeek.lordDayCompleted = lordDayVal;
            targetWeek.visitCompleted = outreachVal;
            if (targetWeek.meeting) {
              targetWeek.meeting.smallGroup = groupVal;
              targetWeek.meeting.prayerMeeting = prayerVal;
              targetWeek.meeting.lordDayMeeting = lordDayVal;
              targetWeek.meeting.outreachVisit = outreachVal;
            }
          }
        };

        if (Array.isArray(cache.weeks)) updateWeekInList(cache.weeks);
        if (Array.isArray(cache.weekly)) updateWeekInList(cache.weekly);

        // 即時增量更新本月成果卡 (聚會次數)
        if (cache.monthSummary) {
          if (groupVal !== Boolean(oldRec.group)) {
            cache.monthSummary.groupMeetingCount = Math.max(0, (cache.monthSummary.groupMeetingCount || 0) + (groupVal ? 1 : -1));
          }
          if (prayerVal !== Boolean(oldRec.prayerMtg)) {
            cache.monthSummary.prayerMeetingCount = Math.max(0, (cache.monthSummary.prayerMeetingCount || 0) + (prayerVal ? 1 : -1));
          }
          if (lordDayVal !== Boolean(oldRec.lordDay)) {
            cache.monthSummary.lordDayMeetingCount = Math.max(0, (cache.monthSummary.lordDayMeetingCount || 0) + (lordDayVal ? 1 : -1));
          }
          if (outreachVal !== Boolean(oldRec.outreach)) {
            cache.monthSummary.visitCount = Math.max(0, (cache.monthSummary.visitCount || 0) + (outreachVal ? 1 : -1));
          }
        }

        cache._cachedAt = Date.now();
        this.storage.setItem(cacheKey, JSON.stringify(cache));
        return true;
      } catch (e) {
        return false;
      }
    }

    updateDailyRecordCache(dateStr, practices = {}, playerId = null) {
      const pId = playerId || this.getPlayerIdFromToken();
      if (!this.storage || !dateStr || !pId) return false;
      try {
        const cacheKey = `vital_daily_records_${pId}`;
        let records = {};
        const raw = this.storage.getItem(cacheKey);
        if (raw) {
          try { records = JSON.parse(raw) || {}; } catch (_) {}
        }
        const oldRec = records[dateStr] || {};
        const morningVal = practices.morningRevival !== undefined ? Boolean(practices.morningRevival) : (practices.morning !== undefined ? Boolean(practices.morning) : Boolean(oldRec.morning || oldRec.morningRevival));
        const bibleVal = practices.bibleReading !== undefined ? Boolean(practices.bibleReading) : (practices.bible !== undefined ? Boolean(practices.bible) : Boolean(oldRec.bible || oldRec.bibleReading));
        const prayerVal = practices.prayer !== undefined ? Boolean(practices.prayer) : Boolean(oldRec.prayer);
        const bookVal = practices.bookPursuit !== undefined ? Boolean(practices.bookPursuit) : (practices.book !== undefined ? Boolean(practices.book) : Boolean(oldRec.book || oldRec.bookPursuit));

        records[dateStr] = {
          ...oldRec,
          morning: morningVal,
          morningRevival: morningVal,
          bible: bibleVal,
          bibleReading: bibleVal,
          prayer: prayerVal,
          book: bookVal,
          bookPursuit: bookVal
        };
        this.storage.setItem(cacheKey, JSON.stringify(records));
        return true;
      } catch (e) {
        return false;
      }
    }

    updateMeetingRecordCache(weekKey, meetings = {}, playerId = null) {
      const pId = playerId || this.getPlayerIdFromToken();
      if (!this.storage || !weekKey || !pId) return false;
      try {
        const cacheKey = `vital_meeting_records_${pId}`;
        let records = {};
        const raw = this.storage.getItem(cacheKey);
        if (raw) {
          try { records = JSON.parse(raw) || {}; } catch (_) {}
        }
        const oldRec = records[weekKey] || {};
        const groupVal = meetings.group !== undefined ? Boolean(meetings.group) : (meetings.smallGroup !== undefined ? Boolean(meetings.smallGroup) : Boolean(oldRec.group || oldRec.smallGroup));
        const prayerVal = meetings.prayerMtg !== undefined ? Boolean(meetings.prayerMtg) : (meetings.prayerMeeting !== undefined ? Boolean(meetings.prayerMeeting) : Boolean(oldRec.prayerMtg || oldRec.prayerMeeting));
        const lordDayVal = meetings.lordDay !== undefined ? Boolean(meetings.lordDay) : (meetings.lordDayMeeting !== undefined ? Boolean(meetings.lordDayMeeting) : Boolean(oldRec.lordDay || oldRec.lordDayMeeting));
        const outreachVal = meetings.outreach !== undefined ? Boolean(meetings.outreach) : (meetings.outreachVisit !== undefined ? Boolean(meetings.outreachVisit) : Boolean(oldRec.outreach || oldRec.outreachVisit || oldRec.blend || oldRec.mutual));

        records[weekKey] = {
          ...oldRec,
          group: groupVal,
          smallGroup: groupVal,
          prayerMtg: prayerVal,
          prayerMeeting: prayerVal,
          lordDay: lordDayVal,
          lordDayMeeting: lordDayVal,
          outreach: outreachVal,
          outreachVisit: outreachVal
        };
        this.storage.setItem(cacheKey, JSON.stringify(records));
        return true;
      } catch (e) {
        return false;
      }
    }
    
    async getProgressBundle(groupId = null, activeMembers = null) {
      const options = (arguments.length > 2 && typeof arguments[2] === 'object' && arguments[2]) ? arguments[2] : {};
      const data = {};
      if (groupId) data.groupId = groupId;
      const mems = activeMembers || this.getActiveMembersFromStorage(groupId);
      if (mems) data.activeMembers = mems;
      if (options && typeof options === 'object') {
        Object.assign(data, options);
      }
      if (!data.hintRow && groupId) {
        try {
          const cachedGp = JSON.parse(this.storage.getItem(`vital_group_profile_${groupId}`) || 'null');
          if (cachedGp && (cachedGp.postsColIndex || cachedGp.row)) {
            data.hintRow = cachedGp.postsColIndex || cachedGp.row;
          }
        } catch (e) {}
      }
      return await this.request('getProgressBundle', data);
    }

    async getPointsConfig(date = '') {
      return await this.request('getPointsConfig', { date: date || '' });
    }

    async getChapterConfigs() {
      return await this.request('getChapterConfigs', {});
    }

    async getChapterConfig() {
      return await this.getChapterConfigs();
    }

    async getAchievementConfigs() {
      return await this.request('getAchievementConfigs', {});
    }

    async getAchievementConfig() {
      return await this.getAchievementConfigs();
    }

    async getTaskConfigs() {
      return await this.request('getTaskConfigs', {});
    }

    async getTasksConfig() {
      return await this.getTaskConfigs();
    }

    async getMilestonesConfig() {
      return await this.request('getMilestonesConfig', {});
    }

    async clearProgressionConfigCache() {
      return await this.request('clearProgressionConfigCache', {});
    }

    async getMyGroupContributionSummary(groupId = null, activeMembers = null) {
      // 合併至 getGroupProgress，維持相容性
      return await this.getGroupProgress(groupId, activeMembers);
    }

    async getProfile() {
      return await this.request('getProfile');
    }

    updateProfile(updates) { return this.request('updateProfile', { updates }); }
    async updatePassword(currentPassword, newPassword) {
      return await this.request('updatePassword', {
        currentPassword: currentPassword,
        newPassword: newPassword
      });
    }
    updateMyPassword(currentPassword, newPassword) {
      return this.updatePassword(currentPassword, newPassword);
    }
    updateAvatar(avatarUrl, name) {
      const payload = typeof avatarUrl === 'object' && avatarUrl !== null
        ? { avatarUrl: avatarUrl.avatarUrl, name: avatarUrl.name }
        : { avatarUrl: avatarUrl };
      if (name !== undefined && name !== null) {
        const trimmed = String(name).trim();
        if (trimmed) {
          payload.name = trimmed;
        }
      }
      return this.request('updateAvatar', payload);
    }
    updatePlayerAvatar(avatarUrl, name) {
      return this.updateAvatar(avatarUrl, name);
    }

    getRegistrationAreaOptions(forceRefresh = false) {
      return this.request('getRegistrationAreaOptions', { forceRefresh: Boolean(forceRefresh) });
    }

    // 操練與聚會打卡
    submitDailyPractice(data) { return this.request('submitDailyPractice', data); }
    submitMeetingPractice(data) { return this.request('submitMeetingPractice', data); }


    // 活力組與成長篇章
    createGroup(data) { return this.request('createGroup', data); }
    joinGroup(groupId, joinedDate = null) {
      if (typeof groupId === 'object' && groupId !== null) {
        return this.request('joinGroup', groupId);
      }
      return this.request('joinGroup', { groupId, joinedDate });
    }
    leaveGroup(groupId = null) {
      const data = {};
      if (groupId) data.groupId = groupId;
      const col = this.getMatrixColIndexFromStorage();
      if (col) data.matrixColIndex = col;
      return this.request('leaveGroup', data);
    }
    getGroupMembers(groupId = null, activeMembers = null, options = {}) {
      const data = {};
      if (groupId) data.groupId = groupId;
      if (activeMembers) data.activeMembers = activeMembers;
      const col = this.getMatrixColIndexFromStorage();
      if (col) data.matrixColIndex = col;
      if (options && typeof options === 'object') {
        Object.assign(data, options);
      }
      if (groupId && (!data.leaderPlayerId || !data.groupName)) {
        try {
          const cachedGp = JSON.parse(this.storage.getItem(`vital_group_profile_${groupId}`) || 'null');
          if (cachedGp) {
            if (!data.leaderPlayerId && cachedGp.leaderPlayerId) data.leaderPlayerId = cachedGp.leaderPlayerId;
            if (!data.groupName && cachedGp.groupName) data.groupName = cachedGp.groupName;
            if (!data.inviteCode && cachedGp.inviteCode) data.inviteCode = cachedGp.inviteCode;
            if (!data.hintRow && (cachedGp.postsColIndex || cachedGp.row)) data.hintRow = cachedGp.postsColIndex || cachedGp.row;
          }
        } catch (e) {}
      }
      return this.request('getGroupMembers', data);
    }
    getGroupProfile(groupId = null, activeMembers = null) {
      const data = {};
      if (groupId) data.groupId = groupId;
      if (activeMembers) data.activeMembers = activeMembers;
      const col = this.getMatrixColIndexFromStorage();
      if (col) data.matrixColIndex = col;
      return this.request('getGroupProfile', data);
    }
    getGroupDashboard(groupId = null) {
      return this.getGroupProfile(groupId);
    }
    transferGroupLeader(leaderPlayerId, groupId = null) {
      const targetId = typeof leaderPlayerId === 'object' && leaderPlayerId !== null
        ? (leaderPlayerId.leaderPlayerId || leaderPlayerId.targetPlayerId)
        : leaderPlayerId;
      const gId = typeof leaderPlayerId === 'object' && leaderPlayerId !== null
        ? leaderPlayerId.groupId
        : groupId;
      const data = { leaderPlayerId: targetId };
      if (gId) data.groupId = gId;
      const col = this.getMatrixColIndexFromStorage();
      if (col) data.matrixColIndex = col;
      return this.request('transferGroupLeader', data);
    }
    getGroupJourney(groupId = null, activeMembers = null) {
      const data = {};
      if (groupId) data.groupId = groupId;
      const mems = activeMembers || this.getActiveMembersFromStorage(groupId);
      if (mems) data.activeMembers = mems;
      return this.request('getGroupJourney', data);
    }
    getGroupJourneyList() {
      return this.request('getGroupJourneyList');
    }
    getPlayerProgress(playerId = null) {
      const data = {};
      if (playerId) data.playerId = playerId;
      return this.request('getPlayerProgress', data);
    }
    getGroupProgress(groupId = null, activeMembers = null) {
      const data = {};
      if (groupId) data.groupId = groupId;
      const mems = activeMembers || this.getActiveMembersFromStorage(groupId);
      if (mems) data.activeMembers = mems;
      return this.request('getGroupProgress', data);
    }
    evaluateTargetMilestones(scopeOrType = 'PLAYER', targetId = null, triggerEvent = null) {
      if (typeof scopeOrType === 'object' && scopeOrType !== null) {
        const payload = { ...scopeOrType };
        if (!payload.targetType && payload.scope) payload.targetType = payload.scope;
        return this.request('evaluateTargetMilestones', payload);
      }
      let targetType = String(scopeOrType || 'PLAYER').toUpperCase();
      let event = triggerEvent;
      let tid = targetId;

      if (scopeOrType && typeof scopeOrType === 'string' && scopeOrType.startsWith('CHP_')) {
        targetType = 'GROUP';
        event = scopeOrType;
      } else if (tid && typeof tid === 'string' && tid.startsWith('GRP_')) {
        targetType = 'GROUP';
      }

      const data = {
        targetType,
        targetId: tid
      };
      if (event) {
        data.triggerEvent = event;
      }
      return this.request('evaluateTargetMilestones', data);
    }

    grantTargetedReward(options) {
      const data = typeof options === 'object' && options !== null ? { ...options } : {};
      const deltaPoints = Number(data.deltaPoints !== undefined ? data.deltaPoints : data.points) || 0;
      const reason = String(data.reason || data.taskName || '管理者發放特殊同行獎勵').trim();
      const cleanData = {
        targetType: data.targetType || 'PLAYER',
        targetId: data.targetId || (Array.isArray(data.targetIds) ? data.targetIds[0] : ''),
        deltaPoints: deltaPoints,
        reason: reason
      };
      if (data.adminPlayerId) cleanData.adminPlayerId = data.adminPlayerId;
      if (data.taskId) cleanData.taskId = data.taskId;
      if (data.targetIds) cleanData.targetIds = data.targetIds;
      return this.request('grantTargetedReward', cleanData);
    }

    syncGroupMembership(groupId, operation, memberPlayerId) {
      return this.request('syncGroupMembership', { groupId, operation, memberPlayerId });
    }

    archiveAnnualGroupProgress(targetYear) {
      return this.request('archiveAnnualGroupProgress', { targetYear: Number(targetYear) });
    }

    runDailyMilestoneSettlement(targetDate = null) {
      const data = targetDate ? { targetDate } : {};
      return this.request('runDailyMilestoneSettlement', data);
    }

    // 小組交流板 (Chat 服務)
    postMessage(data) { return this.request('postMessage', data); }
    createGroupPost(data) { return this.postMessage(data); }

    setGroupAnnouncement(data) { return this.request('setGroupAnnouncement', data); }
    pinGroupPost(data) { return this.setGroupAnnouncement(data); }

    clearGroupChat(groupId, postsColIndex = null) {
      const data = typeof groupId === 'object' && groupId !== null
        ? { ...groupId }
        : { groupId };
      if (postsColIndex) data.postsColIndex = postsColIndex;
      return this.request('clearGroupChat', data);
    }
    clearGroupAnnouncement(groupId, postsColIndex = null) {
      const data = typeof groupId === 'object' && groupId !== null
        ? { ...groupId }
        : { groupId };
      if (postsColIndex) data.postsColIndex = postsColIndex;
      return this.request('clearGroupAnnouncement', data);
    }

    getMessages(groupId, limit = 30, postsColIndex = null, clientCount = null, sinceTimeMs = null) {
      const data = typeof groupId === 'object' && groupId !== null
        ? { ...groupId }
        : { groupId, limit };
      if (postsColIndex !== null && postsColIndex !== undefined) data.postsColIndex = postsColIndex;
      if (clientCount !== null && clientCount !== undefined) data.clientCount = clientCount;
      if (sinceTimeMs !== null && sinceTimeMs !== undefined) data.sinceTimeMs = sinceTimeMs;
      return this.request('getMessages', data);
    }
    getGroupPosts(groupId, limit = 30, postsColIndex = null, clientCount = null, sinceTimeMs = null) {
      return this.getMessages(groupId, limit, postsColIndex, clientCount, sinceTimeMs);
    }

    deleteMessage(messageId) {
      const mId = typeof messageId === 'object' && messageId !== null
        ? (messageId.messageId || messageId.postId)
        : messageId;
      return this.request('deleteMessage', { messageId: mId });
    }
    deleteGroupPost(postId) { return this.deleteMessage(postId); }

    /**
     * 檢查指定動作是否正在在途執行中
     * @param {string} action 
     * @returns {boolean}
     */
    isActionInFlight(action) {
      return !!(this.inFlightMutex && this.inFlightMutex.has(action));
    }
  }

  // 附加預設照顧區與互斥鎖動作靜態常數
  ApiClient.DEFAULT_DISTRICTS = DEFAULT_DISTRICTS;
  ApiClient.MUTATING_EXCLUSIVE_ACTIONS = MUTATING_EXCLUSIVE_ACTIONS;

  // 匯出至全域與模組環境
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ApiClient, DEFAULT_DISTRICTS, MUTATING_EXCLUSIVE_ACTIONS };
  }
  global.ApiClient = ApiClient;
})(typeof window !== 'undefined' ? window : global);
