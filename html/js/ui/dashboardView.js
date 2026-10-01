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
    constructor({ practiceStore, apiClient, onFootprintClick, onChestClick, onRefresh, onLogout, onGroupJourneyListClick, onContributionClick }) {
      this.practiceStore = practiceStore;
      this.apiClient = apiClient;
      this.onFootprintClick = onFootprintClick;
      this.onChestClick = onChestClick;
      this.onRefresh = onRefresh;
      this.onLogout = onLogout;
      this.onGroupJourneyListClick = onGroupJourneyListClick;
      this.onContributionClick = onContributionClick;

      this.currentUserProfile = null;
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

    setSyncLock(isLocked) {
      this.isSyncing = isLocked;
      const btns = document.querySelectorAll('.quest-card');
      btns.forEach(btn => {
        btn.style.opacity = isLocked ? '0.6' : '1';
        btn.style.pointerEvents = isLocked ? 'none' : 'auto';
        btn.style.filter = isLocked ? 'grayscale(0.5)' : 'none';
      });
    }

    getCurrentWeekKey() {
      const now = new Date();
      const year = now.getFullYear();
      const start = new Date(year, 0, 1);
      const days = Math.floor((now - start) / (24 * 60 * 60 * 1000));
      const week = Math.ceil((days + start.getDay() + 1) / 7);
      return `${year}-W${String(week).padStart(2, '0')}`;
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

      // 旅程軌道各節點點擊（亦對應八階篇章與寶箱）
      document.querySelectorAll('#homeJourneyNodes .journey-node').forEach((node, idx) => {
        node.addEventListener('click', () => {
          if (typeof this.onChestClick === 'function') this.onChestClick(idx);
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
    }

    subscribeStore_() {
      this.practiceStore.onStateChange = ({ type, key, state }) => {
        if (type === 'DAILY' && key === this.currentDate) {
          this.renderDailyPracticeState(state);
        } else if (type === 'MEETING' && key === this.currentWeekKey) {
          this.renderMeetingPracticeState(state);
        }
      };
    }

    render(userProfile, journeyData, announcements = null) {
      if (!userProfile) return;
      this.currentUserProfile = userProfile;

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

      // 【個人點數】（整年操練分 + 歷史結算沉澱分 personalPoints）
      const personalPoints = userProfile.personalPoints !== undefined 
        ? userProfile.personalPoints 
        : (userProfile.totalPoints !== undefined ? userProfile.totalPoints : (userProfile.totalScore || 0));
      const personalEl = document.getElementById('homePersonalScoreText');
      if (personalEl) personalEl.textContent = Number(personalPoints || 0).toLocaleString();

      // 【貢獻點數】（在目前組別累積貢獻點 contributionPoints）
      const contribution = userProfile.contributionPoints !== undefined 
        ? userProfile.contributionPoints 
        : (userProfile.contribution !== undefined ? userProfile.contribution : 0);
      const contribEl = document.getElementById('homeContributionText');
      if (contribEl) contribEl.textContent = Number(contribution || 0).toLocaleString();

      const streakEl = document.getElementById('homeStreakText');
      if (streakEl) streakEl.textContent = `${userProfile.streakDays || 0} 天`;

      const memberCountEl = document.getElementById('homeMemberCountText');
      if (memberCountEl) {
        const hasGroup = Boolean(userProfile && userProfile.groupId);
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
        memberCountEl.textContent = String(mCount);
      }

      // 3. 八大篇章成長旅程
      this.renderJourneyNodes_(journeyData);

      // 4. 公告呈現 (若未傳入 announcements 則維持現有快取，絕不誤清空)
      if (Array.isArray(announcements) && announcements.length > 0) {
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
    }

    renderJourneyNodes_(journeyData) {
      if (!journeyData && typeof localStorage !== 'undefined') {
        try {
          journeyData = JSON.parse(localStorage.getItem('vital_group_journey') || 'null');
        } catch (e) {}
      }

      const currentChapter = (journeyData && journeyData.currentChapter) || 1;
      const chapterIdx = Math.max(1, Math.min(8, Number(currentChapter))) - 1;
      const chapterName = CHAPTER_NAMES[chapterIdx] || '信心';

      const titleEl = document.getElementById('homeJourneyChapterText');
      if (titleEl) titleEl.textContent = chapterName;

      const progressPercent = (journeyData && journeyData.progressPercent) || 0;
      const progressText = document.getElementById('homeJourneyProgressText');
      if (progressText) progressText.textContent = `${Math.min(100, Math.round(progressPercent))}%`;

      const nextText = document.getElementById('homeJourneyNextText');
      if (nextText) {
        const nextChapterName = CHAPTER_NAMES[Math.min(7, chapterIdx + 1)];
        const target = (journeyData && journeyData.targetPoints) || 500;
        nextText.textContent = chapterIdx < 7
          ? `距離【${nextChapterName}】篇章還有 ${target.toLocaleString()} 點`
          : '已達最高榮耀篇章【愛】！';
      }

      // 更新軌道節點高亮
      document.querySelectorAll('#homeJourneyNodes .journey-node').forEach((node, idx) => {
        if (idx === chapterIdx) {
          node.classList.add('active');
        } else {
          node.classList.remove('active');
        }
      });

      // 5. 渲染操練卡說明與點數
      this.renderTaskCards(this.pointsConfig);
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

      // 今日操練四項
      this.updateTaskCard_('homeMorningBtn', '晨', '小組晨興', `合作取得 +${morningPts}`);
      this.updateTaskCard_('homeBibleBtn', '讀', '個人讀經', `個人貢獻 +${biblePts}`);
      this.updateTaskCard_('homePrayerPracticeBtn', '禱', '個人禱告', `個人貢獻 +${prayerPts}`);
      this.updateTaskCard_('homeBookBtn', '書', '個人書報', `個人貢獻 +${bookPts}`);

      // 每週操練四項
      this.updateTaskCard_('homeOutreachVisitBtn', '訪', '外出探訪', `合作取得 +${outreachPts}`);
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

      // 依總分由高至低排序
      const sorted = [...groups].sort((a, b) => {
        const scoreA = Number(a.totalScore || a.totalPoints || 0);
        const scoreB = Number(b.totalScore || b.totalPoints || 0);
        return scoreB - scoreA;
      });

      const currentGroupId = this.currentUserProfile && this.currentUserProfile.groupId;
      const rankIcons = ['🥇', '🥈', '🥉'];

      const html = `
        <div style="display:flex; flex-direction:column; gap:12px; max-height:60vh; overflow-y:auto; padding:4px;">
          ${sorted.map((grp, idx) => {
            const isMyGroup = Boolean(currentGroupId && grp.groupId === currentGroupId);
            const rankBadge = idx < 3 ? rankIcons[idx] : `<span style="font-size:0.95rem;color:#64748b;font-weight:700;">#${idx + 1}</span>`;
            const score = Number(grp.totalScore || grp.totalPoints || 0);
            const chapter = grp.currentChapter || {};
            const chapterName = chapter.title || chapter.name || CHAPTER_NAMES[chapter.index || 0] || '信心';
            const progressPercent = Math.min(100, Math.round(grp.progressPercent || (grp.journey && grp.journey.progressPercent) || 0));

            return `
              <div style="background:${isMyGroup ? '#ecfdf5' : '#ffffff'}; border:2px solid ${isMyGroup ? '#10b981' : '#e2e8f0'}; border-radius:14px; padding:12px 16px; box-shadow:0 2px 4px rgba(0,0,0,0.04); display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <div style="font-size:1.25rem; font-weight:700; width:30px; text-align:center; display:flex; align-items:center; justify-content:center;">${rankBadge}</div>
                    <strong style="font-size:1.05rem; color:#1e293b;">${this.escapeHtml_(grp.groupName || '未命名小組')}</strong>
                    ${isMyGroup ? '<span style="font-size:0.75rem; background:#10b981; color:#ffffff; padding:2px 8px; border-radius:12px; font-weight:600;">您的小組</span>' : ''}
                  </div>
                  <div style="font-weight:700; color:#d97706; font-size:1.1rem;">
                    ${score.toLocaleString()} <span style="font-size:0.8rem; font-weight:normal; color:#64748b;">點</span>
                  </div>
                </div>
                
                <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; color:#475569;">
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span style="background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:6px; font-weight:600; font-size:0.8rem;">篇章</span>
                    <span style="font-weight:600;">【${this.escapeHtml_(chapterName)}】</span>
                  </div>
                  <div>
                    <span>進度 ${progressPercent}%</span>
                  </div>
                </div>

                <div style="width:100%; height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden;">
                  <div style="width:${progressPercent}%; height:100%; background:linear-gradient(90deg, #f59e0b, #10b981); border-radius:4px; transition:width 0.3s ease;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      this.infoModalContent.innerHTML = html;
    }

    applyOptimisticPointsDelta_(key, isDone, type) {
      if (!this.currentUserProfile) return;

      const cfg = this.pointsConfig || DEFAULT_POINTS_CONFIG;
      let pts = 0;

      if (type === 'DAILY') {
        if (key === 'morning') pts = Number(cfg.morning || 50);
        else if (key === 'bible') pts = Number(cfg.bible || 30);
        else if (key === 'prayer') pts = Number(cfg.prayer || 30);
        else if (key === 'book') pts = Number(cfg.book || 30);
      } else if (type === 'MEETING') {
        if (key === 'smallGroup') pts = Number(cfg.group !== undefined ? cfg.group : (cfg.smallGroup || 30));
        else if (key === 'prayerMeeting') pts = Number(cfg.prayerMtg !== undefined ? cfg.prayerMtg : (cfg.prayerMeeting || 50));
        else if (key === 'lordDayMeeting') pts = Number(cfg.lordDay !== undefined ? cfg.lordDay : (cfg.lordDayMeeting || 50));
        else if (key === 'outreachVisit') pts = Number(cfg.outreach !== undefined ? cfg.outreach : (cfg.outreachVisit || 100));
      }

      if (pts === 0) return;
      const delta = isDone ? pts : -pts;

      // 1. 更新【個人點數】（永遠累計）
      const currentPersonal = Number(
        this.currentUserProfile.personalPoints !== undefined
          ? this.currentUserProfile.personalPoints
          : (this.currentUserProfile.totalPoints !== undefined ? this.currentUserProfile.totalPoints : (this.currentUserProfile.totalScore || 0))
      );
      const nextPersonal = Math.max(0, currentPersonal + delta);
      this.currentUserProfile.personalPoints = nextPersonal;
      if (this.currentUserProfile.totalPoints !== undefined) this.currentUserProfile.totalPoints = nextPersonal;
      if (this.currentUserProfile.totalScore !== undefined) this.currentUserProfile.totalScore = nextPersonal;

      const personalEl = document.getElementById('homePersonalScoreText');
      if (personalEl) personalEl.textContent = nextPersonal.toLocaleString();

      // 2. 更新【貢獻點數】（若已加入活力組，則同仁在小組內的年度貢獻亦同步累計）
      const hasGroup = Boolean(this.currentUserProfile.groupId);
      if (hasGroup) {
        const currentContrib = Number(
          this.currentUserProfile.contributionPoints !== undefined
            ? this.currentUserProfile.contributionPoints
            : (this.currentUserProfile.contribution !== undefined ? this.currentUserProfile.contribution : 0)
        );
        const nextContrib = Math.max(0, currentContrib + delta);
        this.currentUserProfile.contributionPoints = nextContrib;
        if (this.currentUserProfile.contribution !== undefined) this.currentUserProfile.contribution = nextContrib;

        const contribEl = document.getElementById('homeContributionText');
        if (contribEl) contribEl.textContent = nextContrib.toLocaleString();
      }

      // 3. 同步至 LocalStorage 快取，防止重新整理回滾
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('vital_current_player', JSON.stringify(this.currentUserProfile));
        } catch (e) {}
      }
    }

    escapeHtml_(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DashboardView };
  }
  global.DashboardView = DashboardView;

})(typeof window !== 'undefined' ? window : global);
