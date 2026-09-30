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

      this.infoModal = document.getElementById('infoModal');
      this.infoModalTitle = document.getElementById('infoModalTitle');
      this.infoModalContent = document.getElementById('infoModalContent');

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
            if (this.isSyncing) return;
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
      const contribCard = document.querySelector('.hero-score-card.hero-contribution');
      if (contribCard) {
        contribCard.style.cursor = 'pointer';
        contribCard.addEventListener('click', () => {
          if (typeof this.onContributionClick === 'function') this.onContributionClick();
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

      // 【個人點數】（當年度個人操練分 + 歷年歷史分）
      const personalPoints = userProfile.personalPoints !== undefined 
        ? userProfile.personalPoints 
        : (userProfile.totalPoints !== undefined ? userProfile.totalPoints : (userProfile.totalScore || 0));
      const personalEl = document.getElementById('homePersonalScoreText');
      if (personalEl) personalEl.textContent = Number(personalPoints || 0).toLocaleString();

      // 【貢獻點數】（在當前活力組累積貢獻點數 contributionPoints）
      const contribution = userProfile.contributionPoints !== undefined 
        ? userProfile.contributionPoints 
        : (userProfile.contribution !== undefined ? userProfile.contribution : 0);
      const contribEl = document.getElementById('homeContributionText');
      if (contribEl) contribEl.textContent = Number(contribution || 0).toLocaleString();

      // 兼容舊版 groupScoreEl
      const groupScoreEl = document.getElementById('homeGroupScoreText');
      if (groupScoreEl) groupScoreEl.textContent = Number(personalPoints || 0).toLocaleString();

      const streakEl = document.getElementById('homeStreakText');
      if (streakEl) streakEl.textContent = `${userProfile.streakDays || 0} 天`;

      const memberCountEl = document.getElementById('homeMemberCountText');
      if (memberCountEl) memberCountEl.textContent = String(userProfile.memberCount || (journeyData && journeyData.memberCount) || 1);

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
        weekDateEl.textContent = `週次：${this.currentWeekKey}`;
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
