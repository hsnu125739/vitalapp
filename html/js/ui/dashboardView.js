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

  class DashboardView {
    constructor({ practiceStore, apiClient, onFootprintClick, onChestClick, onRefresh, onLogout }) {
      this.practiceStore = practiceStore;
      this.apiClient = apiClient;
      this.onFootprintClick = onFootprintClick;
      this.onChestClick = onChestClick;
      this.onRefresh = onRefresh;
      this.onLogout = onLogout;

      this.currentDate = this.getTodayDateString();
      this.currentWeekKey = this.getCurrentWeekKey();

      this.initEvents_();
      this.subscribeStore_();
    }

    getTodayDateString() {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
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
            this.practiceStore.toggleDailyPractice(this.currentDate, key);
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
            this.practiceStore.toggleMeetingPractice(this.currentWeekKey, key);
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

    render(userProfile, journeyData, announcements = []) {
      if (!userProfile) return;

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

      const personalPoints = userProfile.totalPoints !== undefined ? userProfile.totalPoints : (userProfile.totalScore || 0);
      const contribEl = document.getElementById('homeContributionText');
      if (contribEl) contribEl.textContent = personalPoints.toLocaleString();

      const groupScore = (journeyData && (journeyData.totalPoints || journeyData.totalScore)) || 0;
      const groupScoreEl = document.getElementById('homeGroupScoreText');
      if (groupScoreEl) groupScoreEl.textContent = groupScore.toLocaleString();

      const streakEl = document.getElementById('homeStreakText');
      if (streakEl) streakEl.textContent = `${userProfile.streakDays || 0} 天`;

      const memberCountEl = document.getElementById('homeMemberCountText');
      if (memberCountEl) memberCountEl.textContent = String(userProfile.memberCount || (journeyData && journeyData.memberCount) || 1);

      // 3. 八大篇章成長旅程
      this.renderJourneyNodes_(journeyData);

      // 4. 公告呈現
      this.renderAnnouncements_(announcements);

      // 5. 本週任務週次與日期標籤
      const weekDateEl = document.getElementById('homeWeeklyDateText');
      if (weekDateEl) {
        weekDateEl.textContent = `週次：${this.currentWeekKey}`;
      }
    }

    renderJourneyNodes_(journeyData) {
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
    }

    renderAnnouncements_(announcements) {
      const container = document.getElementById('homeHeroAnnouncements');
      if (!container) return;

      if (!Array.isArray(announcements) || announcements.length === 0) {
        container.innerHTML = '<div class="hero-announcement-item">今日無重大公告，願主與你同行</div>';
        return;
      }

      container.innerHTML = announcements.map(a => `
        <div class="hero-announcement-item">
          <strong>${a.isPinned ? '<span style="color:#d97706;font-weight:700;margin-right:4px;">[置頂]</span>' : ''}${this.escapeHtml_(a.title || '系統公告')}</strong>
          <span style="opacity:0.85; margin-left:6px;">${this.escapeHtml_(a.content || '')}</span>
        </div>
      `).join('');
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
