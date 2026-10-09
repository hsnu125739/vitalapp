/**
 * footprintsView.js
 * 個人同行足跡視圖深層模組 (Footprints View Deep Module)
 * 職責：
 * 1. 前端解算引擎：接收後端極簡 Raw Data，在瀏覽器 V8 中完成隊友達標判定與算分
 * 2. 呈現本月 8 大成果指標卡（晨興、讀經、禱告、書報天數 + 小組、禱會、主日、相調次數與點數）
 * 3. 呈現過去 10 週之垂直可折疊時間軸，支援每週操練與聚會狀態、7 天打卡徽章明細
 * 4. 實作 SWR 載入（快取秒開 0ms，背景靜默更新）與骨架屏載入動畫
 * 5. 團體操練（晨興 ≥2人 / 外出探訪 ≥2人）視覺標註
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

  function getLocalDateString(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getLocalMonthString(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

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

  function extractRuleField_(obj, key, fallbackVal) {
    if (!obj) return fallbackVal;
    if (obj[key] !== undefined && obj[key] !== null) return Number(obj[key]);
    if (obj.daily && obj.daily[key] !== undefined && obj.daily[key] !== null) return Number(obj.daily[key]);
    if (obj.meeting && obj.meeting[key] !== undefined && obj.meeting[key] !== null) return Number(obj.meeting[key]);
    return fallbackVal;
  }

  /**
   * 依日期查詢適用的計分規則 (支援後端 PointsConfig 之多期間動態加分規則)
   */
  function getRuleForDate(rulesOrConfig, targetDateStr) {
    if (!rulesOrConfig) return DEFAULT_POINTS_CONFIG;
    if (Array.isArray(rulesOrConfig)) {
      if (rulesOrConfig.length === 0) return DEFAULT_POINTS_CONFIG;
      const dStr = String(targetDateStr || '').slice(0, 10);
      const matched = rulesOrConfig.find(r => r && (!r.startDate || dStr >= r.startDate) && (!r.endDate || dStr <= r.endDate)) || rulesOrConfig[0];
      if (!matched) return DEFAULT_POINTS_CONFIG;
      return {
        morning: extractRuleField_(matched, 'morning', DEFAULT_POINTS_CONFIG.morning),
        bible: extractRuleField_(matched, 'bible', DEFAULT_POINTS_CONFIG.bible),
        prayer: extractRuleField_(matched, 'prayer', DEFAULT_POINTS_CONFIG.prayer),
        book: extractRuleField_(matched, 'book', DEFAULT_POINTS_CONFIG.book),
        group: extractRuleField_(matched, 'group', DEFAULT_POINTS_CONFIG.group),
        prayerMtg: extractRuleField_(matched, 'prayerMtg', DEFAULT_POINTS_CONFIG.prayerMtg),
        lordDay: extractRuleField_(matched, 'lordDay', DEFAULT_POINTS_CONFIG.lordDay),
        outreach: extractRuleField_(matched, 'outreach', DEFAULT_POINTS_CONFIG.outreach)
      };
    }
    return Object.assign({}, DEFAULT_POINTS_CONFIG, rulesOrConfig);
  }

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

  /**
   * 解包 Base-100 每日打包整數 → 布林物件
   */
  function unpackDaily(val) {
    const v = Math.floor(Number(val)) || 0;
    return {
      morning: v % 100 > 0,
      bible: Math.floor(v / 100) % 100 > 0,
      prayer: Math.floor(v / 10000) % 100 > 0,
      book: Math.floor(v / 1000000) % 100 > 0
    };
  }

  /**
   * 解包 Base-100 每週聚會打包整數 → 布林物件
   */
  function unpackMeeting(val) {
    const v = Math.floor(Number(val)) || 0;
    return {
      group: v % 100 > 0,
      prayerMtg: Math.floor(v / 100) % 100 > 0,
      lordDay: Math.floor(v / 10000) % 100 > 0,
      outreach: Math.floor(v / 1000000) % 100 > 0
    };
  }

  /**
   * 前端解算引擎核心：將後端極簡 Raw Data 組裝為完整的足跡資料
   * @param {Object} raw 後端回傳的極簡格式 { today, dates, weeks, teamDaily, teamMeeting, selfPlayerId, groupId, joinGroupTime, pointsRules }
   * @param {Object} [pointsConfig] 點數設定或規則陣列
   * @param {Object} [liveStore] 今日即時打卡狀態 { morning, bible, prayer, book } (from practiceStore)
   * @returns {{ monthSummary, weeks }} 與舊版 render() 入參相容的完整足跡資料
   */
  function assembleFootprintsData(raw, pointsConfig, liveStore) {
    if (!raw) return { monthSummary: {}, weeks: [] };
    // 若傳入之物件已是組裝完成的足跡結構（具備 monthSummary 與物件格式的 weeks 陣列，且無 teamDaily），直接回傳
    if (raw.monthSummary && Array.isArray(raw.weeks) && raw.weeks.length > 0 && typeof raw.weeks[0] === 'object' && !raw.teamDaily) {
      if (liveStore && Array.isArray(raw.weeks[0].days)) {
        const todayStr = raw.today || getLocalDateString();
        const todayItem = raw.weeks[0].days.find(d => d.isToday || d.date === todayStr);
        if (todayItem) {
          const m = Boolean(liveStore.morning || liveStore.morningRevival);
          const b = Boolean(liveStore.bible || liveStore.bibleReading);
          const p = Boolean(liveStore.prayer);
          const k = Boolean(liveStore.book || liveStore.bookPursuit);
          todayItem.morningCompleted = m;
          todayItem.bibleCompleted = b;
          todayItem.prayerCompleted = p;
          todayItem.readingCompleted = k;
          todayItem.completedCount = (m ? 1 : 0) + (b ? 1 : 0) + (p ? 1 : 0) + (k ? 1 : 0);
          todayItem.hasRecord = todayItem.completedCount > 0;
        }
      }
      return raw;
    }

    // 優先順序：raw.pointsRules > raw.pointsConfig > pointsConfig > localStorage 快取 > 預設常數
    let resolvedRules = (raw && (raw.pointsRules || raw.pointsConfig)) || pointsConfig;
    if (!resolvedRules && typeof localStorage !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem('vital_points_config') || 'null');
        if (stored) resolvedRules = stored;
      } catch (e) {}
    }
    if (!resolvedRules) resolvedRules = DEFAULT_POINTS_CONFIG;

    const todayStr = raw.today || getLocalDateString();
    const dates = raw.dates || [];
    const weekKeys = raw.weeks || [];
    const teamDaily = raw.teamDaily || {};
    const teamMeeting = raw.teamMeeting || {};
    const selfId = raw.selfPlayerId || '';
    const groupId = raw.groupId || '';
    const joinGroupDate = (raw.joinGroupTime && typeof raw.joinGroupTime === 'string') ? raw.joinGroupTime.slice(0, 10) : '';

    const teamMemberIds = Array.from(new Set([...Object.keys(teamDaily), ...Object.keys(teamMeeting)]));
    const teamSize = teamMemberIds.length;

    // 確保自己在 teamDaily 中
    const selfDailyArr = teamDaily[selfId] || [];
    const selfMeetingArr = teamMeeting[selfId] || [];

    // ---- 1. 逐日解算 (每日操練 + 團體晨興判定) ----
    const dailyResults = {}; // dateStr -> { unpacked, isMorningQualified, dailyScore }

    for (let i = 0; i < dates.length; i++) {
      const dateStr = dates[i];
      const rule = getRuleForDate(resolvedRules, dateStr);

      // 統計全組晨興打卡人數
      let morningCount = 0;
      for (let t = 0; t < teamMemberIds.length; t++) {
        const arr = teamDaily[teamMemberIds[t]];
        const val = (arr && arr[i]) || 0;
        if (val % 100 > 0) morningCount++;
      }

      // 入組判定：若為活力組成員，且該日期在入組日當天或之後，才享有晨興團體共享分
      const isJoinedToday = Boolean(groupId) && (!joinGroupDate || dateStr >= joinGroupDate);
      const isMorningQualified = (teamSize >= 2 && morningCount >= 2 && isJoinedToday);

      // 本人解包（若是今日且有 liveStore，優先使用本地即時狀態）
      let selfVal = selfDailyArr[i] || 0;
      let unpacked;
      if (dateStr === todayStr && liveStore) {
        unpacked = {
          morning: Boolean(liveStore.morning || liveStore.morningRevival),
          bible: Boolean(liveStore.bible || liveStore.bibleReading),
          prayer: Boolean(liveStore.prayer),
          book: Boolean(liveStore.book || liveStore.bookPursuit)
        };
        // 也更新 morningCount if live state differs from packed
        if (unpacked.morning && selfVal % 100 === 0) {
          morningCount++;
        } else if (!unpacked.morning && selfVal % 100 > 0) {
          morningCount--;
        }
      } else {
        unpacked = unpackDaily(selfVal);
      }

      // 計算當日得分：個人項目 + 團體晨興
      let dailyScore = 0;
      if (unpacked.bible) dailyScore += rule.bible;
      if (unpacked.prayer) dailyScore += rule.prayer;
      if (unpacked.book) dailyScore += rule.book;

      // 晨興：團體項目，同組≥2人且本人當日已入組才得分
      const finalMorningQualified = (teamSize >= 2 && morningCount >= 2 && isJoinedToday);
      if (finalMorningQualified) {
        dailyScore += rule.morning;
      }

      dailyResults[dateStr] = {
        unpacked,
        isMorningQualified: finalMorningQualified,
        dailyScore
      };
    }

    // ---- 2. 逐週解算 (聚會 + 團體外出探訪判定) ----
    const weeklyResults = {}; // weekKey -> { unpackedMeeting, isOutreachQualified, meetingScore }

    for (let w = 0; w < weekKeys.length; w++) {
      const wk = weekKeys[w];
      const weekStartIdx = w * 7;
      const weekDates = dates.slice(weekStartIdx, weekStartIdx + 7);
      const wStartDate = weekDates[0] || '';
      // 以該週週四作為代表日取得該週 pointsRule
      const wRepDate = wStartDate
        ? new Date(new Date(wStartDate + 'T00:00:00Z').getTime() + 3 * 86400000).toISOString().slice(0, 10)
        : getLocalDateString();
      const wRule = getRuleForDate(resolvedRules, wRepDate);

      // 統計全組外出探訪人數
      let outreachCount = 0;
      for (let t = 0; t < teamMemberIds.length; t++) {
        const arr = teamMeeting[teamMemberIds[t]];
        const val = (arr && arr[w]) || 0;
        if (Math.floor(val / 1000000) % 100 > 0) outreachCount++;
      }
      const isJoinedThisWeek = Boolean(groupId) && (!joinGroupDate || wRepDate >= joinGroupDate);
      const isOutreachQualified = (teamSize >= 2 && outreachCount >= 2 && isJoinedThisWeek);

      const selfMeetVal = selfMeetingArr[w] || 0;
      const unpackedM = unpackMeeting(selfMeetVal);

      // 計算聚會得分：個人項目 + 團體探訪
      let meetingScore = 0;
      if (unpackedM.group) meetingScore += wRule.group;
      if (unpackedM.prayerMtg) meetingScore += wRule.prayerMtg;
      if (unpackedM.lordDay) meetingScore += wRule.lordDay;
      if (isOutreachQualified) {
        meetingScore += wRule.outreach;
      }

      weeklyResults[wk] = {
        unpackedMeeting: unpackedM,
        isOutreachQualified,
        meetingScore
      };
    }

    // ---- 3. 組裝 10 週時間軸 (新→舊) ----
    const currentMonthKey = todayStr.slice(0, 7);
    const formattedWeeks = [];

    for (let wi = weekKeys.length - 1; wi >= 0; wi--) {
      const wk = weekKeys[wi];
      const wr = weeklyResults[wk];
      const isCurrentWeek = (wi === weekKeys.length - 1);

      // 計算本週日期範圍
      const weekStartIdx = wi * 7;
      const weekDates = dates.slice(weekStartIdx, weekStartIdx + 7);
      if (weekDates.length === 0) continue;

      const startDate = weekDates[0];
      const endDate = weekDates[weekDates.length - 1] || weekDates[0];
      const wNum = parseInt((wk.split('-W')[1] || '0'), 10);
      const weekLabel = '第 ' + wNum + ' 週';
      const dateRange = startDate.slice(5).replace('-', '/') + ' - ' + endDate.slice(5).replace('-', '/');

      let completedDays = 0;
      let wMorningDays = 0, wBibleDays = 0, wPrayerDays = 0, wBookDays = 0;
      let weekPoints = wr.meetingScore;

      const days = [];
      for (let d = 0; d < weekDates.length; d++) {
        const dStr = weekDates[d];
        const dr = dailyResults[dStr];
        if (!dr) {
          days.push({
            date: dStr, recordDate: dStr, dayOfWeek: d + 1, isToday: dStr === todayStr,
            morningCompleted: false, bibleCompleted: false, prayerCompleted: false, readingCompleted: false,
            completedCount: 0, dailyScore: 0, hasRecord: false,
            isMorningQualified: false
          });
          continue;
        }

        const u = dr.unpacked;
        const completedCount = (u.morning ? 1 : 0) + (u.bible ? 1 : 0) + (u.prayer ? 1 : 0) + (u.book ? 1 : 0);
        if (completedCount > 0) completedDays++;
        if (u.morning) wMorningDays++;
        if (u.bible) wBibleDays++;
        if (u.prayer) wPrayerDays++;
        if (u.book) wBookDays++;
        weekPoints += dr.dailyScore;

        days.push({
          date: dStr,
          recordDate: dStr,
          dayOfWeek: d + 1,
          isToday: dStr === todayStr,
          morningCompleted: Boolean(u.morning),
          bibleCompleted: Boolean(u.bible),
          prayerCompleted: Boolean(u.prayer),
          readingCompleted: Boolean(u.book),
          completedCount,
          dailyScore: dr.dailyScore,
          hasRecord: completedCount > 0,
          isMorningQualified: dr.isMorningQualified
        });
      }

      formattedWeeks.push({
        weekKey: wk,
        weekLabel,
        dateRange,
        startDate,
        endDate,
        isCurrentWeek,
        completedDays,
        morningDays: wMorningDays,
        bibleDays: wBibleDays,
        prayerDays: wPrayerDays,
        readingDays: wBookDays,
        bookDays: wBookDays,
        weeklyScore: weekPoints,
        totalWeekPoints: weekPoints,
        groupMeetingCompleted: Boolean(wr.unpackedMeeting.group),
        prayerMeetingCompleted: Boolean(wr.unpackedMeeting.prayerMtg),
        lordDayCompleted: Boolean(wr.unpackedMeeting.lordDay),
        visitCompleted: Boolean(wr.unpackedMeeting.outreach),
        isOutreachQualified: wr.isOutreachQualified,
        meeting: {
          smallGroup: Boolean(wr.unpackedMeeting.group),
          prayerMeeting: Boolean(wr.unpackedMeeting.prayerMtg),
          lordDayMeeting: Boolean(wr.unpackedMeeting.lordDay),
          outreachVisit: Boolean(wr.unpackedMeeting.outreach),
          isOutreachQualified: wr.isOutreachQualified,
          points: wr.meetingScore
        },
        days
      });
    }

    // ---- 4. 計算本月 8 大成果指標 ----
    let mCompletedDays = 0, mFullAttendanceDays = 0;
    let mMorningDays = 0, mBibleDays = 0, mPrayerDays = 0, mBookDays = 0;
    let mGroupCount = 0, mPrayerMtgCount = 0, mLordDayCount = 0, mVisitCount = 0;
    let mTotalScore = 0;

    for (const dStr of dates) {
      if (dStr.indexOf(currentMonthKey) !== 0) continue;
      if (dStr >= todayStr) continue; // 核心架構契約：月度成果卡嚴格只統計至昨日
      const dr = dailyResults[dStr];
      if (!dr) continue;
      const u = dr.unpacked;
      const count = (u.morning ? 1 : 0) + (u.bible ? 1 : 0) + (u.prayer ? 1 : 0) + (u.book ? 1 : 0);
      if (count > 0) mCompletedDays++;
      if (count === 4) mFullAttendanceDays++;
      if (u.morning) mMorningDays++;
      if (u.bible) mBibleDays++;
      if (u.prayer) mPrayerDays++;
      if (u.book) mBookDays++;
      mTotalScore += dr.dailyScore;
    }

    // 週聚會以週四作為唯一代表日判斷所屬月份
    for (const w of formattedWeeks) {
      const wThurs = new Date(new Date(w.startDate + 'T00:00:00Z').getTime() + 3 * 86400000);
      const wRepDate = wThurs.toISOString().slice(0, 10);
      if (wRepDate.indexOf(currentMonthKey) === 0) {
        if (w.groupMeetingCompleted) mGroupCount++;
        if (w.prayerMeetingCompleted) mPrayerMtgCount++;
        if (w.lordDayCompleted) mLordDayCount++;
        if (w.visitCompleted) mVisitCount++;
        mTotalScore += (w.meeting.points || 0);
      }
    }

    // 最長連續打卡天數 (嚴格計算至昨日)
    let maxStreak = 0, streak = 0;
    for (let s = 1; s <= 31; s++) {
      const checkDate = currentMonthKey + '-' + (s < 10 ? '0' + s : s);
      if (checkDate >= todayStr) break;
      const dr = dailyResults[checkDate];
      const u = dr && dr.unpacked;
      const hasPrac = u && ((u.morning ? 1 : 0) + (u.bible ? 1 : 0) + (u.prayer ? 1 : 0) + (u.book ? 1 : 0) > 0);
      if (hasPrac) {
        streak++;
        if (streak > maxStreak) maxStreak = streak;
      } else {
        streak = 0;
      }
    }

    const monthSummary = {
      monthKey: currentMonthKey,
      completedDays: mCompletedDays,
      fullAttendanceDays: mFullAttendanceDays,
      perfectDays: mFullAttendanceDays,
      fullDays: mFullAttendanceDays,
      morningDays: mMorningDays,
      bibleDays: mBibleDays,
      prayerDays: mPrayerDays,
      bookDays: mBookDays,
      meetingCount: mGroupCount + mPrayerMtgCount + mLordDayCount,
      visitCount: mVisitCount,
      groupMeetingCount: mGroupCount,
      prayerMeetingCount: mPrayerMtgCount,
      lordDayMeetingCount: mLordDayCount,
      totalScore: mTotalScore,
      longestStreak: maxStreak
    };

    const dailyRecords = {};
    for (const dStr of Object.keys(dailyResults)) {
      const u = dailyResults[dStr].unpacked;
      dailyRecords[dStr] = {
        morning: Boolean(u.morning),
        morningRevival: Boolean(u.morning),
        bible: Boolean(u.bible),
        bibleReading: Boolean(u.bible),
        prayer: Boolean(u.prayer),
        book: Boolean(u.book),
        bookPursuit: Boolean(u.book)
      };
    }

    return {
      today: todayStr,
      monthKey: currentMonthKey,
      monthSummary,
      monthly: monthSummary,
      weeks: formattedWeeks,
      dailyRecords
    };
  }


  class FootprintsView {
    constructor({ apiClient, practiceStore, currentDate } = {}) {
      this.apiClient = apiClient;
      this.practiceStore = practiceStore || null;
      this.currentDate = currentDate || null;
      this.infoModal = typeof document !== 'undefined' ? document.getElementById('infoModal') : null;
      this.infoModalTitle = typeof document !== 'undefined' ? document.getElementById('infoModalTitle') : null;
      this.infoModalContent = typeof document !== 'undefined' ? document.getElementById('infoModalContent') : null;
      this.currentData = null;
    }

    /**
     * 開啟同行足跡彈窗 (SWR 混合載入策略)
     */
    async openFootprintsModal(playerId = null, options = {}) {
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

      const forceRefresh = Boolean(options && options.forceRefresh);
      const shouldRevalidate = Boolean(options && (options.revalidate || options.backgroundSync));

      // 1. 優先從本地快取渲染（0ms 秒開），並以 practiceStore 即時動態水合今日操練
      let hasRenderedCache = false;
      if (!forceRefresh && this.apiClient && typeof this.apiClient.getCachedFootprints === 'function') {
        const cached = this.apiClient.getCachedFootprints(targetPlayerId);
        if (cached && (cached.teamDaily || (cached.weeks && cached.monthSummary))) {
          const assembled = assembleFootprintsData(cached, null, this.getLiveToday_(cached.today));
          this.render(assembled);
          hasRenderedCache = true;
        }
      }

      // 2. 基於「昨日以前歷史資料具備不變性」與「今日數據由 practiceStore 實時水合」：
      // 只要快取已存在且非強制刷新或要求重驗，即代表已持有權威的昨日基準，完全不需再次發起多餘網路請求！
      if (hasRenderedCache && !forceRefresh && !shouldRevalidate) {
        return;
      }

      // 3. 僅在無快取時（如冷啟動尚未預載完成），顯示骨架屏並請求後台數據
      if (!hasRenderedCache) {
        this.renderSkeleton();
      }

      if (this.apiClient && typeof this.apiClient.getFootprints === 'function') {
        try {
          const res = await this.apiClient.getFootprints({ playerId: targetPlayerId, weeks: 10, forceRefresh });
          if (res && res.success) {
            const freshRaw = res.data || res;
            const assembled = assembleFootprintsData(freshRaw, null, this.getLiveToday_(freshRaw.today));
            this.render(assembled);

            // 若為 SWR 快取返回且帶有背景 revalidatePromise，等網路返回時無縫更新畫面
            if (res.revalidatePromise) {
              res.revalidatePromise.then(freshRes => {
                if (freshRes && freshRes.success) {
                  const latestRaw = freshRes.data || freshRes;
                  const latestAssembled = assembleFootprintsData(latestRaw, null, this.getLiveToday_(latestRaw.today));
                  this.render(latestAssembled);
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
     * 取得今日日期字串
     */
    getTodayDateString_(fallbackDate) {
      if (fallbackDate) return fallbackDate;
      if (this.currentDate) return this.currentDate;
      return (typeof dashboardView !== 'undefined' && dashboardView && typeof dashboardView.getTodayDateString === 'function')
        ? dashboardView.getTodayDateString()
        : getLocalDateString();
    }

    /**
     * 取得今日的即時打卡狀態（from practiceStore）
     */
    getLiveToday_(fallbackDate) {
      const store = this.practiceStore
        || (typeof window !== 'undefined' && window.practiceStore)
        || (typeof global !== 'undefined' && global.practiceStore)
        || (typeof AppCoordinator !== 'undefined' && AppCoordinator.practiceStore)
        || (typeof dashboardView !== 'undefined' && dashboardView && dashboardView.practiceStore)
        || null;
      if (!store || !store.dailyState) return null;
      return store.dailyState[this.getTodayDateString_(fallbackDate)] || null;
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
          this.openFootprintsModal(this.lastTargetPlayerId, { forceRefresh: true });
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
     * 本月 8 大成果指標卡區塊
     */
    renderMonthSection_(month) {
      const monthKey = month.monthKey || getLocalMonthString();
      const totalScore = Number(month.totalScore || month.totalPoints || 0);

      // 動態轉換月份中文名稱 (例如 '2026-10' -> '十月成果卡')
      const monthName = getChineseMonthName(monthKey);

      // 取得今日即時操練水合狀態 (from practiceStore)
      const todayStr = (this.currentData && this.currentData.today) || this.getTodayDateString_();
      const live = this.getLiveToday_(todayStr);
      const isTodayCurrentMonth = Boolean(todayStr && todayStr.startsWith(monthKey));
      const isLiveMorning = Boolean(isTodayCurrentMonth && live && (live.morning || live.morningRevival));
      const isLiveBible = Boolean(isTodayCurrentMonth && live && (live.bible || live.bibleReading));
      const isLivePrayer = Boolean(isTodayCurrentMonth && live && live.prayer);
      const isLiveBook = Boolean(isTodayCurrentMonth && live && (live.book || live.bookPursuit));
      const isLiveFull = Boolean(isLiveMorning && isLiveBible && isLivePrayer && isLiveBook);

      // 當月全勤天數 (昨日純淨基準 + 今日動態水合)
      const baseFullAttendanceDays = Number(month.fullAttendanceDays ?? month.perfectDays ?? month.fullDays ?? 0);
      const fullAttendanceDays = baseFullAttendanceDays + (isLiveFull ? 1 : 0);

      // 8 大成果項目定義 (4 每日操練天數動態水合 + 4 每週聚會次數)
      const statsList = [
        { label: '晨興天數', value: Number(month.morningDays || 0) + (isLiveMorning ? 1 : 0), icon: '🌅', unit: '天' },
        { label: '讀經天數', value: Number(month.bibleDays || 0) + (isLiveBible ? 1 : 0), icon: '📖', unit: '天' },
        { label: '禱告天數', value: Number(month.prayerDays || 0) + (isLivePrayer ? 1 : 0), icon: '🙏', unit: '天' },
        { label: '書報天數', value: Number(month.bookDays || month.readingDays || 0) + (isLiveBook ? 1 : 0), icon: '📚', unit: '天' },
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
          <div class="footprint-heading footprint-month-heading">
            <div class="footprint-title-group">
              <h3>🏆 ${monthName}成果卡</h3>
              <span class="footprint-month-key">(${escapeHtml(monthKey)})</span>
            </div>
            <div class="footprint-summary-group">
              <span class="footprint-total-points">累計 ⭐ <strong>${formatNumber(totalScore)}</strong> 點</span>
              <span class="footprint-total-attendance">全勤 🔥 ${formatNumber(fullAttendanceDays)} 天</span>
            </div>
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
        const visitSelf = Boolean(w.visitCompleted || (w.meeting && (w.meeting.outreachVisit || w.meeting.outreach)));
        const visitQualified = Boolean(w.isOutreachQualified || (w.meeting && w.meeting.isOutreachQualified));

        let visitSummary = '▫️ 探訪';
        if (visitSelf && visitQualified) {
          visitSummary = '✅ 探訪';
        } else if (visitSelf && !visitQualified) {
          visitSummary = '⏳ 探訪';
        } else if (!visitSelf && visitQualified) {
          visitSummary = '🤝 探訪';
        }

        const meetingSummaryParts = [
          groupDone ? '✅ 小排' : '▫️ 小排',
          prayerDone ? '✅ 禱會' : '▫️ 禱會',
          lordDayDone ? '✅ 主日' : '▫️ 主日',
          visitSummary
        ];

        // 7 天清單列
        const days = Array.isArray(w.days) ? w.days : [];
        const daysRows = days.map(d => {
          const dName = DAY_NAMES[d.dayOfWeek] || '';
          const dDate = String(d.date || d.recordDate || '').slice(5).replace('-', '/');
          const isToday = Boolean(d.isToday);
          const score = Number(d.dailyScore || 0);

          const liveToday = isToday ? this.getLiveToday_() : null;
          const mActive = liveToday
            ? Boolean(liveToday.morning || liveToday.morningRevival)
            : Boolean(d.morningCompleted || d.morningRevival || d.morning);
          const bActive = liveToday
            ? Boolean(liveToday.bible || liveToday.bibleReading)
            : Boolean(d.bibleCompleted || d.bibleReading || d.bible);
          const pActive = liveToday
            ? Boolean(liveToday.prayer)
            : Boolean(d.prayerCompleted || d.prayer);
          const rActive = liveToday
            ? Boolean(liveToday.book || liveToday.bookPursuit)
            : Boolean(d.readingCompleted || d.bookCompleted || d.bookPursuit || d.book);

          // 晨興狀態判斷（方案二選項 C：語意樣式分流，零符號雜訊，尺寸完全對齊）
          let morningClass = '';
          let morningTitle = '晨興：未打卡';
          if (mActive) {
            if (d.isMorningQualified === false) {
              morningClass = 'is-active is-pending';
              morningTitle = '晨興：個人已打卡 (同組未滿2人未計分)';
            } else {
              morningClass = 'is-active is-group-qualified';
              morningTitle = `晨興：已完成${d.isMorningQualified ? ' (團體達標)' : ''}`;
            }
          } else if (d.isMorningQualified) {
            morningClass = 'is-shared';
            morningTitle = '晨興：隊友達標 (同組共享得分)';
          }

          return `
            <div class="footprint-day-row ${isToday ? 'is-today' : ''}">
              <div class="footprint-day-left">
                <span class="footprint-day-name">${dName}</span>
                <span class="footprint-day-date">${dDate}${isToday ? ' (今)' : ''}</span>
              </div>
              <div class="footprint-badges">
                <span class="footprint-badge ${morningClass}" title="${morningTitle}">晨</span>
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
                <div class="footprint-practice-summary">
                  <span class="footprint-summary-item">🌅 ${w.morningDays || 0}天</span>
                  <span class="footprint-summary-item">📖 ${w.bibleDays || 0}天</span>
                  <span class="footprint-summary-item">🙏 ${w.prayerDays || 0}天</span>
                  <span class="footprint-summary-item">📚 ${w.readingDays || w.bookDays || 0}天</span>
                </div>
                <div class="footprint-meeting-summary">
                  ${meetingSummaryParts.map(item => `<span class="footprint-summary-item footprint-meeting-tag">${item}</span>`).join('')}
                </div>
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
    module.exports = { FootprintsView, assembleFootprintsData, unpackDaily, unpackMeeting, DEFAULT_POINTS_CONFIG };
  }
  global.FootprintsView = FootprintsView;
  global.assembleFootprintsData = assembleFootprintsData;

})(typeof window !== 'undefined' ? window : global);
