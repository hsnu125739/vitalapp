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

  const DEFAULT_CHAPTER_CONFIG = [
    { chapterId: 'CHP_01', order: 1, status: 'ACTIVE', targetPoint: 0, name: '信心篇' },
    { chapterId: 'CHP_02', order: 2, status: 'ACTIVE', targetPoint: 2000, name: '美德篇' },
    { chapterId: 'CHP_03', order: 3, status: 'ACTIVE', targetPoint: 5500, name: '知識篇' },
    { chapterId: 'CHP_04', order: 4, status: 'ACTIVE', targetPoint: 10000, name: '節制篇' },
    { chapterId: 'CHP_05', order: 5, status: 'ACTIVE', targetPoint: 16000, name: '忍耐篇' },
    { chapterId: 'CHP_06', order: 6, status: 'ACTIVE', targetPoint: 24000, name: '敬虔篇' },
    { chapterId: 'CHP_07', order: 7, status: 'ACTIVE', targetPoint: 35000, name: '弟兄相愛篇' },
    { chapterId: 'CHP_08', order: 8, status: 'ACTIVE', targetPoint: 50000, name: '愛篇' }
  ];

  function resolveAvatarUrl(gender, avatarKey) {
    const isFemale = gender === 'SISTER' || gender === 'female';
    const folder = isFemale ? 'avatar-female' : 'avatar-male';
    const prefix = isFemale ? 'avatar-female-direct' : 'avatar-male-direct';
    const match = String(avatarKey || '').match(/\d+/);
    const no = match ? String(match[0]).padStart(3, '0') : '001';
    return `../${folder}/${prefix}-${no}.png`;
  }

  function deriveJourneyFromGroupProgress(groupProgress, fallbackProfile = null, chaptersConfig = null) {
    if (!groupProgress) return null;
    let milestones = groupProgress.milestones || [];
    if (typeof milestones === 'string') {
      try { milestones = JSON.parse(milestones); } catch (e) { milestones = []; }
    }
    if (!Array.isArray(milestones)) milestones = [];

    // 1. 取得 ChapterConfig（優先使用傳入設定，次為本地持久化快取，最後採用標準保底設定）
    let chapters = chaptersConfig;
    if (!Array.isArray(chapters) || chapters.length === 0) {
      if (typeof localStorage !== 'undefined') {
        try {
          const stored = localStorage.getItem('vital_chapters_config');
          if (stored) chapters = JSON.parse(stored);
        } catch (e) {}
      }
    }
    if (!Array.isArray(chapters) || chapters.length === 0) {
      chapters = DEFAULT_CHAPTER_CONFIG;
    }

    // 嚴格依 order 升冪排序（數值越小越靠前）
    const activeChapters = (Array.isArray(chapters) ? chapters : [])
      .filter(c => c && c.status === 'ACTIVE' && (c.chapterId || c.id))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    // 2. 收集已達成之里程碑 ID（純字串精確比對，嚴格禁止以 ID 值進行數值或正規解析）
    const achievedIds = new Set();
    const registerId = (m) => {
      if (!m) return;
      if (typeof m === 'string') {
        const s = m.trim().toUpperCase();
        if (s) achievedIds.add(s);
      } else if (typeof m === 'object') {
        const id = String(m.id || m.chapterId || m.taskId || m.achievementId || '').trim().toUpperCase();
        if (id) achievedIds.add(id);
      }
    };
    milestones.forEach(registerId);
    if (Array.isArray(groupProgress.chapterHistory)) {
      groupProgress.chapterHistory.forEach(registerId);
    }

    // 3. 依據 ChapterConfig 定義之 order 與 chapterId 判定各篇章是否已達成
    const isChapterPassed = (ch) => {
      const cid = String(ch.chapterId || ch.id || '').trim().toUpperCase();
      return cid ? achievedIds.has(cid) : false;
    };

    // 4. 尋找當前正在挑戰的目標篇章（第一個尚未達成之篇章；若全數達成則為最後一個篇章）
    const completedChapters = activeChapters.filter(isChapterPassed);
    let targetChapter = activeChapters.find(ch => !isChapterPassed(ch));
    const allPassed = !targetChapter;
    if (!targetChapter) {
      targetChapter = activeChapters[activeChapters.length - 1] || DEFAULT_CHAPTER_CONFIG[0];
    }

    const chapterIndex = Number(targetChapter.order) || 1;
    const chapterTitle = targetChapter.name || targetChapter.title || (CHAPTER_NAMES[chapterIndex - 1] ? (CHAPTER_NAMES[chapterIndex - 1] + '篇') : '起步啟航');
    const totalChaptersCount = activeChapters.length || 8;
    const progressPercent = allPassed ? 100 : Math.min(100, Math.round((completedChapters.length / totalChaptersCount) * 100));

    let totalScore = Number(
      groupProgress.groupTotalPoints !== undefined ? groupProgress.groupTotalPoints : (groupProgress.journeyPoints || 0)
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

    const finalPoints = totalScore || (fallbackProfile && (fallbackProfile.groupTotalPoints || fallbackProfile.journeyPoints)) || 0;

    return {
      ...groupProgress,
      memberCount: typeof mCount === 'number' ? mCount : undefined,
      currentChapter: chapterTitle,
      chapterTitle: chapterTitle,
      chapterName: chapterTitle,
      chapterIndex: chapterIndex,
      currentChapterIndex: chapterIndex,
      currentLevel: chapterIndex,
      totalPoints: finalPoints,
      totalScore: finalPoints,
      groupTotalPoints: finalPoints,
      progressPercent: progressPercent,
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
        onLoginSuccess: (profile, group) => handleLoginSuccess(profile, group)
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
      await loadUserData(true);
    }
  }

  async function loadUserData(isColdStart = true) {
    try {
      // 0. 本地水合 (0ms rendering，僅限冷啟動首屏秒開；在線刷新時絕不拿舊快取覆蓋記憶體最新狀態)
      if (isColdStart) {
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

            let cachedChapters = null;
            try {
              const chStr = localStorage.getItem('vital_chapters_config');
              if (chStr) cachedChapters = JSON.parse(chStr);
            } catch (e) {}

            let cachedGroupProgress = null;
            if (gId) {
              const cgStr = localStorage.getItem(`vital_group_progress_${gId}`);
              if (cgStr) cachedGroupProgress = JSON.parse(cgStr);
              currentJourneyData = deriveJourneyFromGroupProgress(cachedGroupProgress, currentUserProfile, cachedChapters);
            }
            
            let cachedAnnouncements = [];
            const caStr = localStorage.getItem('vital_announcements');
            if (caStr) cachedAnnouncements = JSON.parse(caStr);

            // 嘗試從本地操練快取水合 practiceStore，確保 0ms 首屏即可精確算出今日未結算點數
            if (practiceStore) {
              const today = (dashboardView && dashboardView.currentDate) || (dashboardView && dashboardView.getTodayDateString && dashboardView.getTodayDateString());
              const curWeek = (dashboardView && dashboardView.currentWeekKey) || (dashboardView && dashboardView.getCurrentWeekKey && dashboardView.getCurrentWeekKey());
              if (today) {
                try {
                  const cachedDaily = JSON.parse(localStorage.getItem(`vital_daily_records_${cachedPlayer.playerId}`) || 'null');
                  if (cachedDaily) {
                    if (cachedDaily[today]) {
                      const rec = cachedDaily[today];
                      practiceStore.dailyState[today] = {
                        morning: Boolean(rec.morning || rec.morningRevival),
                        morningRevival: Boolean(rec.morning || rec.morningRevival),
                        bible: Boolean(rec.bible || rec.bibleReading),
                        bibleReading: Boolean(rec.bible || rec.bibleReading),
                        prayer: Boolean(rec.prayer),
                        book: Boolean(rec.book || rec.bookPursuit),
                        bookPursuit: Boolean(rec.book || rec.bookPursuit),
                        syncStatus: 'synced',
                        hasAmberDot: false
                      };
                      if (dashboardView) dashboardView.renderDailyPracticeState(practiceStore.dailyState[today]);
                    }
                    const yDate = (dashboardView && typeof dashboardView.getYesterdayDateString === 'function')
                      ? dashboardView.getYesterdayDateString(today)
                      : '';
                    if (yDate && cachedDaily[yDate]) {
                      const yRec = cachedDaily[yDate];
                      practiceStore.dailyState[yDate] = {
                        morning: Boolean(yRec.morning || yRec.morningRevival),
                        morningRevival: Boolean(yRec.morning || yRec.morningRevival),
                        bible: Boolean(yRec.bible || yRec.bibleReading),
                        bibleReading: Boolean(yRec.bible || yRec.bibleReading),
                        prayer: Boolean(yRec.prayer),
                        book: Boolean(yRec.book || yRec.bookPursuit),
                        bookPursuit: Boolean(yRec.book || yRec.bookPursuit),
                        syncStatus: 'synced',
                        hasAmberDot: false
                      };
                    }
                  }
                } catch (e) {}
              }
              if (curWeek) {
                try {
                  const cachedMtg = JSON.parse(localStorage.getItem(`vital_meeting_records_${cachedPlayer.playerId}`) || 'null');
                  if (cachedMtg && cachedMtg[curWeek]) {
                    const mRec = cachedMtg[curWeek];
                    practiceStore.meetingState[curWeek] = {
                      smallGroup: Boolean(mRec.group || mRec.smallGroup),
                      prayerMeeting: Boolean(mRec.prayerMtg || mRec.prayerMeeting),
                      lordDayMeeting: Boolean(mRec.lordDay || mRec.lordDayMeeting),
                      outreachVisit: Boolean(mRec.outreach || mRec.outreachVisit || mRec.blend || mRec.mutual),
                      syncStatus: 'synced',
                      hasAmberDot: false
                    };
                    if (dashboardView) dashboardView.renderMeetingPracticeState(practiceStore.meetingState[curWeek]);
                  }
                } catch (e) {}
              }
            }
            
            // 立即使用快取資料渲染 UI
            dashboardView.render(currentUserProfile, currentJourneyData, cachedAnnouncements, cachedChapters);
            profileView.render(currentUserProfile, currentJourneyData);
          }
        }
      } catch (e) {}
      }

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
          const today = dashboardView.currentDate || pRes.data.todayStr || (dashboardView.getTodayDateString && dashboardView.getTodayDateString());
          const yesterday = pRes.data.yesterdayStr || (dashboardView.getYesterdayDateString && dashboardView.getYesterdayDateString(today));
          const curWeek = dashboardView.currentWeekKey || pRes.data.weekKey || (dashboardView.getCurrentWeekKey && dashboardView.getCurrentWeekKey());
          const lastWeek = pRes.data.lastWeekKey || '';
          const dRec = pRes.data.daily || {};
          const yRec = pRes.data.yesterdayDaily || null;
          const mRec = pRes.data.meeting || {};
          const lastMRec = pRes.data.lastWeekMeeting || null;
          
          const pendingD = (practiceStore.pendingDaily && practiceStore.pendingDaily.get(today)) || null;
          practiceStore.dailyState[today] = {
            morning: pendingD ? pendingD.morning : Boolean(dRec.morning || dRec.morningRevival),
            morningRevival: pendingD ? pendingD.morningRevival : Boolean(dRec.morning || dRec.morningRevival),
            bible: pendingD ? pendingD.bible : Boolean(dRec.bible || dRec.bibleReading),
            bibleReading: pendingD ? pendingD.bibleReading : Boolean(dRec.bible || dRec.bibleReading),
            prayer: pendingD ? pendingD.prayer : Boolean(dRec.prayer),
            book: pendingD ? pendingD.book : Boolean(dRec.book || dRec.bookPursuit),
            bookPursuit: pendingD ? pendingD.bookPursuit : Boolean(dRec.book || dRec.bookPursuit),
            syncStatus: pendingD ? 'pending' : 'synced',
            hasAmberDot: false
          };

          if (yesterday && yRec) {
            const pendingY = (practiceStore.pendingDaily && practiceStore.pendingDaily.get(yesterday)) || null;
            practiceStore.dailyState[yesterday] = {
              morning: pendingY ? pendingY.morning : Boolean(yRec.morning || yRec.morningRevival),
              morningRevival: pendingY ? pendingY.morningRevival : Boolean(yRec.morning || yRec.morningRevival),
              bible: pendingY ? pendingY.bible : Boolean(yRec.bible || yRec.bibleReading),
              bibleReading: pendingY ? pendingY.bibleReading : Boolean(yRec.bible || yRec.bibleReading),
              prayer: pendingY ? pendingY.prayer : Boolean(yRec.prayer),
              book: pendingY ? pendingY.book : Boolean(yRec.book || yRec.bookPursuit),
              bookPursuit: pendingY ? pendingY.bookPursuit : Boolean(yRec.book || yRec.bookPursuit),
              syncStatus: pendingY ? 'pending' : 'synced',
              hasAmberDot: false
            };
          }

          const pendingM = (practiceStore.pendingMeeting && practiceStore.pendingMeeting.get(curWeek)) || null;
          practiceStore.meetingState[curWeek] = {
            smallGroup: pendingM ? pendingM.smallGroup : Boolean(mRec.group || mRec.smallGroup),
            prayerMeeting: pendingM ? pendingM.prayerMeeting : Boolean(mRec.prayerMtg || mRec.prayerMeeting),
            lordDayMeeting: pendingM ? pendingM.lordDayMeeting : Boolean(mRec.lordDay || mRec.lordDayMeeting),
            outreachVisit: pendingM ? pendingM.outreachVisit : Boolean(mRec.outreach || mRec.outreachVisit || mRec.blend || mRec.mutual),
            syncStatus: pendingM ? 'pending' : 'synced',
            hasAmberDot: false
          };

          if (lastWeek && lastMRec) {
            practiceStore.meetingState[lastWeek] = {
              smallGroup: Boolean(lastMRec.group || lastMRec.smallGroup),
              prayerMeeting: Boolean(lastMRec.prayerMtg || lastMRec.prayerMeeting),
              lordDayMeeting: Boolean(lastMRec.lordDay || lastMRec.lordDayMeeting),
              outreachVisit: Boolean(lastMRec.outreach || lastMRec.outreachVisit || lastMRec.blend || lastMRec.mutual),
              syncStatus: 'synced',
              hasAmberDot: false
            };
          }

          if (pId && typeof localStorage !== 'undefined') {
            try {
              let dailyToSave = {};
              const existingDailyStr = localStorage.getItem(`vital_daily_records_${pId}`);
              if (existingDailyStr) {
                try { dailyToSave = JSON.parse(existingDailyStr) || {}; } catch(e) {}
              }
              dailyToSave[today] = practiceStore.dailyState[today];
              if (yesterday && practiceStore.dailyState[yesterday]) {
                dailyToSave[yesterday] = practiceStore.dailyState[yesterday];
              }
              localStorage.setItem(`vital_daily_records_${pId}`, JSON.stringify(dailyToSave));

              let meetingToSave = {};
              const existingMtgStr = localStorage.getItem(`vital_meeting_records_${pId}`);
              if (existingMtgStr) {
                try { meetingToSave = JSON.parse(existingMtgStr) || {}; } catch(e) {}
              }
              meetingToSave[curWeek] = practiceStore.meetingState[curWeek];
              if (lastWeek && practiceStore.meetingState[lastWeek]) {
                meetingToSave[lastWeek] = practiceStore.meetingState[lastWeek];
              }
              localStorage.setItem(`vital_meeting_records_${pId}`, JSON.stringify(meetingToSave));
            } catch (e) {}
          }
          if (dashboardView) {
            dashboardView.renderDailyPracticeState(practiceStore.dailyState[today]);
            dashboardView.renderMeetingPracticeState(practiceStore.meetingState[curWeek]);
            dashboardView.setSyncLock(false);
          }
        }
      }).catch(err => {
        console.warn('[App] getPractice 快速載入略過:', err);
      }).finally(() => {
        if (dashboardView && typeof dashboardView.setSyncLock === 'function') {
          dashboardView.setSyncLock(false);
        }
      });

      // 取得組員名單時，直接帶入登入時取得的 activeMembers，免除後端重查 Groups 表
      const activeMembersObj = currentUserProfile?.activeMembers || (() => {
        try {
          const cachedGp = JSON.parse(localStorage.getItem(`vital_group_profile_${gId}`) || 'null');
          return cachedGp ? (cachedGp.activeMembers || cachedGp.activeMembersJson) : null;
        } catch (e) { return null; }
      })();

      // 針對首頁右上角個人積分&貢獻值面板，設為 getProgressBundle 的專屬 callback
      const bundlePromise = pId ? apiClient.getProgressBundle(gId, activeMembersObj).then(bRes => {
        if (bRes && bRes.success) {
          const bData = bRes.data || bRes;
          if (bData.playerProgress && currentUserProfile) {
            if (bData.playerProgress.personalPoints !== undefined) {
              currentUserProfile.personalPoints = Number(bData.playerProgress.personalPoints || 0);
              currentUserProfile.basePersonalPoints = currentUserProfile.personalPoints;
            }
            if (bData.playerProgress.contributionPoints !== undefined) {
              currentUserProfile.contributionPoints = Number(bData.playerProgress.contributionPoints || 0);
              currentUserProfile.baseContributionPoints = currentUserProfile.contributionPoints;
            }
            if (bData.playerProgress.joinBasePoints !== undefined) {
              currentUserProfile.joinBasePoints = Number(bData.playerProgress.joinBasePoints || 0);
            }
            if (bData.playerProgress.currentYearPoints !== undefined) {
              currentUserProfile.currentYearPoints = Number(bData.playerProgress.currentYearPoints || 0);
            }
            let lastSettled = bData.playerProgress.lastSettledDate || '';
            const hSummary = bData.playerProgress.historySummary;
            if (!lastSettled && hSummary) {
              if (typeof hSummary === 'object' && hSummary._lastSettledDate) {
                lastSettled = hSummary._lastSettledDate;
              } else if (typeof hSummary === 'string') {
                try {
                  const parsed = JSON.parse(hSummary);
                  if (parsed._lastSettledDate) lastSettled = parsed._lastSettledDate;
                } catch (e) {}
              }
            }
            if (lastSettled) {
              currentUserProfile._lastSettledDate = String(lastSettled).trim();
            }
            try { localStorage.setItem('vital_current_player', JSON.stringify(currentUserProfile)); } catch(e) {}

            // ★ 專屬 Callback：Progress Bundle 一到達立刻獨立刷新右上角面板，無需等待其他請求
            if (dashboardView && typeof dashboardView.refreshScoresDisplay === 'function') {
              dashboardView.refreshScoresDisplay(currentUserProfile);
            }
          }
        }
        return bRes;
      }) : Promise.resolve(null);

      const [announcementsRes, bundleRes, profileRes] = await Promise.allSettled([
        apiClient.getAnnouncements(),
        bundlePromise,
        gId ? (typeof apiClient.getGroupMembers === 'function' ? apiClient.getGroupMembers(gId, activeMembersObj) : apiClient.getGroupProfile(gId)) : Promise.resolve(null)
      ]);

      let announcements = [];
      let isAnnouncementsFetched = false;
      let dailyRecords = null;
      let meetingRecords = null;
      
      // 2. 處理公告回應 (取代重複的 Bootstrap Profile 查詢)
      if (announcementsRes.status === 'fulfilled' && announcementsRes.value) {
        const res = announcementsRes.value;
        if (res && res.success) {
          isAnnouncementsFetched = true;
          announcements = res.announcements || res.data?.announcements || (Array.isArray(res.data) ? res.data : []);
          if (typeof localStorage !== 'undefined') {
            try {
              localStorage.setItem('vital_announcements', JSON.stringify(announcements));
            } catch (e) {}
          }
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
              currentUserProfile.basePersonalPoints = currentUserProfile.personalPoints;
            }
            if (data.playerProgress.contributionPoints !== undefined) {
              currentUserProfile.contributionPoints = Number(data.playerProgress.contributionPoints || 0);
              currentUserProfile.baseContributionPoints = currentUserProfile.contributionPoints;
            }
            if (data.playerProgress.joinBasePoints !== undefined) {
              currentUserProfile.joinBasePoints = Number(data.playerProgress.joinBasePoints || 0);
            }
            if (data.playerProgress.currentYearPoints !== undefined) {
              currentUserProfile.currentYearPoints = Number(data.playerProgress.currentYearPoints || 0);
            }
            // 擷取昨日結算日期時間戳記，供跨夜結算期間平滑補償判定使用
            let lastSettled = data.playerProgress.lastSettledDate || '';
            const hSummary = data.playerProgress.historySummary;
            if (!lastSettled && hSummary) {
              if (typeof hSummary === 'object' && hSummary._lastSettledDate) {
                lastSettled = hSummary._lastSettledDate;
              } else if (typeof hSummary === 'string') {
                try {
                  const parsed = JSON.parse(hSummary);
                  if (parsed._lastSettledDate) lastSettled = parsed._lastSettledDate;
                } catch (e) {}
              }
            }
            if (lastSettled) {
              currentUserProfile._lastSettledDate = String(lastSettled).trim();
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

        // 若仍未取得點數，嘗試從本地快取中救回既有點數
        if (currentGId && (!groupProgress || groupProgress.groupTotalPoints === undefined)) {
          try {
            const cachedGp = JSON.parse(localStorage.getItem(`vital_group_progress_${currentGId}`) || 'null');
            if (cachedGp) {
              const cp = Number(cachedGp.groupTotalPoints !== undefined ? cachedGp.groupTotalPoints : (cachedGp.journeyPoints || 0));
              if (cp > 0) {
                if (!groupProgress) groupProgress = cachedGp;
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

      if (currentGId && profileRes.status === 'fulfilled' && profileRes.value && profileRes.value.success) {
        const groupMembersData = profileRes.value.data || profileRes.value;
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem(`vital_group_members_${currentGId}`, JSON.stringify(groupMembersData));
          } catch(e) {}
        }
        if (groupMembersData && currentUserProfile) {
          const count = typeof groupMembersData.memberCount === 'number'
            ? groupMembersData.memberCount
            : (Array.isArray(groupMembersData.members) ? groupMembersData.members.length : undefined);
          if (count !== undefined) {
            currentUserProfile.memberCount = count;
          }
          if (groupMembersData.leaderPlayerId) {
            currentUserProfile.leaderPlayerId = groupMembersData.leaderPlayerId;
            currentUserProfile.isLeader = (groupMembersData.leaderPlayerId === currentUserProfile.playerId);
          }
        }
      }

      if (currentGId) {
        currentJourneyData = deriveJourneyFromGroupProgress(groupProgress, currentUserProfile, chaptersConfig);
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
      if (hasBackendPlayerProgress || (groupMilestones && groupMilestones.length > 0)) {
        checkMilestone(playerMilestones, groupMilestones, currentPId, currentGId, {
          chapters: chaptersConfig,
          achievements: achievementsConfig,
          tasks: tasksConfig
        });
      }

      // 僅在網路請求失敗或未成功獲取時，才從離線快取兜底
      if (!isAnnouncementsFetched && announcements.length === 0 && typeof localStorage !== 'undefined') {
        try { announcements = JSON.parse(localStorage.getItem('vital_announcements') || '[]'); } catch(e) { announcements = []; }
      }

      // 5. 處理打卡狀態防禦 (非空物件防禦，避免覆蓋已水合之 practiceStore)
      if (dailyRecords && Object.keys(dailyRecords).length > 0) {
        dashboardView.renderDailyPracticeState(dailyRecords);
      }
      if (meetingRecords && Object.keys(meetingRecords).length > 0) {
        dashboardView.renderMeetingPracticeState(meetingRecords);
      }

      // 6. 差量更新視圖 (此時 practiceStore 已具備最新打卡紀錄，未結算操練分數即時疊加)
      dashboardView.render(currentUserProfile, currentJourneyData, announcements, chaptersConfig);
      profileView.render(currentUserProfile, currentJourneyData);

      // 6.1 檢查特殊任務登入提示彈窗 (今日不再顯示記憶機制)
      checkSpecialTasksPrompt(tasksConfig, currentPId);

      // 7. 初始化小組交流
      if (currentGId) {
        fellowshipView.currentPlayerId = currentUserProfile.playerId;
        fellowshipView.currentUserName = currentUserProfile.name;
        const pCol = currentUserProfile.postsColIndex || currentJourneyData?.postsColIndex || null;
        fellowshipView.postsColIndex = pCol;
        fellowshipView.isLeader = Boolean(currentUserProfile.isLeader);
        chatStore.init(currentGId, pCol);
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

  const escapeHtml = (typeof VitalUtils !== 'undefined' && VitalUtils.escapeHtml)
    || ((str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));

  function resolveMilestoneName(m, type = '', configs = {}) {
    if (!m) return '';
    if (m.name && typeof m.name === 'string' && m.name.trim()) return m.name.trim();
    if (m.title && typeof m.title === 'string' && m.title.trim()) return m.title.trim();

    // REPEAT 里程碑 id 形如 `${基底ID}_YYYY-MM-DD`，查表一律以基底 ID 為準
    const id = String((m.id || m.achievementId || m.chapterId || m.taskId) || '').trim().replace(/_\d{4}-\d{2}-\d{2}$/, '');
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

    // 1. 若指定 type，優先對應之設定表查表
    if (type === 'chapter' && Array.isArray(chapters)) {
      const found = chapters.find(c => {
        if (!c) return false;
        const cid = String(c.chapterId || c.id || '').trim();
        const normCid = cid.replace(/^CHAPTER_/i, '');
        return cid === id || cid === normChapterId || normCid === normChapterId;
      });
      if (found && found.name) return found.name;
    }
    if (type === 'chest' && Array.isArray(achievements)) {
      const found = achievements.find(a => {
        if (!a) return false;
        const aid = String(a.achievementId || a.id || '').trim();
        const normAid = aid.replace(/^CHEST_/i, '');
        return aid === id || aid === normChestId || normAid === normChestId;
      });
      if (found && found.name) return found.name;
    }
    if (type === 'task' && Array.isArray(tasks)) {
      const found = tasks.find(t => {
        if (!t) return false;
        const tid = String(t.taskId || t.id || '').trim();
        const normTid = tid.replace(/^TASK_/i, '');
        return tid === id || tid === normTaskId || normTid === normTaskId;
      });
      if (found && found.name) return found.name;
    }

    // 2. 全面依設定表查表 (AchievementConfig -> ChapterConfig -> TasksConfig)
    if (Array.isArray(achievements)) {
      const found = achievements.find(a => {
        if (!a) return false;
        const aid = String(a.achievementId || a.id || '').trim();
        const normAid = aid.replace(/^CHEST_/i, '');
        return aid === id || aid === normChestId || normAid === normChestId;
      });
      if (found && found.name) return found.name;
    }
    if (Array.isArray(chapters)) {
      const found = chapters.find(c => {
        if (!c) return false;
        const cid = String(c.chapterId || c.id || '').trim();
        const normCid = cid.replace(/^CHAPTER_/i, '');
        return cid === id || cid === normChapterId || normCid === normChapterId;
      });
      if (found && found.name) return found.name;
    }
    if (Array.isArray(tasks)) {
      const found = tasks.find(t => {
        if (!t) return false;
        const tid = String(t.taskId || t.id || '').trim();
        const normTid = tid.replace(/^TASK_/i, '');
        return tid === id || tid === normTaskId || normTid === normTaskId;
      });
      if (found && found.name) return found.name;
    }

    // 3. 安全兜底預設名稱
    const legacyDefaults = {
      'T1': '初熟果子寶箱', 'CHEST_T1': '初熟果子寶箱',
      'T2': '盛花繁茂寶箱', 'CHEST_T2': '盛花繁茂寶箱',
      'T3': '碩果纍纍寶箱', 'CHEST_T3': '碩果纍纍寶箱',
      'T4': '深根泉湧寶箱', 'CHEST_T4': '深根泉湧寶箱',
      'T5': '純金精煉寶箱', 'CHEST_T5': '純金精煉寶箱',
      'T6': '明光照耀寶箱', 'CHEST_T6': '明光照耀寶箱',
      'T7': '磐石基石寶箱', 'CHEST_T7': '磐石基石寶箱',
      'T8': '榮耀冠冕寶箱', 'CHEST_T8': '榮耀冠冕寶箱',
      'CHP_01': '信心篇', 'CHP_02': '美德篇', 'CHP_03': '知識篇', 'CHP_04': '節制篇',
      'CHP_05': '忍耐篇', 'CHP_06': '敬虔篇', 'CHP_07': '弟兄相愛篇', 'CHP_08': '愛篇'
    };
    if (legacyDefaults[id]) return legacyDefaults[id];

    return id;
  }

  function checkMilestone(playerMilestones, groupMilestones, pId = null, gId = null, configs = {}) {
    // 直接讀取後端給的 currentUserProfile.lastLoginAt
    // 若沒有值，代表是剛註冊，直接結束 checkMilestone
    const profile = (typeof currentUserProfile !== 'undefined' && currentUserProfile) || (typeof global !== 'undefined' && global.currentUserProfile) || null;
    const lastLogin = profile && (profile.lastLoginAt || profile.lastLogin);
    if (!lastLogin) {
      return { newPlayerMs: [], newGroupMs: [] };
    }

    const lastLoginTime = new Date(lastLogin).getTime();
    if (isNaN(lastLoginTime)) {
      return { newPlayerMs: [], newGroupMs: [] };
    }

    let cachedPMs = [];
    let cachedGMs = [];

    if (typeof localStorage !== 'undefined') {
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

    // 條件：只有當 playerProgress 的 milestone 數量比快取多（有新 milestone），
    // 且達成時間晚於上次登入時間 lastLogin 時才提示。
    if (pMs.length > cachedPMs.length) {
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

    // 小組篇章里程碑同樣遵循嚴格增量與時間判定
    if (gMs.length > cachedGMs.length) {
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

    if (newPlayerMs.length > 0 || newGroupMs.length > 0) {
      showMilestonesCelebration(newPlayerMs, newGroupMs, configs);
    }

    // 判定完成後，僅寫入成就清單快取供下次比對，不操作任何 vital_last_login
    if (typeof localStorage !== 'undefined') {
      try {
        if (pId) {
          localStorage.setItem(`vital_player_milestones_${pId}`, JSON.stringify(pMs));
        }
        if (gId) {
          localStorage.setItem(`vital_group_milestones_${gId}`, JSON.stringify(gMs));
        }
        localStorage.setItem('vital_player_milestones', JSON.stringify(pMs));
        localStorage.setItem('vital_group_milestones', JSON.stringify(gMs));
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

    let achCfgForClassify = (configs && configs.achievements) || null;
    let chpCfgForClassify = (configs && configs.chapters) || null;
    if (typeof localStorage !== 'undefined') {
      try { if (!achCfgForClassify) achCfgForClassify = JSON.parse(localStorage.getItem('vital_achievements_config') || 'null'); } catch (e) {}
      try { if (!chpCfgForClassify) chpCfgForClassify = JSON.parse(localStorage.getItem('vital_chapters_config') || 'null'); } catch (e) {}
    }
    const achIdSet = new Set(Array.isArray(achCfgForClassify) && achCfgForClassify.length > 0
      ? achCfgForClassify.map(a => String((a && (a.achievementId || a.id)) || '').trim()).filter(Boolean)
      : ['CHEST_T1', 'CHEST_T2', 'CHEST_T3', 'CHEST_T4', 'CHEST_T5', 'CHEST_T6', 'CHEST_T7', 'CHEST_T8', 'REPEAT_DAILY_ALL', 'REPEAT_STREAK_7']);

    const chpIdSet = new Set(Array.isArray(chpCfgForClassify) && chpCfgForClassify.length > 0
      ? chpCfgForClassify.map(c => String((c && (c.chapterId || c.id)) || '').trim()).filter(Boolean)
      : ['CHP_01', 'CHP_02', 'CHP_03', 'CHP_04', 'CHP_05', 'CHP_06', 'CHP_07', 'CHP_08']);

    allNew.forEach(m => {
      // REPEAT 里程碑 id 形如 `${基底ID}_YYYY-MM-DD`，分類以基底 ID 為準
      const id = String((m && (m.id || m.achievementId || m.chapterId || m.taskId)) || '').replace(/_\d{4}-\d{2}-\d{2}$/, '').trim();
      if (!id) return;

      // 全面以 AchievementConfig 與 ChapterConfig 設定表為準
      if (achIdSet.has(id)) {
        chests.push(m);
      } else if (chpIdSet.has(id)) {
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
    const prof = (dashboardView && dashboardView.currentUserProfile) || currentUserProfile;
    const points = (prof && Number(prof.personalPoints || 0)) || 0;
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
      : (() => {
          const d = new Date();
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })();

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
    await loadUserData(false);
  }

  function handleLoginSuccess(profile, group = null) {
    currentUserProfile = profile;
    if (group && typeof group === 'object') {
      const gid = group.groupId || profile?.groupId;
      if (gid && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(`vital_group_profile_${gid}`, JSON.stringify(group));
        } catch (e) {}
      }
      if (currentUserProfile) {
        if (gid) currentUserProfile.groupId = gid;
        if (group.groupName) currentUserProfile.groupName = group.groupName;
        if (group.isLeader !== undefined) currentUserProfile.isLeader = group.isLeader;
        if (group.postsColIndex) currentUserProfile.postsColIndex = group.postsColIndex;
        if (group.memberCount !== undefined) currentUserProfile.memberCount = group.memberCount;
        currentUserProfile.activeMembers = group.activeMembers || null;
      }
    }
    if (currentUserProfile && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('vital_current_player', JSON.stringify(currentUserProfile));
      } catch (e) {}
    }
    if (profileView && typeof profileView.showHome === 'function') {
      profileView.showHome();
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
          localStorage.removeItem(`vital_group_members_${gid}`);
        }
      } catch (e) {}
    }
    
    currentUserProfile = null;
    currentJourneyData = null;
    
    if (typeof document !== 'undefined') {
      document.querySelectorAll('.modal-layer').forEach(m => m.classList.add('hidden'));
    }

    if (profileView && typeof profileView.showHome === 'function') {
      profileView.showHome();
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
          } catch (e) {}
          // 注意：調組/建組僅更新小組進度快取，不在此預先寫入 vital_group_milestones_${groupId}，
          // 必須保留由 checkMilestone 依據後端最新 progress 判定增量並彈出慶祝提示
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
