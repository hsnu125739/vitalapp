/**
 * footprintsView.js
 * 個人同行足跡視圖深層模組 (Footprints View Deep Module)
 * 職責：
 * 1. 呈現本月 8 大成果指標卡（晨興、讀經、禱告、書報天數 + 小組、禱會、主日、相調次數與點數）
 * 2. 呈現過去 10 週之垂直可折疊時間軸，支援每週操練與聚會狀態、7 天打卡徽章明細
 * 3. 實作 SWR 載入（快取秒開 0ms，背景靜默更新）與骨架屏載入動畫
 * 4. 嚴格不含任何熱度圖 (Heatmap) 代碼
 */

(function(global) {
  'use strict';

  const escapeHtml = (typeof VitalUtils !== 'undefined' && VitalUtils.escapeHtml) ||
    global.escapeHtml ||
    ((str) => String(str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));

  function formatNumber(num) {
    const n = Number(num);
    return isNaN(n) ? '0' : n.toLocaleString('zh-TW');
  }

  const DAY_NAMES = ['', '週一', '週二', '週三', '週四', '週五', '週六', '主日'];
  const CHINESE_MONTHS = ['', '一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

  function getChineseMonthName(monthKey) {
    if (!monthKey || typeof monthKey !== 'string') return '本月';
    const parts = monthKey.split('-');
    if (parts.length >= 2) {
      const mNum = parseInt(parts[1], 10);
      if (mNum >= 1 && mNum <= 12) {
        return CHINESE_MONTHS[mNum];
      }
    }
    return '本月';
  }

  class FootprintsView {
    constructor({ apiClient } = {}) {
      this.apiClient = apiClient;
      this.infoModal = typeof document !== 'undefined' ? document.getElementById('infoModal') : null;
      this.infoModalTitle = typeof document !== 'undefined' ? document.getElementById('infoModalTitle') : null;
      this.infoModalContent = typeof document !== 'undefined' ? document.getElementById('infoModalContent') : null;
      this.currentData = null;
    }

    /**
     * 開啟同行足跡彈窗 (SWR 混合載入策略)
     */
    async openFootprintsModal(playerId = null) {
      if (this.infoModalTitle) {
        this.infoModalTitle.textContent = '👣 同行足跡與月度成果';
      }
      if (this.infoModal) {
        this.infoModal.classList.remove('hidden');
      }

      // 取得目標 Player ID
      let targetPlayerId = playerId;
      if (!targetPlayerId && typeof window !== 'undefined' && window.AppCoordinator && window.AppCoordinator.currentUserProfile) {
        targetPlayerId = window.AppCoordinator.currentUserProfile.playerId;
      }
      if (!targetPlayerId && typeof localStorage !== 'undefined') {
        try {
          const u = JSON.parse(localStorage.getItem('vital_current_player'));
          if (u && u.playerId) targetPlayerId = u.playerId;
        } catch (e) {}
      }
      this.lastTargetPlayerId = targetPlayerId;

      // 1. SWR 快取優先：若本地有快取，立即 0ms 秒開渲染
      let hasRenderedCache = false;
      if (this.apiClient && typeof this.apiClient.getCachedFootprints === 'function') {
        const cached = this.apiClient.getCachedFootprints(targetPlayerId);
        if (cached && (cached.weeks || cached.monthSummary || cached.monthly)) {
          this.render(cached);
          hasRenderedCache = true;
        }
      }

      // 2. 若無快取，顯示優雅的骨架屏載入動畫
      if (!hasRenderedCache) {
        this.renderSkeleton();
      }

      // 3. 背景非同步載入最新 10 週足跡數據 (Revalidate)
      if (this.apiClient && typeof this.apiClient.getFootprints === 'function') {
        try {
          const res = await this.apiClient.getFootprints({ playerId: targetPlayerId, weeks: 10 });
          if (res && res.success) {
            const freshData = res.data || res;
            this.render(freshData);
            // 若為 SWR 快取返回且帶有背景 revalidatePromise，等網路返回時無縫更新畫面
            if (res.revalidatePromise) {
              res.revalidatePromise.then(freshRes => {
                if (freshRes && freshRes.success) {
                  this.render(freshRes.data || freshRes);
                }
              }).catch(() => {});
            }
          } else if (!hasRenderedCache) {
            this.renderError(res ? res.error : '載入足跡資料失敗');
          }
        } catch (netErr) {
          if (!hasRenderedCache) {
            this.renderError(netErr.message || '網路連線異常，請稍後再試');
          }
        }
      }
    }

    /**
     * 骨架屏載入動畫
     */
    renderSkeleton() {
      if (!this.infoModalContent) return;
      this.infoModalContent.innerHTML = `
        <div class="footprint-dashboard">
          <section class="footprint-section">
            <div class="footprint-heading">
              <div class="footprint-skeleton-box" style="width: 120px; height: 22px;"></div>
              <div class="footprint-skeleton-box" style="width: 80px; height: 16px;"></div>
            </div>
            <div class="footprint-stats">
              <div class="footprint-skeleton-box" style="height: 68px;"></div>
              <div class="footprint-skeleton-box" style="height: 68px;"></div>
              <div class="footprint-skeleton-box" style="height: 68px;"></div>
              <div class="footprint-skeleton-box" style="height: 68px;"></div>
              <div class="footprint-skeleton-box" style="height: 68px;"></div>
              <div class="footprint-skeleton-box" style="height: 68px;"></div>
              <div class="footprint-skeleton-box" style="height: 68px;"></div>
              <div class="footprint-skeleton-box" style="height: 68px;"></div>
            </div>
          </section>
          <section class="footprint-section">
            <div class="footprint-heading">
              <div class="footprint-skeleton-box" style="width: 140px; height: 22px;"></div>
              <div class="footprint-skeleton-box" style="width: 70px; height: 16px;"></div>
            </div>
            <div class="footprint-route">
              <div class="footprint-skeleton-box" style="height: 72px;"></div>
              <div class="footprint-skeleton-box" style="height: 72px;"></div>
              <div class="footprint-skeleton-box" style="height: 72px;"></div>
            </div>
          </section>
        </div>
      `;
    }

    /**
     * 錯誤狀態渲染
     */
    renderError(errorMessage) {
      if (!this.infoModalContent) return;
      this.infoModalContent.innerHTML = `
        <div style="text-align: center; padding: 40px 16px; color: #ef4444;">
          <div style="font-size: 32px; margin-bottom: 8px;">⚠️</div>
          <p style="font-size: 14px; margin: 0;">${escapeHtml(errorMessage)}</p>
          <button type="button" class="btn btn-secondary footprint-retry-btn" style="margin-top: 16px; padding: 6px 16px; font-size: 13px;">重新嘗試</button>
        </div>
      `;
      const retryBtn = this.infoModalContent.querySelector('.footprint-retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          this.openFootprintsModal(this.lastTargetPlayerId);
        });
      }
    }

    /**
     * 主要渲染入口
     */
    render(dashboardData = {}) {
      if (!this.infoModalContent) return;
      this.currentData = dashboardData;

      // 記住使用者已手動展開的週次，避免 SWR 背景 Revalidate 重繪時被重設
      const expandedKeys = new Set();
      this.infoModalContent.querySelectorAll('.footprint-week.is-expanded').forEach(el => {
        const key = el.getAttribute('data-week-key');
        if (key) expandedKeys.add(key);
      });

      const monthSummary = dashboardData.monthSummary || dashboardData.monthly || dashboardData.month || {};
      const weeks = dashboardData.weeks || dashboardData.weekly || [];

      const html = `
        <div class="footprint-dashboard">
          ${this.renderMonthSection_(monthSummary)}
          ${this.renderTimelineSection_(weeks, expandedKeys)}
        </div>
      `;

      this.infoModalContent.innerHTML = html;
      this.bindEvents_();
    }

    /**
     * 計算當月全勤天數的防禦性回退（若後端或舊快取未帶 fullAttendanceDays）
     */
    calculateFullAttendanceDaysFallback_(monthKey) {
      if (!this.currentData || !monthKey) return 0;
      let count = 0;
      if (this.currentData.dailyRecords && typeof this.currentData.dailyRecords === 'object') {
        Object.keys(this.currentData.dailyRecords).forEach(dStr => {
          if (dStr.startsWith(monthKey)) {
            const r = this.currentData.dailyRecords[dStr];
            if (r && r.morning && r.bible && r.prayer && r.book) count++;
          }
        });
        return count;
      }
      if (Array.isArray(this.currentData.daily)) {
        this.currentData.daily.forEach(d => {
          const dStr = String(d.date || d.recordDate || '');
          if (dStr.startsWith(monthKey)) {
            const isFull = (d.morningCompleted || d.morningRevival || d.morning) &&
              (d.bibleCompleted || d.bibleReading || d.bible) &&
              (d.prayerCompleted || d.prayer) &&
              (d.readingCompleted || d.bookCompleted || d.bookPursuit || d.book);
            if (isFull) count++;
          }
        });
        return count;
      }
      if (Array.isArray(this.currentData.weeks)) {
        this.currentData.weeks.forEach(w => {
          if (Array.isArray(w.days)) {
            w.days.forEach(d => {
              const dStr = String(d.date || d.recordDate || '');
              if (dStr.startsWith(monthKey)) {
                const isFull = (d.morningCompleted || d.morningRevival || d.morning) &&
                  (d.bibleCompleted || d.bibleReading || d.bible) &&
                  (d.prayerCompleted || d.prayer) &&
                  (d.readingCompleted || d.bookCompleted || d.bookPursuit || d.book);
                if (isFull) count++;
              }
            });
          }
        });
        return count;
      }
      return 0;
    }

    /**
     * 本月 8 大成果指標卡區塊
     */
    renderMonthSection_(month) {
      const monthKey = month.monthKey || new Date().toISOString().slice(0, 7);
      const totalScore = Number(month.totalScore || month.totalPoints || 0);

      // 動態轉換月份中文名稱 (例如 '2026-10' -> '十月成果卡')
      const monthName = getChineseMonthName(monthKey);

      // 計算當月全勤天數 (四項每日操練皆完成)
      let fullAttendanceDays = 0;
      if (month.fullAttendanceDays !== undefined && month.fullAttendanceDays !== null) {
        fullAttendanceDays = Number(month.fullAttendanceDays || 0);
      } else if (month.perfectDays !== undefined && month.perfectDays !== null) {
        fullAttendanceDays = Number(month.perfectDays || 0);
      } else if (month.fullDays !== undefined && month.fullDays !== null) {
        fullAttendanceDays = Number(month.fullDays || 0);
      } else {
        fullAttendanceDays = this.calculateFullAttendanceDaysFallback_(monthKey);
      }

      // 8 大成果項目定義 (4 每日操練天數 + 4 每週聚會次數)
      const statsList = [
        { label: '晨興天數', value: month.morningDays || 0, icon: '🌅', unit: '天' },
        { label: '讀經天數', value: month.bibleDays || 0, icon: '📖', unit: '天' },
        { label: '禱告天數', value: month.prayerDays || 0, icon: '🙏', unit: '天' },
        { label: '書報天數', value: month.bookDays || month.readingDays || 0, icon: '📚', unit: '天' },
        { label: '小排聚會', value: month.groupMeetingCount || month.groupDays || 0, icon: '👥', unit: '次' },
        { label: '禱告聚會', value: month.prayerMeetingCount || month.prayerMeetingDays || 0, icon: '🔥', unit: '次' },
        { label: '主日聚會', value: month.lordDayMeetingCount || month.lordDayDays || 0, icon: '🍞', unit: '次' },
        { label: '相調探訪', value: month.visitCount || 0, icon: '🤝', unit: '次' }
      ];

      const statsCards = statsList.map(item => `
        <article class="footprint-stat" title="${item.label}：${formatNumber(item.value)} ${item.unit}">
          <span class="stat-icon" aria-hidden="true">${item.icon}</span>
          <strong>${formatNumber(item.value)}</strong>
          <small>${escapeHtml(item.label)}</small>
        </article>
      `).join('');

      return `
        <section class="footprint-section">
          <div class="footprint-heading">
            <h3>🏆 ${monthName}成果卡 <span>(${escapeHtml(monthKey)})</span></h3>
            <span>累計 ⭐ <strong>${formatNumber(totalScore)}</strong> 點 · 全勤 🔥 ${formatNumber(fullAttendanceDays)} 天</span>
          </div>
          <div class="footprint-stats">
            ${statsCards}
          </div>
        </section>
      `;
    }

    /**
     * 10 週時間軸與路線清單區塊 (垂直折疊)
     */
    renderTimelineSection_(weeks, expandedKeys = new Set()) {
      if (!Array.isArray(weeks) || weeks.length === 0) {
        return `
          <section class="footprint-section">
            <div class="footprint-heading">
              <h3>🧭 每週足跡路線</h3>
              <span>最近 10 週</span>
            </div>
            <div style="text-align: center; padding: 24px; color: var(--ink-soft, #888); font-size: 13px;">
              目前尚無操練足跡資料，立即開啟首頁操練吧！
            </div>
          </section>
        `;
      }

      const hasExplicitCurrent = weeks.some(wk => Boolean(wk.isCurrentWeek));
      const weekArticles = weeks.map((w, index) => {
        const isCurrent = Boolean(w.isCurrentWeek || (index === 0 && !hasExplicitCurrent));
        const completedDays = Number(w.completedDays || 0);
        const isHigh = completedDays >= 5;
        const isPartial = completedDays > 0;
        const weekStateClass = isCurrent ? 'is-current' : (isHigh ? 'is-high' : (isPartial ? 'is-partial' : ''));
        const markerSymbol = isHigh ? '★' : (isPartial ? '●' : '○');
        const isExpanded = isCurrent || expandedKeys.has(w.weekKey);
        const defaultExpanded = isExpanded ? 'is-expanded' : '';

        // 聚會完成標記摘要文字
        const groupDone = Boolean(w.groupMeetingCompleted || (w.meeting && (w.meeting.smallGroup || w.meeting.group)));
        const prayerDone = Boolean(w.prayerMeetingCompleted || (w.meeting && (w.meeting.prayerMeeting || w.meeting.prayerMtg)));
        const lordDayDone = Boolean(w.lordDayCompleted || (w.meeting && (w.meeting.lordDayMeeting || w.meeting.lordDay)));
        const visitDone = Boolean(w.visitCompleted || (w.meeting && (w.meeting.outreachVisit || w.meeting.outreach || w.meeting.mutual)));

        const meetingSummaryParts = [
          groupDone ? '✅ 小排' : '▫️ 小排',
          prayerDone ? '✅ 禱會' : '▫️ 禱會',
          lordDayDone ? '✅ 主日' : '▫️ 主日',
          visitDone ? '✅ 探訪' : '▫️ 探訪'
        ];

        // 7 天清單列
        const days = Array.isArray(w.days) ? w.days : [];
        const daysRows = days.map(d => {
          const dName = DAY_NAMES[d.dayOfWeek] || '';
          const dDate = String(d.date || d.recordDate || '').slice(5).replace('-', '/');
          const isToday = Boolean(d.isToday);
          const score = Number(d.dailyScore || 0);

          const mActive = Boolean(d.morningCompleted || d.morningRevival || d.morning);
          const bActive = Boolean(d.bibleCompleted || d.bibleReading || d.bible);
          const pActive = Boolean(d.prayerCompleted || d.prayer);
          const rActive = Boolean(d.readingCompleted || d.bookCompleted || d.bookPursuit || d.book);

          return `
            <div class="footprint-day-row ${isToday ? 'is-today' : ''}">
              <div class="footprint-day-left">
                <span class="footprint-day-name">${dName}</span>
                <span class="footprint-day-date">${dDate}${isToday ? ' (今)' : ''}</span>
              </div>
              <div class="footprint-badges">
                <span class="footprint-badge ${mActive ? 'is-active' : ''}" title="晨興：${mActive ? '已完成' : '未打卡'}">晨</span>
                <span class="footprint-badge ${bActive ? 'is-active' : ''}" title="讀經：${bActive ? '已完成' : '未打卡'}">讀</span>
                <span class="footprint-badge ${pActive ? 'is-active' : ''}" title="禱告：${pActive ? '已完成' : '未打卡'}">禱</span>
                <span class="footprint-badge ${rActive ? 'is-active' : ''}" title="書報：${rActive ? '已完成' : '未打卡'}">書</span>
              </div>
              <div class="footprint-day-score">
                ${score > 0 ? `+${score}` : '+0'}
              </div>
            </div>
          `;
        }).join('');

        return `
          <article class="footprint-week ${weekStateClass} ${defaultExpanded}" data-week-key="${escapeHtml(w.weekKey)}">
            <div class="footprint-week-summary" role="button" tabindex="0" aria-expanded="${isExpanded ? 'true' : 'false'}" aria-label="切換 ${escapeHtml(w.weekLabel || w.weekKey)} 操練明細">
              <div class="footprint-week-marker" aria-hidden="true">${markerSymbol}</div>
              <div class="footprint-week-info">
                <h4>
                  ${escapeHtml(w.weekLabel || w.weekKey)} 
                  <span style="font-weight: normal; color: var(--ink-soft, #777); font-size: 12px;">(${escapeHtml(w.dateRange || '')})</span>
                  ${isCurrent ? '<span class="current-badge">本週</span>' : ''}
                </h4>
                <p>
                  📖 ${w.bibleDays || 0}天 · 🙏 ${w.prayerDays || 0}天 · 🌅 ${w.morningDays || 0}天 · 📚 ${w.readingDays || w.bookDays || 0}天
                </p>
                <p style="margin-top: 2px;">
                  ${meetingSummaryParts.join('　')}
                </p>
              </div>
              <div class="footprint-week-points">
                <strong>+${formatNumber(w.weeklyScore || w.totalWeekPoints || 0)} 點</strong>
                <span class="footprint-toggle-icon" aria-hidden="true">▼</span>
              </div>
            </div>
            <div class="footprint-week-days">
              ${daysRows}
            </div>
          </article>
        `;
      }).join('');

      return `
        <section class="footprint-section">
          <div class="footprint-heading">
            <h3>🧭 每週足跡路線</h3>
            <span>近 10 週</span>
          </div>
          <div class="footprint-route">
            ${weekArticles}
          </div>
        </section>
      `;
    }

    /**
     * 綁定折疊與無障礙互動事件
     */
    bindEvents_() {
      if (!this.infoModalContent) return;
      const summaries = this.infoModalContent.querySelectorAll('.footprint-week-summary');

      summaries.forEach(summary => {
        const toggle = () => {
          const weekCard = summary.closest('.footprint-week');
          if (!weekCard) return;
          const isExpanded = weekCard.classList.toggle('is-expanded');
          summary.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
        };

        summary.addEventListener('click', toggle);
        summary.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        });
      });
    }
  }

  FootprintsView.getChineseMonthName = getChineseMonthName;

  // 模組與全域導出
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FootprintsView };
  }
  global.FootprintsView = FootprintsView;

})(typeof window !== 'undefined' ? window : global);
