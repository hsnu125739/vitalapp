/**
 * dashboardView.js
 * 聖徒主儀表板視圖深層模組 (Dashboard View Deep Module)
 * 負責：頂部聖徒名冊與頭像、英雄篇章進度條與八大節點、10ms 零阻斷四項每日操練卡片、四項每週聚會卡片、首頁公告
 */

(function(global) {
  'use strict';

  const CHAPTER_KEYS = [
    'faith',
    'virtue',
    'knowledge',
    'selfControl',
    'endurance',
    'godliness',
    'brotherlyAffection',
    'love'
  ];

  const CHAPTER_NAMES = [
    '信心',
    '美德',
    '知識',
    '節制',
    '忍耐',
    '敬虔',
    '弟兄相愛',
    '愛'
  ];

  const DEFAULT_POINTS_CONFIG = Object.freeze({
    morning: 50,
    bible: 30,
    prayer: 30,
    book: 30,
    group: 30,
    prayerMtg: 50,
    lordDay: 50,
    outreach: 100
  });

  class DashboardView {
    constructor({ practiceStore, apiClient, onFootprintClick, onChestClick, onRefresh, onLogout, onGroupJourneyListClick, onContributionClick } = {}) {
      this.practiceStore = practiceStore;
      this.apiClient = apiClient;
      this.onFootprintClick = onFootprintClick;
      this.onChestClick = onChestClick;
      this.onRefresh = onRefresh;
      this.onLogout = onLogout;
      this.onGroupJourneyListClick = onGroupJourneyListClick;
      this.onContributionClick = onContributionClick;

      this.currentUserProfile = null;
      this.baseFullAttendanceDays = null;
      this.baseFullAttendanceMonthKey = null;
      this.currentDate = this.getTodayDateString();
      this.currentWeekKey = this.getCurrentWeekKey();

      this.currentAnnouncements = [];
      try {
        const storedAnn = localStorage.getItem('vital_announcements');
        if (storedAnn) this.currentAnnouncements = JSON.parse(storedAnn);
      } catch (e) {}

      this.pointsConfig = { ...DEFAULT_POINTS_CONFIG };
      try {
        const storedPoints = localStorage.getItem('vital_points_config');
        if (storedPoints) {
          const parsed = JSON.parse(storedPoints);
          if (parsed && typeof parsed === 'object') {
            this.pointsConfig = { ...DEFAULT_POINTS_CONFIG, ...parsed };
          }
        }
      } catch (e) {}

      this.infoModal = document.getElementById('infoModal');
      this.infoModalTitle = document.getElementById('infoModalTitle');
      this.infoModalContent = document.getElementById('infoModalContent');

      // 活力組操練鎖定狀態與提醒旗標
      this.isPracticeLocked = false;
      this.practiceLockReason = '';
      this.hasPromptedGroupLock = false;

      this.initEvents_();
      this.subscribeStore_();
      this.renderTaskCards(this.pointsConfig);
    }

    getTodayDateString() {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    getYesterdayDateString(baseDateStr = '') {
      let d;
      if (baseDateStr) {
        d = new Date(baseDateStr + 'T12:00:00');
      } else {
        d = new Date();
      }
      const prev = new Date(d.getTime() - 86400000);
      const y = prev.getFullYear();
      const m = String(prev.getMonth() + 1).padStart(2, '0');
      const day = String(prev.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }

    setSyncLock(isLocked) {
      this.isSyncing = isLocked;
      const btns = document.querySelectorAll('.quest-card');
      btns.forEach(btn => {
        if (this.isPracticeLocked) {
          btn.disabled = true;
          btn.classList.add('is-locked');
          btn.style.opacity = '';
          btn.style.pointerEvents = '';
          btn.style.filter = '';
          return;
        }
        btn.style.opacity = isLocked ? '0.6' : '1';
        btn.style.pointerEvents = isLocked ? 'none' : 'auto';
        btn.style.filter = isLocked ? 'grayscale(0.5)' : 'none';
      });
    }

    getCurrentWeekKey() {
      const now = new Date();
      // ISO 8601 週四定年原則 (四天規則)
      const curMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
      const curDate = new Date(curMs);
      const isoDay = (curDate.getUTCDay() + 6) % 7 + 1; // 1=Mon, ..., 7=Sun
      const thursdayMs = curMs + (4 - isoDay) * 86400000;
      const thursdayYear = new Date(thursdayMs).getUTCFullYear();
      const jan4Ms = Date.UTC(thursdayYear, 0, 4);
      const jan4IsoDay = (new Date(jan4Ms).getUTCDay() + 6) % 7 + 1;
      const jan4MondayMs = jan4Ms - (jan4IsoDay - 1) * 86400000;
      const curMondayMs = curMs - (isoDay - 1) * 86400000;
      const weekNum = 1 + Math.round((curMondayMs - jan4MondayMs) / 604800000);
      return `${thursdayYear}-W${String(weekNum).padStart(2, '0')}`;
    }

    initEvents_() {
      // 每日操練按鈕點擊
      const dailyMap = [
        ['#homeMorningBtn', 'morning'],
        ['#homeBibleBtn', 'bible'],
        ['#homePrayerPracticeBtn', 'prayer'],
        ['#homeBookBtn', 'book']
      ];

      dailyMap.forEach(([selector, key]) => {
        const btn = document.querySelector(selector);
        if (btn) {
          btn.addEventListener('click', () => {
            if (this.isPracticeLocked || btn.disabled) return;
            if (this.isSyncing) return;
            const currentItemState = this.practiceStore.dailyState[this.currentDate];
            const wasDone = Boolean(currentItemState && (currentItemState[key] !== undefined ? currentItemState[key] : (key === 'morning' ? currentItemState.morningRevival : (key === 'bible' ? currentItemState.bibleReading : (key === 'book' ? currentItemState.bookPursuit : false)))));
            this.practiceStore.toggleDailyPractice(this.currentDate, key);
            const isNowDone = !wasDone;
            this.applyOptimisticPointsDelta_(key, isNowDone, 'DAILY');
          });
        }
      });

      // 每週聚會按鈕點擊
      const weeklyMap = [
        ['#homeWeeklySmallGroupBtn', 'smallGroup'],
        ['#homeWeeklyPrayerMeetingBtn', 'prayerMeeting'],
        ['#homeWeeklyLordDayBtn', 'lordDayMeeting'],
        ['#homeOutreachVisitBtn', 'outreachVisit']
      ];

      weeklyMap.forEach(([selector, key]) => {
        const btn = document.querySelector(selector);
        if (btn) {
          btn.addEventListener('click', () => {
            if (this.isPracticeLocked || btn.disabled) return;
            if (this.isSyncing) return;
            const currentItemState = this.practiceStore.meetingState[this.currentWeekKey];
            const wasDone = Boolean(currentItemState && currentItemState[key]);
            this.practiceStore.toggleMeetingPractice(this.currentWeekKey, key);
            const isNowDone = !wasDone;
            this.applyOptimisticPointsDelta_(key, isNowDone, 'MEETING');
          });
        }
      });

      // 足跡與寶箱捷徑
      const goMyBtn = document.getElementById('goMyBtn');
      if (goMyBtn) {
        goMyBtn.addEventListener('click', () => {
          if (typeof this.onFootprintClick === 'function') this.onFootprintClick();
        });
      }

      const chestHeroBtn = document.getElementById('openChestCollectionBtn');
      if (chestHeroBtn) {
        chestHeroBtn.addEventListener('click', () => {
          if (typeof this.onChestClick === 'function') this.onChestClick();
        });
      }

      // 關閉小組篇章專屬彈窗
      document.querySelectorAll('[data-close-modal="chapterDetailModal"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const m = document.getElementById('chapterDetailModal');
          if (m) m.classList.add('hidden');
        });
      });

      // 更新與登出
      const refreshBtn = document.getElementById('refreshHomeBtn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          if (typeof this.onRefresh === 'function') this.onRefresh();
        });
      }

      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          if (typeof this.onLogout === 'function') this.onLogout();
        });
      }

      // 查看各組旅程清單
      const openGroupJourneyBtn = document.getElementById('openGroupJourneyBtn');
      if (openGroupJourneyBtn) {
        openGroupJourneyBtn.addEventListener('click', () => {
          if (typeof this.onGroupJourneyListClick === 'function') {
            this.onGroupJourneyListClick();
          } else {
            this.openGroupJourneyListModal();
          }
        });
      }

      // 點擊同行貢獻卡片開啟彈窗
      // 點擊貢獻卡開啟彈窗（事件委託確保支援動態修復元素）
      const scoreGrid = document.querySelector('.hero-score-grid');
      if (scoreGrid) {
        scoreGrid.addEventListener('click', (e) => {
          const contribTarget = e.target.closest('.hero-contribution') || e.target.closest('.hero-score-card:nth-child(2)');
          if (contribTarget) {
            if (typeof this.onContributionClick === 'function') this.onContributionClick();
          }
        });
      }

      // 關閉通用彈窗
      document.querySelectorAll('[data-close-modal="infoModal"]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (this.infoModal) this.infoModal.classList.add('hidden');
        });
      });

      // 點擊小組名稱或未加入標籤時，若處於鎖定狀態可再次打開提示視窗
      const groupEl = document.getElementById('homeGroupName');
      if (groupEl) {
        groupEl.addEventListener('click', () => {
          if (this.isPracticeLocked && this.practiceLockReason) {
            this.openGroupPracticeRequiredModal(this.practiceLockReason);
          }
        });
      }

      // 任務結算說明資訊按鈕與氣泡開關
      const dailyInfoBtn = document.getElementById('dailyTaskInfoBtn');
      const dailyPopover = document.getElementById('dailyTaskPopover');
      const weeklyInfoBtn = document.getElementById('weeklyTaskInfoBtn');
      const weeklyPopover = document.getElementById('weeklyTaskPopover');

      const closeAllTaskPopovers = () => {
        if (dailyPopover) dailyPopover.classList.add('hidden');
        if (weeklyPopover) weeklyPopover.classList.add('hidden');
      };

      if (dailyInfoBtn && dailyPopover) {
        dailyInfoBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = dailyPopover.classList.contains('hidden');
          closeAllTaskPopovers();
          if (isHidden) {
            dailyPopover.classList.remove('hidden');
          }
        });
      }

      if (weeklyInfoBtn && weeklyPopover) {
        weeklyInfoBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = weeklyPopover.classList.contains('hidden');
          closeAllTaskPopovers();
          if (isHidden) {
            weeklyPopover.classList.remove('hidden');
          }
        });
      }

      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('click', (e) => {
          if (!e.target || typeof e.target.closest !== 'function') return;
          if (!e.target.closest('.task-info-wrapper')) {
            closeAllTaskPopovers();
          }
        });
      }
    }

    subscribeStore_() {
      const originalHandler = this.practiceStore && this.practiceStore.onStateChange;
      if (!this.practiceStore) return;
      this.practiceStore.onStateChange = ({ type, key, state }) => {
        if (typeof originalHandler === 'function') {
          originalHandler({ type, key, state });
        }
        const playerId = (this.currentUserProfile && this.currentUserProfile.playerId) || null;
        if (type === 'DAILY') {
          if (key === this.currentDate) {
            this.renderDailyPracticeState(state);
          }
          if (this.apiClient && typeof this.apiClient.updateFootprintDailyCache === 'function') {
            this.apiClient.updateFootprintDailyCache(key, state, playerId);
          }
          this.updateFullAttendanceDays();
          if (this.apiClient && typeof this.apiClient.updateDailyRecordCache === 'function') {
            this.apiClient.updateDailyRecordCache(key, state, playerId);
          } else if (typeof localStorage !== 'undefined' && playerId) {
            try {
              const dKey = `vital_daily_records_${playerId}`;
              const curRecs = JSON.parse(localStorage.getItem(dKey) || '{}');
              curRecs[key] = { ...(curRecs[key] || {}), ...state };
              localStorage.setItem(dKey, JSON.stringify(curRecs));
            } catch (_) {}
          }
        } else if (type === 'MEETING') {
          if (key === this.currentWeekKey) {
            this.renderMeetingPracticeState(state);
          }
          if (this.apiClient && typeof this.apiClient.updateFootprintMeetingCache === 'function') {
            this.apiClient.updateFootprintMeetingCache(key, state, playerId);
          }
          if (this.apiClient && typeof this.apiClient.updateMeetingRecordCache === 'function') {
            this.apiClient.updateMeetingRecordCache(key, state, playerId);
          } else if (typeof localStorage !== 'undefined' && playerId) {
            try {
              const mKey = `vital_meeting_records_${playerId}`;
              const curRecs = JSON.parse(localStorage.getItem(mKey) || '{}');
              curRecs[key] = { ...(curRecs[key] || {}), ...state };
              localStorage.setItem(mKey, JSON.stringify(curRecs));
            } catch (_) {}
          }
        }
        this.renderPendingChips_();
      };
    }

    render(userProfile, journeyData = null, announcements = null, chaptersConfig = null) {
      if (!userProfile) return;
      
      // 建立淺拷貝以避免污染源物件
      this.currentUserProfile = { ...userProfile };
      if (journeyData) {
        this.currentJourneyData = journeyData;
      } else if (!this.currentJourneyData && typeof localStorage !== 'undefined' && this.currentUserProfile.groupId) {
        try {
          const cachedGp = JSON.parse(localStorage.getItem(`vital_group_progress_${this.currentUserProfile.groupId}`) || 'null');
          if (cachedGp) {
            const engine = (typeof window !== 'undefined' && window.JourneyEngine) || (typeof JourneyEngine !== 'undefined' && JourneyEngine);
            if (engine && typeof engine.deriveJourney === 'function') {
              this.currentJourneyData = engine.deriveJourney(cachedGp, this.currentUserProfile, chaptersConfig);
            } else {
              this.currentJourneyData = cachedGp;
            }
          }
        } catch (_) {}
      }

      // 正式分數維持權威已結算狀態（零本地偽結算水合，確保跨視圖完全一致）
      const basePersonal = Number(this.currentUserProfile.personalPoints ?? 0);
      this.currentUserProfile.basePersonalPoints = basePersonal;

      const baseContrib = Number(this.currentUserProfile.contributionPoints ?? 0);
      this.currentUserProfile.baseContributionPoints = baseContrib;

      if (!this.currentUserProfile.groupId) {
        this.currentUserProfile.contributionPoints = 0;
        if (this.currentUserProfile.contribution !== undefined) this.currentUserProfile.contribution = 0;
      }

      // 1. 頂部資訊
      const nameEl = document.getElementById('homePlayerName');
      const groupEl = document.getElementById('homeGroupName');
      const avatarImg = document.getElementById('homeAvatarImg');
      const avatarPlaceholder = document.getElementById('homeAvatarPlaceholder');

      if (nameEl) nameEl.textContent = userProfile.name || userProfile.username || '活力人';
      const hasGroup = Boolean(userProfile.groupId);
      if (groupEl) groupEl.textContent = hasGroup ? (userProfile.groupName || `活力組 #${userProfile.groupId}`) : '未加入活力組';

      if (avatarImg && userProfile.avatarUrl) {
        avatarImg.src = userProfile.avatarUrl;
        avatarImg.classList.remove('hidden');
        if (avatarPlaceholder) avatarPlaceholder.classList.add('hidden');
      }

      // 2. 英雄卡片問候與點數
      const greetingEl = document.getElementById('heroGreetingText');
      if (greetingEl) {
        greetingEl.textContent = `平安，${userProfile.name || '聖徒'}！歡迎一同在主裡同奔賽程。`;
      }

      // 自我修復與結構防禦：確保卡片 1 為【個人】、卡片 2 為【貢獻】
      const scoreGridEl = document.querySelector('.hero-score-grid');
      if (scoreGridEl) {
        const cards = scoreGridEl.querySelectorAll('.hero-score-card');
        if (cards.length >= 2) {
          // 第一張卡必為【個人】
          cards[0].className = 'hero-score-card hero-personal-score';
          const label1 = cards[0].querySelector('span');
          if (label1) label1.textContent = '個人';
          const strong1 = cards[0].querySelector('strong');
          if (strong1) {
            strong1.id = 'homePersonalScoreText';
            strong1.style.setProperty('font-size', '28px', 'important');
          }

          // 第二張卡必為【貢獻】
          cards[1].className = 'hero-score-card hero-contribution';
          cards[1].style.cursor = 'pointer';
          const label2 = cards[1].querySelector('span');
          if (label2) label2.textContent = '貢獻';
          const strong2 = cards[1].querySelector('strong');
          if (strong2) {
            strong2.id = 'homeContributionText';
            strong2.style.setProperty('font-size', '28px', 'important');
          }
        }
      }

      // 【個人點數】（整年操練分 + 歷史結算沉澱分 personalPoints + 今日未結算操練分數）
      const personalPoints = Number(this.currentUserProfile.personalPoints || 0);
      const personalEl = document.getElementById('homePersonalScoreText');
      if (personalEl) personalEl.textContent = personalPoints.toLocaleString();

      // 【貢獻點數】（未加入活力組則固定為 0；在目前組別累積貢獻點 contributionPoints + 今日未結算操練分數）
      const contribution = this.currentUserProfile.groupId
        ? Number(this.currentUserProfile.contributionPoints || 0)
        : 0;
      const contribEl = document.getElementById('homeContributionText');
      if (contribEl) contribEl.textContent = contribution.toLocaleString();

      this.renderPendingChips_();
      this.renderSettlingBadges_();

      this.updateFullAttendanceDays();

      let mCount = 0;
      if (hasGroup) {
        if (typeof userProfile.memberCount === 'number' && userProfile.memberCount > 0) {
          mCount = userProfile.memberCount;
        } else if (typeof journeyData?.memberCount === 'number' && journeyData.memberCount > 0) {
          mCount = journeyData.memberCount;
        } else {
          try {
            const gp = JSON.parse(localStorage.getItem(`vital_group_profile_${userProfile.groupId}`) || 'null');
            if (gp && typeof gp.memberCount === 'number' && gp.memberCount > 0) {
              mCount = gp.memberCount;
            } else if (gp && Array.isArray(gp.members) && gp.members.length > 0) {
              mCount = gp.members.length;
            }
          } catch (e) {}
        }
        if (mCount === 0) mCount = 1; // 至少本人在組內
      }

      const memberCountEl = document.getElementById('homeMemberCountText');
      if (memberCountEl) {
        memberCountEl.textContent = String(mCount);
      }

      // 3. 小組篇章成長旅程
      this.renderJourneyNodes_(journeyData, chaptersConfig);

      // 4. 公告呈現 (若傳入陣列則以最新伺服器結果為準；若未傳入則嘗試從快取讀取)
      if (Array.isArray(announcements)) {
        this.currentAnnouncements = announcements;
      } else if (!this.currentAnnouncements || this.currentAnnouncements.length === 0) {
        try {
          const storedAnn = localStorage.getItem('vital_announcements');
          if (storedAnn) this.currentAnnouncements = JSON.parse(storedAnn);
        } catch (e) {}
      }
      this.renderAnnouncements_(this.currentAnnouncements);

      // 5. 本週任務週次與日期標籤
      const weekDateEl = document.getElementById('homeWeeklyDateText');
      if (weekDateEl) {
        weekDateEl.textContent = this.getWeeklyDateRangeText_();
      }

      // 6. 活力組操練權限防禦：未加入活力組、已停用或未滿 2 人時所有打卡按鈕直接反灰不准按
      let groupEnabled = userProfile.groupEnabled !== false;
      let groupStatusMessage = userProfile.groupStatusMessage || '';
      if (hasGroup) {
        try {
          const gp = JSON.parse(localStorage.getItem(`vital_group_profile_${userProfile.groupId}`) || 'null');
          if (gp) {
            if (gp.enabled !== undefined) groupEnabled = gp.enabled !== false;
            if (gp.groupEnabled !== undefined) groupEnabled = gp.groupEnabled !== false;
            if (gp.statusMessage) groupStatusMessage = gp.statusMessage;
          }
        } catch (e) {}
      }

      let lockReason = null;
      if (!hasGroup) {
        lockReason = '歡迎來到活力同行！操練與聚會打卡需有同伴同奔賽程。請先至「我的」頁面建立或加入活力組，才能開啟打卡功能喔！';
      } else if (!groupEnabled) {
        lockReason = groupStatusMessage || '您所屬的活力組目前已暫停服務，暫時無法記錄操練。如有疑問請聯絡服事弟兄。';
      } else if (mCount < 2) {
        lockReason = '同伴尋找中！活力組至少需要 2 位同伴成組。快邀請青職同伴加入您的活力組，一同開啟打卡操練吧！';
      }

      this.updatePracticeLockState_(lockReason);
    }

    isChapterPassed_(chapId, journeyData = null) {
      if (!chapId) return false;
      const jData = journeyData || this.currentJourneyData || {};

      // 1. 若旅程已推導出當前篇章序號，且查詢章節 order 小於當前篇章序號，則必已通過
      const chList = this.chaptersConfig || [];
      if (Array.isArray(chList) && chList.length > 0) {
        const targetCh = chList.find(c => c && (c.chapterId === chapId || c.id === chapId));
        if (targetCh && jData.chapterIndex && Number(targetCh.order) < Number(jData.chapterIndex)) {
          return true;
        }
      }

      let chapterHistory = jData.chapterHistory || [];
      if (typeof chapterHistory === 'string') {
        try { chapterHistory = JSON.parse(chapterHistory); } catch (e) { chapterHistory = []; }
      }
      if (!Array.isArray(chapterHistory)) chapterHistory = [];

      let milestones = jData.milestones || [];
      if (typeof milestones === 'string') {
        try { milestones = JSON.parse(milestones); } catch (e) { milestones = []; }
      }
      if (!Array.isArray(milestones)) milestones = [];

      let unlockedChapters = jData.unlockedChapters || [];
      if (typeof unlockedChapters === 'string') {
        try { unlockedChapters = JSON.parse(unlockedChapters); } catch (e) { unlockedChapters = []; }
      }
      if (!Array.isArray(unlockedChapters)) unlockedChapters = [];

      const targetId = String(chapId).trim().toUpperCase();
      const normTarget = targetId.replace(/^(?:CHAPTER_|CHP_|CH)/i, '');

      const matchMilestone = (m) => {
        if (!m) return false;
        if (typeof m === 'string') {
          const s = m.trim().toUpperCase();
          return s === targetId || s.replace(/^(?:CHAPTER_|CHP_|CH)/i, '') === normTarget;
        }
        const mId = String(m.id || m.chapterId || m.taskId || m.achievementId || '').trim().toUpperCase();
        return mId === targetId || mId.replace(/^(?:CHAPTER_|CHP_|CH)/i, '') === normTarget;
      };

      if (chapterHistory.some(matchMilestone) || milestones.some(matchMilestone) || unlockedChapters.some(matchMilestone)) {
        return true;
      }

      // 信心篇 (order 1，門檻 0 分) 只要小組已成組即自動達成
      if (normTarget === '01' || normTarget === '1') {
        const gid = jData.groupId || (this.currentUserProfile && this.currentUserProfile.groupId);
        const mCount = (typeof jData.memberCount === 'number' ? jData.memberCount : (this.currentUserProfile && this.currentUserProfile.memberCount)) || 0;
        if (gid && mCount >= 2) {
          return true;
        }
      }

      return false;
    }

    renderJourneyNodes_(journeyData, chaptersConfig = null) {
      let chapters = chaptersConfig;
      if (!Array.isArray(chapters) || chapters.length === 0) {
        try {
          const stored = localStorage.getItem('vital_chapters_config');
          if (stored) chapters = JSON.parse(stored);
        } catch (e) {}
      }

      const defaultChapters = [
        { chapterId: 'CHP_01', order: 1, status: 'ACTIVE', targetPoint: 0, name: '信心篇', subtitle: '義人必本於信得生並活著', description: '萬事起頭難，需要有同伴一同立定心志，在信心裡往前！\n(基礎條件：活力組至少2人)', themeColor: '#f59e0b', pictureKey: 'journey_1.webp' },
        { chapterId: 'CHP_02', order: 2, status: 'ACTIVE', targetPoint: 1000, name: '美德篇', subtitle: '藉這榮耀和美德，祂已將又寶貴又極大的應許賜給我們', description: '因著神聖生命的能力而產生有活力的行動，在人面前有好見證！', themeColor: '#3b82f6', pictureKey: 'journey_2.webp' },
        { chapterId: 'CHP_03', order: 3, status: 'ACTIVE', targetPoint: 2000, name: '知識篇', subtitle: '直到我們眾人都達到了對神兒子之完全認識上的一', description: '對我們主的知識的領會等於真理，就是祂一切所是的實際，我們需要在真理上長大！', themeColor: '#10b981', pictureKey: 'journey_3.webp' },
        { chapterId: 'CHP_04', order: 4, status: 'ACTIVE', targetPoint: 4000, name: '節制篇', subtitle: '凡較力爭勝的，諸事都有節制', description: '生活中操練從主受限制，讓主管治我們的全人，為著生命正確的長大，也為著得著不能壞的華冠！', themeColor: '#8b5cf6', pictureKey: 'journey_4.webp' },
        { chapterId: 'CHP_05', order: 5, status: 'ACTIVE', targetPoint: 7000, name: '忍耐篇', subtitle: '那美好的仗我已經打過了', description: '同心奔跑屬天賽程，在日常繁忙職場與生活中見證基督的得勝。', themeColor: '#ec4899', pictureKey: 'journey_5.webp' },
        { chapterId: 'CHP_06', order: 6, status: 'ACTIVE', targetPoint: 10000, name: '敬虔篇', subtitle: '榮上加榮，同被變化', description: '同心合意，滿有屬天的喜樂與長進，成為團體發光的榮耀見證。', themeColor: '#f97316', pictureKey: 'journey_6.webp' },
        { chapterId: 'CHP_07', order: 7, status: 'ACTIVE', targetPoint: 15000, name: '弟兄相愛篇', subtitle: '聯絡得合式，百節各按各職', description: '彼此相顧，激發愛心，勉勵行善；每週同聚禱告與小排交通。', themeColor: '#06b6d4', pictureKey: 'journey_7.webp' },
        { chapterId: 'CHP_08', order: 8, status: 'ACTIVE', targetPoint: 20000, name: '愛篇', subtitle: '世上的國成了我主和祂基督的國', description: '在榮耀裡作王同掌權，成為羔羊的伴侶，完全達到基督的身量。', themeColor: '#eab308', pictureKey: 'journey_8.webp' }
      ];

      if (!Array.isArray(chapters) || chapters.length === 0) {
        chapters = defaultChapters;
      }

      // 嚴格依 order 升冪排序（數值越小越靠左，過濾空白或無名篇章）
      chapters = chapters
        .filter(c => c && c.status === 'ACTIVE' && String(c.name || '').trim() && String(c.chapterId || '').trim())
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

      if (chapters.length === 0) chapters = defaultChapters;

      const hasJourneyScore = journeyData && (journeyData.groupTotalPoints !== undefined || journeyData.journeyPoints !== undefined);
      let groupScore = hasJourneyScore
        ? Number(journeyData.groupTotalPoints !== undefined ? journeyData.groupTotalPoints : journeyData.journeyPoints)
        : 0;

      // 兜底防禦：若後端尚未提供分數，嘗試從本地小組快取讀取已取得的分數
      if (!hasJourneyScore && typeof localStorage !== 'undefined') {
        const gid = (journeyData && journeyData.groupId) || (this.currentUserProfile && this.currentUserProfile.groupId);
        if (gid) {
          try {
            const cachedGp = JSON.parse(localStorage.getItem(`vital_group_progress_${gid}`) || 'null');
            if (cachedGp) {
              const cp = Number(cachedGp.groupTotalPoints !== undefined ? cachedGp.groupTotalPoints : (cachedGp.journeyPoints || 0));
              if (!isNaN(cp)) groupScore = cp;
            }
          } catch (e) {}
        }
      }
      this.currentGroupScore = groupScore;

      // 完全根據後端回傳的真實成就紀錄來判定篇章進度
      const isChapterPassed = (chapId) => this.isChapterPassed_(chapId, journeyData);

      // 尋找當前正在挑戰的目標篇章（第一個尚未達成的篇章；若全達成則為最後一個）
      let targetChapter = chapters.find(c => !isChapterPassed(c.chapterId));
      const allPassed = !targetChapter;
      if (!targetChapter) {
        targetChapter = chapters[chapters.length - 1];
      }

      // 標題顯示當前篇章名稱
      const titleEl = document.getElementById('homeJourneyChapterText');
      if (titleEl) {
        titleEl.textContent = targetChapter.name || '篇章旅程';
      }

      // 計算差距點數（如果目標篇章有設定 targetPoint > 0，才顯示分數差距）
      const nextText = document.getElementById('homeJourneyNextText');
      if (nextText) {
        if (allPassed) {
          nextText.textContent = `小組已達成最高榮耀篇章【${targetChapter.name}】！感謝讚美主！`;
        } else {
          const tPoint = Number(targetChapter.targetPoint) || 0;
          if (tPoint > 0) {
            const gap = Math.max(0, tPoint - groupScore);
            nextText.textContent = `距離【${targetChapter.name}】還差 ${gap.toLocaleString()} 點`;
          } else {
            nextText.textContent = `正在努力攻克【${targetChapter.name}】`;
          }
        }
      }

      // 動態渲染軌道節點
      const track = document.getElementById('homeJourneyNodes');
      if (track) {
        track.innerHTML = chapters.map((ch) => {
          const isPassed = isChapterPassed(ch.chapterId);
          const isCurrent = !allPassed && ch.chapterId === targetChapter.chapterId;
          const nodeClass = isPassed ? 'journey-node passed' : (isCurrent ? 'journey-node active' : 'journey-node');
          const statusText = isPassed ? '已達成' : (isCurrent ? '攻克中' : '尚未解鎖');

          return `
            <button class="${nodeClass}" type="button" data-chapter-id="${this.escapeHtml_(ch.chapterId)}" aria-label="${this.escapeHtml_(ch.name)} (${statusText})">
              <span>${this.escapeHtml_(ch.order)}</span>
              <strong>${this.escapeHtml_(ch.name)}</strong>
            </button>
          `;
        }).join('');

        // 綁定節點點擊開啟專屬篇章彈窗
        track.querySelectorAll('.journey-node').forEach(node => {
          node.addEventListener('click', () => {
            const cid = node.getAttribute('data-chapter-id');
            const targetCh = chapters.find(c => c.chapterId === cid);
            if (targetCh) {
              this.openChapterDetailModal(targetCh, this.currentGroupScore !== undefined ? this.currentGroupScore : groupScore);
            }
          });
        });

        // 啟用滑鼠左右拖移（Drag-to-Scroll）
        this.initTrackMouseDrag_(track);

        // 智慧滾動：將當前活躍或目標節點置中
        try {
          const activeNode = track.querySelector('.journey-node.active') || track.querySelector('.journey-node.passed:last-of-type') || track.firstElementChild;
          if (activeNode && typeof activeNode.scrollIntoView === 'function') {
            activeNode.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        } catch (e) {}
      }

      // 5. 渲染操練卡說明與點數
      this.renderTaskCards(this.pointsConfig);
    }

    openChapterDetailModal(chapter, groupScore = null) {
      if (!chapter) return;
      const modal = document.getElementById('chapterDetailModal');
      if (!modal) return;

      let score = (typeof groupScore === 'number' && !isNaN(groupScore)) ? groupScore : (this.currentGroupScore || 0);
      if (score === 0 && typeof localStorage !== 'undefined') {
        const gid = this.currentUserProfile && this.currentUserProfile.groupId;
        if (gid) {
          try {
            const cachedGp = JSON.parse(localStorage.getItem(`vital_group_progress_${gid}`) || 'null');
            if (cachedGp) {
              const cp = Number(cachedGp.groupTotalPoints !== undefined ? cachedGp.groupTotalPoints : (cachedGp.journeyPoints || 0));
              if (cp > 0) score = cp;
            }
          } catch (e) {}
        }
      }

      const titleEl = document.getElementById('chapterDetailModalTitle');
      const imgEl = document.getElementById('chapterDetailModalImage');
      const nameEl = document.getElementById('chapterDetailModalName');
      const subtitleEl = document.getElementById('chapterDetailModalSubtitle');
      const statusEl = document.getElementById('chapterDetailModalStatus');
      const gapEl = document.getElementById('chapterDetailModalGap');
      const descEl = document.getElementById('chapterDetailModalDesc');

      if (titleEl) titleEl.textContent = `第 ${chapter.order} 篇章`;
      if (nameEl) nameEl.textContent = chapter.name || '';
      if (subtitleEl) subtitleEl.textContent = chapter.subtitle || '';
      if (descEl) descEl.textContent = chapter.description || '暫無篇章說明。';

      if (imgEl) {
        imgEl.onerror = () => {
          imgEl.onerror = null;
          imgEl.src = '../Chest_Assets/journey_1.webp';
        };
        imgEl.src = this.resolvePictureKey_(chapter.pictureKey, '../Chest_Assets/journey_1.webp');
      }

      const chapterHistory = (this.currentJourneyData && this.currentJourneyData.chapterHistory) || [];
      const milestones = (this.currentJourneyData && this.currentJourneyData.milestones) || [];
      const isPassed = this.isChapterPassed_(chapter.chapterId, this.currentJourneyData);

      const tPoint = Number(chapter.targetPoint) || 0;
      const gap = Math.max(0, tPoint - score);

      if (statusEl) {
        if (isPassed) {
          statusEl.textContent = '🏆 已達成';
          statusEl.style.background = '#dcfce7';
          statusEl.style.color = '#15803d';
        } else {
          const targetChapter = this.chaptersConfig ? this.chaptersConfig.find(c => !this.isChapterPassed_(c.chapterId, this.currentJourneyData)) : null;
          const isCurrent = targetChapter ? targetChapter.chapterId === chapter.chapterId : (chapter.order === 1);
          if (isCurrent) {
            statusEl.textContent = '🏃 攻克中';
            statusEl.style.background = '#fef3c7';
            statusEl.style.color = '#d97706';
          } else {
            statusEl.textContent = '🔒 未解鎖';
            statusEl.style.background = '#f1f5f9';
            statusEl.style.color = '#64748b';
          }
        }
      }

      if (gapEl) {
        if (isPassed) {
          gapEl.textContent = tPoint > 0
            ? `✅ 小組累積操練分已突破門檻（門檻：${tPoint.toLocaleString()} 點）`
            : `✅ 小組已達成篇章解鎖條件`;
          gapEl.style.color = '#15803d';
        } else if (tPoint > 0) {
          gapEl.textContent = `⚡ 距離達成【${chapter.name}】還差 ${gap.toLocaleString()} 點（門檻：${tPoint.toLocaleString()} 點）`;
          gapEl.style.color = '#0284c7';
        } else {
          gapEl.textContent = `⚡ 正在攻克【${chapter.name}】（請參照下方達成條件）`;
          gapEl.style.color = '#0284c7';
        }
      }

      modal.classList.remove('hidden');
    }

    resolvePictureKey_(pictureKey, fallback = '../Chest_Assets/journey_1.webp') {
      if (!pictureKey) return fallback;
      const p = String(pictureKey).trim();
      if (p.startsWith('http://') || p.startsWith('https://') || p.startsWith('data:')) {
        return p;
      }
      if (p.startsWith('journey_')) {
        const file = (p.endsWith('.webp') || p.endsWith('.png') || p.endsWith('.jpg')) ? p : `${p}.webp`;
        return `../Chest_Assets/${file}`;
      }
      if (p.startsWith('Chapter_')) {
        const matchedChest = p.replace(/^Chapter_/, 'Chest_');
        return `../Chest_Assets/${matchedChest}`;
      }
      if (p.startsWith('Chest_')) {
        return `../Chest_Assets/${p}`;
      }
      if (p.startsWith('../')) {
        return p;
      }
      return `../Chest_Assets/${p}`;
    }

    initTrackMouseDrag_(track) {
      if (!track || track._hasDragInit) return;
      track._hasDragInit = true;
      track.style.cursor = 'grab';
      track.style.userSelect = 'none';
      track.style.webkitUserSelect = 'none';

      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;
      let hasDragged = false;

      track.addEventListener('mousedown', (e) => {
        isDown = true;
        hasDragged = false;
        startX = e.pageX - track.offsetLeft;
        scrollLeft = track.scrollLeft;
        track.style.cursor = 'grabbing';
      });

      track.addEventListener('mouseleave', () => {
        isDown = false;
        track.style.cursor = 'grab';
      });

      track.addEventListener('mouseup', () => {
        isDown = false;
        track.style.cursor = 'grab';
        setTimeout(() => { hasDragged = false; }, 50);
      });

      track.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - track.offsetLeft;
        const walk = (x - startX) * 1.5;
        if (Math.abs(walk) > 4) {
          hasDragged = true;
        }
        track.scrollLeft = scrollLeft - walk;
      });

      // 避免拖曳時誤觸發 click
      track.addEventListener('click', (e) => {
        if (hasDragged) {
          e.stopPropagation();
          e.preventDefault();
        }
      }, true);
    }

    renderAnnouncements_(announcements) {
      const container = document.getElementById('homeHeroAnnouncements');
      if (!container) return;

      container.onclick = () => this.openAnnouncementsModal_();
      container.style.cursor = 'pointer';

      if (!Array.isArray(announcements) || announcements.length === 0) {
        container.innerHTML = '<div style="width:100%;text-align:center;color:#806a68;font-size:13px;font-weight:700;">今日無重大公告，願主與你同行</div>';
        return;
      }

      const itemsHtml = announcements.map(a => `
        <span class="hero-announcement-item">
          <strong>${a.isPinned ? '<span style="color:#d97706;font-weight:700;margin-right:4px;">[置頂]</span>' : ''}${this.escapeHtml_(a.title || '系統公告')}</strong>
          <span style="opacity:0.9; margin-left:6px;">${this.escapeHtml_(a.content || '')}</span>
        </span>
      `).join('<span class="hero-announcement-sep" style="margin:0 24px;color:#c4a482;opacity:0.6;">✦</span>') + '<span class="hero-announcement-sep" style="margin:0 24px;color:#c4a482;opacity:0.6;">✦</span>';

      container.innerHTML = `
        <div class="hero-announcement-marquee" title="點擊檢視完整公告">
          <div class="hero-announcement-track" id="heroAnnouncementTrack">
            <div class="hero-announcement-content">${itemsHtml}</div>
            <div class="hero-announcement-content" aria-hidden="true">${itemsHtml}</div>
          </div>
        </div>
      `;

      requestAnimationFrame(() => {
        const track = document.getElementById('heroAnnouncementTrack');
        const firstChild = track && track.firstElementChild;
        if (track && firstChild) {
          const w = firstChild.offsetWidth;
          const duration = Math.max(16, Math.round(w / 45));
          track.style.animationDuration = `${duration}s`;
        }
      });
    }

    openAnnouncementsModal_() {
      if (!this.infoModal || !this.currentAnnouncements || this.currentAnnouncements.length === 0) return;
      if (this.infoModalTitle) this.infoModalTitle.textContent = '系統公告';
      if (this.infoModalContent) {
        this.infoModalContent.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:14px; max-height:60vh; overflow-y:auto; padding:4px;">
            ${this.currentAnnouncements.map(a => `
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px 16px;">
                <div style="font-weight:700; font-size:15px; color:#1e293b; margin-bottom:6px;">
                  ${a.isPinned ? '<span style="color:#d97706; font-weight:700; margin-right:6px;">[置頂]</span>' : ''}
                  ${this.escapeHtml_(a.title || '系統公告')}
                </div>
                <div style="font-size:14px; color:#475569; line-height:1.6; white-space:pre-wrap;">
                  ${this.escapeHtml_(a.content || '')}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }
      this.infoModal.classList.remove('hidden');
    }

    renderDailyPracticeState(state) {
      const items = [
        ['#homeMorningBtn', '#homeMorningStatus', state.morningRevival !== undefined ? state.morningRevival : state.morning],
        ['#homeBibleBtn', '#homeBibleStatus', state.bibleReading !== undefined ? state.bibleReading : state.bible],
        ['#homePrayerPracticeBtn', '#homePrayerPracticeStatus', state.prayer],
        ['#homeBookBtn', '#homeBookStatus', state.bookPursuit !== undefined ? state.bookPursuit : state.book]
      ];

      items.forEach(([btnSel, statusSel, isDone]) => {
        const btn = document.querySelector(btnSel);
        const status = document.querySelector(statusSel);
        const done = Boolean(isDone);

        if (btn) {
          btn.classList.toggle('done', done);
          btn.classList.toggle('has-amber-dot', Boolean(state.hasAmberDot));
        }
        if (status) {
          status.textContent = done ? '已完成' : '未完成';
        }
      });
    }

    renderMeetingPracticeState(state) {
      const items = [
        ['#homeWeeklySmallGroupBtn', '#homeWeeklySmallGroupStatus', state.smallGroup],
        ['#homeWeeklyPrayerMeetingBtn', '#homeWeeklyPrayerMeetingStatus', state.prayerMeeting],
        ['#homeWeeklyLordDayBtn', '#homeWeeklyLordDayStatus', state.lordDayMeeting],
        ['#homeOutreachVisitBtn', '#homeOutreachVisitStatus', state.outreachVisit]
      ];

      items.forEach(([btnSel, statusSel, isDone]) => {
        const btn = document.querySelector(btnSel);
        const status = document.querySelector(statusSel);
        const done = Boolean(isDone);

        if (btn) {
          btn.classList.toggle('done', done);
          btn.classList.toggle('has-amber-dot', Boolean(state.hasAmberDot));
        }
        if (status) {
          status.textContent = done ? '已完成' : '未完成';
        }
      });
    }

    getWeeklyDateRangeText_() {
      const now = new Date();
      const day = now.getDay(); // 0 is Sun, 1 is Mon, ..., 6 is Sat
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMonday);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const m1 = monday.getMonth() + 1;
      const d1 = monday.getDate();
      const m2 = sunday.getMonth() + 1;
      const d2 = sunday.getDate();

      return `日期：${m1}/${d1}(一)~${m2}/${d2}(日)`;
    }

    renderTaskCards(pointsConfig = null) {
      if (pointsConfig && typeof pointsConfig === 'object') {
        this.pointsConfig = { ...DEFAULT_POINTS_CONFIG, ...pointsConfig };
      }
      const cfg = this.pointsConfig || DEFAULT_POINTS_CONFIG;

      const morningPts = cfg.morning !== undefined ? cfg.morning : 50;
      const biblePts = cfg.bible !== undefined ? cfg.bible : 30;
      const prayerPts = cfg.prayer !== undefined ? cfg.prayer : 30;
      const bookPts = cfg.book !== undefined ? cfg.book : 30;
      const outreachPts = cfg.outreach !== undefined ? cfg.outreach : (cfg.outreachVisit !== undefined ? cfg.outreachVisit : 100);
      const groupPts = cfg.group !== undefined ? cfg.group : (cfg.smallGroup !== undefined ? cfg.smallGroup : 30);
      const prayerMtgPts = cfg.prayerMtg !== undefined ? cfg.prayerMtg : (cfg.prayerMeeting !== undefined ? cfg.prayerMeeting : 50);
      const lordDayPts = cfg.lordDay !== undefined ? cfg.lordDay : (cfg.lordDayMeeting !== undefined ? cfg.lordDayMeeting : 50);

      // 更新日期範圍
      const dateTextEl = document.getElementById('homeWeeklyDateText');
      if (dateTextEl) {
        dateTextEl.textContent = this.getWeeklyDateRangeText_();
      }

      // 今日操練四項 (晨興為團體項目，需2人打卡達標，全組同得)
      this.updateTaskCard_('homeMorningBtn', '晨', '小組晨興', `2人達標 +${morningPts}`);
      this.updateTaskCard_('homeBibleBtn', '讀', '個人讀經', `個人貢獻 +${biblePts}`);
      this.updateTaskCard_('homePrayerPracticeBtn', '禱', '個人禱告', `個人貢獻 +${prayerPts}`);
      this.updateTaskCard_('homeBookBtn', '書', '個人書報', `個人貢獻 +${bookPts}`);

      // 每週操練四項 (外出探訪為團體項目，需2人打卡達標，全組同得)
      this.updateTaskCard_('homeOutreachVisitBtn', '訪', '外出探訪', `2人達標 +${outreachPts}`);
      this.updateTaskCard_('homeWeeklySmallGroupBtn', '小', '小排聚會', `個人貢獻 +${groupPts}`);
      this.updateTaskCard_('homeWeeklyPrayerMeetingBtn', '禱', '禱告聚會', `個人貢獻 +${prayerMtgPts}`);
      this.updateTaskCard_('homeWeeklyLordDayBtn', '主', '主日聚會', `個人貢獻 +${lordDayPts}`);
    }

    updateTaskCard_(btnId, icon, title, desc) {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      let iconEl = btn.querySelector('.quest-icon');
      if (!iconEl && icon) {
        iconEl = document.createElement('span');
        iconEl.className = 'quest-icon';
        btn.prepend(iconEl);
      }
      if (iconEl && icon) iconEl.textContent = icon;

      let strong = btn.querySelector('strong');
      if (!strong) {
        strong = document.createElement('strong');
        btn.appendChild(strong);
      }
      strong.textContent = title;

      let small = btn.querySelector('small');
      if (!small) {
        small = document.createElement('small');
        btn.appendChild(small);
      }
      small.textContent = desc;
    }

    async openGroupJourneyListModal() {
      if (this.infoModalTitle) this.infoModalTitle.textContent = '全召會活力組旅程榜';
      if (this.infoModal) this.infoModal.classList.remove('hidden');

      if (this.infoModalContent) {
        this.infoModalContent.innerHTML = '<div style="text-align:center;padding:30px;color:#64748b;">讀取全召會活力組旅程中...</div>';
      }

      try {
        const res = await this.apiClient.getGroupJourneyList();
        const data = (res && res.data) || res || {};
        const groups = (data && data.groups) || (res && res.groups) || [];
        this.renderGroupJourneyList_(groups);
      } catch (err) {
        if (this.infoModalContent) {
          this.infoModalContent.innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444;">讀取失敗：${this.escapeHtml_(err.message || '網路異常')}</div>`;
        }
      }
    }

    renderGroupJourneyList_(groups) {
      if (!this.infoModalContent) return;

      if (!Array.isArray(groups) || groups.length === 0) {
        this.infoModalContent.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;">目前尚無已建立的活力組</div>';
        return;
      }

      // 依旅程積分由高至低排序 (優先採用 journeyPoints，次為 groupTotalPoints)
      const sorted = [...groups].sort((a, b) => {
        const scoreA = Number(a.journeyPoints !== undefined ? a.journeyPoints : (a.groupTotalPoints || 0));
        const scoreB = Number(b.journeyPoints !== undefined ? b.journeyPoints : (b.groupTotalPoints || 0));
        return scoreB - scoreA;
      });

      const currentGroupId = this.currentUserProfile && this.currentUserProfile.groupId;
      const rankIcons = ['🥇', '🥈', '🥉'];

      const html = `
        <div style="display:flex; flex-direction:column; gap:12px; max-height:60vh; overflow-y:auto; padding:4px;">
          ${sorted.map((grp, idx) => {
            const isMyGroup = Boolean(currentGroupId && grp.groupId === currentGroupId);
            const rankBadge = idx < 3 ? rankIcons[idx] : `<span style="font-size:0.95rem;color:#64748b;font-weight:700;">#${idx + 1}</span>`;
            const score = Number(grp.journeyPoints !== undefined ? grp.journeyPoints : (grp.groupTotalPoints || 0));
            if (grp.currentChapter && typeof grp.currentChapter === 'object') {
              grp.currentChapter = grp.currentChapter.name || grp.currentChapter.title || '起步啟航';
            }
            const chapterName = grp.currentChapter || grp.chapterTitle || '起步啟航';

            const progressPercent = Math.min(100, Math.round(
              grp.progressPercent !== undefined ? grp.progressPercent :
              (grp.progressPercentage !== undefined ? grp.progressPercentage :
              ((grp.journey && (grp.journey.progressPercent !== undefined ? grp.journey.progressPercent : grp.journey.progressPercentage)) || 0))
            ));

            return `
              <div class="journey-rank-card ${isMyGroup ? 'is-my-group' : ''}">
                <div class="journey-rank-header">
                  <div class="journey-rank-badge">${rankBadge}</div>
                  <div class="journey-rank-content">
                    <div class="journey-rank-title-row">
                      <div class="journey-group-name-box">
                        <span class="journey-group-name-text">${this.escapeHtml_(grp.groupName || '未命名小組')}</span>
                      </div>
                      <div class="journey-rank-score">
                        ${score.toLocaleString()} <span class="journey-rank-score-unit">點</span>
                      </div>
                    </div>
                    ${(grp.district || isMyGroup) ? `
                      <div class="journey-rank-tags-row">
                        ${grp.district ? `<span class="journey-tag-district">${this.escapeHtml_(grp.district)}</span>` : ''}
                        ${isMyGroup ? '<span class="journey-tag-my-group">您的小組</span>' : ''}
                      </div>
                    ` : ''}
                    <div class="journey-rank-progress-row">
                      <div class="journey-chapter-box">
                        <span class="journey-tag-chapter">篇章</span>
                        <span class="journey-chapter-name">【${this.escapeHtml_(chapterName)}】</span>
                      </div>
                      <div class="journey-progress-text">進度 ${progressPercent}%</div>
                    </div>
                  </div>
                </div>
                <div class="journey-progress-track">
                  <div class="journey-progress-fill" style="width:${progressPercent}%;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
      this.infoModalContent.innerHTML = html;
      this.initGroupNameMarquees_();
    }

    /**
     * 初始化小組名稱跑馬燈（左右巡迴 Ping-Pong）
     */
    initGroupNameMarquees_() {
      if (!this.infoModalContent) return;
      const measure = () => {
        const boxes = this.infoModalContent.querySelectorAll('.journey-group-name-box');
        boxes.forEach(box => {
          const text = box.querySelector('.journey-group-name-text');
          if (!text) return;
          const overflow = text.scrollWidth - box.clientWidth;
          if (overflow > 2) {
            text.style.setProperty('--marquee-dist', `-${overflow + 6}px`);
            const duration = Math.max(5, Math.min(10, Math.round(overflow / 15) + 3));
            text.style.setProperty('--marquee-duration', `${duration}s`);
            text.classList.add('is-marquee-pingpong');
          }
        });
      };
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(measure);
      } else {
        measure();
      }
    }

    calculateUnsettledPointsDelta_() {
      const curDate = this.currentDate || this.getTodayDateString();
      const yesterdayStr = this.getYesterdayDateString(curDate);
      const curWeek = this.currentWeekKey || this.getCurrentWeekKey();

      // 1. 檢查後端是否已經完成昨日結算（比較 _lastSettledDate）
      const lastSettledDate = (this.currentUserProfile && this.currentUserProfile._lastSettledDate) || '';
      const isYesterdaySettled = Boolean(lastSettledDate && lastSettledDate >= yesterdayStr);
      // 若無歷史結算戳記（新用戶），不觸發「結算中」徽章
      this.isSettlingYesterday = lastSettledDate ? !isYesterdaySettled : false;

      const engine = (typeof PendingPointsEngine !== 'undefined')
        ? PendingPointsEngine
        : (typeof require === 'function' ? require('../modules/pendingPointsEngine') : null);

      if (engine && typeof engine.evaluate === 'function') {
        const res = engine.evaluate({
          daily: this.practiceStore?.dailyState?.[curDate],
          meeting: this.practiceStore?.meetingState?.[curWeek],
          pointsConfig: this.pointsConfig
        });
        return res.totalPoints;
      }
      return 0;
    }

    calculateTodayLocalPointsDelta_() {
      return this.calculateUnsettledPointsDelta_();
    }

    renderPendingChips_() {
      if (typeof document === 'undefined') return null;

      const engine = (typeof PendingPointsEngine !== 'undefined')
        ? PendingPointsEngine
        : (typeof require === 'function' ? require('../modules/pendingPointsEngine') : null);

      if (!engine || typeof engine.evaluate !== 'function') return null;

      const curDate = this.currentDate || this.getTodayDateString();
      const curWeek = this.currentWeekKey || this.getCurrentWeekKey();

      const dailyState = (this.practiceStore && this.practiceStore.dailyState)
        ? this.practiceStore.dailyState[curDate]
        : null;

      const meetingState = (this.practiceStore && this.practiceStore.meetingState)
        ? this.practiceStore.meetingState[curWeek]
        : null;

      const res = engine.evaluate({
        daily: dailyState,
        meeting: meetingState,
        pointsConfig: this.pointsConfig
      });

      const dailyChip = document.getElementById('homeDailyPendingChip');
      const dailyText = document.getElementById('homeDailyPendingText');
      if (dailyText) {
        dailyText.textContent = res.today.points > 0 ? `+${res.today.points} 點` : '0 點';
      }
      if (dailyChip) {
        dailyChip.classList.toggle('has-points', res.today.points > 0);
      }

      const weeklyChip = document.getElementById('homeWeeklyPendingChip');
      const weeklyText = document.getElementById('homeWeeklyPendingText');
      if (weeklyText) {
        weeklyText.textContent = res.week.points > 0 ? `+${res.week.points} 點` : '0 點';
      }
      if (weeklyChip) {
        weeklyChip.classList.toggle('has-points', res.week.points > 0);
      }

      return res;
    }

    resetState() {
      this.currentUserProfile = null;
      this.currentJourneyData = null;
      this.baseFullAttendanceDays = null;
      this.baseFullAttendanceMonthKey = null;
      if (typeof document !== 'undefined') {
        const el = document.getElementById('homeStreakText');
        if (el) el.textContent = '0 天';
      }
    }

    updateFullAttendanceDays(days = null) {
      if (typeof document === 'undefined') return;
      const el = document.getElementById('homeStreakText');
      if (!el) return;

      const currentMonthKey = (this.currentDate && this.currentDate.slice(0, 7)) || new Date().toISOString().slice(0, 7);

      // 檢查本地今日在 practiceStore 是否已達成 4/4 全勤（晨、讀、禱、書）
      const todaySt = (this.practiceStore && this.practiceStore.dailyState && this.currentDate)
        ? this.practiceStore.dailyState[this.currentDate]
        : null;
      const isTodayLocallyFull = Boolean(
        todaySt &&
        (todaySt.morningRevival || todaySt.morning) &&
        (todaySt.bibleReading || todaySt.bible) &&
        todaySt.prayer &&
        (todaySt.bookPursuit || todaySt.book)
      );

      let baseDays = 0;

      if (typeof days === 'number' && !isNaN(days)) {
        baseDays = days;
        this.baseFullAttendanceDays = baseDays;
        this.baseFullAttendanceMonthKey = currentMonthKey;
      } else {
        const playerId = (this.currentUserProfile && this.currentUserProfile.playerId)
          || (this.apiClient && typeof this.apiClient.getPlayerIdFromToken === 'function' && this.apiClient.getPlayerIdFromToken());

        const cached = (this.apiClient && typeof this.apiClient.getCachedFootprints === 'function')
          ? this.apiClient.getCachedFootprints(playerId)
          : null;

        const cachedMonth = cached && (cached.monthSummary || cached.monthly || cached.month);
        const isStaleMonth = Boolean(cachedMonth && cachedMonth.monthKey && cachedMonth.monthKey !== currentMonthKey);

        if (cachedMonth && !isStaleMonth && typeof cachedMonth.fullAttendanceDays === 'number' && !isNaN(cachedMonth.fullAttendanceDays)) {
          baseDays = cachedMonth.fullAttendanceDays;
          this.baseFullAttendanceDays = baseDays;
          this.baseFullAttendanceMonthKey = currentMonthKey;
        } else if (!isStaleMonth && this.baseFullAttendanceDays !== null && this.baseFullAttendanceDays !== undefined && this.baseFullAttendanceMonthKey === currentMonthKey) {
          baseDays = this.baseFullAttendanceDays;
        }
      }

      // 核心架構原則：後端與快取只結算至昨天，今日全勤一律由前端水合純粹加上
      const finalDays = baseDays + (isTodayLocallyFull ? 1 : 0);

      const count = Math.max(0, Number(finalDays || 0));
      el.textContent = `${count} 天`;
      if (this.currentUserProfile) {
        this.currentUserProfile.fullAttendanceDays = count;
        this.currentUserProfile.fullAttendanceMonthKey = currentMonthKey;
      }
    }

    renderSettlingBadges_() {
      if (typeof document === 'undefined') return;
      const curDate = this.currentDate || this.getTodayDateString();
      const yesterdayStr = this.getYesterdayDateString(curDate);
      const lastSettledDate = (this.currentUserProfile && this.currentUserProfile._lastSettledDate) || '';
      const isYesterdaySettled = Boolean(lastSettledDate && lastSettledDate >= yesterdayStr);
      this.isSettlingYesterday = lastSettledDate ? !isYesterdaySettled : false;

      const pSyncEl = document.getElementById('homePersonalSyncText');
      const cSyncEl = document.getElementById('homeContributionSyncText');
      const isSettling = Boolean(this.isSettlingYesterday);

      [pSyncEl, cSyncEl].forEach(el => {
        if (!el) return;
        if (isSettling) {
          el.textContent = '⏳ 結算中';
          el.className = 'score-sync-badge is-settling';
          if (el.classList && typeof el.classList.add === 'function') el.classList.add('is-settling');
          el.title = '系統正在進行昨日操練結算，已為您暫存最新累計點數';
          if (typeof el.removeAttribute === 'function') el.removeAttribute('hidden');
          el.hidden = false;
        } else {
          el.className = 'score-sync-badge';
          if (el.classList && typeof el.classList.remove === 'function') el.classList.remove('is-settling');
          if (typeof el.setAttribute === 'function') el.setAttribute('hidden', '');
          el.hidden = true;
          el.textContent = '';
        }
      });
    }

    refreshScoresDisplay(userProfile = null) {
      if (userProfile) {
        this.currentUserProfile = { ...this.currentUserProfile, ...userProfile };
      }
      if (!this.currentUserProfile) return;

      // 正式分數直接反映已結算權威值（不再疊加 localDelta）
      const personalPoints = Number(this.currentUserProfile.personalPoints || 0);
      const personalEl = (typeof document !== 'undefined') ? document.getElementById('homePersonalScoreText') : null;
      if (personalEl) personalEl.textContent = personalPoints.toLocaleString();

      if (this.currentUserProfile.groupId) {
        const contribPoints = Number(this.currentUserProfile.contributionPoints || 0);
        const contribEl = (typeof document !== 'undefined') ? document.getElementById('homeContributionText') : null;
        if (contribEl) contribEl.textContent = contribPoints.toLocaleString();
      } else {
        this.currentUserProfile.contributionPoints = 0;
        const contribEl = (typeof document !== 'undefined') ? document.getElementById('homeContributionText') : null;
        if (contribEl) contribEl.textContent = '0';
      }

      this.renderPendingChips_();
      this.renderSettlingBadges_();
    }

    applyOptimisticPointsDelta_(key, isDone, type) {
      // 在新架構下，正式分數保持昨日權威結算值，待結算膠囊即時反映點擊增減
      this.renderPendingChips_();
    }

    updatePracticeLockState_(lockReason) {
      this.isPracticeLocked = Boolean(lockReason);
      this.practiceLockReason = lockReason || '';

      const selectors = [
        '#homeMorningBtn',
        '#homeBibleBtn',
        '#homePrayerPracticeBtn',
        '#homeBookBtn',
        '#homeWeeklySmallGroupBtn',
        '#homeWeeklyPrayerMeetingBtn',
        '#homeWeeklyLordDayBtn',
        '#homeOutreachVisitBtn'
      ];

      selectors.forEach(sel => {
        const btn = document.querySelector(sel);
        if (btn) {
          btn.disabled = this.isPracticeLocked;
          btn.classList.toggle('is-locked', this.isPracticeLocked);
          if (this.isPracticeLocked) {
            btn.setAttribute('title', lockReason);
            btn.style.opacity = '';
            btn.style.pointerEvents = '';
            btn.style.filter = '';
          } else {
            btn.removeAttribute('title');
          }
        }
      });

      const groupEl = document.getElementById('homeGroupName');
      if (groupEl) {
        groupEl.style.cursor = this.isPracticeLocked ? 'pointer' : '';
      }

      // 登入首頁時，若不符合條件，直接彈出提示視窗（每 Session 僅主動提醒一次避免反覆打擾）
      if (this.isPracticeLocked && !this.hasPromptedGroupLock) {
        this.hasPromptedGroupLock = true;
        this.openGroupPracticeRequiredModal(lockReason);
      }
    }

    openGroupPracticeRequiredModal(lockReason) {
      if (this.apiClient && typeof this.apiClient.getSessionToken === 'function' && !this.apiClient.getSessionToken()) return;
      if (!this.infoModal) return;
      if (this.infoModalTitle) {
        this.infoModalTitle.textContent = '需要活力組同行';
      }
      if (this.infoModalContent) {
        this.infoModalContent.innerHTML = `
          <div style="text-align:center; padding:24px 12px 16px; display:flex; flex-direction:column; align-items:center; gap:16px;">
            <div style="font-size:3rem; line-height:1;">🌱</div>
            <div style="font-size:1.02rem; font-weight:600; line-height:1.65; color:#334155; max-width:320px;">
              ${this.escapeHtml_(lockReason)}
            </div>
            <div style="display:flex; gap:10px; margin-top:8px; width:100%; max-width:280px; justify-content:center; align-items:stretch;">
              <button id="goToProfileFromLockBtn" class="primary-btn" type="button" style="padding:8px 12px; border-radius:12px; font-weight:700; flex:1; font-size:0.95rem; line-height:1.3; text-align:center;">
                前往<br>我的專屬頁
              </button>
              <button class="ghost-btn" data-close-modal="infoModal" type="button" style="padding:8px 12px; border-radius:12px; font-weight:600; font-size:0.95rem; flex:1; display:flex; align-items:center; justify-content:center;">
                我知道了
              </button>
            </div>
          </div>
        `;

        const goBtn = this.infoModalContent.querySelector('#goToProfileFromLockBtn');
        if (goBtn) {
          goBtn.addEventListener('click', () => {
            if (this.infoModal) this.infoModal.classList.add('hidden');
            const navMyBtn = document.getElementById('navMyBtn');
            if (navMyBtn) {
              navMyBtn.click();
            } else if (typeof this.onFootprintClick === 'function') {
              this.onFootprintClick();
            }
          });
        }

        this.infoModalContent.querySelectorAll('[data-close-modal="infoModal"]').forEach(btn => {
          btn.addEventListener('click', () => {
            if (this.infoModal) this.infoModal.classList.add('hidden');
          });
        });
      }

      this.infoModal.classList.remove('hidden');
    }

    escapeHtml_(str) {
      if (typeof VitalUtils !== 'undefined' && VitalUtils.escapeHtml) {
        return VitalUtils.escapeHtml(str);
      }
      return String(str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DashboardView };
  }
  global.DashboardView = DashboardView;

})(typeof window !== 'undefined' ? window : global);
