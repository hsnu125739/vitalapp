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
      apiClient: apiClient
    });

    footprintsView = new (global.FootprintsView || window.FootprintsView)({
      apiClient: apiClient
    });

    fellowshipView = new (global.GroupFellowshipView || window.GroupFellowshipView)({
      chatStore: chatStore,
      currentPlayerId: '',
      currentUserName: ''
    });

    dashboardView = new (global.DashboardView || window.DashboardView)({
      practiceStore: practiceStore,
      apiClient: apiClient,
      onFootprintClick: () => footprintsView.openFootprintsModal(),
      onChestClick: (selectedIdx) => openChests(selectedIdx),
      onRefresh: () => refreshUserData(),
      onLogout: () => handleLogout(),
      onGroupJourneyListClick: () => dashboardView.openGroupJourneyListModal()
    });

    profileView = new (global.ProfileView || window.ProfileView)({
      apiClient: apiClient,
      onAvatarUpdated: (url) => handleAvatarUpdated(url),
      onLogout: () => handleLogout(),
      onFootprintClick: () => footprintsView.openFootprintsModal(),
      onFellowshipClick: () => {
        if (!currentUserProfile || !currentUserProfile.groupId) {
          alert('您尚未加入任何活力組！請先於首頁或個人手冊中加入或建立活力組，才能使用小組公告與交通功能。');
          return;
        }
        fellowshipView.openModal();
      }
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
        console.warn('[App] 取得遠端使用者檔案失敗，使用登入快照呈現', profileRes);
        // 只有在完全無登入快照且無有效 Token 時，才跳轉登入
        if (!currentUserProfile && !apiClient.getSessionToken()) {
          handleLogout();
          return;
        }
      } else {
        const fetchedPlayer = profileRes.player || profileRes.data?.player || profileRes.data || {};
        currentUserProfile = { ...currentUserProfile, ...fetchedPlayer };
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem('vital_current_player', JSON.stringify(currentUserProfile));
          } catch (e) {}
        }
      }

      if (currentUserProfile && !currentUserProfile.avatarUrl && currentUserProfile.avatarKey) {
        const isFemale = currentUserProfile.gender === 'SISTER' || currentUserProfile.gender === 'female';
        const folder = isFemale ? 'avatar-female' : 'avatar-male';
        const prefix = isFemale ? 'avatar-female-direct' : 'avatar-male-direct';
        const match = String(currentUserProfile.avatarKey).match(/\d+/);
        const no = match ? String(match[0]).padStart(3, '0') : '001';
        currentUserProfile.avatarUrl = `../${folder}/${prefix}-${no}.png`;
      }

      const playerId = currentUserProfile?.playerId;
      const groupId = currentUserProfile?.groupId;

      // 1.5 取得個人成就進度 (PlayerProgress.milestones)
      let playerMilestones = [];
      if (playerId) {
        try {
          const ppRes = await apiClient.getPlayerProgress(playerId);
          if (ppRes && (ppRes.success || ppRes.data)) {
            const data = ppRes.data || ppRes;
            playerMilestones = data.milestones || [];
            if (typeof playerMilestones === 'string') {
              try { playerMilestones = JSON.parse(playerMilestones); } catch (e) { playerMilestones = []; }
            }
          }
        } catch (pErr) {
          console.warn('[App] 讀取個人成就進度失敗', pErr);
          try {
            playerMilestones = JSON.parse(localStorage.getItem('vital_player_milestones') || '[]');
          } catch (e) { playerMilestones = []; }
        }
      }

      // 2. 取得小組成長歷程 (GroupProgress.milestones)
      let groupMilestones = [];
      if (groupId) {
        try {
          const journeyRes = await apiClient.getGroupJourney(groupId);
          if (journeyRes && journeyRes.success) {
            currentJourneyData = journeyRes.data || journeyRes.journey || journeyRes;
            const pCol = Number(currentJourneyData?.postsColIndex || currentJourneyData?.groupPostsColIndex);
            if (!isNaN(pCol) && pCol >= 2 && currentUserProfile) {
              currentUserProfile.postsColIndex = pCol;
              try {
                localStorage.setItem('vital_current_player', JSON.stringify(currentUserProfile));
              } catch (e) {}
            }
            groupMilestones = currentJourneyData?.milestones || [];
            if (typeof groupMilestones === 'string') {
              try { groupMilestones = JSON.parse(groupMilestones); } catch (e) { groupMilestones = []; }
            }
            try {
              localStorage.setItem('vital_group_journey', JSON.stringify(currentJourneyData));
            } catch (e) {}
          }
        } catch (jErr) {
          console.warn('[App] 讀取小組歷程失敗', jErr);
          try {
            currentJourneyData = JSON.parse(localStorage.getItem('vital_group_journey') || 'null');
            groupMilestones = (currentJourneyData && currentJourneyData.milestones) || [];
          } catch (e) {}
        }
      } else {
        currentJourneyData = null;
        if (currentUserProfile) {
          currentUserProfile.groupId = '';
          delete currentUserProfile.groupName;
          delete currentUserProfile.isLeader;
          delete currentUserProfile.postsColIndex;
          try {
            localStorage.setItem('vital_current_player', JSON.stringify(currentUserProfile));
            localStorage.removeItem('vital_group_journey');
            localStorage.removeItem('vital_group_milestones');
          } catch (e) {}
        }
      }

      // 2.5 登入時核對新成就並覆蓋本地快取
      checkMilestone(playerMilestones, groupMilestones);

      // 3. 取得有效系統公告
      let announcements = [];
      try {
        const annRes = await apiClient.getAnnouncements();
        if (annRes && annRes.success) {
          announcements = annRes.announcements || annRes.data?.announcements || annRes.data || [];
        }
      } catch (aErr) {
        console.warn('[App] 讀取公告失敗', aErr);
      }

      // 4. 渲染視圖
      dashboardView.render(currentUserProfile, currentJourneyData, announcements);
      profileView.render(currentUserProfile, currentJourneyData);

      // 4.5 水合當日操練與當週聚會狀態
      try {
        const homeDashRes = await apiClient.getHomeDashboard(currentUserProfile.playerId, currentUserProfile.matrixColIndex);
        const dashData = (homeDashRes && homeDashRes.data) || homeDashRes || {};
        if (dashData.dailyRecord) {
          const today = dashboardView.currentDate || dashboardView.getTodayDateString();
          practiceStore.dailyState[today] = {
            morning: Boolean(dashData.dailyRecord.morningRevival || dashData.dailyRecord.morning),
            morningRevival: Boolean(dashData.dailyRecord.morningRevival || dashData.dailyRecord.morning),
            bible: Boolean(dashData.dailyRecord.bibleReading || dashData.dailyRecord.bible),
            bibleReading: Boolean(dashData.dailyRecord.bibleReading || dashData.dailyRecord.bible),
            prayer: Boolean(dashData.dailyRecord.prayer),
            book: Boolean(dashData.dailyRecord.bookPursuit || dashData.dailyRecord.book),
            bookPursuit: Boolean(dashData.dailyRecord.bookPursuit || dashData.dailyRecord.book),
            syncStatus: 'synced',
            hasAmberDot: false
          };
          dashboardView.renderDailyPracticeState(practiceStore.dailyState[today]);
        }
        if (dashData.meetingRecord) {
          const currentWeek = dashboardView.currentWeekKey || dashboardView.getCurrentWeekKey();
          practiceStore.meetingState[currentWeek] = {
            smallGroup: Boolean(dashData.meetingRecord.groupMeeting || dashData.meetingRecord.smallGroup || dashData.meetingRecord.group),
            prayerMeeting: Boolean(dashData.meetingRecord.prayerMeeting || dashData.meetingRecord.prayerMtg),
            lordDayMeeting: Boolean(dashData.meetingRecord.lordsDayMeeting || dashData.meetingRecord.lordDayMeeting || dashData.meetingRecord.lordDay),
            outreachVisit: Boolean(dashData.meetingRecord.mutualPursuit || dashData.meetingRecord.outreachVisit || dashData.meetingRecord.outreach),
            syncStatus: 'synced',
            hasAmberDot: false
          };
          dashboardView.renderMeetingPracticeState(practiceStore.meetingState[currentWeek]);
        }
      } catch (dashErr) {
        console.warn('[App] 讀取主頁打卡狀態失敗', dashErr);
      }

      // 5. 初始化小組交流
      if (groupId) {
        fellowshipView.currentPlayerId = currentUserProfile.playerId;
        fellowshipView.currentUserName = currentUserProfile.name;
        const pCol = currentUserProfile.postsColIndex || currentJourneyData?.postsColIndex || null;
        fellowshipView.postsColIndex = pCol;
        fellowshipView.isLeader = Boolean(currentUserProfile.isLeader);
        chatStore.init(groupId, pCol);
      } else {
        fellowshipView.currentPlayerId = (currentUserProfile && currentUserProfile.playerId) || '';
        fellowshipView.currentUserName = (currentUserProfile && currentUserProfile.name) || '';
        fellowshipView.postsColIndex = null;
        fellowshipView.isLeader = false;
        if (typeof chatStore.leaveChat === 'function') {
          chatStore.leaveChat();
        }
      }

    } catch (err) {
      console.error('[App] 載入使用者資料發生異常', err);
    }
  }

  function checkMilestone(playerMilestones, groupMilestones) {
    let lastLogin = '1970-01-01T00:00:00Z';
    try {
      lastLogin = localStorage.getItem('vital_last_login') || '1970-01-01T00:00:00Z';
    } catch (e) {}

    const pMs = Array.isArray(playerMilestones) ? playerMilestones : [];
    const gMs = Array.isArray(groupMilestones) ? groupMilestones : [];

    const newPlayerMs = pMs.filter(m => m && m.completedAt && m.completedAt > lastLogin);
    const newGroupMs = gMs.filter(m => m && m.completedAt && m.completedAt > lastLogin);

    if (newPlayerMs.length > 0 || newGroupMs.length > 0) {
      showMilestonesCelebration(newPlayerMs, newGroupMs);
    }

    // 無論有無新成就，全覆蓋寫入 localStorage 確保一致性
    try {
      localStorage.setItem('vital_player_milestones', JSON.stringify(pMs));
      localStorage.setItem('vital_group_milestones', JSON.stringify(gMs));
      localStorage.setItem('vital_last_login', new Date().toISOString());
    } catch (e) {}
  }

  function showMilestonesCelebration(newPlayerMs, newGroupMs) {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('milestoneCelebrationModal');
    if (!modal) return;

    const chestListEl = document.getElementById('celebrationChestList');
    const chapterListEl = document.getElementById('celebrationChapterList');
    const taskListEl = document.getElementById('celebrationTaskList');
    const closeBtn = document.getElementById('closeCelebrationBtn');

    const allNew = [...(newPlayerMs || []), ...(newGroupMs || [])];
    const chests = [];
    const chapters = [];
    const tasks = [];

    allNew.forEach(m => {
      const id = String((m && m.id) || '');
      if (id.startsWith('CHEST_') || /^T\d+$/.test(id)) {
        chests.push(m);
      } else if (id.startsWith('CHAPTER_') || /^CH\d+$/i.test(id)) {
        chapters.push(m);
      } else {
        tasks.push(m);
      }
    });

    const formatReward = (r) => {
      if (!r) return '';
      const pt = typeof r === 'object' ? (r.point || r.points || 0) : Number(r);
      return pt ? ` (+${pt} 操練分)` : '';
    };

    if (chestListEl) {
      if (chests.length > 0) {
        chestListEl.innerHTML = `<strong>🎁 獲得新寶箱：</strong><ul style="margin: 4px 0 0 18px; padding: 0;">` +
          chests.map(c => `<li>${c.id}${formatReward(c.reward)}</li>`).join('') +
          `</ul>`;
        chestListEl.style.display = 'block';
      } else {
        chestListEl.innerHTML = '';
        chestListEl.style.display = 'none';
      }
    }

    if (chapterListEl) {
      if (chapters.length > 0) {
        chapterListEl.innerHTML = `<strong>📜 達成新篇章：</strong><ul style="margin: 4px 0 0 18px; padding: 0;">` +
          chapters.map(c => `<li>${c.id}${formatReward(c.reward)}</li>`).join('') +
          `</ul>`;
        chapterListEl.style.display = 'block';
      } else {
        chapterListEl.innerHTML = '';
        chapterListEl.style.display = 'none';
      }
    }

    if (taskListEl) {
      if (tasks.length > 0) {
        taskListEl.innerHTML = `<strong>⭐ 完成新任務：</strong><ul style="margin: 4px 0 0 18px; padding: 0;">` +
          tasks.map(t => `<li>${t.id}${formatReward(t.reward)}</li>`).join('') +
          `</ul>`;
        taskListEl.style.display = 'block';
      } else {
        taskListEl.innerHTML = '';
        taskListEl.style.display = 'none';
      }
    }

    modal.classList.remove('hidden');

    if (closeBtn) {
      closeBtn.onclick = () => {
        modal.classList.add('hidden');
      };
    }
  }

  function openChests(selectedIdx = null) {
    const points = (currentUserProfile && (currentUserProfile.totalPoints !== undefined ? currentUserProfile.totalPoints : currentUserProfile.totalScore)) || 0;
    chestView.openChestModal(points, selectedIdx);
  }

  async function refreshUserData() {
    await loadUserData();
  }

  function handleLoginSuccess(profile) {
    currentUserProfile = profile;
    if (profile && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('vital_current_player', JSON.stringify(profile));
      } catch (e) {}
    }
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

  async function updateUserGroupState(groupId, groupName = '', isLeader = false) {
    if (!currentUserProfile) return;
    currentUserProfile.groupId = groupId || '';
    if (groupId) {
      currentUserProfile.groupName = groupName;
      currentUserProfile.isLeader = Boolean(isLeader);
    } else {
      delete currentUserProfile.groupName;
      delete currentUserProfile.isLeader;
      delete currentUserProfile.postsColIndex;
      currentJourneyData = null;
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('vital_current_player', JSON.stringify(currentUserProfile));
        if (!groupId) {
          localStorage.removeItem('vital_current_group');
          localStorage.removeItem('vital_group_journey');
          localStorage.removeItem('vital_group_milestones');
        }
      } catch (e) {}
    }

    if (groupId) {
      try {
        const journeyRes = await apiClient.getGroupJourney(groupId);
        if (journeyRes && journeyRes.success) {
          currentJourneyData = journeyRes.data || journeyRes.journey || journeyRes;
          const pCol = Number(currentJourneyData?.postsColIndex || currentJourneyData?.groupPostsColIndex);
          if (!isNaN(pCol) && pCol >= 2) {
            currentUserProfile.postsColIndex = pCol;
          }
          let groupMilestones = currentJourneyData?.milestones || [];
          if (typeof groupMilestones === 'string') {
            try { groupMilestones = JSON.parse(groupMilestones); } catch (e) { groupMilestones = []; }
          }
          try {
            localStorage.setItem('vital_group_journey', JSON.stringify(currentJourneyData));
          } catch (e) {}
          let playerMilestones = [];
          try {
            playerMilestones = JSON.parse(localStorage.getItem('vital_player_milestones') || '[]');
          } catch (e) {}
          checkMilestone(playerMilestones, groupMilestones);
        }
      } catch (jErr) {
        console.warn('[App] 創組/加入小組後讀取小組歷程失敗', jErr);
      }
    }

    if (profileView && typeof profileView.render === 'function') {
      profileView.render(currentUserProfile, currentJourneyData);
    }
    if (dashboardView && typeof dashboardView.render === 'function') {
      dashboardView.render(currentUserProfile, currentJourneyData);
    }
    if (fellowshipView) {
      if (groupId) {
        fellowshipView.currentPlayerId = currentUserProfile.playerId;
        fellowshipView.currentUserName = currentUserProfile.name;
        fellowshipView.isLeader = Boolean(currentUserProfile.isLeader);
      } else {
        fellowshipView.currentPlayerId = (currentUserProfile && currentUserProfile.playerId) || '';
        fellowshipView.currentUserName = (currentUserProfile && currentUserProfile.name) || '';
        fellowshipView.postsColIndex = null;
        fellowshipView.isLeader = false;
        if (typeof chatStore.leaveChat === 'function') {
          chatStore.leaveChat();
        }
      }
    }
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
    refreshUserData,
    updateUserGroupState,
    checkMilestone,
    showMilestonesCelebration
  };

})(typeof window !== 'undefined' ? window : global);
