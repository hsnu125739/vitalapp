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
    if (val === undefined || val === null || val === '') return fallback;
    const n = Number(val);
    return Number.isFinite(n) ? Math.max(0, n) : fallback;
  }

  function extractRuleField_(obj, key, fallbackVal) {
    if (!obj) return fallbackVal;
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return safeNum(obj[key], fallbackVal);
    if (obj.daily && obj.daily[key] !== undefined && obj.daily[key] !== null && obj.daily[key] !== '') return safeNum(obj.daily[key], fallbackVal);
    if (obj.meeting && obj.meeting[key] !== undefined && obj.meeting[key] !== null && obj.meeting[key] !== '') return safeNum(obj.meeting[key], fallbackVal);
    return fallbackVal;
  }

  /**
   * 依日期查詢適用的計分規則 (支援單一物件或後端 PointsConfig 之多期間動態加分陣列，零 I/O 純函數)
   * @param {Object|Array} rulesOrConfig
   * @param {string} [targetDateStr] 'YYYY-MM-DD'
   * @returns {Object} 規範的計分規則物件 { morning, bible, prayer, book, group, prayerMtg, lordDay, outreach }
   */
  function getRuleForDate(rulesOrConfig, targetDateStr = '') {
    if (!rulesOrConfig) return { ...DEFAULT_POINTS_CONFIG };
    if (Array.isArray(rulesOrConfig)) {
      if (rulesOrConfig.length === 0) return { ...DEFAULT_POINTS_CONFIG };
      const dStr = String(targetDateStr || '').slice(0, 10);
      const matched = rulesOrConfig.find(r => r && (!r.startDate || dStr >= r.startDate) && (!r.endDate || dStr <= r.endDate)) || rulesOrConfig[0];
      if (!matched) return { ...DEFAULT_POINTS_CONFIG };
      return {
        morning: extractRuleField_(matched, 'morning', DEFAULT_POINTS_CONFIG.morning),
        bible: extractRuleField_(matched, 'bible', DEFAULT_POINTS_CONFIG.bible),
        prayer: extractRuleField_(matched, 'prayer', DEFAULT_POINTS_CONFIG.prayer),
        book: extractRuleField_(matched, 'book', DEFAULT_POINTS_CONFIG.book),
        group: extractRuleField_(matched, 'group', extractRuleField_(matched, 'smallGroup', DEFAULT_POINTS_CONFIG.group)),
        prayerMtg: extractRuleField_(matched, 'prayerMtg', extractRuleField_(matched, 'prayerMeeting', DEFAULT_POINTS_CONFIG.prayerMtg)),
        lordDay: extractRuleField_(matched, 'lordDay', extractRuleField_(matched, 'lordDayMeeting', DEFAULT_POINTS_CONFIG.lordDay)),
        outreach: extractRuleField_(matched, 'outreach', extractRuleField_(matched, 'outreachVisit', DEFAULT_POINTS_CONFIG.outreach))
      };
    }
    return {
      morning: extractRuleField_(rulesOrConfig, 'morning', DEFAULT_POINTS_CONFIG.morning),
      bible: extractRuleField_(rulesOrConfig, 'bible', DEFAULT_POINTS_CONFIG.bible),
      prayer: extractRuleField_(rulesOrConfig, 'prayer', DEFAULT_POINTS_CONFIG.prayer),
      book: extractRuleField_(rulesOrConfig, 'book', DEFAULT_POINTS_CONFIG.book),
      group: extractRuleField_(rulesOrConfig, 'group', extractRuleField_(rulesOrConfig, 'smallGroup', DEFAULT_POINTS_CONFIG.group)),
      prayerMtg: extractRuleField_(rulesOrConfig, 'prayerMtg', extractRuleField_(rulesOrConfig, 'prayerMeeting', DEFAULT_POINTS_CONFIG.prayerMtg)),
      lordDay: extractRuleField_(rulesOrConfig, 'lordDay', extractRuleField_(rulesOrConfig, 'lordDayMeeting', DEFAULT_POINTS_CONFIG.lordDay)),
      outreach: extractRuleField_(rulesOrConfig, 'outreach', extractRuleField_(rulesOrConfig, 'outreachVisit', DEFAULT_POINTS_CONFIG.outreach))
    };
  }

  /**
   * 試算待結算點數與完成細項
   * @param {Object} params
   * @param {Object} [params.daily] - 今日操練打卡狀態 { morning, bible, prayer, book }
   * @param {Object} [params.meeting] - 本週聚會打卡狀態 { smallGroup/group, prayerMeeting/prayerMtg, lordDayMeeting/lordDay, outreachVisit/outreach }
   * @param {Object|Array} [params.pointsConfig] - 自訂或後端下發之權重設定（物件或多期間陣列）
   * @param {string} [params.date] - 適用基準日期 'YYYY-MM-DD'
   * @returns {Object} { today, week, totalPoints }
   */
  function evaluate(params = {}) {
    const daily = (params && typeof params.daily === 'object' && params.daily !== null) ? params.daily : {};
    const meeting = (params && typeof params.meeting === 'object' && params.meeting !== null) ? params.meeting : {};
    const dateStr = (params && (params.date || params.targetDate)) || '';
    const cfg = getRuleForDate(params && params.pointsConfig, dateStr);

    // 1. 今日操練細項與加總
    const isMorning = Boolean(daily.morning || daily.morningRevival);
    const isBible = Boolean(daily.bible || daily.bibleReading);
    const isPrayer = Boolean(daily.prayer);
    const isBook = Boolean(daily.book || daily.bookPursuit);

    const todayBreakdown = {
      morning: isMorning ? cfg.morning : 0,
      bible: isBible ? cfg.bible : 0,
      prayer: isPrayer ? cfg.prayer : 0,
      book: isBook ? cfg.book : 0
    };

    const todayCompletedCount = (isMorning ? 1 : 0) + (isBible ? 1 : 0) + (isPrayer ? 1 : 0) + (isBook ? 1 : 0);
    const todayPoints = todayBreakdown.morning + todayBreakdown.bible + todayBreakdown.prayer + todayBreakdown.book;
    const isAllCompleted = todayCompletedCount === 4;

    // 2. 本週聚會細項與加總
    const isSmallGroup = Boolean(meeting.smallGroup || meeting.group);
    const isPrayerMeeting = Boolean(meeting.prayerMeeting || meeting.prayerMtg);
    const isLordDay = Boolean(meeting.lordDayMeeting || meeting.lordDay);
    const isOutreach = Boolean(meeting.outreachVisit || meeting.outreach || meeting.mutual || meeting.blend);

    const weekBreakdown = {
      smallGroup: isSmallGroup ? cfg.group : 0,
      prayerMeeting: isPrayerMeeting ? cfg.prayerMtg : 0,
      lordDayMeeting: isLordDay ? cfg.lordDay : 0,
      outreachVisit: isOutreach ? cfg.outreach : 0
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
    getRuleForDate,
    evaluate
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PendingPointsEngine;
  }
  global.PendingPointsEngine = PendingPointsEngine;
})(typeof window !== 'undefined' ? window : global);
