/**
 * pendingPointsEngine.js
 * 純領域待結算點數試算引擎 (Pure Domain Engine)
 * 職責：依據今日打卡與本週聚會狀態，試算未結算點數與完成進度，只輸出純數值，零 DOM、零 I/O、零字串文案。
 */
(function (global) {
  'use strict';

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

  function safeNum(val, fallback) {
    if (val === undefined || val === null) return fallback;
    const n = Number(val);
    return Number.isFinite(n) ? Math.max(0, n) : fallback;
  }

  /**
   * 試算待結算點數與完成細項
   * @param {Object} params
   * @param {Object} [params.daily] - 今日操練打卡狀態 { morning, bible, prayer, book }
   * @param {Object} [params.meeting] - 本週聚會打卡狀態 { smallGroup/group, prayerMeeting/prayerMtg, lordDayMeeting/lordDay, outreachVisit/outreach }
   * @param {Object} [params.pointsConfig] - 自訂或後端下發之權重設定
   * @returns {Object} { today, week, totalPoints }
   */
  function evaluate(params = {}) {
    const daily = (params && typeof params.daily === 'object' && params.daily !== null) ? params.daily : {};
    const meeting = (params && typeof params.meeting === 'object' && params.meeting !== null) ? params.meeting : {};
    const cfg = (params && typeof params.pointsConfig === 'object' && params.pointsConfig !== null) ? params.pointsConfig : DEFAULT_POINTS_CONFIG;

    // 1. 權重解析 (支援後端與舊版欄位別名，防禦 NaN 與負數，保護合法 0)
    const ptsMorning = safeNum(cfg.morning, 50);
    const ptsBible = safeNum(cfg.bible, 30);
    const ptsPrayer = safeNum(cfg.prayer, 30);
    const ptsBook = safeNum(cfg.book, 30);

    const ptsGroup = safeNum(cfg.group ?? cfg.smallGroup, 30);
    const ptsPrayerMtg = safeNum(cfg.prayerMtg ?? cfg.prayerMeeting, 50);
    const ptsLordDay = safeNum(cfg.lordDay ?? cfg.lordDayMeeting, 50);
    const ptsOutreach = safeNum(cfg.outreach ?? cfg.outreachVisit, 100);

    // 2. 今日操練細項與加總
    const isMorning = Boolean(daily.morning || daily.morningRevival);
    const isBible = Boolean(daily.bible || daily.bibleReading);
    const isPrayer = Boolean(daily.prayer);
    const isBook = Boolean(daily.book || daily.bookPursuit);

    const todayBreakdown = {
      morning: isMorning ? ptsMorning : 0,
      bible: isBible ? ptsBible : 0,
      prayer: isPrayer ? ptsPrayer : 0,
      book: isBook ? ptsBook : 0
    };

    const todayCompletedCount = (isMorning ? 1 : 0) + (isBible ? 1 : 0) + (isPrayer ? 1 : 0) + (isBook ? 1 : 0);
    const todayPoints = todayBreakdown.morning + todayBreakdown.bible + todayBreakdown.prayer + todayBreakdown.book;
    const isAllCompleted = todayCompletedCount === 4;

    // 3. 本週聚會細項與加總
    const isSmallGroup = Boolean(meeting.smallGroup || meeting.group);
    const isPrayerMeeting = Boolean(meeting.prayerMeeting || meeting.prayerMtg);
    const isLordDay = Boolean(meeting.lordDayMeeting || meeting.lordDay);
    const isOutreach = Boolean(meeting.outreachVisit || meeting.outreach || meeting.mutual || meeting.blend);

    const weekBreakdown = {
      smallGroup: isSmallGroup ? ptsGroup : 0,
      prayerMeeting: isPrayerMeeting ? ptsPrayerMtg : 0,
      lordDayMeeting: isLordDay ? ptsLordDay : 0,
      outreachVisit: isOutreach ? ptsOutreach : 0
    };

    const weekCompletedCount = (isSmallGroup ? 1 : 0) + (isPrayerMeeting ? 1 : 0) + (isLordDay ? 1 : 0) + (isOutreach ? 1 : 0);
    const weekPoints = weekBreakdown.smallGroup + weekBreakdown.prayerMeeting + weekBreakdown.lordDayMeeting + weekBreakdown.outreachVisit;

    return {
      today: {
        points: todayPoints,
        completedCount: todayCompletedCount,
        isAllCompleted,
        breakdown: todayBreakdown
      },
      week: {
        points: weekPoints,
        completedCount: weekCompletedCount,
        breakdown: weekBreakdown
      },
      totalPoints: todayPoints + weekPoints
    };
  }

  const PendingPointsEngine = {
    DEFAULT_POINTS_CONFIG,
    evaluate
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PendingPointsEngine;
  }
  global.PendingPointsEngine = PendingPointsEngine;
})(typeof window !== 'undefined' ? window : global);
