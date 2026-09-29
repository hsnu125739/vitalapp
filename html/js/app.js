/**
 * app.js
 * 前端總入口控制器深層協同模組 (Application Coordinator)
 * 協同 ApiClient, OptimisticPracticeStore, ChatStore 與各 UI Views
 */

(function(global) {
  'use strict';

  let apiClient;
  let practiceStore;
  let chatStore;

  let authView;
  let dashboardView;
  let chestView;
  let footprintsView;
  let profileView;
  let fellowshipView;

  let currentUserProfile = null;
  let currentJourneyData = null;

  async function initApp() {
    // 1. 初始化 API 客戶端
    apiClient = new (global.ApiClient || window.ApiClient)({
      baseUrl: (typeof window !== 'undefined' && window.VITAL_API_URL) || '/api',
      onSessionExpired: () => handleLogout()
    });
    if (typeof window !== 'undefined') {
      window.activeApiClient = apiClient;
    }

    // 2. 初始化狀態庫
    practiceStore = new (global.OptimisticPracticeStore || window.OptimisticPracticeStore)({
      apiClient: apiClient
    });

    chatStore = new (global.ChatStore || window.ChatStore)({
      apiClient: apiClient
    });

    // 3. 初始化視圖模組
    authView = new (global.AuthView || window.AuthView)({
      apiClient: apiClient,
      onLoginSuccess: (profile) => handleLoginSuccess(profile)
    });

    chestView = new (global.ChestView || window.ChestView)({
      apiClient: apiClient,
      onChestClaimed: () => refreshUserData()
    });

    footprintsView = new (global.FootprintsView || window.FootprintsView)({
      apiClient: apiClient,
      onChestClaimed: () => refreshUserData()
    });

    fellowshipView = new (global.GroupFellowshipView || window.GroupFellowshipView)({
      chatStore: chatStore,
      currentUserId: ''
    });

    dashboardView = new (global.DashboardView || window.DashboardView)({
      practiceStore: practiceStore,
      apiClient: apiClient,
      onFootprintClick: () => footprintsView.openFootprintsModal(),
      onChestClick: () => openChests(),
      onRefresh: () => refreshUserData(),
      onLogout: () => handleLogout()
    });

    profileView = new (global.ProfileView || window.ProfileView)({
      apiClient: apiClient,
      onAvatarUpdated: (url) => handleAvatarUpdated(url),
      onLogout: () => handleLogout(),
      onFootprintClick: () => footprintsView.openFootprintsModal(),
      onFellowshipClick: () => fellowshipView.openModal()
    });

    // 4. 驗證現有 Session
    const token = apiClient.getSessionToken();
    if (!token) {
      authView.showAuth();
    } else {
      authView.hideAuth();
      await loadUserData();
    }
  }

  async function loadUserData() {
    try {
      // 1. 取得使用者檔案
      const profileRes = await apiClient.getProfile();
      if (!profileRes || !profileRes.success) {
        handleLogout();
        return;
      }

      currentUserProfile = profileRes.player || profileRes.data?.player || profileRes.data || {};
      const groupId = currentUserProfile.groupId;

      // 2. 取得小組成長歷程
      if (groupId) {
        try {
          const journeyRes = await apiClient.getGroupJourney(groupId);
          if (journeyRes && journeyRes.success) {
            currentJourneyData = journeyRes.data || journeyRes.journey || journeyRes;
          }
        } catch (jErr) {
          console.warn('[App] 讀取小組歷程失敗', jErr);
        }
      }

      // 3. 取得有效系統公告
      let announcements = [];
      try {
        const annRes = await apiClient.getActiveAnnouncements();
        if (annRes && annRes.success) {
          announcements = annRes.announcements || annRes.data?.announcements || annRes.data || [];
        }
      } catch (aErr) {
        console.warn('[App] 讀取公告失敗', aErr);
      }

      // 4. 渲染視圖
      dashboardView.render(currentUserProfile, currentJourneyData, announcements);
      profileView.render(currentUserProfile);

      // 5. 初始化小組交流
      if (groupId) {
        fellowshipView.currentUserId = currentUserProfile.playerId || currentUserProfile.username;
        fellowshipView.isLeader = Boolean(currentUserProfile.isLeader);
        chatStore.init(groupId);
      }

    } catch (err) {
      console.error('[App] 載入使用者資料發生異常', err);
    }
  }

  function openChests() {
    const points = (currentUserProfile && (currentUserProfile.totalPoints !== undefined ? currentUserProfile.totalPoints : currentUserProfile.totalScore)) || 0;
    const claimed = (currentUserProfile && currentUserProfile.claimedChests) || [];
    chestView.openChestModal(points, claimed);
  }

  async function refreshUserData() {
    await loadUserData();
  }

  function handleLoginSuccess(profile) {
    currentUserProfile = profile;
    loadUserData();
  }

  function handleAvatarUpdated(newUrl) {
    if (currentUserProfile) {
      currentUserProfile.avatarUrl = newUrl;
      dashboardView.render(currentUserProfile, currentJourneyData);
      profileView.render(currentUserProfile);
    }
  }

  function handleLogout() {
    apiClient.clearSessionToken();
    currentUserProfile = null;
    currentJourneyData = null;
    authView.showAuth();
  }

  // 頁面就緒自動載入
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }
  }

  global.AppCoordinator = {
    initApp,
    loadUserData,
    refreshUserData
  };

})(typeof window !== 'undefined' ? window : global);
