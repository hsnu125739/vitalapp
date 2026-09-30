/**
 * footprintsView.js
 * 個人同行足跡視圖深層模組 (Footprints View Deep Module)
 * 負責：呈現連續 30 天個人操練足跡與近 4 週每週聚會紀錄
 */

(function(global) {
  'use strict';

  class FootprintsView {
    constructor({ apiClient }) {
      this.apiClient = apiClient;

      this.infoModal = document.getElementById('infoModal');
      this.infoModalTitle = document.getElementById('infoModalTitle');
      this.infoModalContent = document.getElementById('infoModalContent');
    }

    openFootprintsModal() {
      if (this.infoModalTitle) this.infoModalTitle.textContent = '👣 個人同行足跡（近 30 天）';
      if (this.infoModal) this.infoModal.classList.remove('hidden');

      if (this.infoModalContent) {
        this.infoModalContent.innerHTML = '<div style="text-align:center;padding:30px;color:#64748b;">讀取中...</div>';
      }

      try {
        let pId = null;
        if (typeof window !== 'undefined' && window.AppCoordinator && window.AppCoordinator.currentUserProfile) {
          pId = window.AppCoordinator.currentUserProfile.playerId;
        } else {
          try { pId = JSON.parse(localStorage.getItem('vital_current_player')).playerId; } catch(e){}
        }

        let dailyRecords = {};
        let meetingRecords = {};
        if (pId && typeof localStorage !== 'undefined') {
          const stored = localStorage.getItem(`vital_daily_records_${pId}`);
          if (stored) {
            dailyRecords = JSON.parse(stored);
          }
          const storedMeeting = localStorage.getItem(`vital_meeting_records_${pId}`);
          if (storedMeeting) {
            meetingRecords = JSON.parse(storedMeeting);
          }
        }

        // 輔助函式：取得某個日期當週的主日 (Sunday) 日期字串 (YYYY-MM-DD)
        const getSundayOfWeekStr = (d) => {
          const day = d.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
          const diffToSunday = day === 0 ? 0 : (7 - day);
          const sun = new Date(d.getTime() + diffToSunday * 86400000);
          const y = sun.getFullYear();
          const m = String(sun.getMonth() + 1).padStart(2, '0');
          const dayStr = String(sun.getDate()).padStart(2, '0');
          return `${y}-${m}-${dayStr}`;
        };

        // 輔助函式：計算 WeekKey
        const getWeekKeyOfDate = (d) => {
          const year = d.getFullYear();
          const start = new Date(year, 0, 1);
          const days = Math.floor((d - start) / (24 * 60 * 60 * 1000));
          const week = Math.ceil((days + start.getDay() + 1) / 7);
          return `${year}-W${String(week).padStart(2, '0')}`;
        };

        const weekdays = ['主日', '週一', '週二', '週三', '週四', '週五', '週六'];
        const list = [];
        const weeksAdded = new Set();
        const today = new Date();

        // 1. 連續生成近 30 天
        for (let i = 0; i < 30; i++) {
          const curD = new Date(today.getTime() - i * 86400000);
          const y = curD.getFullYear();
          const m = String(curD.getMonth() + 1).padStart(2, '0');
          const dayNum = String(curD.getDate()).padStart(2, '0');
          const dStr = `${y}-${m}-${dayNum}`;
          
          const weekKey = getWeekKeyOfDate(curD);
          const sunStr = getSundayOfWeekStr(curD);

          // 當遇到新的一週時，在該週主日上方插入「週聚會紀錄」
          if (!weeksAdded.has(weekKey)) {
            weeksAdded.add(weekKey);
            const mtgUnpacked = meetingRecords[weekKey] || {
              group: false, prayerMtg: false, lordDay: false, outreach: false, points: 0
            };
            list.push({
              isWeekly: true,
              date: `${weekKey} 週聚會紀錄`,
              sortKey: `${sunStr}_week`, // 確保降冪排序時排在該週主日上方
              ...mtgUnpacked
            });
          }

          // 每日操練項目（若無紀錄則預設為空 +0分）
          const dailyUnpacked = dailyRecords[dStr] || {
            morning: false, bible: false, prayer: false, book: false, points: 0
          };
          const wName = weekdays[curD.getDay()];
          list.push({
            isWeekly: false,
            date: `${dStr} (${wName})`,
            sortKey: dStr,
            ...dailyUnpacked
          });
        }

        // 2. 確保近 4 週若有未覆蓋之較早週次也列出
        for (const [wStr, mtgUnpacked] of Object.entries(meetingRecords)) {
          if (!weeksAdded.has(wStr)) {
            weeksAdded.add(wStr);
            list.push({
              isWeekly: true,
              date: `${wStr} 週聚會紀錄`,
              sortKey: `${wStr}_week`,
              ...mtgUnpacked
            });
          }
        }

        // 3. 由新到舊排序
        list.sort((a, b) => b.sortKey.localeCompare(a.sortKey));

        this.renderFootprintsList_(list);
      } catch (err) {
        if (this.infoModalContent) {
          this.infoModalContent.innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444;">讀取失敗：${err.message}</div>`;
        }
      }
    }

    renderFootprintsList_(list) {
      if (!this.infoModalContent) return;

      if (!Array.isArray(list) || list.length === 0) {
        this.infoModalContent.innerHTML = '<div style="text-align:center;padding:30px;color:#94a3b8;">最近 30 天尚無操練打卡紀錄，立即開啟今日晨興吧！</div>';
        return;
      }

      const html = `
        <div style="max-height: 60vh; overflow-y: auto; padding: 10px;">
          ${list.map(item => {
            const badges = [];
            if (item.isWeekly) {
              // 聚會紀錄標籤 (全面相容 group/smallGroup, prayerMtg/prayerMeeting, lordDay/lordDayMeeting, outreach/outreachVisit/mutual)
              if (item.group || item.smallGroup || item.groupMeeting) badges.push('👥 小排');
              if (item.prayerMtg || item.prayerMeeting) badges.push('🛐 禱告聚會');
              if (item.lordDay || item.lordDayMeeting || item.lordsDayMeeting) badges.push('🍞 主日');
              if (item.outreach || item.outreachVisit || item.mutualPursuit || item.blend || item.mutual) badges.push('🤝 相調探望');
            } else {
              // 每日操練標籤
              if (item.completedPractices && Array.isArray(item.completedPractices)) {
                badges.push(...item.completedPractices.map(p => {
                  if (p.includes('晨興')) return '🌅 晨興';
                  if (p.includes('讀經')) return '📖 讀經';
                  if (p.includes('禱告')) return '🙏 禱告';
                  if (p.includes('書報')) return '📚 書報';
                  return p;
                }));
              } else {
                if (item.morningRevival || item.morning) badges.push('🌅 晨興');
                if (item.bibleReading || item.bible) badges.push('📖 讀經');
                if (item.prayer) badges.push('🙏 禱告');
                if (item.bookPursuit || item.book) badges.push('📚 書報');
              }
            }

            const points = item.points || item.pointsEarned || 0;
            const isZero = points === 0;
            const bgColor = item.isWeekly ? '#f8fafc' : '#ffffff';
            const weeklyBadge = item.isWeekly 
              ? '<span style="font-size:11px; background:#e0f2fe; color:#0369a1; padding:1px 6px; border-radius:4px; font-weight:normal; margin-left:6px;">週聚會</span>'
              : '';

            return `
              <div style="border-bottom: 1px solid #e2e8f0; background: ${bgColor}; padding: 12px 8px; display: flex; justify-content: space-between; align-items: center; border-radius: 6px; margin-bottom: 4px;">
                <div>
                  <div style="font-weight: 700; font-size: 14px; color: ${item.isWeekly ? '#0f172a' : '#1e293b'}; display: flex; align-items: center;">
                    ${item.date} ${weeklyBadge}
                  </div>
                  <div style="font-size: 12px; color: #64748b; margin-top: 4px; display: flex; gap: 6px; flex-wrap: wrap;">
                    ${badges.map(b => `<span style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">${b}</span>`).join('') || '<span style="color:#94a3b8;">無操練項目</span>'}
                  </div>
                </div>
                <div style="font-weight: 700; color: ${isZero ? '#94a3b8' : '#0284c7'}; font-size: 15px; white-space: nowrap; margin-left: 12px;">
                  +${points} 分
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      this.infoModalContent.innerHTML = html;
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FootprintsView };
  }
  global.FootprintsView = FootprintsView;

})(typeof window !== 'undefined' ? window : global);
