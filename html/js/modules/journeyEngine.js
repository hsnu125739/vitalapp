/**
 * journeyEngine.js
 * 前端純領域成長篇章與旅程推導模組 (Pure Domain Engine)
 * 職責：依據小組進度 (groupProgress)、設定 (chaptersConfig) 與成員資料推導篇章目標與總分
 * 特性：零 I/O 依賴、輸入物件不可變 (Immutable，絕不修改入參)
 */
(function (global) {
  'use strict';

  const CHAPTER_NAMES = ['信心', '美德', '知識', '節制', '忍耐', '敬虔', '弟兄相愛', '愛'];

  const DEFAULT_CHAPTER_CONFIG = [
    { chapterId: 'CHP_01', order: 1, status: 'ACTIVE', targetPoint: 0, name: '信心篇' },
    { chapterId: 'CHP_02', order: 2, status: 'ACTIVE', targetPoint: 2000, name: '美德篇' },
    { chapterId: 'CHP_03', order: 3, status: 'ACTIVE', targetPoint: 5500, name: '知識篇' },
    { chapterId: 'CHP_04', order: 4, status: 'ACTIVE', targetPoint: 10000, name: '節制篇' },
    { chapterId: 'CHP_05', order: 5, status: 'ACTIVE', targetPoint: 16000, name: '忍耐篇' },
    { chapterId: 'CHP_06', order: 6, status: 'ACTIVE', targetPoint: 24000, name: '敬虔篇' },
    { chapterId: 'CHP_07', order: 7, status: 'ACTIVE', targetPoint: 35000, name: '弟兄相愛篇' },
    { chapterId: 'CHP_08', order: 8, status: 'ACTIVE', targetPoint: 50000, name: '愛篇' }
  ];

  /**
   * 推導小組當前篇章、進度百分比與總分
   * @param {Object} groupProgress 小組進度資料
   * @param {Object|null} fallbackProfile 備用個人/小組檔案 (保持唯讀，不產生副作用)
   * @param {Array|null} chaptersConfig 篇章設定清單
   * @returns {Object|null} 推導後之旅程快照物件
   */
  function deriveJourney(groupProgress, fallbackProfile = null, chaptersConfig = null) {
    if (!groupProgress) return null;

    let milestones = groupProgress.milestones || [];
    if (typeof milestones === 'string') {
      milestones = JSON.parse(milestones);
    }
    if (!Array.isArray(milestones)) milestones = [];

    // 1. 取得 ChapterConfig（優先使用傳入設定，次為本地持久化快取，最後採用標準保底設定）
    let chapters = chaptersConfig;
    if (!Array.isArray(chapters) || chapters.length === 0) {
      if (typeof localStorage !== 'undefined') {
        try {
          const stored = localStorage.getItem('vital_chapters_config');
          if (stored) chapters = JSON.parse(stored);
        } catch (_) {}
      }
    }
    if (!Array.isArray(chapters) || chapters.length === 0) {
      chapters = DEFAULT_CHAPTER_CONFIG;
    }

    // 嚴格依 order 升冪排序（數值越小越靠前）
    const activeChapters = (Array.isArray(chapters) ? chapters : [])
      .filter(c => c && c.status === 'ACTIVE' && (c.chapterId || c.id))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

    // 2. 收集已達成之里程碑 ID（純字串精確比對）
    const achievedIds = new Set();
    const registerId = (m) => {
      if (!m) return;
      if (typeof m === 'string') {
        const s = m.trim().toUpperCase();
        if (s) achievedIds.add(s);
      } else if (typeof m === 'object') {
        const id = String(m.id || m.chapterId || m.taskId || m.achievementId || '').trim().toUpperCase();
        if (id) achievedIds.add(id);
      }
    };
    milestones.forEach(registerId);
    if (Array.isArray(groupProgress.chapterHistory)) {
      groupProgress.chapterHistory.forEach(registerId);
    }

    // 3. 依據 ChapterConfig 定義之 order 與 chapterId 判定各篇章是否已達成
    const isChapterPassed = (ch) => {
      const cid = String(ch.chapterId || ch.id || '').trim().toUpperCase();
      return cid ? achievedIds.has(cid) : false;
    };

    // 4. 尋找當前正在挑戰的目標篇章（第一個尚未達成之篇章；若全數達成則為最後一個篇章）
    const completedChapters = activeChapters.filter(isChapterPassed);
    let targetChapter = activeChapters.find(ch => !isChapterPassed(ch));
    const allPassed = !targetChapter;
    if (!targetChapter) {
      targetChapter = activeChapters[activeChapters.length - 1] || DEFAULT_CHAPTER_CONFIG[0];
    }

    const chapterIndex = Number(targetChapter.order) || 1;
    const chapterTitle = targetChapter.name || targetChapter.title || (CHAPTER_NAMES[chapterIndex - 1] ? (CHAPTER_NAMES[chapterIndex - 1] + '篇') : '起步啟航');
    const totalChaptersCount = activeChapters.length || 8;
    // 歷史留存欄位 progressPercent（UI 已不使用，維持欄位向下相容）
    const progressPercent = allPassed ? 100 : Math.min(100, Math.round((completedChapters.length / totalChaptersCount) * 100));

    // 5. 小組累積總分欄位取值相容 (Group Points Field Resolution)
    const hasExplicitPoints = (groupProgress.groupTotalPoints !== undefined || groupProgress.journeyPoints !== undefined);
    let totalScore = hasExplicitPoints
      ? Number(groupProgress.groupTotalPoints !== undefined ? groupProgress.groupTotalPoints : groupProgress.journeyPoints)
      : null;

    if (totalScore === null || isNaN(totalScore)) {
      if (groupProgress.memberContribution && typeof groupProgress.memberContribution === 'object') {
        const sum = Object.values(groupProgress.memberContribution).reduce((acc, v) => acc + (Number(v) || 0), 0);
        if (sum > 0) totalScore = sum;
      }
      if (totalScore === null && groupProgress.historySummary) {
        let hs = groupProgress.historySummary;
        if (typeof hs === 'string') {
          hs = JSON.parse(hs);
        }
        const currYear = String(new Date().getFullYear());
        const hsScore = Number(hs[currYear] || hs.totalScore);
        if (!isNaN(hsScore)) totalScore = hsScore;
      }
    }

    // 6. 小組人數推導（保持純函式不可變性，絕不原地修改 fallbackProfile）
    let mCount = groupProgress.memberCount;
    if (typeof mCount !== 'number' && groupProgress.memberContribution && typeof groupProgress.memberContribution === 'object') {
      mCount = Object.keys(groupProgress.memberContribution).length;
    }
    if (typeof mCount !== 'number' && fallbackProfile && typeof fallbackProfile.memberCount === 'number') {
      mCount = fallbackProfile.memberCount;
    }

    const finalPoints = (typeof totalScore === 'number' && !isNaN(totalScore))
      ? totalScore
      : ((fallbackProfile && (fallbackProfile.groupTotalPoints !== undefined ? fallbackProfile.groupTotalPoints : fallbackProfile.journeyPoints)) || 0);

    return {
      ...groupProgress,
      memberCount: typeof mCount === 'number' ? mCount : undefined,
      currentChapter: chapterTitle,
      chapterTitle: chapterTitle,
      chapterName: chapterTitle,
      chapterIndex: chapterIndex,
      currentChapterIndex: chapterIndex,
      currentLevel: chapterIndex,
      totalPoints: finalPoints,
      totalScore: finalPoints,
      groupTotalPoints: finalPoints,
      progressPercent: progressPercent,
      milestones: milestones
    };
  }

  const JourneyEngine = {
    CHAPTER_NAMES,
    DEFAULT_CHAPTER_CONFIG,
    deriveJourney
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = JourneyEngine;
  }
  global.JourneyEngine = JourneyEngine;
})(typeof window !== 'undefined' ? window : global);
