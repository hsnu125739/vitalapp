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

  const MEETING_KEY_MAP = Object.freeze({
    group: 'smallGroup', smallGroup: 'smallGroup', groupMeeting: 'smallGroup',
    prayerMtg: 'prayerMeeting', prayerMeeting: 'prayerMeeting', prayer: 'prayerMeeting',
    lordDay: 'lordDayMeeting', lordDayMeeting: 'lordDayMeeting', lordsDayMeeting: 'lordDayMeeting',
    outreach: 'outreachVisit', outreachVisit: 'outreachVisit', blend: 'outreachVisit', mutual: 'outreachVisit', mutualPursuit: 'outreachVisit'
  });

  function normalizeMeetingKey(k) {
    return (k && MEETING_KEY_MAP[k]) || k;
  }

  /**
   * 試算待結算點數與完成細項
   * @param {Object} params
   * @param {Object} [params.daily] - 今日操練打卡狀態 { morning, bible, prayer, book }
   * @param {Object} [params.meeting] - 本週聚會打卡狀態 { smallGroup/group, prayerMeeting/prayerMtg, lordDayMeeting/lordDay, outreachVisit/outreach, solidifiedItems }
   * @param {Array<string>} [params.solidifiedItems] - 已固化入帳項目清單（待結算點數排除該項目）
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

    const rawDailySolidified = (daily && Array.isArray(daily.solidifiedItems))
      ? daily.solidifiedItems
      : (params && Array.isArray(params.dailySolidifiedItems) ? params.dailySolidifiedItems : []);
    const dailySolidifiedSet = new Set(rawDailySolidified.map(k => String(k).trim()));

    const todayBreakdown = {
      morning: (isMorning && !dailySolidifiedSet.has('morning') && !dailySolidifiedSet.has('morningRevival')) ? cfg.morning : 0,
      bible: (isBible && !dailySolidifiedSet.has('bible') && !dailySolidifiedSet.has('bibleReading')) ? cfg.bible : 0,
      prayer: (isPrayer && !dailySolidifiedSet.has('prayer')) ? cfg.prayer : 0,
      book: (isBook && !dailySolidifiedSet.has('book') && !dailySolidifiedSet.has('bookPursuit')) ? cfg.book : 0
    };

    const todayCompletedCount = (isMorning ? 1 : 0) + (isBible ? 1 : 0) + (isPrayer ? 1 : 0) + (isBook ? 1 : 0);
    const todayPoints = todayBreakdown.morning + todayBreakdown.bible + todayBreakdown.prayer + todayBreakdown.book;
    const isAllCompleted = todayCompletedCount === 4;

    // 2. 本週聚會細項與加總 (只能算尚未固化的操練項目分數，已固化的代表分數已經入帳)
    const rawMeetingSolidified = (meeting && Array.isArray(meeting.solidifiedItems))
      ? meeting.solidifiedItems
      : (params && Array.isArray(params.solidifiedItems) ? params.solidifiedItems : []);
    const meetingSolidifiedSet = new Set(rawMeetingSolidified.map(normalizeMeetingKey));

    const isSmallGroup = Boolean(meeting.smallGroup || meeting.group);
    const isPrayerMeeting = Boolean(meeting.prayerMeeting || meeting.prayerMtg);
    const isLordDay = Boolean(meeting.lordDayMeeting || meeting.lordDay);
    const isOutreach = Boolean(meeting.outreachVisit || meeting.outreach || meeting.mutual || meeting.blend);

    const isSmallGroupSolidified = meetingSolidifiedSet.has('smallGroup');
    const isPrayerMeetingSolidified = meetingSolidifiedSet.has('prayerMeeting');
    const isLordDaySolidified = meetingSolidifiedSet.has('lordDayMeeting');
    const isOutreachSolidified = meetingSolidifiedSet.has('outreachVisit');

    const weekBreakdown = {
      smallGroup: (isSmallGroup && !isSmallGroupSolidified) ? cfg.group : 0,
      prayerMeeting: (isPrayerMeeting && !isPrayerMeetingSolidified) ? cfg.prayerMtg : 0,
      lordDayMeeting: (isLordDay && !isLordDaySolidified) ? cfg.lordDay : 0,
      outreachVisit: (isOutreach && !isOutreachSolidified) ? cfg.outreach : 0
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
    MEETING_KEY_MAP,
    normalizeMeetingKey,
    getRuleForDate,
    evaluate
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PendingPointsEngine;
  }
  global.PendingPointsEngine = PendingPointsEngine;
})(typeof window !== 'undefined' ? window : global);
