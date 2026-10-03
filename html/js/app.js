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

  const CHAPTER_NAMES = ['信心', '美德', '知識', '節制', '忍耐', '敬虔', '弟兄相愛', '愛'];

  function resolveAvatarUrl(gender, avatarKey) {
    const isFemale = gender === 'SISTER' || gender === 'female';
    const folder = isFemale ? 'avatar-female' : 'avatar-male';
    const prefix = isFemale ? 'avatar-female-direct' : 'avatar-male-direct';
    const match = String(avatarKey || '').match(/\d+/);
    const no = match ? String(match[0]).padStart(3, '0') : '001';
    return `../${folder}/${prefix}-${no}.png`;
  }

  function deriveJourneyFromGroupProgress(groupProgress, fallbackProfile = null) {
    if (!groupProgress) return null;
    let milestones = groupProgress.milestones || [];
    if (typeof milestones === 'string') {
      try { milestones = JSON.parse(milestones); } catch (e) { milestones = []; }
    }

    let maxChapterLevel = 1;
    milestones.forEach(m => {
      const id = String((m && m.id) || '');
      const match = id.match(/(?:CHP_|CHAPTER_|CH)(\d+)/i);
      if (match) {
        const lvl = parseInt(match[1], 10);
        if (lvl > maxChapterLevel) maxChapterLevel = lvl;
      }
    });

    const chapterIndex = Math.min(8, Math.max(1, maxChapterLevel));
    const chapterTitle = CHAPTER_NAMES[chapterIndex - 1] || '起步啟航';

    let totalScore = Number(
      groupProgress.totalPoints !== undefined ? groupProgress.totalPoints :
      (groupProgress.groupTotalPoints !== undefined ? groupProgress.groupTotalPoints :
      (groupProgress.totalScore !== undefined ? groupProgress.totalScore : 0))
    );
    if (!totalScore && groupProgress.memberContribution && typeof groupProgress.memberContribution === 'object') {
      const sum = Object.values(groupProgress.memberContribution).reduce((acc, v) => acc + (Number(v) || 0), 0);
      if (sum > 0) totalScore = sum;
    }
    if (!totalScore && groupProgress.historySummary) {
      let hs = groupProgress.historySummary;
      if (typeof hs === 'string') {
        try { hs = JSON.parse(hs); } catch (e) { hs = {}; }
      }
      const currYear = String(new Date().getFullYear());
      totalScore = Number(hs[currYear] || hs.totalScore || 0);
    }

    let mCount = groupProgress.memberCount;
    if (typeof mCount !== 'number' && groupProgress.memberContribution && typeof groupProgress.memberContribution === 'object') {
      mCount = Object.keys(groupProgress.memberContribution).length;
    }
    if (typeof mCount !== 'number' && fallbackProfile && typeof fallbackProfile.memberCount === 'number') {
      mCount = fallbackProfile.memberCount;
    }
    if (typeof mCount === 'number' && fallbackProfile && fallbackProfile.groupId) {
      fallbackProfile.memberCount = mCount;
    }

    const finalPoints = totalScore || (fallbackProfile && (fallbackProfile.groupTotalPoints || fallbackProfile.totalPoints || fallbackProfile.totalScore)) || 0;

    return {
      ...groupProgress,
      memberCount: typeof mCount === 'number' ? mCount : undefined,
      currentChapter: chapterIndex,
      chapterTitle: chapterTitle,
      chapterName: chapterTitle,
      currentLevel: chapterIndex,
      totalPoints: finalPoints,
      totalScore: finalPoints,
      groupTotalPoints: finalPoints,
      progressPercent: Math.min(100, Math.round((chapterIndex / 8) * 100)),
      milestones: milestones
    };
  }

  async function initApp() {
    const _W = typeof window !== 'undefined' ? window : {};

    // 1. 初始化 API 客戶端
    const ApiClientClass = global.ApiClient || _W.ApiClient;
    if (!ApiClientClass) return;

    apiClient = new ApiClientClass({
      baseUrl: (typeof window !== 'undefined' && window.VITAL_API_URL) || '/api',
      onSessionExpired: () => handleLogout()
    });
    if (typeof window !== 'undefined') {
      window.activeApiClient = apiClient;
    }

    // 2. 初始化狀態庫
    const PracticeStoreClass = global.OptimisticPracticeStore || _W.OptimisticPracticeStore;
    if (PracticeStoreClass) {
      practiceStore = new PracticeStoreClass({
        apiClient: apiClient
      });
    }

    const ChatStoreClass = global.ChatStore || _W.ChatStore;
    if (ChatStoreClass) {
      chatStore = new ChatStoreClass({
        apiClient: apiClient
      });
    }

    // 3. 初始化視圖模組
    const AuthViewClass = global.AuthView || _W.AuthView;
    if (AuthViewClass) {
      authView = new AuthViewClass({
        apiClient: apiClient,
        onLoginSuccess: (profile) => handleLoginSuccess(profile)
      });
    }

    const ChestViewClass = global.ChestView || _W.ChestView;
    if (ChestViewClass) {
      chestView = new ChestViewClass({
        apiClient: apiClient
      });
    }

    const FootprintsViewClass = global.FootprintsView || _W.FootprintsView;
    if (FootprintsViewClass) {
      footprintsView = new FootprintsViewClass({
        apiClient: apiClient
      });
      global.footprintsView = footprintsView;
      if (typeof window !== 'undefined') {
        window.footprintsView = footprintsView;
      }
    }

    const FellowshipViewClass = global.GroupFellowshipView || _W.GroupFellowshipView;
    if (FellowshipViewClass) {
      fellowshipView = new FellowshipViewClass({
        chatStore: chatStore,
        currentPlayerId: '',
        currentUserName: ''
      });
    }

    const DashboardViewClass = global.DashboardView || _W.DashboardView;
    if (DashboardViewClass) {
      dashboardView = new DashboardViewClass({
        practiceStore: practiceStore,
        apiClient: apiClient,
        onFootprintClick: () => footprintsView && footprintsView.openFootprintsModal(),
        onChestClick: (selectedIdx) => openChests(selectedIdx),
        onRefresh: () => refreshUserData(),
        onLogout: () => handleLogout(),
        onGroupJourneyListClick: () => dashboardView && dashboardView.openGroupJourneyListModal(),
        onContributionClick: () => profileView && profileView.openContributionModal()
      });
      global.dashboardView = dashboardView;
    }

    const ProfileViewClass = global.ProfileView || _W.ProfileView;
    if (ProfileViewClass) {
      profileView = new ProfileViewClass({
        apiClient: apiClient,
        onAvatarUpdated: (url, name) => handleAvatarUpdated(url, name),
        onLogout: () => handleLogout(),
        onFootprintClick: () => footprintsView && footprintsView.openFootprintsModal(),
        onFellowshipClick: () => {
          if (!currentUserProfile || !currentUserProfile.groupId) {
            alert('您尚未加入任何活力組！請先於首頁或個人手冊中加入或建立活力組，才能使用小組公告與交通功能。');
            return;
          }
          if (fellowshipView) fellowshipView.openModal();
        }
      });
    }

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
      // 0. 本地水合 (0ms rendering)
      let cachedPlayer = null;
      try {
        const cachedStr = localStorage.getItem('vital_current_player');
        if (cachedStr) {
          cachedPlayer = JSON.parse(cachedStr);
          if (cachedPlayer && cachedPlayer.playerId) {
            currentUserProfile = { ...currentUserProfile, ...cachedPlayer };
            const gId = cachedPlayer.groupId;
            
            // 嘗試從本地小組快取補全 memberCount
            if (gId && (currentUserProfile.memberCount === undefined || currentUserProfile.memberCount === null)) {
              try {
                const cgp = JSON.parse(localStorage.getItem(`vital_group_profile_${gId}`) || 'null');
                if (cgp) {
                  if (typeof cgp.memberCount === 'number') currentUserProfile.memberCount = cgp.memberCount;
                  else if (Array.isArray(cgp.members)) currentUserProfile.memberCount = cgp.members.length;
                }
              } catch (e) {}
            }

            let cachedGroupProgress = null;
            if (gId) {
              const cgStr = localStorage.getItem(`vital_group_progress_${gId}`);
              if (cgStr) cachedGroupProgress = JSON.parse(cgStr);
              currentJourneyData = deriveJourneyFromGroupProgress(cachedGroupProgress, currentUserProfile);
            }
            
            let cachedAnnouncements = [];
            const caStr = localStorage.getItem('vital_announcements');
            if (caStr) cachedAnnouncements = JSON.parse(caStr);

            let cachedChapters = null;
            try {
              const chStr = localStorage.getItem('vital_chapters_config');
              if (chStr) cachedChapters = JSON.parse(chStr);
            } catch (e) {}
            
            // 立即使用快取資料渲染 UI
            dashboardView.render(currentUserProfile, currentJourneyData, cachedAnnouncements, cachedChapters);
            profileView.render(currentUserProfile, currentJourneyData);
          }
        }
      } catch (e) {}

      // 如果既無 token 也無快取 profile，則退出
      if (!currentUserProfile && !apiClient.getSessionToken()) {
        handleLogout();
        return;
      }
      
      const pId = currentUserProfile?.playerId;
      const gId = currentUserProfile?.groupId;
      const matrixColIndex = currentUserProfile?.matrixColIndex;

      if (dashboardView && typeof dashboardView.setSyncLock === 'function') {
        dashboardView.setSyncLock(true);
      }

      // 平行發起極速 getPractice，專供首頁儀表板 2 個單元格更新與解鎖
      apiClient.getPractice().then(pRes => {
        if (pRes && pRes.success && pRes.data) {
          const today = dashboardView.currentDate || dashboardView.getTodayDateString();
          const curWeek = dashboardView.currentWeekKey || dashboardView.getCurrentWeekKey();
          const dRec = pRes.data.daily || {};
          const mRec = pRes.data.meeting || {};
          
          practiceStore.dailyState[today] = {
            morning: Boolean(dRec.morning || dRec.morningRevival),
            morningRevival: Boolean(dRec.morning || dRec.morningRevival),
            bible: Boolean(dRec.bible || dRec.bibleReading),
            bibleReading: Boolean(dRec.bible || dRec.bibleReading),
            prayer: Boolean(dRec.prayer),
            book: Boolean(dRec.book || dRec.bookPursuit),
            bookPursuit: Boolean(dRec.book || dRec.bookPursuit),
            syncStatus: 'synced',
            hasAmberDot: false
          };
          practiceStore.meetingState[curWeek] = {
            smallGroup: Boolean(mRec.group || mRec.smallGroup),
            prayerMeeting: Boolean(mRec.prayerMtg || mRec.prayerMeeting),
            lordDayMeeting: Boolean(mRec.lordDay || mRec.lordDayMeeting),
            outreachVisit: Boolean(mRec.outreach || mRec.outreachVisit || mRec.blend || mRec.mutual),
            syncStatus: 'synced',
            hasAmberDot: false
          };
          if (dashboardView) {
            dashboardView.renderDailyPracticeState(practiceStore.dailyState[today]);
            dashboardView.renderMeetingPracticeState(practiceStore.meetingState[curWeek]);
            dashboardView.setSyncLock(false);
          }
        }
      }).catch(err => {
        console.warn('[App] getPractice 快速載入略過:', err);
      });

      const [bootstrapRes, bundleRes, profileRes, groupProgressRes] = await Promise.allSettled([
        apiClient.getBootstrap(),
        pId ? apiClient.getProgressBundle(gId) : Promise.resolve(null),
        gId ? apiClient.getGroupProfile(gId) : Promise.resolve(null),
        gId ? apiClient.getGroupProgress(gId) : Promise.resolve(null)
      ]);

      let announcements = [];
      let dailyRecords = null;
      let meetingRecords = null;
      
      // 2. 處理 Bootstrap 回應
      if (bootstrapRes.status === 'fulfilled' && bootstrapRes.value) {
        const res = bootstrapRes.value;
        if (res && res.success) {
          const fetchedPlayer = res.player || res.data?.player || res.data || {};
          currentUserProfile = { ...currentUserProfile, ...fetchedPlayer };
          
          if (res.data?.dailyRecords) dailyRecords = res.data.dailyRecords;
          if (res.data?.meetingRecords) meetingRecords = res.data.meetingRecords;
          if (res.data?.announcements) announcements = res.data.announcements;

          if (typeof localStorage !== 'undefined') {
            try {
              localStorage.setItem('vital_current_player', JSON.stringify(currentUserProfile));
              if (dailyRecords) localStorage.setItem(`vital_daily_records_${currentUserProfile.playerId}`, JSON.stringify(dailyRecords));
              if (meetingRecords) localStorage.setItem(`vital_meeting_records_${currentUserProfile.playerId}`, JSON.stringify(meetingRecords));
              if (announcements.length > 0) localStorage.setItem('vital_announcements', JSON.stringify(announcements));
            } catch (e) {}
          }
        } else {
          console.warn('[App] 取得遠端使用者檔案失敗', bootstrapRes.value);
        }
      }

      if (currentUserProfile && !currentUserProfile.avatarUrl && currentUserProfile.avatarKey) {
        currentUserProfile.avatarUrl = resolveAvatarUrl(currentUserProfile.gender, currentUserProfile.avatarKey);
      }

      const currentPId = currentUserProfile?.playerId;
      const currentGId = currentUserProfile?.groupId;

      // 3. 處理 Progress Bundle 回應
      let playerMilestones = [];
      let groupMilestones = [];
      let groupProgress = null;
      let chaptersConfig = null;
      let achievementsConfig = null;
      let tasksConfig = null;

      let hasBackendPlayerProgress = false;

      if (bundleRes.status === 'fulfilled' && bundleRes.value && bundleRes.value.success) {
        const data = bundleRes.value.data || bundleRes.value;
        
        if (data.playerProgress) {
          hasBackendPlayerProgress = true;
          playerMilestones = data.playerProgress.milestones || [];
          if (typeof playerMilestones === 'string') {
            try { playerMilestones = JSON.parse(playerMilestones); } catch(e) { playerMilestones = []; }
          }
          if (currentUserProfile) {
            if (data.playerProgress.personalPoints !== undefined) {
              currentUserProfile.personalPoints = Number(data.playerProgress.personalPoints || 0);
            }
            if (data.playerProgress.contributionPoints !== undefined) {
              currentUserProfile.contributionPoints = Number(data.playerProgress.contributionPoints || 0);
            }
            try { localStorage.setItem('vital_current_player', JSON.stringify(currentUserProfile)); } catch(e) {}
          }
        }
        
        if (data.groupProgress) {
          groupProgress = data.groupProgress;
          groupMilestones = groupProgress.milestones || [];
          if (typeof groupMilestones === 'string') {
            try { groupMilestones = JSON.parse(groupMilestones); } catch(e) { groupMilestones = []; }
          }
        }

        // 若獨立查詢之 groupProgressRes 具備有效總分，優先注入
        if (groupProgressRes && groupProgressRes.status === 'fulfilled' && groupProgressRes.value && (groupProgressRes.value.success || groupProgressRes.value.data)) {
          const gpData = groupProgressRes.value.data || groupProgressRes.value;
          const gpScore = Number(gpData.totalPoints !== undefined ? gpData.totalPoints : (gpData.groupTotalPoints !== undefined ? gpData.groupTotalPoints : 0));
          if (gpScore > 0) {
            if (!groupProgress) groupProgress = gpData;
            groupProgress.totalPoints = gpScore;
            groupProgress.groupTotalPoints = gpScore;
            if (gpData.memberContribution) groupProgress.memberContribution = gpData.memberContribution;
          }
        }

        // 若仍未取得點數，嘗試從本地快取中救回既有點數
        if (currentGId && (!groupProgress || (groupProgress.totalPoints === undefined && groupProgress.groupTotalPoints === undefined))) {
          try {
            const cachedGp = JSON.parse(localStorage.getItem(`vital_group_progress_${currentGId}`) || 'null');
            if (cachedGp) {
              const cp = Number(cachedGp.totalPoints !== undefined ? cachedGp.totalPoints : (cachedGp.groupTotalPoints !== undefined ? cachedGp.groupTotalPoints : 0));
              if (cp > 0) {
                if (!groupProgress) groupProgress = cachedGp;
                groupProgress.totalPoints = cp;
                groupProgress.groupTotalPoints = cp;
                if (cachedGp.memberContribution) groupProgress.memberContribution = cachedGp.memberContribution;
              }
            }
          } catch(e) {}
        }

        if (currentGId && groupProgress && typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(`vital_group_progress_${currentGId}`, JSON.stringify(groupProgress));
          } catch(e) {}
        }

        if (data.chapters) {
          chaptersConfig = data.chapters;
          try { localStorage.setItem('vital_chapters_config', JSON.stringify(data.chapters)); } catch(e) {}
        }
        if (data.achievements) {
          achievementsConfig = data.achievements;
          try { localStorage.setItem('vital_achievements_config', JSON.stringify(data.achievements)); } catch(e) {}
        }
        if (data.tasks) {
          tasksConfig = data.tasks;
          try { localStorage.setItem('vital_tasks_config', JSON.stringify(data.tasks)); } catch(e) {}
        }

        if (data.pointsConfig) {
          try {
            localStorage.setItem('vital_points_config', JSON.stringify(data.pointsConfig));
          } catch (e) {}
          if (dashboardView && typeof dashboardView.renderTaskCards === 'function') {
            dashboardView.renderTaskCards(data.pointsConfig);
          }
        }
      } else {
        if (currentPId && typeof localStorage !== 'undefined') {
          try { playerMilestones = JSON.parse(localStorage.getItem(`vital_player_milestones_${currentPId}`) || '[]'); } catch(e) { playerMilestones = []; }
        }
        if (currentGId && typeof localStorage !== 'undefined') {
          try {
            groupMilestones = JSON.parse(localStorage.getItem(`vital_group_milestones_${currentGId}`) || '[]');
            groupProgress = JSON.parse(localStorage.getItem(`vital_group_progress_${currentGId}`) || 'null');
          } catch(e) { groupMilestones = []; groupProgress = null; }
        }
        try { chaptersConfig = JSON.parse(localStorage.getItem('vital_chapters_config') || 'null'); } catch(e) {}
        try { achievementsConfig = JSON.parse(localStorage.getItem('vital_achievements_config') || 'null'); } catch(e) {}
        try { tasksConfig = JSON.parse(localStorage.getItem('vital_tasks_config') || 'null'); } catch(e) {}
      }

      // 若 ProgressBundle 未包含 pointsConfig（如未入組/離線），發起 getPointsConfig 補充拉取
      const hasPointsConfig = Boolean(bundleRes?.value?.data?.pointsConfig || bundleRes?.value?.pointsConfig);
      if (!hasPointsConfig) {
        apiClient.getPointsConfig().then(pcRes => {
          const cfg = (pcRes && (pcRes.pointsConfig || pcRes.data || pcRes.configs)) || null;
          if (cfg) {
            try { localStorage.setItem('vital_points_config', JSON.stringify(cfg)); } catch (e) {}
            if (dashboardView && typeof dashboardView.renderTaskCards === 'function') {
              dashboardView.renderTaskCards(cfg);
            }
          }
        }).catch(err => {
          console.warn('[App] getPointsConfig 補充拉取跳過:', err);
        });
      }

      if (currentGId && profileRes.status === 'fulfilled' && profileRes.value && profileRes.value.success) {
        const groupProfileData = profileRes.value.data || profileRes.value;
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(`vital_group_profile_${currentGId}`, JSON.stringify(groupProfileData));
          } catch(e) {}
        }
        if (groupProfileData && currentUserProfile) {
          const count = typeof groupProfileData.memberCount === 'number'
            ? groupProfileData.memberCount
            : (Array.isArray(groupProfileData.members) ? groupProfileData.members.length : undefined);
          if (count !== undefined) {
            currentUserProfile.memberCount = count;
          }
        }
      }

      if (currentGId) {
        currentJourneyData = deriveJourneyFromGroupProgress(groupProgress, currentUserProfile);
      } else {
        currentJourneyData = null;
        if (currentUserProfile) {
          currentUserProfile.groupId = '';
          delete currentUserProfile.groupName;
          delete currentUserProfile.isLeader;
          delete currentUserProfile.postsColIndex;
          currentUserProfile.memberCount = 0;
          if (typeof localStorage !== 'undefined') {
            try { localStorage.setItem('vital_current_player', JSON.stringify(currentUserProfile)); } catch (e) {}
          }
        }
      }

      if (currentUserProfile && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('vital_current_player', JSON.stringify(currentUserProfile));
        } catch (e) {}
      }

      // 4. checkMilestone (嚴格以後端收到的 progress 為標準，前端未結算/快取不觸發)
      if (hasBackendPlayerProgress) {
        checkMilestone(playerMilestones, groupMilestones, currentPId, currentGId, {
          chapters: chaptersConfig,
          achievements: achievementsConfig,
          tasks: tasksConfig
        });
      }

      if (announcements.length === 0 && typeof localStorage !== 'undefined') {
        try { announcements = JSON.parse(localStorage.getItem('vital_announcements') || '[]'); } catch(e) { announcements = []; }
      }

      // 5. 差量更新視圖
      dashboardView.render(currentUserProfile, currentJourneyData, announcements, chaptersConfig);
      profileView.render(currentUserProfile, currentJourneyData);

      // 5.1 檢查特殊任務登入提示彈窗 (今日不再顯示記憶機制)
      checkSpecialTasksPrompt(tasksConfig, currentPId);



      // 6. 處理打卡狀態 (從 dailyRecords / meetingRecords 解析)
      if (dailyRecords) {
        const today = dashboardView.currentDate || dashboardView.getTodayDateString();
        const todayRecord = dailyRecords[today] || {};
        practiceStore.dailyState[today] = {
          morning: Boolean(todayRecord.morning),
          morningRevival: Boolean(todayRecord.morning),
          bible: Boolean(todayRecord.bible),
          bibleReading: Boolean(todayRecord.bible),
          prayer: Boolean(todayRecord.prayer),
          book: Boolean(todayRecord.book),
          bookPursuit: Boolean(todayRecord.book),
          syncStatus: 'synced',
          hasAmberDot: false
        };
        dashboardView.renderDailyPracticeState(practiceStore.dailyState[today]);
      }
      if (meetingRecords) {
        const currentWeek = dashboardView.currentWeekKey || dashboardView.getCurrentWeekKey();
        const currentMtg = meetingRecords[currentWeek] || {};
        practiceStore.meetingState[currentWeek] = {
          smallGroup: Boolean(currentMtg.group),
          prayerMeeting: Boolean(currentMtg.prayerMtg),
          lordDayMeeting: Boolean(currentMtg.lordDay),
          outreachVisit: Boolean(currentMtg.mutual),
          syncStatus: 'synced',
          hasAmberDot: false
        };
        dashboardView.renderMeetingPracticeState(practiceStore.meetingState[currentWeek]);
      }

      // 7. 初始化小組交流
      if (currentGId) {
        fellowshipView.currentPlayerId = currentUserProfile.playerId;
        fellowshipView.currentUserName = currentUserProfile.name;
        const pCol = currentUserProfile.postsColIndex || currentJourneyData?.postsColIndex || null;
        fellowshipView.postsColIndex = pCol;
        fellowshipView.isLeader = Boolean(currentUserProfile.isLeader);
        chatStore.init(currentGId, pCol);

        // 8. 登入後背景平行觸發 getGroupProgress，非同步更新快取 (SWR cache warm-up)
        apiClient.getGroupProgress(currentGId).then(gpRes => {
          if (gpRes && (gpRes.success || gpRes.data)) {
            const data = gpRes.data || gpRes;
            try {
              localStorage.setItem(`vital_group_progress_${currentGId}`, JSON.stringify(data));
              if (data.milestones) {
                localStorage.setItem(`vital_group_milestones_${currentGId}`, JSON.stringify(data.milestones));
              }
            } catch (e) {}
          }
        }).catch(bgErr => {
          console.warn('[App] 背景同步小組進度略過:', bgErr);
        });
      } else {
        fellowshipView.currentPlayerId = (currentUserProfile && currentUserProfile.playerId) || '';
        fellowshipView.currentUserName = (currentUserProfile && currentUserProfile.name) || '';
        fellowshipView.postsColIndex = null;
        fellowshipView.isLeader = false;
        if (typeof chatStore.leaveChat === 'function') {
          chatStore.leaveChat();
        }
      }

      // 9. 背景預熱同行足跡快取 (SWR 預載，100% 零阻塞登入與首屏)
      if (currentPId && typeof setTimeout !== 'undefined') {
        setTimeout(() => {
          if (apiClient && apiClient.getSessionToken() && typeof apiClient.getFootprints === 'function') {
            apiClient.getFootprints({ playerId: currentPId, weeks: 10 }).catch(() => {});
          }
        }, 1500);
      }

    } catch (err) {
      console.error('[App] 載入使用者資料發生異常', err);
    } finally {
      if (dashboardView && typeof dashboardView.setSyncLock === 'function') {
        dashboardView.setSyncLock(false);
      }
    }
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function resolveMilestoneName(m, type = '', configs = {}) {
    if (!m) return '';
    if (m.name && typeof m.name === 'string' && m.name.trim()) return m.name.trim();
    if (m.title && typeof m.title === 'string' && m.title.trim()) return m.title.trim();

    const id = String((m.id || m.achievementId || m.chapterId || m.taskId) || '').trim();
    if (!id) return '';

    let chapters = (configs && configs.chapters) || null;
    let achievements = (configs && configs.achievements) || null;
    let tasks = (configs && configs.tasks) || null;

    if (typeof localStorage !== 'undefined') {
      try { if (!chapters) chapters = JSON.parse(localStorage.getItem('vital_chapters_config') || 'null'); } catch (e) {}
      try { if (!achievements) achievements = JSON.parse(localStorage.getItem('vital_achievements_config') || 'null'); } catch (e) {}
      try { if (!tasks) tasks = JSON.parse(localStorage.getItem('vital_tasks_config') || 'null'); } catch (e) {}
    }

    const normChapterId = id.replace(/^CHAPTER_/i, '');
    const normChestId = id.replace(/^CHEST_/i, '');
    const normTaskId = id.replace(/^TASK_/i, '');

    // 篇章查表
    if (type === 'chapter' || id.startsWith('CHAPTER_') || id.startsWith('CHP_') || /^CH\d+$/i.test(id)) {
      if (Array.isArray(chapters)) {
        const found = chapters.find(c => {
          if (!c) return false;
          const cid = String(c.chapterId || c.id || '').trim();
          const normCid = cid.replace(/^CHAPTER_/i, '');
          return cid === id || cid === normChapterId || normCid === normChapterId;
        });
        if (found && found.name) return found.name;
      }
    }

    // 個人成就/寶箱查表
    if (type === 'chest' || id.startsWith('CHEST_') || /^T\d+$/i.test(id)) {
      if (Array.isArray(achievements)) {
        const found = achievements.find(a => {
          if (!a) return false;
          const aid = String(a.achievementId || a.id || '').trim();
          const normAid = aid.replace(/^CHEST_/i, '');
          return aid === id || aid === normChestId || normAid === normChestId;
        });
        if (found && found.name) return found.name;
      }
      const chestDefaults = {
        'T1': '初熟果子寶箱', 'CHEST_T1': '初熟果子寶箱', 'CHEST_tier_1': '初熟果子寶箱', 'tier_1': '初熟果子寶箱',
        'T2': '盛花繁茂寶箱', 'CHEST_T2': '盛花繁茂寶箱', 'CHEST_tier_2': '盛花繁茂寶箱', 'tier_2': '盛花繁茂寶箱',
        'T3': '碩果纍纍寶箱', 'CHEST_T3': '碩果纍纍寶箱', 'CHEST_tier_3': '碩果纍纍寶箱', 'tier_3': '碩果纍纍寶箱',
        'T4': '深根泉湧寶箱', 'CHEST_T4': '深根泉湧寶箱', 'CHEST_tier_4': '深根泉湧寶箱', 'tier_4': '深根泉湧寶箱',
        'T5': '純金精煉寶箱', 'CHEST_T5': '純金精煉寶箱', 'CHEST_tier_5': '純金精煉寶箱', 'tier_5': '純金精煉寶箱',
        'T6': '明光照耀寶箱', 'CHEST_T6': '明光照耀寶箱', 'CHEST_tier_6': '明光照耀寶箱', 'tier_6': '明光照耀寶箱',
        'T7': '磐石基石寶箱', 'CHEST_T7': '磐石基石寶箱', 'CHEST_tier_7': '磐石基石寶箱', 'tier_7': '磐石基石寶箱',
        'T8': '榮耀冠冕寶箱', 'CHEST_T8': '榮耀冠冕寶箱', 'CHEST_tier_8': '榮耀冠冕寶箱', 'tier_8': '榮耀冠冕寶箱'
      };
      if (chestDefaults[id] || chestDefaults[normChestId]) return chestDefaults[id] || chestDefaults[normChestId];
    }

    // 特殊任務查表
    if (Array.isArray(tasks)) {
      const found = tasks.find(t => {
        if (!t) return false;
        const tid = String(t.taskId || t.id || '').trim();
        const normTid = tid.replace(/^TASK_/i, '');
        return tid === id || tid === normTaskId || normTid === normTaskId;
      });
      if (found && found.name) return found.name;
    }

    return id;
  }

  function checkMilestone(playerMilestones, groupMilestones, pId = null, gId = null, configs = {}) {
    let lastLogin = null;
    let cachedPMs = [];
    let cachedGMs = [];

    if (typeof localStorage !== 'undefined') {
      try {
        lastLogin = (pId ? localStorage.getItem(`vital_last_login_${pId}`) : null) || localStorage.getItem('vital_last_login') || null;
      } catch (e) {}

      try {
        const cachedPStr = (pId ? localStorage.getItem(`vital_player_milestones_${pId}`) : null) || localStorage.getItem('vital_player_milestones');
        if (cachedPStr) {
          const parsed = JSON.parse(cachedPStr);
          if (Array.isArray(parsed)) cachedPMs = parsed;
        }
      } catch (e) {}

      try {
        const cachedGStr = (gId ? localStorage.getItem(`vital_group_milestones_${gId}`) : null) || localStorage.getItem('vital_group_milestones');
        if (cachedGStr) {
          const parsed = JSON.parse(cachedGStr);
          if (Array.isArray(parsed)) cachedGMs = parsed;
        }
      } catch (e) {}
    }

    const pMs = Array.isArray(playerMilestones) ? playerMilestones : [];
    const gMs = Array.isArray(groupMilestones) ? groupMilestones : [];

    let newPlayerMs = [];
    let newGroupMs = [];

    // 條件：只有當 playerProgress 的 milestone 比快取資料多（代表有新 milestone），
    // 而且多的 milestone 達成的時間比使用者的 lastLogin 還晚的時候，才要提示。
    if (pMs.length > cachedPMs.length && lastLogin) {
      const lastLoginTime = new Date(lastLogin).getTime();
      if (!isNaN(lastLoginTime)) {
        const cachedIds = new Set(cachedPMs.map(m => String((m && (m.id || m.achievementId || m.chapterId || m.taskId)) || '')));
        const addedMilestones = pMs.filter(m => {
          const id = String((m && (m.id || m.achievementId || m.chapterId || m.taskId)) || '');
          return id && !cachedIds.has(id);
        });
        newPlayerMs = addedMilestones.filter(m => {
          if (!m || !m.completedAt) return false;
          const compTime = new Date(m.completedAt).getTime();
          return !isNaN(compTime) && compTime > lastLoginTime;
        });
      }
    }

    // 小組篇章里程碑同樣遵循嚴格增量與時間判定
    if (gMs.length > cachedGMs.length && lastLogin) {
      const lastLoginTime = new Date(lastLogin).getTime();
      if (!isNaN(lastLoginTime)) {
        const cachedGIds = new Set(cachedGMs.map(m => String((m && (m.id || m.chapterId)) || '')));
        const addedGMilestones = gMs.filter(m => {
          const id = String((m && (m.id || m.chapterId)) || '');
          return id && !cachedGIds.has(id);
        });
        newGroupMs = addedGMilestones.filter(m => {
          if (!m || !m.completedAt) return false;
          const compTime = new Date(m.completedAt).getTime();
          return !isNaN(compTime) && compTime > lastLoginTime;
        });
      }
    }

    if (newPlayerMs.length > 0 || newGroupMs.length > 0) {
      showMilestonesCelebration(newPlayerMs, newGroupMs, configs);
    }

    // 判定完成後，寫入 localStorage 供下次比對
    const nowIso = new Date().toISOString();
    if (typeof localStorage !== 'undefined') {
      try {
        if (pId) {
          localStorage.setItem(`vital_player_milestones_${pId}`, JSON.stringify(pMs));
          localStorage.setItem(`vital_last_login_${pId}`, nowIso);
        }
        if (gId) {
          localStorage.setItem(`vital_group_milestones_${gId}`, JSON.stringify(gMs));
        }
        localStorage.setItem('vital_player_milestones', JSON.stringify(pMs));
        localStorage.setItem('vital_group_milestones', JSON.stringify(gMs));
        localStorage.setItem('vital_last_login', nowIso);
      } catch (e) {}
    }

    return { newPlayerMs, newGroupMs };
  }

  function showMilestonesCelebration(newPlayerMs, newGroupMs, configs = {}) {
    if (typeof document === 'undefined') return;
    if (apiClient && !apiClient.getSessionToken()) return;
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
      const id = String((m && (m.id || m.achievementId || m.chapterId || m.taskId)) || '');
      if (id.startsWith('CHEST_') || /^T\d+$/i.test(id)) {
        chests.push(m);
      } else if (id.startsWith('CHAPTER_') || id.startsWith('CHP_') || /^CH\d+$/i.test(id)) {
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
        chestListEl.innerHTML = `<strong>🎁 獲得新成就：</strong><ul style="margin: 4px 0 0 18px; padding: 0;">` +
          chests.map(c => `<li>${escapeHtml(resolveMilestoneName(c, 'chest', configs))}${formatReward(c.reward)}</li>`).join('') +
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
          chapters.map(c => `<li>${escapeHtml(resolveMilestoneName(c, 'chapter', configs))}${formatReward(c.reward)}</li>`).join('') +
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
          tasks.map(t => `<li>${escapeHtml(resolveMilestoneName(t, 'task', configs))}${formatReward(t.reward)}</li>`).join('') +
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
    let pMs = [];
    if (currentUserProfile && currentUserProfile.playerId) {
      try {
        pMs = JSON.parse(localStorage.getItem(`vital_player_milestones_${currentUserProfile.playerId}`) || '[]');
      } catch (e) {}
    }
    let achCfg = null;
    try {
      achCfg = JSON.parse(localStorage.getItem('vital_achievements_config') || 'null');
    } catch (e) {}
    if (chestView && typeof chestView.openChestModal === 'function') {
      chestView.openChestModal(points, selectedIdx, pMs, achCfg);
    }
  }

  function checkSpecialTasksPrompt(tasksConfig, playerId) {
    if (!playerId || typeof window === 'undefined' || typeof document === 'undefined') return;

    const todayStr = (dashboardView && typeof dashboardView.getTodayDateString === 'function')
      ? dashboardView.getTodayDateString()
      : new Date().toISOString().slice(0, 10);

    // 1. 檢查今日是否已開啟過並勾選「今日不再顯示」
    try {
      const dismissedDate = localStorage.getItem(`vital_tasks_prompt_date_${playerId}`);
      if (dismissedDate === todayStr) {
        return; // 今日已記錄不再顯示
      }
    } catch (e) {}

    // 2. 取得任務清單（優先傳入 > 快取）
    let tasks = tasksConfig;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      try {
        const stored = localStorage.getItem('vital_tasks_config');
        if (stored) tasks = JSON.parse(stored);
      } catch (e) {}
    }
    if (!Array.isArray(tasks)) tasks = [];

    const normalizeDate = (d) => {
      if (!d) return '';
      const str = String(d).trim().replace(/\//g, '-');
      if (str.length >= 10) return str.slice(0, 10);
      const parts = str.split('-');
      if (parts.length === 3) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      return str;
    };

    // 3. 過濾正在開放中的特殊任務
    const activeTasks = tasks.filter(t => {
      if (!t || t.status !== 'ACTIVE') return false;
      const start = normalizeDate(t.startDate);
      const end = normalizeDate(t.endDate);
      if (start && todayStr < start) return false;
      if (end && todayStr > end) return false;
      return true;
    }).sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    if (activeTasks.length === 0) {
      return; // 目前無開放中的特殊任務，不跳出提示
    }

    // 4. 若新成就慶祝視窗正在開啟，等待慶祝視窗關閉後再跳出任務提示
    const celebrationModal = document.getElementById('milestoneCelebrationModal');
    if (celebrationModal && !celebrationModal.classList.contains('hidden')) {
      const closeCelebrationBtn = document.getElementById('closeCelebrationBtn');
      if (closeCelebrationBtn && !closeCelebrationBtn._hasPromptHook) {
        closeCelebrationBtn._hasPromptHook = true;
        const origClick = closeCelebrationBtn.onclick;
        closeCelebrationBtn.onclick = (e) => {
          closeCelebrationBtn._hasPromptHook = false;
          if (typeof origClick === 'function') origClick.call(closeCelebrationBtn, e);
          setTimeout(() => showSpecialTasksModal(activeTasks, playerId, todayStr), 400);
        };
        return;
      }
    }

    showSpecialTasksModal(activeTasks, playerId, todayStr);
  }

  function showSpecialTasksModal(activeTasks, playerId, todayStr) {
    if (typeof document === 'undefined') return;
    if (apiClient && !apiClient.getSessionToken()) return;
    const modal = document.getElementById('taskPromptModal');
    if (!modal) return;

    const listContainer = document.getElementById('taskPromptList');
    const checkbox = document.getElementById('taskPromptDismissTodayCheckbox');
    if (checkbox) checkbox.checked = false; // 每次開啟預設不勾選

    const escape = (str) => {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };

    const isValidUrl = (url) => {
      if (!url) return false;
      const trimmed = String(url).trim();
      return /^https?:\/\//i.test(trimmed) || (trimmed.startsWith('/') && !trimmed.startsWith('//'));
    };

    const normalizeDate = (d) => {
      if (!d) return '';
      const str = String(d).trim().replace(/\//g, '-');
      if (str.length >= 10) return str.slice(0, 10);
      const parts = str.split('-');
      if (parts.length === 3) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      return str;
    };

    const resolvePic = (picKey) => {
      if (!picKey) return '../Chest_Assets/Chest_01.webp';
      const p = String(picKey).trim();
      if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:') || p.startsWith('../')) return p;
      if (p.startsWith('Chest_') || p.startsWith('Chapter_')) {
        const matched = p.replace(/^Chapter_/, 'Chest_');
        return `../Chest_Assets/${matched}`;
      }
      if (p.startsWith('Cute_Icon_')) return `../Cute_Icons/${p}`;
      return `../Chest_Assets/${p}`;
    };

    if (listContainer) {
      listContainer.innerHTML = activeTasks.map(t => {
        const picUrl = escape(resolvePic(t.pictureKey));
        const name = escape(t.name || t.title || '特殊任務');
        const desc = escape(t.description || t.desc || '');
        const reward = t.rewardDesc ? `<div class="task-prompt-reward">🎁 獎勵：${escape(t.rewardDesc)}</div>` : '';
        
        let dateRange = '';
        if (t.startDate || t.endDate) {
          let remainingText = '';
          const endNorm = normalizeDate(t.endDate);
          if (endNorm) {
            const todayTime = new Date(`${todayStr}T00:00:00`).getTime();
            const endTime = new Date(`${endNorm}T23:59:59`).getTime();
            const diffDays = Math.ceil((endTime - todayTime) / 86400000);
            if (diffDays >= 0) {
              remainingText = diffDays === 0 ? '（最後今天）' : `（剩餘 ${diffDays} 天）`;
            }
          }
          dateRange = `<div class="task-prompt-date">📅 期間：${escape(t.startDate || '即日起')} ~ ${escape(t.endDate || '截止日止')}${remainingText}</div>`;
        }

        const actionBtn = isValidUrl(t.actionUrl)
          ? `<a href="${escape(t.actionUrl)}" target="_blank" rel="noopener noreferrer" class="task-prompt-action-btn">立即前往 ›</a>`
          : '';

        return `
          <div class="task-prompt-item">
            <img src="${picUrl}" alt="${name}" class="task-prompt-thumb" loading="lazy" onerror="this.onerror=null; this.src='../Chest_Assets/Chest_01.png';">
            <div class="task-prompt-details">
              <h4 class="task-prompt-name">${name}</h4>
              <p class="task-prompt-desc">${desc}</p>
              ${reward}
              ${dateRange}
              ${actionBtn}
            </div>
          </div>
        `;
      }).join('');
    }

    const handleDismiss = () => {
      if (checkbox && checkbox.checked) {
        // 使用者勾選「今日不再顯示」：在本地儲存當天的日期
        try {
          localStorage.setItem(`vital_tasks_prompt_date_${playerId}`, todayStr);
        } catch (e) {}
      } else {
        // 未勾選：不儲存，下次登入繼續提示
        try {
          localStorage.removeItem(`vital_tasks_prompt_date_${playerId}`);
        } catch (e) {}
      }
      modal.classList.add('hidden');
    };

    const closeBtn = document.getElementById('taskPromptCloseBtn');
    if (closeBtn) closeBtn.onclick = handleDismiss;

    modal.querySelectorAll('[data-close-modal="taskPromptModal"]').forEach(btn => {
      btn.onclick = handleDismiss;
    });

    modal.classList.remove('hidden');
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
    loadUserData(false);
  }

  function handleAvatarUpdated(newUrl, newName) {
    if (currentUserProfile) {
      if (newUrl) currentUserProfile.avatarUrl = newUrl;
      if (newName) currentUserProfile.name = newName;
      try {
        localStorage.setItem('vital_current_player', JSON.stringify(currentUserProfile));
      } catch (e) {}
      dashboardView.render(currentUserProfile, currentJourneyData);
      profileView.render(currentUserProfile);
    }
  }

  function handleLogout() {
    apiClient.clearSessionToken();
    const pid = currentUserProfile?.playerId;
    const gid = currentUserProfile?.groupId;
    
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('vital_current_player');
        if (pid) {
          localStorage.removeItem(`vital_player_milestones_${pid}`);
          localStorage.removeItem(`vital_daily_records_${pid}`);
          localStorage.removeItem(`vital_meeting_records_${pid}`);
          localStorage.removeItem(`vital_footprints_cache_${pid}`);
        }
        localStorage.removeItem('vital_footprints_cache_guest');
        if (gid) {
          localStorage.removeItem(`vital_group_progress_${gid}`);
          localStorage.removeItem(`vital_group_milestones_${gid}`);
          localStorage.removeItem(`vital_group_profile_${gid}`);
        }
      } catch (e) {}
    }
    
    currentUserProfile = null;
    currentJourneyData = null;
    
    if (typeof document !== 'undefined') {
      document.querySelectorAll('.modal-layer').forEach(m => m.classList.add('hidden'));
    }
    
    authView.showAuth();
  }

  async function updateUserGroupState(groupId, groupName = '', isLeader = false, memberCount = null) {
    if (!currentUserProfile) return;
    const pId = currentUserProfile.playerId;
    currentUserProfile.groupId = groupId || '';
    if (groupId) {
      currentUserProfile.groupName = groupName;
      currentUserProfile.isLeader = Boolean(isLeader);
      if (typeof memberCount === 'number') {
        currentUserProfile.memberCount = memberCount;
      }
    } else {
      delete currentUserProfile.groupName;
      delete currentUserProfile.isLeader;
      delete currentUserProfile.postsColIndex;
      currentUserProfile.memberCount = 0;
      currentJourneyData = null;
    }
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('vital_current_player', JSON.stringify(currentUserProfile));
      } catch (e) {}
    }

    if (groupId) {
      try {
        const gpRes = await apiClient.getGroupProgress(groupId);
        if (gpRes && (gpRes.success || gpRes.data)) {
          const data = gpRes.data || gpRes;
          let groupMilestones = data?.milestones || [];
          if (typeof groupMilestones === 'string') {
            try { groupMilestones = JSON.parse(groupMilestones); } catch (e) { groupMilestones = []; }
          }
          currentJourneyData = deriveJourneyFromGroupProgress(data, currentUserProfile);
          try {
            localStorage.setItem(`vital_group_progress_${groupId}`, JSON.stringify(data));
            localStorage.setItem(`vital_group_milestones_${groupId}`, JSON.stringify(groupMilestones));
          } catch (e) {}
          // 注意：調組/建組僅更新小組進度快取，不觸發里程碑提示（必須由後端 loadUserData 之 playerProgress 為準）
        }
      } catch (jErr) {
        console.warn('[App] 創組/加入小組後讀取小組進度失敗', jErr);
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
    resolveMilestoneName,
    showMilestonesCelebration,
    checkSpecialTasksPrompt,
    showSpecialTasksModal,
    get currentUserProfile() { return currentUserProfile; },
    get currentJourneyData() { return currentJourneyData; },
    get apiClient() { return apiClient; },
    get practiceStore() { return practiceStore; },
    get chatStore() { return chatStore; },
    get authView() { return authView; },
    get dashboardView() { return dashboardView; },
    get chestView() { return chestView; },
    get footprintsView() { return footprintsView; },
    get profileView() { return profileView; },
    get fellowshipView() { return fellowshipView; }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      deriveJourneyFromGroupProgress,
      initApp,
      checkMilestone,
      resolveMilestoneName,
      showMilestonesCelebration,
      checkSpecialTasksPrompt,
      showSpecialTasksModal,
      AppCoordinator: global.AppCoordinator
    };
  }

})(typeof window !== 'undefined' ? window : global);
