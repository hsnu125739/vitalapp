/**
 * userSessionCoordinator.js
 * 使用者會話協同器外觀模組 (User Session Coordinator Facade)
 *
 * 職責：
 * 1. 管理使用者會話五態生命週期狀態機 (FSM)：
 *    UNAUTHENTICATED -> HYDRATING -> SYNCHRONIZING -> ACTIVE -> EXPIRED
 * 2. 提供快照 (getSnapshot) 與事件訂閱 (subscribe)，實現單向資料流與局部視圖更新。
 * 3. 封裝冷啟動快取水合 (hydrateCachedSession)、登入 (handleLogin)、登出 (handleLogout) 與會話過期。
 * 4. 與 StorageGateway, ApiClient, PracticeStore 緊密協同，充當頂層領域外觀 (Domain Facade)。
 */

(function (global) {
  'use strict';

  const SESSION_STATES = Object.freeze({
    UNAUTHENTICATED: 'UNAUTHENTICATED',
    HYDRATING: 'HYDRATING',
    SYNCHRONIZING: 'SYNCHRONIZING',
    ACTIVE: 'ACTIVE',
    EXPIRED: 'EXPIRED'
  });

  class UserSessionCoordinator {
    static get States() {
      return SESSION_STATES;
    }

    constructor({ apiClient = null, storage = null, practiceStore = null } = {}) {
      this.apiClient = apiClient;
      this.storage = storage || (typeof StorageGateway !== 'undefined' ? StorageGateway.getInstance() : null);
      this.practiceStore = practiceStore;

      this.state = SESSION_STATES.UNAUTHENTICATED;
      this.currentUser = null;
      this.currentGroup = null;
      this.currentJourney = null;
      this.lastSyncAt = null;

      this._listeners = new Set();
    }

    static getInstance() {
      if (!UserSessionCoordinator._instance) {
        UserSessionCoordinator._instance = new UserSessionCoordinator();
      }
      return UserSessionCoordinator._instance;
    }

    getState() {
      return this.state;
    }

    getSnapshot() {
      return {
        state: this.state,
        currentUser: this.currentUser ? { ...this.currentUser } : null,
        currentGroup: this.currentGroup ? { ...this.currentGroup } : null,
        currentJourney: this.currentJourney ? { ...this.currentJourney } : null,
        lastSyncAt: this.lastSyncAt
      };
    }

    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      this._listeners.add(listener);
      return () => {
        this._listeners.delete(listener);
      };
    }

    _notify(event, data = {}) {
      const snapshot = this.getSnapshot();
      for (const listener of this._listeners) {
        try {
          listener(snapshot, event, data);
        } catch (err) {
          console.error('[UserSessionCoordinator] Listener error:', err);
        }
      }
    }

    _setState(newState, eventName, data) {
      if (this.state === newState && !eventName) return;
      this.state = newState;
      this._notify(eventName || 'stateChanged', data);
    }

    /**
     * 冷啟動本地快取水合 (0ms instant render)
     * 從 StorageGateway 讀取快取之個人 Profile 與小組資料
     * @returns {boolean} 是否成功命中快取並水合
     */
    hydrateCachedSession() {
      this._setState(SESSION_STATES.HYDRATING, 'hydrating');
      const player = this.storage ? this.storage.getJSON('vital_current_player') : null;
      if (player) {
        this.currentUser = player;
        const gid = player.groupId;
        if (gid && this.storage) {
          this.currentGroup = this.storage.getJSON(`vital_group_profile_${gid}`);
        }
        this._notify('hydrated', { user: this.currentUser, group: this.currentGroup });
        return true;
      }
      return false;
    }

    /**
     * 處理登入成功事件
     * @param {Object} profile 使用者資料
     * @param {Object|null} group 所屬小組資料
     * @param {Object|null} practice 隨登入帶回之操練資料
     */
    handleLogin(profile, group = null, practice = null) {
      this.currentUser = profile;
      this.currentGroup = group;
      if (this.storage && profile) {
        this.storage.setJSON('vital_current_player', profile);
        if (group && profile.groupId) {
          this.storage.setJSON(`vital_group_profile_${profile.groupId}`, group);
        }
      }
      this._setState(SESSION_STATES.ACTIVE, 'loginSuccess', { profile, group, practice });
    }

    /**
     * 處理登出清場事件 (原子雙階掃除)
     */
    handleLogout() {
      const pid = this.currentUser?.playerId || null;
      const gid = this.currentUser?.groupId || null;

      if (this.apiClient && typeof this.apiClient.clearSessionToken === 'function') {
        this.apiClient.clearSessionToken();
      }

      if (this.storage && typeof this.storage.purgeUserSession === 'function') {
        this.storage.purgeUserSession(pid, gid);
      }

      this.currentUser = null;
      this.currentGroup = null;
      this.currentJourney = null;
      this.lastSyncAt = null;

      this._setState(SESSION_STATES.UNAUTHENTICATED, 'logout');
    }

    /**
     * 標記背景網路對帳進行中
     */
    setSynchronizing() {
      this._setState(SESSION_STATES.SYNCHRONIZING, 'synchronizing');
    }

    /**
     * 標記背景網路對帳成功，會話進入就緒活躍態
     * @param {Object|null} journeyData 最新成長篇章資料
     */
    setActive(journeyData = null) {
      if (journeyData) this.currentJourney = journeyData;
      this.lastSyncAt = new Date().toISOString();
      this._setState(SESSION_STATES.ACTIVE, 'synced', { journey: this.currentJourney });
    }

    /**
     * 更新使用者個人資料並通知訂閱者
     * @param {Object} newProfile 最新個人資料物件
     */
    updateProfile(newProfile) {
      if (!newProfile) return;
      this.currentUser = { ...newProfile };
      if (this.storage) {
        this.storage.setJSON('vital_current_player', this.currentUser);
      }
      this._notify('profileUpdated', { user: this.currentUser });
    }

    /**
     * 更新小組資料並通知訂閱者
     * @param {Object|null} newGroup 最新小組資料物件
     */
    updateGroup(newGroup) {
      this.currentGroup = newGroup ? { ...newGroup } : null;
      if (this.storage && this.currentGroup && this.currentGroup.groupId) {
        this.storage.setJSON(`vital_group_profile_${this.currentGroup.groupId}`, this.currentGroup);
      }
      this._notify('groupUpdated', { group: this.currentGroup });
    }

    /**
     * 標記 Token 過期 (401)，自動觸發清場
     */
    setExpired() {
      this._setState(SESSION_STATES.EXPIRED, 'expired');
      this.handleLogout();
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UserSessionCoordinator, SESSION_STATES };
  }
  global.UserSessionCoordinator = UserSessionCoordinator;
  global.SESSION_STATES = SESSION_STATES;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : global));
