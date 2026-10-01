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

    let totalScore = Number(groupProgress.totalPoints || groupProgress.totalScore || 0);
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

    return {
      ...groupProgress,
      memberCount: typeof mCount === 'number' ? mCount : undefined,
      currentChapter: chapterIndex,
      chapterTitle: chapterTitle,
      chapterName: chapterTitle,
      currentLevel: chapterIndex,
      totalPoints: totalScore || (fallbackProfile && (fallbackProfile.totalPoints || fallbackProfile.totalScore)) || 0,
      totalScore: totalScore || (fallbackProfile && (fallbackProfile.totalPoints || fallbackProfile.totalScore)) || 0,
      progressPercent: Math.min(100, Math.round((chapterIndex / 8) * 100)),
      milestones: milestones
    };
  }

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
      onGroupJourneyListClick: () => dashboardView.openGroupJourneyListModal(),
      onContributionClick: () => profileView && profileView.openContributionModal()
    });
    global.dashboardView = dashboardView;

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

  async function loadUserData(skipProfile = false) {
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
            
            // 立即使用快取資料渲染 UI
            dashboardView.render(currentUserProfile, currentJourneyData, cachedAnnouncements);
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

      const reqs = [];
      reqs.push(skipProfile ? Promise.resolve({ success: true, player: currentUserProfile }) : apiClient.getBootstrap());
      if (pId) {
        reqs.push(apiClient.getProgressBundle(gId));
      } else {
        reqs.push(Promise.resolve(null));
      }
      if (gId) {
        reqs.push(apiClient.getGroupProfile(gId));
      } else {
        reqs.push(Promise.resolve(null));
      }

      const [bootstrapRes, bundleRes, profileRes] = await Promise.allSettled(reqs);

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
        } else if (!skipProfile) {
          console.warn('[App] 取得遠端使用者檔案失敗', bootstrapRes.value);
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

      const currentPId = currentUserProfile?.playerId;
      const currentGId = currentUserProfile?.groupId;

      // 3. 處理 Progress Bundle 回應
      let playerMilestones = [];
      let groupMilestones = [];
      let groupProgress = null;

      if (bundleRes.status === 'fulfilled' && bundleRes.value && bundleRes.value.success) {
        const data = bundleRes.value.data || bundleRes.value;
        
        if (data.playerProgress) {
          playerMilestones = data.playerProgress.milestones || [];
          if (typeof playerMilestones === 'string') {
            try { playerMilestones = JSON.parse(playerMilestones); } catch(e) { playerMilestones = []; }
          }
          if (currentPId && typeof localStorage !== 'undefined') {
            try { localStorage.setItem(`vital_player_milestones_${currentPId}`, JSON.stringify(playerMilestones)); } catch(e) {}
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
          if (currentGId && typeof localStorage !== 'undefined') {
            try {
              localStorage.setItem(`vital_group_progress_${currentGId}`, JSON.stringify(groupProgress));
              localStorage.setItem(`vital_group_milestones_${currentGId}`, JSON.stringify(groupMilestones));
            } catch(e) {}
          }
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

      // 4. checkMilestone
      checkMilestone(playerMilestones, groupMilestones, currentPId, currentGId);

      if (announcements.length === 0 && typeof localStorage !== 'undefined') {
        try { announcements = JSON.parse(localStorage.getItem('vital_announcements') || '[]'); } catch(e) { announcements = []; }
      }

      // 5. 差量更新視圖
      dashboardView.render(currentUserProfile, currentJourneyData, announcements);
      profileView.render(currentUserProfile, currentJourneyData);



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

    } catch (err) {
      console.error('[App] 載入使用者資料發生異常', err);
    } finally {
      if (dashboardView && typeof dashboardView.setSyncLock === 'function') {
        dashboardView.setSyncLock(false);
      }
    }
  }

  function checkMilestone(playerMilestones, groupMilestones, pId = null, gId = null) {
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
      if (pId) localStorage.setItem(`vital_player_milestones_${pId}`, JSON.stringify(pMs));
      if (gId) localStorage.setItem(`vital_group_milestones_${gId}`, JSON.stringify(gMs));
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
    let pMs = [];
    if (currentUserProfile && currentUserProfile.playerId) {
      try {
        pMs = JSON.parse(localStorage.getItem(`vital_player_milestones_${currentUserProfile.playerId}`) || '[]');
      } catch (e) {}
    }
    chestView.openChestModal(points, selectedIdx, pMs);
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

  function handleAvatarUpdated(newUrl) {
    if (currentUserProfile) {
      currentUserProfile.avatarUrl = newUrl;
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
        }
        if (gid) {
          localStorage.removeItem(`vital_group_progress_${gid}`);
          localStorage.removeItem(`vital_group_milestones_${gid}`);
          localStorage.removeItem(`vital_group_profile_${gid}`);
        }
      } catch (e) {}
    }
    
    currentUserProfile = null;
    currentJourneyData = null;
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
          let playerMilestones = [];
          try {
            playerMilestones = JSON.parse(localStorage.getItem(`vital_player_milestones_${pId}`) || '[]');
          } catch (e) {}
          checkMilestone(playerMilestones, groupMilestones, pId, groupId);
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
    showMilestonesCelebration
  };

})(typeof window !== 'undefined' ? window : global);
