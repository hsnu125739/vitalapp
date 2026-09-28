const STORAGE_KEY = 'yct_current_player';
  const MESSAGE_SUPPRESSION_RETRY_KEY = 'yct_message_suppression_retry';
  const APP_SYNC_SIGNAL_KEY = 'yct_app_sync_signal';
  const APP_SYNC_CHANNEL_NAME = 'yct_app_sync_v1';
  const ASSET_BASE_URL = '..';
  const LOCAL_AVATAR_BASE_URL = ASSET_BASE_URL;
  const REMOTE_AVATAR_BASE_URL =
    'https://khya31.github.io/vitalapp';
  const IMAGE_ASSET_VERSION = String(
    (window.APP_RUNTIME_CONFIG && window.APP_RUNTIME_CONFIG.assetVersion) || 'current'
  ).trim() || 'current';
  const IMAGE_LOAD_TIMEOUT_MS = 8000;
  const IMAGE_LOAD_MAX_RETRIES = 1;
  const IMAGE_FALLBACK_DATA_URL =
    'data:image/svg+xml;charset=UTF-8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">' +
      '<rect width="160" height="160" rx="28" fill="#fff6df"/>' +
      '<path d="M40 70h80v46H40z" fill="#f1c464" stroke="#9a7359" stroke-width="8"/>' +
      '<path d="M48 55h64c10 0 18 8 18 18H30c0-10 8-18 18-18z" fill="#f8dc86" stroke="#9a7359" stroke-width="8"/>' +
      '<rect x="70" y="63" width="20" height="53" rx="7" fill="#d97b7b"/>' +
      '<text x="80" y="142" text-anchor="middle" font-size="14" font-family="Arial" fill="#86624e">圖片載入中</text>' +
      '</svg>'
    );
  const IMAGE_ASSETS = (() => {
    const assets = {
      appBgMobile: ASSET_BASE_URL + '/UI/app-bg-cute-v4.png',
      appBgDesktop: ASSET_BASE_URL + '/UI/app-bg-cute-v4.png',
      heroMobile: ASSET_BASE_URL + '/UI/hero-journey-cute-v4.png',
      heroDesktop: ASSET_BASE_URL + '/UI/hero-journey-cute-v4.png',
      journeyMobile: ASSET_BASE_URL + '/UI/journey-map-cute-v4.png',
      journeyDesktop: ASSET_BASE_URL + '/UI/journey-map-cute-v4.png',
      gameCamp: ASSET_BASE_URL + '/UI/board-panel-cute-v4.png',
      gamePanel: ASSET_BASE_URL + '/UI/quest-panel-cute-v4.png',
      iconGrowth: ASSET_BASE_URL + '/UI/icon-growth.png',
      systemAnnouncement: ASSET_BASE_URL + '/Cute_Icons/Cute_Icon_07.png',
      specialTaskInProgress: ASSET_BASE_URL + '/Cute_Icons/Cute_Icon_01.png',
      specialTaskCompleted: ASSET_BASE_URL + '/Cute_Icons/Cute_Icon_03.png',
      fallbackChest: IMAGE_FALLBACK_DATA_URL
    };

    for (let i = 1; i <= 8; i += 1) {
      const id = String(i).padStart(2, '0');
      const chestUrl = ASSET_BASE_URL + '/Chest_Assets/Chest_' + id + '.png';

      assets['chest' + id] = chestUrl;
    }

    return assets;
  })();
  const SESSION_ERROR_CODES = [
    'SESSION_EXPIRED',
    'SESSION_INVALID',
    'ACCOUNT_DISABLED',
    'SESSION_REVOKED'
  ];
  const SESSION_TOKEN_ARG_APIS = [
    'getHomeDashboard',
    'getHomeSyncState',
    'getPlayerMessageCenter',
    'getMyVitalGroups',
    'getMyFootprintDashboard',
    'getPlayerProfile',
    'getGroupJourney',
    'getGroupJourneyList',
    'getPlayerChestCollection',
    'getMyGroupContributionSummary'
  ];
  const SESSION_PAYLOAD_APIS = [
    'updatePlayerAvatar',
    'markPlayerMessageRead',
    'suppressPlayerMessageToday',
    'updateMyAccount',
    'updateMyPassword',
    'createVitalGroup',
    'joinVitalGroupByInviteCode',
    'switchPrimaryVitalGroup',
    'transferVitalGroupOwnership',
    'leaveVitalGroup',
    'createGroupPost',
    'updateGroupPost',
    'deleteGroupPost',
    'submitDailyPractice',
    'submitMeetingPractice',
    'processTaskWriteEvent',
    'getTaskWriteEventStatus',
    'claimPlayerChestReward',
  ];

  const CACHE_DEFAULT_TTL_MS = 5 * 60 * 1000;
  const CACHE_POLICIES = {
    dashboard: 90 * 1000,
    dailyPractice: 2 * 60 * 1000,
    meetingPractice: 2 * 60 * 1000,
    practiceHistory: 2 * 60 * 1000,
    journey: 2 * 60 * 1000,
    groupJourneyList: 2 * 60 * 1000,
    contribution: 2 * 60 * 1000,
    growth: 2 * 60 * 1000,
    chestSummary: 2 * 60 * 1000,
    chestCollection: 2 * 60 * 1000,
    chestSettingsForPlayer: 5 * 60 * 1000,
    accountProfile: 3 * 60 * 1000,
    groupInfo: 3 * 60 * 1000
  };
  const HOME_SYNC_POLL_MS = 60 * 1000;
  const HOME_SYNC_MIN_GAP_MS = 30 * 1000;
  const HOME_SYNC_RESUME_DEBOUNCE_MS = 1500;
  const SERVER_READ_CALL_TIMEOUT_MS = 90 * 1000;
  const CACHE_LOADING_PROMISE_TTL_MS = SERVER_READ_CALL_TIMEOUT_MS + 5 * 1000;
  const TASK_SUBMIT_LOADING_VISIBLE_MS = 250;
  const TASK_PERFORMANCE_PROBE_ENABLED = (() => {
    try {
      return new URLSearchParams(window.location.search).get('taskPerf') === '1';
    } catch (error) {
      return false;
    }
  })();

  function formatTaskPerformanceMessage_() {
    return '任務已完成';
  }
  function formatTaskQueueAcceptedMessage_() {
    return '任務已完成';
  }

  function getOfficialHomeScoreSnapshot_() {
    return {
      personalPoints: Math.max(0, Number(
        state.currentPlayer && state.currentPlayer.totalScore || 0
      )),
      groupPoints: state.homeGroupEnabled === false
        ? 0
        : Math.max(0, Number(
            state.groupJourney && state.groupJourney.totalScore || 0
          ))
    };
  }

  function normalizeTaskScorePreviewDelta_(delta) {
    delta = delta || {};
    return {
      personalPoints: Math.max(0, Number(delta.personalPoints || 0)),
      groupPoints: Math.max(0, Number(delta.groupPoints || 0)),
      selectedTaskField: String(delta.selectedTaskField || '').trim(),
      source: String(delta.source || '').trim()
    };
  }

  function getPendingTaskScorePreviewTotals_() {
    return Object.keys(state.pendingTaskScorePreviews || {}).reduce(
      (totals, previewKey) => {
        const preview = normalizeTaskScorePreviewDelta_(
          state.pendingTaskScorePreviews[previewKey]
        );
        totals.personalPoints += preview.personalPoints;
        totals.groupPoints += preview.groupPoints;
        return totals;
      },
      { personalPoints: 0, groupPoints: 0 }
    );
  }

  function renderPendingTaskScorePreview_() {
    const official = getOfficialHomeScoreSnapshot_();
    const pending = getPendingTaskScorePreviewTotals_();
    const baseline = state.pendingTaskScoreBaseline || {
      personalPoints: official.personalPoints,
      groupPoints: official.groupPoints
    };
    const hasPending = Object.keys(state.pendingTaskScorePreviews || {}).length > 0;
    const contributionValue = hasPending
      ? Math.max(
          official.personalPoints,
          Number(baseline.personalPoints || 0) + pending.personalPoints
        )
      : official.personalPoints;
    const groupValue = state.homeGroupEnabled === false
      ? 0
      : (hasPending
          ? Math.max(
              official.groupPoints,
              Number(baseline.groupPoints || 0) + pending.groupPoints
            )
          : official.groupPoints);

    const contributionText = $('#homeContributionText');
    const groupText = $('#homeGroupScoreText');
    if (contributionText) contributionText.textContent = formatNumber(contributionValue);
    if (groupText) groupText.textContent = formatNumber(groupValue);

    const contributionBadge = $('#homeContributionSyncText');
    if (contributionBadge) {
      contributionBadge.hidden = true;
      contributionBadge.textContent = '';
    }

    const groupBadge = $('#homeGroupSyncText');
    if (groupBadge) {
      groupBadge.hidden = true;
      groupBadge.textContent = '';
    }
  }

  function beginPendingTaskScorePreview_(previewKey, delta) {
    previewKey = String(previewKey || '').trim();
    const normalized = normalizeTaskScorePreviewDelta_(delta);
    if (!previewKey || (!normalized.personalPoints && !normalized.groupPoints)) return;

    const currentKeys = Object.keys(state.pendingTaskScorePreviews || {});
    if (!currentKeys.length) {
      const official = getOfficialHomeScoreSnapshot_();
      state.pendingTaskScoreBaseline = {
        personalPoints: official.personalPoints,
        groupPoints: official.groupPoints
      };
    }
    state.pendingTaskScorePreviews[previewKey] = normalized;
    renderPendingTaskScorePreview_();
  }

  function replacePendingTaskScorePreview_(oldKey, newKey, delta) {
    oldKey = String(oldKey || '').trim();
    newKey = String(newKey || '').trim();

    /*
     * submitDailyPractice / submitMeetingPractice 接受 Queue 事件時，目前後端
     * 不回 optimisticDelta。此時必須把送出前依動態 taskConfig 建立的 local
     * preview 原樣交接給 eventId，不能因為 response 沒有 delta 就把分數拿掉。
     * 若未來後端明確提供 delta，仍以後端值為準。
     */
    const existing = oldKey && state.pendingTaskScorePreviews[oldKey]
      ? normalizeTaskScorePreviewDelta_(state.pendingTaskScorePreviews[oldKey])
      : null;
    const hasServerDelta = !!delta && typeof delta === 'object';
    const normalized = hasServerDelta
      ? normalizeTaskScorePreviewDelta_(delta)
      : (existing || normalizeTaskScorePreviewDelta_(null));

    if (oldKey) delete state.pendingTaskScorePreviews[oldKey];
    if (newKey && (normalized.personalPoints || normalized.groupPoints)) {
      state.pendingTaskScorePreviews[newKey] = normalized;
    }
    if (!Object.keys(state.pendingTaskScorePreviews).length) {
      const official = getOfficialHomeScoreSnapshot_();
      state.pendingTaskScoreBaseline = {
        personalPoints: official.personalPoints,
        groupPoints: official.groupPoints
      };
    }
    renderPendingTaskScorePreview_();
  }

  function removePendingTaskScorePreview_(previewKey, deferRender) {
    previewKey = String(previewKey || '').trim();
    if (previewKey) delete state.pendingTaskScorePreviews[previewKey];
    if (!deferRender) rebasePendingTaskScorePreview_();
  }

  function rebasePendingTaskScorePreview_() {
    const official = getOfficialHomeScoreSnapshot_();
    state.pendingTaskScoreBaseline = {
      personalPoints: official.personalPoints,
      groupPoints: official.groupPoints
    };
    renderPendingTaskScorePreview_();
  }

  function clearPendingTaskScorePreviews_() {
    state.pendingTaskScorePreviews = {};
    const official = getOfficialHomeScoreSnapshot_();
    state.pendingTaskScoreBaseline = {
      personalPoints: official.personalPoints,
      groupPoints: official.groupPoints
    };
    renderPendingTaskScorePreview_();
  }

  function getTaskUiPendingBucket_(kind) {
    const key = kind === 'MEETING' ? 'weekly' : 'daily';
    if (!state.pendingTaskUi || typeof state.pendingTaskUi !== 'object') {
      state.pendingTaskUi = { daily: {}, weekly: {} };
    }
    if (!state.pendingTaskUi[key] || typeof state.pendingTaskUi[key] !== 'object') {
      state.pendingTaskUi[key] = {};
    }
    return state.pendingTaskUi[key];
  }

  function isTaskUiPending_(kind, taskType) {
    taskType = String(taskType || '').trim();
    return !!(taskType && getTaskUiPendingBucket_(kind)[taskType]);
  }

  function setTaskUiPending_(kind, taskType, pending) {
    taskType = String(taskType || '').trim();
    if (!taskType) return;
    const bucket = getTaskUiPendingBucket_(kind);
    if (pending) {
      bucket[taskType] = true;
    } else {
      delete bucket[taskType];
    }
  }

  function showTaskSubmitLoadingBriefly_(text) {
    const generation = Number(state.taskSubmitLoadingGeneration || 0) + 1;
    state.taskSubmitLoadingGeneration = generation;

    if (state.taskSubmitLoadingTimer) {
      window.clearTimeout(state.taskSubmitLoadingTimer);
    }

    setLoading(true, text || '儲存任務...');
    state.taskSubmitLoadingTimer = window.setTimeout(() => {
      if (Number(state.taskSubmitLoadingGeneration || 0) !== generation) return;
      state.taskSubmitLoadingTimer = null;
      setLoading(false);
    }, TASK_SUBMIT_LOADING_VISIBLE_MS);
  }

  function submitTaskWriteWithRecovery_(action, payload) {
    return callServer(action, payload).catch((firstError) =>
      callServer(action, payload).catch(() => {
        throw firstError;
      })
    );
  }

  function buildClientTaskScorePreview_(kind, taskType) {
    const config = kind === 'DAILY'
      ? PRACTICE_CONFIG[taskType]
      : WEEKLY_TASK_CONFIG[taskType];
    const points = Math.max(0, Number(config && config.score || 0));
    const cooperative = kind === 'DAILY'
      ? taskType === 'morning'
      : taskType === 'outreachVisit';
    return {
      personalPoints: cooperative ? 0 : points,
      groupPoints: points,
      selectedTaskField: String(config && config.field || ''),
      source: 'LOADED_TASK_CONFIG'
    };
  }

  function mergeCompletedTaskRecord_(currentRecord, incomingRecord, fields) {
    const current = currentRecord || {};
    const incoming = incomingRecord || {};
    const merged = Object.assign({}, current, incoming);
    fields.forEach((field) => {
      merged[field] = toBool(current[field]) || toBool(incoming[field]);
    });
    return merged;
  }

  function shouldApplyCompletedTaskRecord_(kind, record) {
    record = record || {};
    if (kind === 'DAILY') {
      const recordDate = String(record.recordDate || '').trim();
      return !recordDate || recordDate === getTaipeiBusinessDate_();
    }
    const incomingWeekKey = String(record.weekKey || '').trim();
    const currentWeekKey = String(
      state.weeklyTaskRecord && state.weeklyTaskRecord.weekKey || getTaipeiIsoWeekKey_()
    ).trim();
    return !incomingWeekKey || !currentWeekKey || incomingWeekKey === currentWeekKey;
  }

  function applyCompletedTaskPlayerSnapshot_(kind, result) {
    result = result || {};
    const incoming = result.player || null;
    const current = state.currentPlayer || null;

    if (!incoming || !current) {
      return false;
    }

    const incomingPlayerId = String(incoming.playerId || '').trim();
    const currentPlayerId = String(current.playerId || '').trim();
    if (!incomingPlayerId || incomingPlayerId !== currentPlayerId) {
      return false;
    }

    const incomingDataEpochId = String(incoming.currentDataEpochId || '').trim();
    const currentDataEpochId = String(
      state.currentDataEpochId || current.currentDataEpochId || ''
    ).trim();
    if (incomingDataEpochId && currentDataEpochId && incomingDataEpochId !== currentDataEpochId) {
      return false;
    }

    const incomingGroupId = String(incoming.groupId || '').trim();
    const currentGroupId = String(current.groupId || '').trim();
    if (incomingGroupId !== currentGroupId) {
      return false;
    }

    const nextPlayer = Object.assign({}, current, {
      totalScore: Math.max(
        Number(current.totalScore || 0),
        Number(incoming.totalScore || 0)
      ),
      updatedAt: incoming.updatedAt || current.updatedAt || ''
    });

    if (kind === 'DAILY') {
      nextPlayer.dailyStreak = Number(incoming.dailyStreak || 0);
      nextPlayer.lastDailyFullDate = String(incoming.lastDailyFullDate || '');
    }

    state.currentPlayer = nextPlayer;
    persistCurrentPlayer();
    renderPlayer(nextPlayer);

    if (state.groupJourney) {
      state.groupJourney = Object.assign({}, state.groupJourney, {
        myContributionScore: Number(nextPlayer.totalScore || 0)
      });
      renderGroupJourney(state.groupJourney);
    }

    return true;
  }

  function applyCompletedTaskOfficialScores_(result) {
    result = result || {};
    const scores = result.officialScores || null;
    const player = state.currentPlayer || null;
    if (!scores || !player) return false;

    const currentPlayerId = String(player.playerId || '').trim();
    const currentGroupId = String(player.groupId || '').trim();
    const currentDataEpochId = String(
      state.currentDataEpochId || player.currentDataEpochId || ''
    ).trim();
    if (String(scores.playerId || '').trim() !== currentPlayerId) return false;
    if (String(scores.groupId || '').trim() !== currentGroupId) return false;
    if (String(scores.dataEpochId || '').trim() && currentDataEpochId &&
        String(scores.dataEpochId || '').trim() !== currentDataEpochId) return false;

    state.currentPlayer = Object.assign({}, player, {
      totalScore: Math.max(0, Number(scores.personalPoints || 0))
    });
    persistCurrentPlayer();

    if (state.groupJourney) {
      state.groupJourney = Object.assign({}, state.groupJourney, {
        totalScore: Math.max(0, Number(scores.groupPoints || 0)),
        myContributionScore: Math.max(0, Number(scores.personalPoints || 0))
      });
    }
    renderPlayer(state.currentPlayer);
    if (state.groupJourney) renderGroupJourney(state.groupJourney);
    return true;
  }

  function applyCompletedTaskWriteResult_(kind, result) {
    result = result || {};
    if (kind === 'DAILY' && result.record &&
        shouldApplyCompletedTaskRecord_(kind, result.record)) {
      state.dailyRecord = mergeCompletedTaskRecord_(
        state.dailyRecord,
        result.record,
        ['morningRevival', 'bibleReading', 'prayer', 'bookPursuit']
      );
    }
    if (kind === 'MEETING' && result.record &&
        shouldApplyCompletedTaskRecord_(kind, result.record)) {
      state.weeklyTaskRecord = mergeCompletedTaskRecord_(
        state.weeklyTaskRecord,
        result.record,
        ['smallGroup', 'prayerMeeting', 'lordDayMeeting', 'outreachVisit']
      );
    }

    /*
     * 背景事件保存的是接受當時的玩家快照；完成回應不得覆蓋目前登入者、
     * 換組或晉級後的新狀態。玩家與旅程資料由輕量同步版本重新取得。
     */
    if (kind === 'DAILY') invalidateByRule_('dailyPracticeChanged');
    if (kind === 'MEETING') invalidateByRule_('meetingPracticeChanged');
    renderDailyStatus();
    renderWeeklyTaskStatus();
    const officialScoresApplied = applyCompletedTaskOfficialScores_(result);
    if (!officialScoresApplied) {
      applyCompletedTaskPlayerSnapshot_(kind, result);
      applyRewardSummaryToHome(result.rewardSummary);
    }
    checkHomeSyncState_();
  }

  const TASK_WRITE_SYNC_RETRY_DELAYS_MS = [0, 1200, 2000, 3000, 5000, 8000, 13000, 20000];

  function finishTaskWriteSyncTracking_(eventId) {
    const tracking = state.taskWriteSyncInFlight[eventId];
    if (tracking && tracking.timerId) {
      window.clearTimeout(tracking.timerId);
    }
    delete state.taskWriteSyncInFlight[eventId];
  }

  function continueTaskWriteProcessing_(eventId, kind, queueRowNumber) {
    eventId = String(eventId || '').trim();
    if (!eventId || state.taskWriteSyncInFlight[eventId]) return;

    state.taskWriteSyncInFlight[eventId] = {
      attempt: 0,
      timerId: 0,
      queueRowNumber: Number(queueRowNumber || 0)
    };

    const runAttempt = () => {
      const tracking = state.taskWriteSyncInFlight[eventId];
      if (!tracking) return;
      const attemptIndex = Number(tracking.attempt || 0);
      const action = 'processTaskWriteEvent';

      callServer(action, {
        eventId,
        queueRowNumber: Number(tracking.queueRowNumber || 0)
      })
        .then((res) => {
          const data = res && res.data || {};
          if (Number(data.queueRowNumber || 0) >= 2) {
            tracking.queueRowNumber = Number(data.queueRowNumber);
          }
          if (data.optimisticDelta) {
            replacePendingTaskScorePreview_(eventId, eventId, data.optimisticDelta);
          }

          if (isSuccess(res) && String(data.status || '') === 'COMPLETED' && data.result) {
            removePendingTaskScorePreview_(eventId, true);
            applyCompletedTaskWriteResult_(kind, data.result);
            rebasePendingTaskScorePreview_();
            notifyOtherAppInstances_('taskWriteCompleted');
            finishTaskWriteSyncTracking_(eventId);
            return;
          }

          if (String(data.status || '') === 'FAILED') {
            removePendingTaskScorePreview_(eventId);
            setResultMessage(
              '#homeMessage',
              '任務處理失敗，請稍後再試。',
              false
            );
            finishTaskWriteSyncTracking_(eventId);
            return;
          }

          const nextAttempt = attemptIndex + 1;
          if (nextAttempt >= TASK_WRITE_SYNC_RETRY_DELAYS_MS.length) {
            removePendingTaskScorePreview_(eventId);
            finishTaskWriteSyncTracking_(eventId);
            return;
          }

          tracking.attempt = nextAttempt;
          tracking.timerId = window.setTimeout(
            runAttempt,
            TASK_WRITE_SYNC_RETRY_DELAYS_MS[nextAttempt]
          );
        })
        .catch(() => {
          const current = state.taskWriteSyncInFlight[eventId];
          if (!current) return;
          const nextAttempt = Number(current.attempt || 0) + 1;
          if (nextAttempt >= TASK_WRITE_SYNC_RETRY_DELAYS_MS.length) {
            removePendingTaskScorePreview_(eventId);
            finishTaskWriteSyncTracking_(eventId);
            return;
          }
          current.attempt = nextAttempt;
          current.timerId = window.setTimeout(
            runAttempt,
            TASK_WRITE_SYNC_RETRY_DELAYS_MS[nextAttempt]
          );
        });
    };

    runAttempt();
  }

  const STALE_REQUEST_ERROR_CODE = 'STALE_REQUEST';
  const SERVER_MUTATION_APIS = new Set([
    'loginPlayer', 'registerPlayer', 'logoutPlayer', 'updatePlayerAvatar', 'markPlayerMessageRead',
    'suppressPlayerMessageToday', 'updateMyAccount', 'updateMyPassword',
    'createVitalGroup', 'joinVitalGroupByInviteCode', 'switchPrimaryVitalGroup',
    'transferVitalGroupOwnership', 'leaveVitalGroup', 'createGroupPost', 'updateGroupPost', 'deleteGroupPost',
    'submitDailyPractice', 'submitMeetingPractice', 'processTaskWriteEvent', 
      
    'claimPlayerChestReward'
  ]);
  const PENDING_MUTATION_TTL_MS = 24 * 60 * 60 * 1000;
  const TAIPEI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

  const JOURNEY_CHAPTERS = [
    { key: 'faith', title: '信心' },
    { key: 'virtue', title: '美德' },
    { key: 'knowledge', title: '知識' },
    { key: 'selfControl', title: '節制' },
    { key: 'endurance', title: '忍耐' },
    { key: 'godliness', title: '敬虔' },
    { key: 'brotherlyAffection', title: '弟兄相愛' },
    { key: 'love', title: '愛' }
  ];

  /*
   * 前端只保留欄位對應，不保存任務名稱、積分或確認文字。
   * 實際顯示內容全部由後端 SystemSettings → taskConfig 注入，
   * 避免前後端各自硬編碼一套設定。
   */
  const PRACTICE_CONFIG = {
    morning: {
      field: 'morningRevival',
      title: '',
      description: '',
      reward: ''
    },
    bible: {
      field: 'bibleReading',
      title: '',
      description: '',
      reward: ''
    },
    prayer: {
      field: 'prayer',
      title: '',
      description: '',
      reward: ''
    },
    book: {
      field: 'bookPursuit',
      title: '',
      description: '',
      reward: ''
    }
  };

  const WEEKLY_TASK_CONFIG = {
    outreachVisit: {
      field: 'outreachVisit',
      title: '',
      description: '',
      reward: ''
    },
    smallGroup: {
      field: 'smallGroup',
      title: '',
      description: '',
      reward: ''
    },
    prayerMeeting: {
      field: 'prayerMeeting',
      title: '',
      description: '',
      reward: ''
    },
    lordDayMeeting: {
      field: 'lordDayMeeting',
      title: '',
      description: '',
      reward: ''
    }
  };


  function applyTaskConfiguration_(taskConfig) {
    taskConfig = taskConfig || {};
    const daily = taskConfig.daily || {};
    const meeting = taskConfig.meeting || {};

    Object.keys(PRACTICE_CONFIG).forEach((type) => {
      const source = daily[type] || {};
      const config = PRACTICE_CONFIG[type];

      config.title = String(source.title || '').trim();
      config.description = String(source.description || '').trim();

      const score = Math.max(0, Number(source.score || 0));
      config.score = score;
      config.reward = String(source.reward || '').trim() ||
        (
          type === 'morning'
            ? '合作取得 +' + score
            : '個人貢獻 +' + score
        );
    });

    Object.keys(WEEKLY_TASK_CONFIG).forEach((type) => {
      const source = meeting[type] || {};
      const config = WEEKLY_TASK_CONFIG[type];

      config.title = String(source.title || '').trim();
      config.description = String(source.description || '').trim();

      const score = Math.max(0, Number(source.score || 0));
      config.score = score;
      config.reward = String(source.reward || '').trim() ||
        (
          type === 'outreachVisit'
            ? '合作取得 +' + score
            : '個人貢獻 +' + score
        );
    });

    const cardTargets = {
      morning: ['#homeMorningBtn', '#dailyMorningBtn'],
      bible: ['#homeBibleBtn', '#dailyBibleBtn'],
      prayer: ['#homePrayerPracticeBtn', '#dailyPrayerBtn'],
      book: ['#homeBookBtn', '#dailyBookBtn'],
      outreachVisit: ['#homeOutreachVisitBtn'],
      smallGroup: ['#homeWeeklySmallGroupBtn'],
      prayerMeeting: ['#homeWeeklyPrayerMeetingBtn'],
      lordDayMeeting: ['#homeWeeklyLordDayBtn']
    };

    Object.keys(cardTargets).forEach((type) => {
      const config =
        PRACTICE_CONFIG[type] ||
        WEEKLY_TASK_CONFIG[type];

      if (!config) {
        return;
      }

      cardTargets[type].forEach((selector) => {
        const card = document.querySelector(selector);

        if (!card) {
          return;
        }

        const title = card.querySelector('strong');
        const reward = card.querySelector('small');

        if (title) {
          title.textContent = config.title;
        }

        if (reward) {
          reward.textContent = config.reward;
        }
      });
    });
  }

  const state = {
    currentPlayer: null,
    sessionToken: '',
    sessionInvalidated: false,
    sessionGeneration: 0,
    currentDataEpochId: '',
    cache: {},
    cacheRequestSequence: 0,
    groups: [],
    dailyRecord: null,
    weeklyTaskRecord: null,
    groupJourney: null,
    homeGroupPosts: [],
    myGroupPost: null,
    homeGroupMemberCount: 0,
    homeGroupEnabled: true,
    homeGroupStatusMessage: '',
    chestSummary: null,
    messageCenter: createEmptyMessageCenterState_(),
    messageCenterFilter: 'ANNOUNCEMENT',
    selectedMessageKey: '',
    messageCenterAutoOpenedKey: '',
    messageReadInFlight: new Set(),
    pendingMessageCenterSuppressions: new Map(),
    messageCenterSuppressionFlushInFlight: new Set(),
    messageCenterSuppressionRetryAttempts: new Map(),
    messageCenterSuppressionRetryTimer: null,
    vitalGroups: [],
    selectedPracticeType: '',
    selectedWeeklyTaskType: '',
    pendingDailyRequestId: '',
    pendingWeeklyRequestId: '',
    pendingTaskUi: { daily: {}, weekly: {} },
    taskSubmitLoadingTimer: null,
    taskSubmitLoadingGeneration: 0,
    taskWriteSyncInFlight: {},
    pendingTaskScorePreviews: {},
    pendingTaskScoreBaseline: {
      personalPoints: 0,
      groupPoints: 0
    },
    pendingGroupCreateRequestId: '',
    pendingGroupCreateSignature: '',
    pendingGroupPostCreateRequestId: '',
    pendingGroupPostCreateSignature: '',
    registrationInFlight: false,
    selectedChestDetail: null,
    pendingConfirm: null,
    registrationAreaOptions: [],
    registerAvatar: null,
    avatarModal: null,
    editingGroupPostId: '',
    groupPostTimer: null,
    imageCache: {},
    businessDate: '',
    homeSyncToken: '',
    homeSyncCheckInFlight: false,
    homeSyncLastCheckedAt: 0,
    homeSyncResumeTimer: null,
    crossDayRefreshTimer: null,
    homeSyncTimer: null,
    appSyncChannel: null
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  document.addEventListener('DOMContentLoaded', initApp);

  function initApp() {
    applySavedTheme();
    bindEvents();
    initRegisterAvatar();
    hydrateExistingImages_();
    initializeAppLifecycleRefresh_();
    restoreSession();
  }

  function getTaipeiBusinessDate_() {
    return new Date(
      Date.now() + TAIPEI_UTC_OFFSET_MS
    ).toISOString().slice(0, 10);
  }

  function getTaipeiIsoWeekKey_() {
    const taipeiNow = new Date(Date.now() + TAIPEI_UTC_OFFSET_MS);
    const date = new Date(Date.UTC(
      taipeiNow.getUTCFullYear(),
      taipeiNow.getUTCMonth(),
      taipeiNow.getUTCDate()
    ));
    const dayNumber = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNumber);
    const isoYear = date.getUTCFullYear();
    const yearStart = new Date(Date.UTC(isoYear, 0, 1));
    const isoWeek = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return isoYear + '-W' + String(isoWeek).padStart(2, '0');
  }

  function getMillisecondsUntilNextTaipeiMidnight_() {
    const now = Date.now();
    const taipeiNow = new Date(now + TAIPEI_UTC_OFFSET_MS);
    const nextMidnightTaipeiAsUtc = Date.UTC(
      taipeiNow.getUTCFullYear(),
      taipeiNow.getUTCMonth(),
      taipeiNow.getUTCDate() + 1,
      0,
      0,
      0,
      0
    );
    const targetUtc =
      nextMidnightTaipeiAsUtc -
      TAIPEI_UTC_OFFSET_MS;

    return Math.max(
      1000,
      targetUtc - now + 250
    );
  }

  function scheduleNextTaipeiMidnightRefresh_() {
    if (state.crossDayRefreshTimer) {
      window.clearTimeout(state.crossDayRefreshTimer);
    }

    state.crossDayRefreshTimer = window.setTimeout(() => {
      handleBusinessDateBoundary_();
      scheduleNextTaipeiMidnightRefresh_();
    }, getMillisecondsUntilNextTaipeiMidnight_());
  }

  function handleBusinessDateBoundary_() {
    const currentDate = getTaipeiBusinessDate_();
    const previousDate = String(state.businessDate || '');

    if (!previousDate) {
      state.businessDate = currentDate;
      return false;
    }

    if (previousDate === currentDate) {
      return false;
    }

    state.businessDate = currentDate;
    state.homeSyncToken = '';

    /*
     * 跨日後所有前端資料快取立即失效。
     * 不只首頁：每日紀錄、聚會週期、訊息中心與旅程資料都重新以新日期取得。
     */
    clearAllAppCache_();
    state.dailyRecord = createEmptyDailyRecord();
    state.weeklyTaskRecord = createEmptyWeeklyTaskRecord();

    if (
      state.currentPlayer &&
      state.currentPlayer.playerId &&
      state.sessionToken
    ) {
      refreshDashboard(false);
    }

    return true;
  }

  function checkHomeSyncState_(options) {
    options = options || {};
    const now = Date.now();
    if (
      state.homeSyncCheckInFlight ||
      !state.sessionToken ||
      !state.currentPlayer ||
      !state.currentPlayer.playerId ||
      document.visibilityState === 'hidden' ||
      (!options.force &&
        now - Number(state.homeSyncLastCheckedAt || 0) <
          HOME_SYNC_MIN_GAP_MS)
    ) {
      return;
    }

    state.homeSyncCheckInFlight = true;
    state.homeSyncLastCheckedAt = now;

    callServer('getHomeSyncState')
      .then((res) => {
        if (!isSuccess(res) || !res.data) {
          return;
        }

        const data = res.data || {};
        const serverBusinessDate = String(
          data.businessDate || ''
        ).trim();

        if (
          serverBusinessDate &&
          serverBusinessDate !== String(state.businessDate || '')
        ) {
          state.businessDate = serverBusinessDate;
          state.homeSyncToken = '';
          clearAllAppCache_();
          return refreshDashboard(false);
        }

        const nextToken = String(data.token || '').trim();

        if (!nextToken) {
          return;
        }

        if (!state.homeSyncToken) {
          state.homeSyncToken = nextToken;
          return;
        }

        if (nextToken !== state.homeSyncToken) {
          invalidateCache_('dashboard');
          invalidateCaches_([
            'groupInfo',
            'groupAnnouncements',
            'journey',
            'groupJourneyList',
            'contribution',
            'growth',
            'chestSummary',
            'chestCollection',
            'chestSettingsForPlayer',
            'accountProfile'
          ]);
          return refreshDashboard(false);
        }
      })
      .catch(() => {})
      .finally(() => {
        state.homeSyncCheckInFlight = false;
      });
  }

  function getCurrentSessionSyncKey_() {
    const token = String(state.sessionToken || '').trim();
    return token
      ? digestPendingMutationPayload_('session::' + token)
      : '';
  }

  function notifyOtherAppInstances_(reason) {
    const playerId = String(
      state.currentPlayer && state.currentPlayer.playerId || ''
    ).trim();
    const sessionKey = getCurrentSessionSyncKey_();

    if (!playerId || !sessionKey) return;

    const payload = {
      playerId: playerId,
      sessionKey: sessionKey,
      reason: String(reason || 'dataChanged'),
      timestamp: Date.now()
    };

    if (state.appSyncChannel) {
      try {
        state.appSyncChannel.postMessage(payload);
      } catch (error) {}
    }

    try {
      localStorage.setItem(APP_SYNC_SIGNAL_KEY, JSON.stringify(payload));
    } catch (error) {}
  }

  function handleExternalAppSyncSignal_(payload) {
    payload = payload || {};

    const currentPlayerId = String(
      state.currentPlayer && state.currentPlayer.playerId || ''
    ).trim();
    const targetPlayerId = String(payload.playerId || '').trim();
    const currentSessionKey = getCurrentSessionSyncKey_();
    const targetSessionKey = String(payload.sessionKey || '').trim();
    const reason = String(payload.reason || 'dataChanged').trim();

    if (
      !currentPlayerId ||
      targetPlayerId !== currentPlayerId ||
      !currentSessionKey ||
      targetSessionKey !== currentSessionKey
    ) {
      return;
    }

    if (reason === 'sessionRevoked' || reason === 'passwordChanged') {
      state.sessionInvalidated = true;
      clearCurrentSession({ preserveSessionInvalidated: true });
      showAuth();
      showAuthMessage(
        reason === 'passwordChanged'
          ? '登入密碼已變更，請重新登入。'
          : '此登入工作階段已登出。'
      );
      return;
    }

    checkHomeSyncState_({ force: true });
  }

  function initializeCrossTabSync_() {
    if ('BroadcastChannel' in window) {
      try {
        state.appSyncChannel = new BroadcastChannel(APP_SYNC_CHANNEL_NAME);
        state.appSyncChannel.onmessage = (event) => {
          handleExternalAppSyncSignal_(event && event.data || {});
        };
      } catch (error) {
        state.appSyncChannel = null;
      }
    }

    window.addEventListener('storage', (event) => {
      if (event.key !== APP_SYNC_SIGNAL_KEY || !event.newValue) {
        return;
      }

      try {
        handleExternalAppSyncSignal_(JSON.parse(event.newValue));
      } catch (error) {}
    });
  }

  function handleAppResume_() {
    const crossedDate = handleBusinessDateBoundary_();

    if (!crossedDate) {
      if (state.homeSyncResumeTimer) {
        window.clearTimeout(state.homeSyncResumeTimer);
      }
      state.homeSyncResumeTimer = window.setTimeout(() => {
        state.homeSyncResumeTimer = null;
        checkHomeSyncState_();
      }, HOME_SYNC_RESUME_DEBOUNCE_MS);
    }
  }

  function initializeAppLifecycleRefresh_() {
    state.businessDate = getTaipeiBusinessDate_();

    scheduleNextTaipeiMidnightRefresh_();
    initializeCrossTabSync_();

    if (state.homeSyncTimer) {
      window.clearInterval(state.homeSyncTimer);
    }

    state.homeSyncTimer = window.setInterval(
      checkHomeSyncState_,
      HOME_SYNC_POLL_MS
    );

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleAppResume_();
      }
    });

    window.addEventListener('pageshow', handleAppResume_);
    window.addEventListener('focus', handleAppResume_);
  }

  function normalizeManagedImageUrl_(url) {
    url = String(url || '').trim();
    if (!url) return '';

    const avatarMatch = url.match(
      /\/((?:avatar-male|avatar-female)\/(?:avatar-male|avatar-female)-direct-\d{3}\.png)(?:[?#].*)?$/i
    );
    if (avatarMatch) {
      return ASSET_BASE_URL + '/' + avatarMatch[1];
    }

    return url;
  }

  function hydrateExistingImages_(root) {
    const scope = root || document;

    Array.from(scope.querySelectorAll('img[src], img[data-managed-url]')).forEach((img) => {
      const managedUrl = img.dataset.managedUrl || '';
      const url = managedUrl || img.getAttribute('src') || '';

      if (!url || (!managedUrl && url.indexOf('data:') === 0)) {
        return;
      }

      const imageKey = img.dataset.imageKey || url;
      const isImmediateAsset = /^chest\d{2}$/i.test(String(imageKey || ''));
      setManagedImageSource_(img, url, imageKey, {
        loading: isImmediateAsset ? 'eager' : (img.getAttribute('loading') || undefined),
        priority: isImmediateAsset ? 'high' : undefined
      });
    });
  }

  function getChestImageAssetKey_(chestId) {
    const match = String(chestId || '').match(/Chest_(\d{2})/);
    const id = match ? match[1] : '01';

    return 'chest' + id;
  }

  function getChestImageUrl_(chest) {
    const key = getChestImageAssetKey_(chest && chest.chestId);
    const configuredUrl = String(chest && chest.imageUrl || '').trim();

    return IMAGE_ASSETS[key] || configuredUrl || IMAGE_FALLBACK_DATA_URL;
  }

  function setManagedImageSource_(img, url, key, options) {
    if (!img || !url) {
      return Promise.resolve('');
    }

    options = options || {};
    url = normalizeManagedImageUrl_(url);
    const fallbackUrl =
      Object.prototype.hasOwnProperty.call(options, 'fallbackUrl')
        ? options.fallbackUrl
        : IMAGE_FALLBACK_DATA_URL;
    const currentUrl = String(img.dataset.managedLoadedUrl || '').trim();

    if (
      currentUrl === url &&
      img.complete &&
      Number(img.naturalWidth || 0) > 0
    ) {
      img.classList.remove('managed-image-loading', 'managed-image-fallback');
      return Promise.resolve(url);
    }

    img.decoding = 'async';
    if (options.priority === 'high') {
      img.loading = 'eager';
      try {
        img.fetchPriority = 'high';
      } catch (error) {}
    } else {
      img.loading = options.loading === 'eager' ? 'eager' : 'lazy';
    }

    img.classList.add('managed-image-loading');
    img.classList.remove('managed-image-fallback');

    return loadManagedImage_(key || url, url)
      .then((loadedUrl) => {
        if (img.getAttribute('src') !== loadedUrl) {
          img.src = loadedUrl;
        }
        img.dataset.managedLoadedUrl = url;
        img.classList.remove('managed-image-loading', 'managed-image-fallback');
        return loadedUrl;
      })
      .catch((error) => {
        console.warn('[image-load-failed]', {
          key: key || url,
          url: url,
          retryCount: IMAGE_LOAD_MAX_RETRIES,
          error: error && error.message ? error.message : String(error || '')
        });
        if (typeof options.onFallback === 'function') {
          options.onFallback(error);
        }

        if (fallbackUrl) {
          if (img.getAttribute('src') !== fallbackUrl) {
            img.src = fallbackUrl;
          }
          img.dataset.managedLoadedUrl = fallbackUrl;
        } else {
          img.removeAttribute('src');
          delete img.dataset.managedLoadedUrl;
        }

        img.classList.remove('managed-image-loading');
        if (fallbackUrl) {
          img.classList.add('managed-image-fallback');
        }
        return fallbackUrl;
      });
  }

  function setAvatarImageSource_(image, placeholder, url, key, fallbackUrl) {
    if (!image || !placeholder) {
      return;
    }

    url = normalizeManagedImageUrl_(url);
    fallbackUrl = String(fallbackUrl || '').trim();
    key = String(key || url || '').trim();

    if (!url) {
      image.classList.add('hidden');
      image.removeAttribute('src');
      delete image.dataset.managedLoadedUrl;
      placeholder.classList.remove('hidden');
      return;
    }

    if (
      String(image.dataset.managedLoadedUrl || '') === url &&
      image.complete &&
      Number(image.naturalWidth || 0) > 0
    ) {
      image.classList.remove('hidden', 'managed-image-loading', 'managed-image-fallback');
      placeholder.classList.add('hidden');
      return;
    }

    image.decoding = 'async';
    image.loading = 'eager';
    try {
      image.fetchPriority = 'high';
    } catch (error) {}

    let retryCount = 0;
    let usingFallback = false;
    let attemptSequence = 0;

    const applySource = () => {
      const sourceUrl = usingFallback ? fallbackUrl : url;
      const targetUrl = buildRetryImageUrl_(sourceUrl, retryCount);
      const attemptId = ++attemptSequence;
      let settled = false;

      const finishAttempt = (handler) => {
        if (settled || attemptId !== attemptSequence) return;
        settled = true;
        window.clearTimeout(timeoutId);
        image.onload = null;
        image.onerror = null;
        handler();
      };

      const handleFailure = (reason) => {
        if (retryCount < IMAGE_LOAD_MAX_RETRIES) {
          retryCount += 1;
          window.setTimeout(applySource, 250);
          return;
        }

        if (!usingFallback && fallbackUrl && fallbackUrl !== url) {
          usingFallback = true;
          retryCount = 0;
          applySource();
          return;
        }

        console.warn('[image-load-failed]', {
          key: key,
          url: sourceUrl,
          retryCount: retryCount,
          error: reason
        });
        image.classList.add('hidden');
        image.removeAttribute('src');
        delete image.dataset.managedLoadedUrl;
        placeholder.classList.remove('hidden');
      };

      image.onload = () => finishAttempt(() => {
        image.dataset.managedLoadedUrl = sourceUrl;
        image.classList.remove('hidden', 'managed-image-loading', 'managed-image-fallback');
        placeholder.classList.add('hidden');
      });

      image.onerror = () => finishAttempt(() => handleFailure('avatar-load-failed'));

      const timeoutId = window.setTimeout(() => {
        finishAttempt(() => handleFailure('avatar-load-timeout'));
      }, IMAGE_LOAD_TIMEOUT_MS);

      image.classList.add('managed-image-loading', 'hidden');
      image.classList.remove('managed-image-fallback');
      placeholder.classList.remove('hidden');
      if (image.getAttribute('src') !== targetUrl) {
        image.src = targetUrl;
      }
    };

    applySource();
  }

  function loadManagedImage_(key, url) {
    key = String(key || url || '').trim();
    url = String(url || '').trim();

    if (!url) {
      return Promise.reject(new Error('缺少圖片網址'));
    }

    state.imageCache = state.imageCache || {};
    const cacheKey = url;

    if (state.imageCache[cacheKey] && state.imageCache[cacheKey].status === 'loaded') {
      return Promise.resolve(state.imageCache[cacheKey].url);
    }

    if (state.imageCache[cacheKey] && state.imageCache[cacheKey].promise) {
      return state.imageCache[cacheKey].promise;
    }

    const promise = loadImageWithRetry_(key, url, 0)
      .then((loadedUrl) => {
        state.imageCache[cacheKey] = {
          status: 'loaded',
          url: loadedUrl
        };

        return loadedUrl;
      })
      .catch((error) => {
        delete state.imageCache[cacheKey];
        throw error;
      });

    state.imageCache[cacheKey] = {
      status: 'loading',
      promise: promise
    };

    return promise;
  }


  function loadImageWithRetry_(key, url, retryCount) {
    const targetUrl = buildRetryImageUrl_(url, retryCount);

    return loadSingleImage_(targetUrl)
      .catch((error) => {
        if (retryCount >= IMAGE_LOAD_MAX_RETRIES) {
          console.warn('[image-load-failed]', {
            key: key,
            url: url,
            retryCount: retryCount,
            error: error && error.message ? error.message : String(error || '')
          });
          throw error;
        }

        return wait_(350 + retryCount * 220)
          .then(() => loadImageWithRetry_(key, url, retryCount + 1));
      });
  }

  function buildRetryImageUrl_(url, retryCount) {
    if (url.indexOf('data:') === 0) {
      return url;
    }

    const separator = url.indexOf('?') === -1 ? '?' : '&';
    const versionedUrl = /[?&]v=/.test(url)
      ? url
      : url + separator + 'v=' + encodeURIComponent(IMAGE_ASSET_VERSION);

    return retryCount
      ? versionedUrl + '&retry=' + retryCount
      : versionedUrl;
  }

  function loadSingleImage_(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let settled = false;

      const finish = (handler) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        img.onload = null;
        img.onerror = null;
        handler();
      };

      img.decoding = 'async';
      img.onload = () => finish(() => resolve(url));
      img.onerror = () => finish(() => reject(new Error('圖片載入失敗')));

      const timeoutId = window.setTimeout(() => {
        finish(() => reject(new Error('圖片載入逾時')));
      }, IMAGE_LOAD_TIMEOUT_MS);

      img.src = url;
    });
  }

  function wait_(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function bindEvents() {
    $('#loginForm').addEventListener('submit', handleLogin);
    $('#openRegisterBtn').addEventListener('click', openRegisterModal);
    $('#registerForm').addEventListener('submit', handleRegister);
    $('#registerCareDistrict').addEventListener(
      'change',
      handleRegisterCareDistrictChange
    );
    $('#registerAvatarGender').addEventListener('change', randomizeRegisterAvatar);
    $('#registerPrevAvatarBtn').addEventListener('click', () => stepRegisterAvatar(-1));
    $('#registerRandomAvatarBtn').addEventListener('click', randomizeRegisterAvatar);
    $('#registerNextAvatarBtn').addEventListener('click', () => stepRegisterAvatar(1));

    $('#homeAvatarBtn').addEventListener('click', () => openMessageCenter_({ refresh: true }));
    $('#refreshMessageCenterBtn').addEventListener('click', refreshMessageCenter_);
    $('#messageCenterSelector').addEventListener('change', handleMessageCenterSelectorChange_);
    $('#messageCenterSuppressToday').addEventListener('change', handleMessageCenterSuppressChange_);
    $$('.message-center-tab').forEach((button) => {
      button.addEventListener('click', () => {
        state.messageCenterFilter = button.dataset.messageCenterTab || 'ANNOUNCEMENT';
        state.selectedMessageKey = '';
        renderMessageCenter_();
        markCurrentMessageRead_(false);
      });
    });
    $('#refreshHomeBtn').addEventListener('click', () => {
      invalidateCache_('dashboard');
      refreshDashboard(true);
    });
    $('#logoutBtn').addEventListener('click', openLogoutConfirm);
    $('#goMyBtn').addEventListener('click', () => showView('my'));

    $('#openGroupJourneyBtn').addEventListener('click', openGroupJourneyListModal);
    $('#homeJourneyNodes').addEventListener('click', openGroupJourneyListModal);
    $('#openChestCollectionBtn').addEventListener('click', openChestCollectionModal);

    $('#homeMorningBtn').addEventListener('click', () => submitHomePracticeDirect_('morning'));
    $('#homeBibleBtn').addEventListener('click', () => submitHomePracticeDirect_('bible'));
    $('#homePrayerPracticeBtn').addEventListener('click', () => submitHomePracticeDirect_('prayer'));
    $('#homeBookBtn').addEventListener('click', () => submitHomePracticeDirect_('book'));

    /*
     * 每日操練獨立頁按鈕已不在目前前台版面中。
     * 保留相容綁定：若未來重新加入按鈕才掛上事件，
     * 不可因找不到這四個節點而中斷後續的本週紀錄與關閉視窗事件。
     */
    const dailyPracticeButtons = [
      ['#dailyMorningBtn', 'morning'],
      ['#dailyBibleBtn', 'bible'],
      ['#dailyPrayerBtn', 'prayer'],
      ['#dailyBookBtn', 'book']
    ];

    dailyPracticeButtons.forEach(([selector, type]) => {
      const button = $(selector);

      if (button) {
        button.addEventListener('click', () => openPracticeModal(type));
      }
    });

    $('#practiceSubmitBtn').addEventListener('click', submitPracticeModal);

    /*
     * 本週任務按鈕使用 data-weekly-task 綁定，避免舊版 HTML 的按鈕 id
     * 與新版不完全一致時，造成整個前端事件中斷。
     */
    $$('[data-weekly-task]').forEach((button) => {
      const type = String(button.dataset.weeklyTask || '').trim();

      if (WEEKLY_TASK_CONFIG[type]) {
        const isHomeTaskButton = [
          'homeOutreachVisitBtn',
          'homeWeeklySmallGroupBtn',
          'homeWeeklyPrayerMeetingBtn',
          'homeWeeklyLordDayBtn'
        ].indexOf(String(button.id || '')) >= 0;

        button.addEventListener('click', () => {
          if (isHomeTaskButton) {
            submitHomeWeeklyTaskDirect_(type);
            return;
          }
          openWeeklyTaskModal(type);
        });
      }
    });

    const weeklyTaskSubmitButton = $('#weeklyTaskSubmitBtn');

    if (weeklyTaskSubmitButton) {
      weeklyTaskSubmitButton.addEventListener('click', submitWeeklyTaskModal);
    }
    $('#openGroupPostModalBtn').addEventListener('click', openGroupPostModal);
    $('#homeGroupPostForm').addEventListener('submit', submitHomeGroupPost);
    $('#cancelGroupPostEditBtn').addEventListener('click', resetGroupPostEditor);
    $('#myGroupPostList').addEventListener('click', (event) => {
      const editButton = event.target.closest('[data-edit-group-post]');
      const deleteButton = event.target.closest('[data-delete-group-post]');

      if (editButton) {
        startEditGroupPost(editButton.dataset.editGroupPost || '');
        return;
      }

      if (!deleteButton) {
        return;
      }

      confirmDeleteMyGroupPost(deleteButton.dataset.deleteGroupPost || '');
    });

    $('#myAvatarBtn').addEventListener('click', openAvatarModal);
    $('#openAvatarBtn').addEventListener('click', openAvatarModal);
    $('#myRefreshBtn').addEventListener('click', () => {
      refreshMyPage({ force: true });
    });
    $('#openGrowthModalBtn').addEventListener('click', openGroupContributionModal);
    $('#openPracticeHistoryBtn').addEventListener('click', openAllPracticeHistoryModal);
    $('#openVitalGroupsBtn').addEventListener('click', openVitalGroupsModal);
    $('#openAccountSettingsBtn').addEventListener('click', openAccountSettingsModal);
    $('#openLogoutConfirmBtn').addEventListener('click', openLogoutConfirm);

    $('#avatarGenderSelect').addEventListener('change', randomizeAvatarModal);
    $('#avatarPrevBtn').addEventListener('click', () => stepAvatarModal(-1));
    $('#avatarRandomBtn').addEventListener('click', randomizeAvatarModal);
    $('#avatarNextBtn').addEventListener('click', () => stepAvatarModal(1));
    $('#avatarSaveBtn').addEventListener('click', saveAvatarModal);
    $('#createVitalGroupForm').addEventListener('submit', handleCreateVitalGroup);
    $('#joinVitalGroupForm').addEventListener('submit', handleJoinVitalGroup);
    $('#vitalGroupsList').addEventListener('click', handleVitalGroupListClick);
    $('#accountProfileForm').addEventListener('submit', handleAccountProfile);
    $('#changePasswordForm').addEventListener('submit', handleChangePassword);

    $('#confirmModalSubmitBtn').addEventListener('click', executePendingConfirm);

    $('#navHomeBtn').addEventListener('click', () => showView('home'));
    $('#navMyBtn').addEventListener('click', () => showView('my'));

    $$('[data-theme-choice]').forEach((button) => {
      button.addEventListener('click', () => setTheme(button.dataset.themeChoice));
    });

    $$('.modal-close-btn').forEach((button) => {
      button.addEventListener('click', () => closeModal(button.dataset.closeModal));
    });

    $$('.back-view-btn').forEach((button) => {
      button.addEventListener('click', () => showView(button.dataset.view || 'home'));
    });

    $('#infoModalContent').addEventListener('click', handleInfoModalContentClick);
    $('#chestClaimRewardBtn').addEventListener('click', claimSelectedChestReward);
  }

  function restoreSession() {
    const stored = readStoredSession();

    if (!stored.sessionToken) {
      showAuth();
      return;
    }

    /*
     * 舊流程：verifyPlayerSession → showView(home) → getHomeDashboard。
     * 同一個開頁流程連續送出兩次後端請求，且兩次都驗證 Session。
     * 現在直接取得首頁資料；getHomeDashboard 本身已完成 Session 驗證。
     */
    establishCurrentSession_(stored.sessionToken, null, stored.persistent === true);

    setLoading(true, '正在載入旅程…');

    loadInitialAppData_()
      .then((res) => {
        if (!isSuccess(res) || !res.data || !res.data.player) {
          if (isSessionErrorResponse(res) || state.sessionInvalidated) {
            setLoading(false);
            return;
          }

          showInitialLoadError_(
            getResponseError(res, '首頁資料讀取失敗，請重新載入')
          );
          return;
        }

        const data = res.data || {};

        enterHomeWithDashboard_(data);
      })
      .catch((error) => {
        showInitialLoadError_(getErrorMessage(error));
      });
  }

  function loadInitialAppData_() {
    return callServer('getHomeDashboard');
  }

  function enterHomeWithDashboard_(data) {
    data = data || {};

    state.currentPlayer = data.player;
    state.currentDataEpochId = data.dataEpochId ||
      (data.dataEpoch && data.dataEpoch.dataEpochId) ||
      '';
    persistCurrentPlayer();

    state.homeSyncToken = String(data.syncToken || '').trim();
    state.businessDate = String(
      data.businessDate || getTaipeiBusinessDate_()
    ).trim();

    if (data.taskConfig) {
      applyTaskConfiguration_(data.taskConfig);
    }

    setCache_('dashboard', data);
    showView('home', {
      skipDataLoad: true
    });
    renderDashboardData_(data);
    setLoading(false);
    window.setTimeout(retryPendingMessageCenterSuppression_, 0);
    window.setTimeout(promptPasswordChangeIfRequired_, 0);
  }

  function promptPasswordChangeIfRequired_() {
    if (!state.currentPlayer || !state.currentPlayer.passwordMustChange) {
      return;
    }

    openAccountSettingsModal();
    setResultMessage(
      '#accountSettingsMessage',
      '此帳號目前使用臨時密碼，請先修改登入密碼後再繼續操作。'
    );
  }

  function showInitialLoadError_(message) {
    const safeMessage = message || '資料載入失敗，請重新整理或稍後再試';

    closeAllModals();
    hideAllViews();
    $('#bottomNav').classList.add('hidden');
    setLoadingError_(safeMessage, [
      {
        text: '重新載入',
        handler: () => window.location.reload()
      },
      {
        text: '返回登入',
        secondary: true,
        handler: exitFailedRestoredSession_
      }
    ]);
  }

  function exitFailedRestoredSession_() {
    const token = String(state.sessionToken || '').trim();

    notifyOtherAppInstances_('sessionRevoked');
    clearCurrentSession();
    $('#loginPassword').value = '';
    showAuth();
    showAuthMessage('已清除本機登入狀態，請重新登入。');
    setLoading(false);

    revokeSessionInBackground_(token);
  }

  function readStoredSession() {
    const parseStoredSession = (raw, persistent) => {
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      const sessionToken = String(parsed.sessionToken || '').trim();
      if (!sessionToken) return null;

      return {
        sessionToken: sessionToken,
        savedAt: parsed.savedAt || '',
        playerId: parsed.playerId || '',
        persistent: persistent === true
      };
    };

    try {
      const temporarySession = parseStoredSession(
        sessionStorage.getItem(STORAGE_KEY),
        false
      );
      if (temporarySession) return temporarySession;
    } catch (error) {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch (ignored) {}
    }

    try {
      const persistentSession = parseStoredSession(
        localStorage.getItem(STORAGE_KEY),
        true
      );
      if (persistentSession) return persistentSession;
    } catch (error) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (ignored) {}
    }

    return {};
  }

  function showAuth() {
    closeAllModals();
    hideAllViews();
    $('#authView').classList.remove('hidden');
    $('#bottomNav').classList.add('hidden');
  }

  function hideAllViews() {
    [
      'authView',
      'homeView',
      'myView'
    ].forEach((id) => {
      $('#' + id).classList.add('hidden');
    });
  }

  function showView(name, options) {
    options = options || {};

    if (!state.currentPlayer || !state.currentPlayer.playerId) {
      showAuth();
      return;
    }

    closeAllModals();
    hideAllViews();

    const viewId = {
      home: 'homeView',
      my: 'myView'
    }[name] || 'homeView';

    $('#' + viewId).classList.remove('hidden');
    $('#bottomNav').classList.remove('hidden');

    setNavActive(name);
    window.scrollTo(0, 0);

    if (name === 'home' && !options.skipDataLoad) {
      refreshDashboard(true);
    }


    if (name === 'my' && !options.skipDataLoad) {
      refreshMyPage({ force: false });
    }
  }

  function setNavActive(name) {
    const map = {
      home: '#navHomeBtn',
      my: '#navMyBtn'
    };

    Object.values(map).forEach((selector) => {
      $(selector).classList.remove('active');
    });

    if (map[name]) {
      $(map[name]).classList.add('active');
    }
  }

  function isModalOpen_(id) {
    const modal = $('#' + id);
    return !!modal && !modal.classList.contains('hidden');
  }

  function openModal(id) {
    $('#' + id).classList.remove('hidden');
  }

  function closeModal(id) {
    if (!id) {
      return;
    }

    if (id === 'messageCenterModal') {
      // 先同步保存本機重試資料，並立即啟動非同步後端寫入。
      // GAS JSON API 呼叫本身不阻塞 UI，因此視窗仍會立即關閉；
      // 同時避免 setTimeout 尚未執行就重新整理而漏送請求。
      stagePendingMessageCenterSuppressionForRetry_();
      flushPendingMessageCenterSuppression_();
    }

    $('#' + id).classList.add('hidden');

    if (id === 'confirmModal') {
      state.pendingConfirm = null;
    }
  }

  function closeAllModals() {
    const messageCenterModal = $('#messageCenterModal');
    const shouldFlushMessageCenterSuppression =
      !!messageCenterModal && !messageCenterModal.classList.contains('hidden');

    if (shouldFlushMessageCenterSuppression) {
      stagePendingMessageCenterSuppressionForRetry_();
      flushPendingMessageCenterSuppression_();
    }

    $$('.modal-layer').forEach((modal) => {
      modal.classList.add('hidden');
    });

    state.pendingConfirm = null;
  }

  function handleLogin(event) {
    event.preventDefault();

    const playerName = $('#loginName').value.trim();
    const passwordCode = $('#loginPassword').value.trim();
    const keepLogin = !!(
      $('#keepLoginCheckbox') && $('#keepLoginCheckbox').checked
    );

    if (!playerName || !passwordCode) {
      showAuthMessage(!playerName ? '請輸入登入帳號' : '請輸入登入密碼');
      return;
    }

    setLoading(true, '正在載入旅程…');

    callServer('loginPlayer', playerName, passwordCode)
      .then((res) => {
        const authData = res && res.data || {};
        const dashboard = authData.dashboard || null;

        if (!isSuccess(res) || !dashboard || !dashboard.player) {
          setLoading(false);
          showAuthMessage(getResponseError(res, '登入失敗'));
          return;
        }

        establishCurrentSession_(
          authData.sessionToken,
          authData.player || dashboard.player,
          keepLogin
        );
        $('#loginPassword').value = '';
        enterHomeWithDashboard_(dashboard);
      })
      .catch((error) => {
        showAuth();
        showAuthMessage(getErrorMessage(error));
        setLoading(false);
      });
  }

  function initRegisterAvatar() {
    state.registerAvatar = buildRandomAvatar('male');
    renderRegisterAvatar();
  }

  function openRegisterModal() {
    $('#registerName').value = '';
    $('#registerLoginName').value = '';
    $('#registerPassword').value = '';
    $('#registerPasswordConfirm').value = '';
    $('#registerBirthYear').value = '';
    $('#registerAvatarGender').value = 'male';

    state.registrationAreaOptions = [];
    renderRegisterAreaSelectors('', '');

    state.registerAvatar = buildRandomAvatar('male');

    renderRegisterAvatar();
    setResultMessage('#registerMessage', '', false);

    openModal('registerModal');
    loadRegistrationAreaOptions();
  }

  function loadRegistrationAreaOptions() {
    const districtSelect = $('#registerCareDistrict');
    const careAreaSelect = $('#registerCareArea');

    districtSelect.disabled = true;
    careAreaSelect.disabled = true;

    callServer('getRegistrationAreaOptions')
      .then((res) => {
        if (!isSuccess(res)) {
          throw new Error(
            getResponseError(res, '讀取照顧區與大區資料失敗')
          );
        }

        const districts =
          res.data && Array.isArray(res.data.districts)
            ? res.data.districts
            : [];

        if (!districts.length) {
          throw new Error(
            'AreaMappings 沒有可用的照顧區與大區資料'
          );
        }

        state.registrationAreaOptions = districts;
        renderRegisterAreaSelectors('', '');
      })
      .catch((error) => {
        state.registrationAreaOptions = [];
        renderRegisterAreaSelectors('', '');

        setResultMessage(
          '#registerMessage',
          getErrorMessage(error)
        );
      });
  }

  function handleRegisterCareDistrictChange() {
    renderRegisterAreaSelectors(
      $('#registerCareDistrict').value,
      ''
    );
  }

  function renderRegisterAreaSelectors(
    selectedDistrict,
    selectedCareArea
  ) {
    const districtSelect = $('#registerCareDistrict');
    const careAreaSelect = $('#registerCareArea');

    const districts = Array.isArray(state.registrationAreaOptions)
      ? state.registrationAreaOptions
      : [];

    setRegisterSelectOptions(
      districtSelect,
      districts.map((district) => ({
        value: district.careDistrict,
        label: district.careDistrict
      })),
      districts.length
        ? '請選擇照顧區'
        : '讀取照顧區中...',
      selectedDistrict
    );

    districtSelect.disabled = !districts.length;

    const activeDistrict = districts.find((district) => {
      return district.careDistrict === districtSelect.value;
    });

    const careAreas = activeDistrict &&
      Array.isArray(activeDistrict.careAreas)
        ? activeDistrict.careAreas
        : [];

    setRegisterSelectOptions(
      careAreaSelect,
      careAreas.map((area) => ({
        value: area.careArea,
        label: area.careArea
      })),
      activeDistrict
        ? '請選擇大區'
        : '請先選擇照顧區',
      selectedCareArea
    );

    careAreaSelect.disabled = !activeDistrict;
  }

  function setRegisterSelectOptions(
    select,
    options,
    placeholder,
    selectedValue
  ) {
    select.innerHTML = '';

    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    select.appendChild(placeholderOption);

    options.forEach((item) => {
      const option = document.createElement('option');
      option.value = String(item.value || '');
      option.textContent = String(item.label || '');
      select.appendChild(option);
    });

    const value = String(selectedValue || '');
    const exists = options.some((item) => {
      return String(item.value || '') === value;
    });

    select.value = exists ? value : '';
  }



  function randomizeRegisterAvatar() {
    state.registerAvatar = buildRandomAvatar(
      $('#registerAvatarGender').value
    );

    renderRegisterAvatar();
  }

  function stepRegisterAvatar(delta) {
    const gender = $('#registerAvatarGender').value;
    state.registerAvatar = buildSteppedAvatar(
      gender,
      state.registerAvatar && state.registerAvatar.avatarNo,
      delta
    );

    renderRegisterAvatar();
  }

  function renderRegisterAvatar() {
    const avatar = state.registerAvatar;

    if (!avatar) {
      return;
    }

    setManagedImageSource_(
      $('#registerAvatarPreview'),
      avatar.avatarUrl,
      'registerAvatar:' + avatar.avatarGender + ':' + avatar.avatarNo
    );
    $('#registerAvatarInfo').textContent =
      getGenderLabel(avatar.avatarGender) +
      '｜第 ' +
      avatar.avatarNo +
      ' 號';
  }

  function setRegistrationInFlight_(inFlight) {
    state.registrationInFlight = inFlight === true;
    const submitButton = $('#registerForm button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = state.registrationInFlight;
    }
  }

  function completeRegistrationSession_(response) {
    const authData = response && response.data || {};
    const dashboard = authData.dashboard || null;

    if (!isSuccess(response) || !dashboard || !dashboard.player) {
      return false;
    }

    establishCurrentSession_(
      authData.sessionToken,
      authData.player || dashboard.player,
      false
    );
    closeModal('registerModal');
    enterHomeWithDashboard_(dashboard);
    return true;
  }

  async function confirmUncertainRegistration_(payload, fallbackMessage) {
    setLoading(true, '帳號可能已建立，正在確認…');

    try {
      const loginResponse = await callServer(
        'loginPlayer',
        payload.loginName,
        payload.passwordCode
      );

      if (completeRegistrationSession_(loginResponse)) {
        return true;
      }
    } catch (ignored) {}

    setLoading(false);
    setResultMessage(
      '#registerMessage',
      fallbackMessage || '註冊狀態無法確認，請回到登入畫面使用剛才的帳號與密碼登入。'
    );
    return false;
  }

  function shouldConfirmRegistrationResponse_(response) {
    if (!response || isSuccess(response)) {
      return true;
    }

    const code = String(response.code || response.errorCode || '').toUpperCase();
    const message = getResponseError(response, '');

    return (
      code === 'ACCOUNT_CREATED_DASHBOARD_FAILED' ||
      code === 'ACCOUNT_CREATED_LOGIN_REQUIRED' ||
      /帳號已建立|此登入帳號已註冊|註冊失敗/.test(message)
    );
  }

  async function handleRegister(event) {
    event.preventDefault();

    if (state.registrationInFlight) {
      return;
    }

    let sessionEstablished = false;
    const avatar = state.registerAvatar;
    const passwordConfirmation = $('#registerPasswordConfirm').value.trim();
    const birthYearText = $('#registerBirthYear').value.trim();
    const currentYear = new Date().getFullYear();

    const payload = {
      careDistrict: $('#registerCareDistrict').value.trim(),
      careArea: $('#registerCareArea').value.trim(),
      loginName: $('#registerLoginName').value.trim(),
      passwordCode: $('#registerPassword').value.trim(),
      displayName: $('#registerName').value.trim(),
      playerName: $('#registerName').value.trim(),
      birthYear: birthYearText,
      avatarGender: avatar && avatar.avatarGender,
      avatarNo: avatar && avatar.avatarNo
    };

    if (!payload.careDistrict || !payload.careArea) {
      setResultMessage(
        '#registerMessage',
        '請選擇照顧區與大區'
      );
      return;
    }

    if (!payload.loginName) {
      setResultMessage('#registerMessage', '請輸入帳號');
      return;
    }

    if (!/^[A-Za-z0-9]{3,32}$/.test(payload.loginName)) {
      setResultMessage(
        '#registerMessage',
        '帳號限 3 至 32 個英文字母或數字'
      );
      return;
    }

    if (!payload.passwordCode) {
      setResultMessage('#registerMessage', '請輸入密碼');
      return;
    }

    if (
      payload.passwordCode.length < 8 ||
      payload.passwordCode.length > 64
    ) {
      setResultMessage('#registerMessage', '密碼長度需為 8 至 64 碼');
      return;
    }

    if (payload.passwordCode !== passwordConfirmation) {
      setResultMessage('#registerMessage', '兩次輸入的密碼不一致');
      return;
    }

    if (
      !payload.displayName ||
      payload.displayName.length < 2 ||
      payload.displayName.length > 20
    ) {
      setResultMessage(
        '#registerMessage',
        '真實姓名需為 2 至 20 個字'
      );
      return;
    }

    if (
      !/^\d{4}$/.test(birthYearText) ||
      Number(birthYearText) < 1900 ||
      Number(birthYearText) > currentYear
    ) {
      setResultMessage(
        '#registerMessage',
        '請輸入正確的出生年份（西元）'
      );
      return;
    }

    setRegistrationInFlight_(true);
    setLoading(true, '正在建立帳號…');

    try {
      const response = await callServer('registerPlayer', payload);

      if (completeRegistrationSession_(response)) {
        return;
      }

      const failureMessage = getResponseError(response, '註冊失敗');
      if (shouldConfirmRegistrationResponse_(response)) {
        await confirmUncertainRegistration_(payload, failureMessage);
        return;
      }

      setLoading(false);
      setResultMessage('#registerMessage', failureMessage);
    } catch (error) {
      await confirmUncertainRegistration_(payload, getErrorMessage(error));
    } finally {
      setRegistrationInFlight_(false);
    }
  }

  function createEmptyMessageCenterState_() {
    return {
      announcements: [],
      specialTasks: [],
      rewardNotifications: [],
      hasBadge: false,
      shouldAutoOpen: false,
      suppressAutoOpenToday: false,
      defaultMessageType: '',
      defaultMessageId: '',
      currentDate: ''
    };
  }

  function normalizeMessageCenterData_(data) {
    const center = Object.assign(createEmptyMessageCenterState_(), data || {});

    center.announcements = Array.isArray(center.announcements)
      ? center.announcements
      : [];
    center.specialTasks = Array.isArray(center.specialTasks)
      ? center.specialTasks
      : [];
    center.rewardNotifications = Array.isArray(center.rewardNotifications)
      ? center.rewardNotifications
      : [];

    return center;
  }

  function applyMessageCenterData_(data, allowAutoOpen) {
    const previousSelectedKey = String(state.selectedMessageKey || '');
    const wasOpen = isModalOpen_('messageCenterModal');

    state.messageCenter = normalizeMessageCenterData_(data);

    // 後端背景寫入尚未完成時，先套用本機已確認的「今日不再顯示」。
    // 這可避免使用者關閉訊息後立即重新整理，訊息因後端狀態尚未落盤而再次跳出。
    applyQueuedMessageCenterSuppressionLocally_();
    renderHomeMessageBadge_();

    if (wasOpen) {
      state.selectedMessageKey = previousSelectedKey;

      if (!getSelectedMessageCenterItem_()) {
        selectDefaultMessageCenterItem_();
      }

      renderMessageCenter_();
    }

    if (allowAutoOpen) {
      maybeAutoOpenMessageCenter_();
    }
  }

  function renderHomeMessageBadge_() {
    const badge = $('#homeMessageBadge');

    if (!badge) {
      return;
    }

    badge.classList.toggle(
      'hidden',
      !(state.messageCenter && state.messageCenter.hasBadge)
    );
  }

  function maybeAutoOpenMessageCenter_() {
    const center = state.messageCenter || createEmptyMessageCenterState_();

    if (!center.shouldAutoOpen || !center.defaultMessageId) {
      return;
    }

    const defaultMessage = findMessageCenterItem_(
      center.defaultMessageType,
      center.defaultMessageId
    );

    if (!defaultMessage) {
      return;
    }

    const key = buildMessageCenterItemKey_(defaultMessage);

    if (!key || state.messageCenterAutoOpenedKey === key) {
      return;
    }

    state.messageCenterAutoOpenedKey = key;
    state.selectedMessageKey = key;
    state.messageCenterFilter = defaultMessage.messageType || 'ANNOUNCEMENT';
    renderMessageCenter_();
    openModal('messageCenterModal');
    markSelectedMessageRead_(defaultMessage, true);
  }

  function openMessageCenter_(options) {
    options = options || {};

    if (!state.currentPlayer) {
      return;
    }

    setResultMessage('#messageCenterStatusMessage', '');

    if (!options.refresh) {
      selectDefaultMessageCenterItem_();
      renderMessageCenter_();
      openModal('messageCenterModal');
      markCurrentMessageRead_(false);
      return;
    }

    setLoading(true, '更新訊息中心...');

    callServer('getPlayerMessageCenter')
      .then((res) => {
        if (!isSuccess(res)) {
          window.alert(getResponseError(res, '訊息中心讀取失敗'));
          openModal('messageCenterModal');
          return;
        }

        applyMessageCenterData_(res.data, false);
        selectDefaultMessageCenterItem_();
        renderMessageCenter_();
        openModal('messageCenterModal');
        markCurrentMessageRead_(false);
      })
      .catch((error) => {
        window.alert(getErrorMessage(error));
        openModal('messageCenterModal');
      })
      .finally(() => setLoading(false));
  }

  function refreshMessageCenter_() {
    openMessageCenter_({ refresh: true });
  }

  function selectDefaultMessageCenterItem_() {
    const center = state.messageCenter || createEmptyMessageCenterState_();
    const firstAnnouncement = (center.announcements || [])[0] || null;
    const preferred = findMessageCenterItem_(
      center.defaultMessageType,
      center.defaultMessageId
    );
    const fallback = preferred ||
      (center.rewardNotifications || []).find((item) =>
        String(item.rewardStatus || '').trim() === 'NOTIFIED'
      ) ||
      (center.rewardNotifications || []).find((item) => !item.isRead) ||
      (center.specialTasks || []).find((item) => !item.isRead) ||
      (center.announcements || []).find((item) => !item.isRead) ||
      firstAnnouncement ||
      (center.specialTasks || [])[0] ||
      (center.rewardNotifications || [])[0] ||
      null;

    state.selectedMessageKey = fallback
      ? buildMessageCenterItemKey_(fallback)
      : '';
    state.messageCenterFilter = fallback
      ? fallback.messageType
      : 'ANNOUNCEMENT';
  }

  function getAllMessageCenterItems_() {
    const center = state.messageCenter || createEmptyMessageCenterState_();
    const items = []
      .concat(center.rewardNotifications || [])
      .concat(center.specialTasks || [])
      .concat(center.announcements || []);

    return items.sort((a, b) => {
      const aTime = String(a.updatedAt || a.publishedAt || '');
      const bTime = String(b.updatedAt || b.publishedAt || '');
      return bTime.localeCompare(aTime);
    });
  }

  function getFilteredMessageCenterItems_() {
    const filter = state.messageCenterFilter || 'ANNOUNCEMENT';
    return getAllMessageCenterItems_().filter((item) => {
      return item.messageType === filter;
    });
  }

  function buildMessageCenterItemKey_(message) {
    if (!message) {
      return '';
    }

    return [
      String(message.messageType || ''),
      String(message.messageId || ''),
      String(Number(message.messageVersion || 1))
    ].join('::');
  }

  function findMessageCenterItem_(messageType, messageId) {
    return getAllMessageCenterItems_().find((item) => {
      return String(item.messageType || '') === String(messageType || '') &&
        String(item.messageId || '') === String(messageId || '');
    }) || null;
  }

  function getSelectedMessageCenterItem_() {
    const key = String(state.selectedMessageKey || '');

    if (!key) {
      return null;
    }

    return getAllMessageCenterItems_().find((item) => {
      return buildMessageCenterItemKey_(item) === key;
    }) || null;
  }

  function hasMessageCenterTabAlert_(messageType) {
    const center = state.messageCenter || createEmptyMessageCenterState_();
    const collections = {
      ANNOUNCEMENT: center.announcements || [],
      SPECIAL_TASK: center.specialTasks || [],
      REWARD_NOTIFICATION: center.rewardNotifications || []
    };

    return (collections[messageType] || []).some((message) => {
      if (!message.isRead) {
        return true;
      }

      if (messageType !== 'REWARD_NOTIFICATION') {
        return false;
      }

      return String(message.rewardStatus || '').trim() === 'NOTIFIED';
    });
  }

  function renderMessageCenter_() {
    $$('.message-center-tab').forEach((button) => {
      const messageType = button.dataset.messageCenterTab || 'ANNOUNCEMENT';
      button.classList.toggle(
        'active',
        messageType === state.messageCenterFilter
      );
      button.classList.toggle(
        'has-alert',
        hasMessageCenterTabAlert_(messageType)
      );
    });

    const items = getFilteredMessageCenterItems_();
    const empty = $('#messageCenterEmpty');
    const layout = $('#messageCenterLayout');
    const selectorRow = $('#messageCenterSelectorRow');
    const selector = $('#messageCenterSelector');

    if (!items.length) {
      state.selectedMessageKey = '';
      selector.innerHTML = '';
      selectorRow.classList.add('hidden');
      empty.classList.remove('hidden');
      layout.classList.add('hidden');
      clearMessageCenterDetail_();
      return;
    }

    empty.classList.add('hidden');
    layout.classList.remove('hidden');

    const selected = getSelectedMessageCenterItem_();
    const selectedVisible = selected && items.some((item) => {
      return buildMessageCenterItemKey_(item) === buildMessageCenterItemKey_(selected);
    });

    if (!selectedVisible) {
      state.selectedMessageKey = buildMessageCenterItemKey_(items[0]);
    }

    selector.innerHTML = items.map((item) => {
      const key = buildMessageCenterItemKey_(item);
      const readText = item.isRead ? '已讀' : '未讀';
      const label = [item.title || '未命名訊息', readText]
        .filter(Boolean)
        .join('｜');

      return '<option value="' + escapeHtml(key) + '">' +
        escapeHtml(label) +
        '</option>';
    }).join('');
    selector.value = state.selectedMessageKey;
    selectorRow.classList.toggle('hidden', items.length <= 1);

    renderMessageCenterDetail_(getSelectedMessageCenterItem_());
  }

  function handleMessageCenterSelectorChange_(event) {
    state.selectedMessageKey = event.target.value || '';
    renderMessageCenter_();
    markCurrentMessageRead_(false);
  }

  function renderMessageCenterDetail_(message) {
    if (!message) {
      clearMessageCenterDetail_();
      return;
    }

    renderMessageCenterIcon_($('#messageCenterDetailIcon'), message);

    $('#messageCenterDetailType').textContent = getMessageCenterTypeLabel_(message.messageType);
    $('#messageCenterDetailTitle').textContent = message.title || '未命名訊息';
    $('#messageCenterDetailContent').textContent = message.content || '';

    const rewardBox = $('#messageCenterRewardBox');
    const hasReward = !!String(message.rewardText || '').trim();
    rewardBox.classList.toggle('hidden', !hasReward);
    $('#messageCenterRewardText').textContent = message.rewardText || '';

    const suppressRow = $('#messageCenterSuppressRow');
    const canSuppress = message.messageType === 'ANNOUNCEMENT' ||
      message.messageType === 'SPECIAL_TASK';
    suppressRow.classList.toggle('hidden', !canSuppress);

    const checkbox = $('#messageCenterSuppressToday');
    const suppressionRecord = buildCurrentMessageCenterSuppressionRecord_();
    const suppressionKey = buildMessageCenterSuppressionStorageKey_(suppressionRecord);
    const pendingSuppression =
      state.pendingMessageCenterSuppressions.has(suppressionKey);
    const suppressionInFlight =
      state.messageCenterSuppressionFlushInFlight.has(suppressionKey);
    checkbox.checked = !!state.messageCenter.suppressAutoOpenToday || pendingSuppression;
    checkbox.disabled = !!state.messageCenter.suppressAutoOpenToday || suppressionInFlight;
  }

  function clearMessageCenterDetail_() {
    const icon = $('#messageCenterDetailIcon');
    icon.className = 'message-center-detail-icon';
    icon.innerHTML = '';
    $('#messageCenterDetailType').textContent = '';
    $('#messageCenterDetailTitle').textContent = '';
    $('#messageCenterDetailContent').textContent = '';
    $('#messageCenterRewardBox').classList.add('hidden');
    $('#messageCenterSuppressRow').classList.add('hidden');
  }

  function getMessageCenterTypeLabel_(messageType) {
    const labels = {
      ANNOUNCEMENT: '系統公告',
      SPECIAL_TASK: '特殊任務',
      REWARD_NOTIFICATION: '任務獎勵'
    };

    return labels[messageType] || '訊息';
  }

  function getMessageCenterIconClass_(message) {
    if (!message) {
      return '';
    }

    if (message.iconType === 'completed') {
      return 'is-completed';
    }

    if (message.iconType === 'reward') {
      return 'is-reward';
    }

    return '';
  }

  function getMessageCenterIconAssetKey_(message) {
    if (!message) {
      return '';
    }

    if (message.messageType === 'ANNOUNCEMENT') {
      return 'systemAnnouncement';
    }

    if (message.messageType !== 'SPECIAL_TASK') {
      return '';
    }

    return message.iconType === 'completed'
      ? 'specialTaskCompleted'
      : 'specialTaskInProgress';
  }

  function renderMessageCenterIcon_(container, message) {
    if (!container) {
      return;
    }

    const assetKey = getMessageCenterIconAssetKey_(message);
    container.className = 'message-center-detail-icon ' + getMessageCenterIconClass_(message);
    container.innerHTML = '';

    if (assetKey) {
      container.classList.add('has-image');
      const image = document.createElement('img');
      image.alt = '';
      image.setAttribute('aria-hidden', 'true');
      container.appendChild(image);
      setManagedImageSource_(image, IMAGE_ASSETS[assetKey], assetKey, {
        fallbackUrl: '',
        onFallback: () => {
          container.classList.remove('has-image');
          container.innerHTML = getMessageCenterIconSvg_(message);
        }
      });
      return;
    }

    container.innerHTML = getMessageCenterIconSvg_(message);
  }

  function getMessageCenterIconSvg_(message) {
    const type = message && message.iconType ? message.iconType : 'announcement';

    if (type === 'completed') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m8 12 2.5 2.5L16.5 8.5"></path></svg>';
    }

    if (type === 'reward') {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16v10H4z"></path><path d="M12 10v10M3 7h18v3H3zM12 7c-3 0-5-1.2-5-3 0-1.2.9-2 2.1-2 1.8 0 2.9 2.2 2.9 5ZM12 7c3 0 5-1.2 5-3 0-1.2-.9-2-2.1-2C13.1 2 12 4.2 12 7Z"></path></svg>';
    }

    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v6"></path><circle cx="12" cy="16.5" r="1"></circle></svg>';
  }

  function markCurrentMessageRead_(autoShown) {
    const message = getSelectedMessageCenterItem_();

    if (message) {
      markSelectedMessageRead_(message, autoShown);
    }
  }

  function markSelectedMessageRead_(message, autoShown) {
    if (!message || (message.isRead && !autoShown)) {
      return;
    }

    const messageKey = buildMessageCenterItemKey_(message);

    if (!messageKey || state.messageReadInFlight.has(messageKey)) {
      return;
    }

    state.messageReadInFlight.add(messageKey);
    setResultMessage('#messageCenterStatusMessage', '');

    callServer('markPlayerMessageRead', {
      messageType: message.messageType,
      messageId: message.messageId,
      messageVersion: Number(message.messageVersion || 1),
      autoShown: !!autoShown
    })
      .then((res) => {
        if (!isSuccess(res)) {
          throw new Error(getResponseError(res, '標記訊息已讀失敗'));
        }

        const savedStatus = (res.data && res.data.status) || {};
        message.isRead = true;
        message.readAt = savedStatus.readAt || message.readAt || new Date().toISOString();

        if (autoShown) {
          message.autoShownAt = savedStatus.autoShownAt ||
            message.autoShownAt ||
            new Date().toISOString();
        }

        state.selectedMessageKey = messageKey;
        state.messageCenter.hasBadge = getAllMessageCenterItems_().some((item) =>
          !item.isRead ||
          (item.messageType === 'REWARD_NOTIFICATION' &&
            String(item.rewardStatus || '').trim() === 'NOTIFIED')
        );
        renderHomeMessageBadge_();
        renderMessageCenter_();
        notifyOtherAppInstances_('messageRead');
      })
      .catch((error) => {
        setResultMessage(
          '#messageCenterStatusMessage',
          '訊息尚未標記為已讀：' + getErrorMessage(error)
        );
      })
      .finally(() => {
        state.messageReadInFlight.delete(messageKey);
      });
  }

  function handleMessageCenterSuppressChange_(event) {
    const checkbox = event.currentTarget;
    const message = getSelectedMessageCenterItem_();

    if (!message) {
      checkbox.checked = false;
      return;
    }

    if (
      message.messageType !== 'ANNOUNCEMENT' &&
      message.messageType !== 'SPECIAL_TASK'
    ) {
      checkbox.checked = false;
      return;
    }

    if (state.messageCenter && state.messageCenter.suppressAutoOpenToday) {
      checkbox.checked = true;
      checkbox.disabled = true;
      return;
    }

    const record = buildCurrentMessageCenterSuppressionRecord_();
    const key = buildMessageCenterSuppressionStorageKey_(record);

    if (!record.playerId || !record.suppressDate) {
      checkbox.checked = false;
      return;
    }

    if (state.messageCenterSuppressionFlushInFlight.has(key)) {
      checkbox.checked = true;
      checkbox.disabled = true;
      return;
    }

    if (checkbox.checked) {
      state.pendingMessageCenterSuppressions.set(key, record);
      return;
    }

    state.pendingMessageCenterSuppressions.delete(key);
    state.messageCenterSuppressionRetryAttempts.delete(key);
    removeMessageCenterSuppressionRetry_(record);
  }

  function getMessageSuppressionDateKey_() {
    const centerDate = String(
      state.messageCenter && state.messageCenter.currentDate || ''
    ).trim();

    if (centerDate) {
      return centerDate;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return [year, month, day].join('-');
  }

  function buildCurrentMessageCenterSuppressionRecord_() {
    return {
      scope: 'MESSAGE_CENTER',
      playerId: String(state.currentPlayer && state.currentPlayer.playerId || ''),
      suppressDate: getMessageSuppressionDateKey_()
    };
  }

  function buildMessageCenterSuppressionStorageKey_(record) {
    record = record || {};

    return [
      String(record.playerId || ''),
      'MESSAGE_CENTER',
      String(record.suppressDate || '')
    ].join('::');
  }

  function readMessageCenterSuppressionRetryQueue_() {
    try {
      const raw = localStorage.getItem(MESSAGE_SUPPRESSION_RETRY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];

      return (Array.isArray(parsed) ? parsed : []).filter((record) => {
        return record && String(record.scope || '') === 'MESSAGE_CENTER';
      });
    } catch (error) {
      return [];
    }
  }

  function writeMessageCenterSuppressionRetryQueue_(records) {
    const unique = new Map();

    (Array.isArray(records) ? records : []).forEach((record) => {
      if (!record || String(record.scope || '') !== 'MESSAGE_CENTER') {
        return;
      }

      const key = buildMessageCenterSuppressionStorageKey_(record);
      if (key) {
        unique.set(key, record);
      }
    });

    try {
      if (!unique.size) {
        localStorage.removeItem(MESSAGE_SUPPRESSION_RETRY_KEY);
        return;
      }

      localStorage.setItem(
        MESSAGE_SUPPRESSION_RETRY_KEY,
        JSON.stringify(Array.from(unique.values()))
      );
    } catch (error) {
      console.error('暫存訊息中心今日不再顯示重試資料失敗', getErrorMessage(error));
    }
  }

  function persistMessageCenterSuppressionRetry_(record) {
    const queue = readMessageCenterSuppressionRetryQueue_();
    queue.push(record);
    writeMessageCenterSuppressionRetryQueue_(queue);
  }

  function stagePendingMessageCenterSuppressionForRetry_() {
    const playerId = String(state.currentPlayer && state.currentPlayer.playerId || '');
    const currentDate = getMessageSuppressionDateKey_();

    if (!playerId || !state.pendingMessageCenterSuppressions.size) {
      return;
    }

    state.pendingMessageCenterSuppressions.forEach((record) => {
      if (
        String(record.playerId || '') === playerId &&
        String(record.suppressDate || '') === currentDate
      ) {
        persistMessageCenterSuppressionRetry_(record);
      }
    });
  }

  function applyQueuedMessageCenterSuppressionLocally_() {
    const playerId = String(state.currentPlayer && state.currentPlayer.playerId || '');
    const center = state.messageCenter || createEmptyMessageCenterState_();
    const currentDate = String(center.currentDate || getMessageSuppressionDateKey_());

    if (!playerId || !currentDate) {
      return;
    }

    const activeQueue = readMessageCenterSuppressionRetryQueue_().filter((record) => {
      return String(record.suppressDate || '') === currentDate;
    });

    // 清除過期日期與舊版「單一訊息 suppression」資料。
    writeMessageCenterSuppressionRetryQueue_(activeQueue);

    const localRecord = activeQueue.find((record) => {
      return String(record.playerId || '') === playerId;
    });

    if (!localRecord) {
      return;
    }

    const key = buildMessageCenterSuppressionStorageKey_(localRecord);

    if (!state.pendingMessageCenterSuppressions.has(key)) {
      state.pendingMessageCenterSuppressions.set(key, localRecord);
    }

    // 「今日不再自動顯示」是整個訊息中心層級，不改動任何訊息的未讀狀態。
    center.suppressAutoOpenToday = true;
    center.shouldAutoOpen = false;
  }

  function removeMessageCenterSuppressionRetry_(record) {
    const targetKey = buildMessageCenterSuppressionStorageKey_(record);
    const queue = readMessageCenterSuppressionRetryQueue_().filter((item) => {
      return buildMessageCenterSuppressionStorageKey_(item) !== targetKey;
    });
    writeMessageCenterSuppressionRetryQueue_(queue);
  }

  function scheduleMessageCenterSuppressionRetry_() {
    if (state.messageCenterSuppressionRetryTimer || !state.sessionToken) {
      return;
    }

    state.messageCenterSuppressionRetryTimer = window.setTimeout(() => {
      state.messageCenterSuppressionRetryTimer = null;
      flushPendingMessageCenterSuppression_();
    }, 5000);
  }

  function retryPendingMessageCenterSuppression_() {
    const playerId = String(state.currentPlayer && state.currentPlayer.playerId || '');
    const currentDate = getMessageSuppressionDateKey_();

    if (!playerId || !state.sessionToken) {
      return;
    }

    const activeQueue = readMessageCenterSuppressionRetryQueue_().filter((record) => {
      return String(record.suppressDate || '') === currentDate;
    });
    writeMessageCenterSuppressionRetryQueue_(activeQueue);

    activeQueue
      .filter((record) => String(record.playerId || '') === playerId)
      .forEach((record) => {
        const key = buildMessageCenterSuppressionStorageKey_(record);

        if (!state.pendingMessageCenterSuppressions.has(key)) {
          state.pendingMessageCenterSuppressions.set(key, record);
        }
      });

    applyQueuedMessageCenterSuppressionLocally_();
    flushPendingMessageCenterSuppression_();
  }

  function markMessageCenterSuppressedLocally_(record) {
    const center = state.messageCenter || createEmptyMessageCenterState_();
    center.suppressAutoOpenToday = true;
    center.shouldAutoOpen = false;
    renderMessageCenter_();
  }

  function flushPendingMessageCenterSuppression_() {
    const playerId = String(state.currentPlayer && state.currentPlayer.playerId || '');
    const currentDate = getMessageSuppressionDateKey_();

    if (!playerId || !state.sessionToken || !state.pendingMessageCenterSuppressions.size) {
      return;
    }

    Array.from(state.pendingMessageCenterSuppressions.entries()).forEach(([key, record]) => {
      if (String(record.suppressDate || '') !== currentDate) {
        state.pendingMessageCenterSuppressions.delete(key);
        removeMessageCenterSuppressionRetry_(record);
        return;
      }

      if (
        String(record.playerId || '') !== playerId ||
        state.messageCenterSuppressionFlushInFlight.has(key)
      ) {
        return;
      }

      const attempts = Number(state.messageCenterSuppressionRetryAttempts.get(key) || 0);

      if (attempts >= 3) {
        return;
      }

      persistMessageCenterSuppressionRetry_(record);
      state.messageCenterSuppressionFlushInFlight.add(key);

      callServer('suppressPlayerMessageToday', {})
        .then((res) => {
          if (!isSuccess(res)) {
            throw new Error(getResponseError(res, '更新訊息中心今日顯示設定失敗'));
          }

          state.pendingMessageCenterSuppressions.delete(key);
          state.messageCenterSuppressionRetryAttempts.delete(key);
          removeMessageCenterSuppressionRetry_(record);
          markMessageCenterSuppressedLocally_(record);
          notifyOtherAppInstances_('messageSuppressed');
        })
        .catch((error) => {
          const nextAttempts = attempts + 1;
          state.messageCenterSuppressionRetryAttempts.set(key, nextAttempts);
          console.error('背景儲存訊息中心今日不再顯示失敗', getErrorMessage(error));

          if (nextAttempts < 3) {
            scheduleMessageCenterSuppressionRetry_();
          }
        })
        .finally(() => {
          state.messageCenterSuppressionFlushInFlight.delete(key);
        });
    });
  }

  function openAvatarModal() {
    const player = state.currentPlayer || {};

    state.avatarModal = {
      avatarGender: normalizeAvatarGender(player.avatarGender) || 'male',
      avatarNo: Number(player.avatarNo || 0),
      avatarUrl: String(player.avatarUrl || '')
    };

    if (!state.avatarModal.avatarNo || !state.avatarModal.avatarUrl) {
      state.avatarModal = buildRandomAvatar(
        state.avatarModal.avatarGender
      );
    }

    $('#avatarGenderSelect').value = state.avatarModal.avatarGender;
    renderAvatarModal();

    setResultMessage('#avatarModalMessage', '', false);
    openModal('avatarModal');
  }

  function randomizeAvatarModal() {
    state.avatarModal = buildRandomAvatar(
      $('#avatarGenderSelect').value
    );

    renderAvatarModal();
  }

  function stepAvatarModal(delta) {
    const gender = $('#avatarGenderSelect').value;
    state.avatarModal = buildSteppedAvatar(
      gender,
      state.avatarModal && state.avatarModal.avatarNo,
      delta
    );

    renderAvatarModal();
  }

  function renderAvatarModal() {
    const avatar = state.avatarModal;

    setManagedImageSource_(
      $('#avatarModalPreview'),
      avatar.avatarUrl,
      'avatarModal:' + avatar.avatarGender + ':' + avatar.avatarNo
    );
    $('#avatarModalInfo').textContent =
      getGenderLabel(avatar.avatarGender) +
      '｜第 ' +
      avatar.avatarNo +
      ' 號';
  }

  function saveAvatarModal() {
    if (!state.currentPlayer || !state.avatarModal) {
      return;
    }

    setLoading(true, '儲存頭像...');

    callServer('updatePlayerAvatar', {
      playerId: state.currentPlayer.playerId,
      avatarGender: state.avatarModal.avatarGender,
      avatarNo: state.avatarModal.avatarNo
    })
      .then((res) => {
        if (!isSuccess(res)) {
          setResultMessage(
            '#avatarModalMessage',
            getResponseError(res, '儲存頭像失敗')
          );
          return;
        }

        state.currentPlayer = res.data.player;
        invalidateByRule_('accountChanged');
        persistCurrentPlayer();

        renderPlayer(state.currentPlayer);
        closeModal('avatarModal');
      })
      .catch((error) => {
        setResultMessage('#avatarModalMessage', getErrorMessage(error));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function openAccountSettingsModal() {
    const player = state.currentPlayer || {};

    $('#accountDisplayName').value =
      player.displayName || player.playerName || '';
    $('#currentPasswordCode').value = '';
    $('#newPasswordCode').value = '';
    $('#confirmNewPasswordCode').value = '';
    setResultMessage('#accountSettingsMessage', '', false);
    openModal('accountSettingsModal');
  }

  function handleAccountProfile(event) {
    event.preventDefault();

    if (!state.currentPlayer) {
      return;
    }

    const displayName = $('#accountDisplayName').value.trim();

    if (!displayName) {
      setResultMessage('#accountSettingsMessage', '請輸入顯示名稱');
      return;
    }

    setLoading(true, '儲存帳號資料...');

    callServer('updateMyAccount', {
      playerId: state.currentPlayer.playerId,
      displayName: displayName
    })
      .then((res) => {
        if (!isSuccess(res)) {
          setResultMessage(
            '#accountSettingsMessage',
            getResponseError(res, '更新帳號資料失敗')
          );
          return;
        }

        state.currentPlayer = res.data.player;
        invalidateByRule_('accountChanged');
        persistCurrentPlayer();
        renderPlayer(state.currentPlayer);
        setResultMessage('#accountSettingsMessage', res.data.message || '帳號資料已更新', true);
      })
      .catch((error) => {
        setResultMessage('#accountSettingsMessage', getErrorMessage(error));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function handleChangePassword(event) {
    event.preventDefault();

    if (!state.currentPlayer) {
      return;
    }

    const currentPasswordCode = $('#currentPasswordCode').value.trim();
    const newPasswordCode = $('#newPasswordCode').value.trim();
    const confirmNewPasswordCode = $('#confirmNewPasswordCode').value.trim();

    if (!currentPasswordCode || !newPasswordCode || !confirmNewPasswordCode) {
      setResultMessage(
        '#accountSettingsMessage',
        '請完整輸入目前密碼、新密碼與確認密碼'
      );
      return;
    }

    if (newPasswordCode.length < 8 || newPasswordCode.length > 64) {
      setResultMessage(
        '#accountSettingsMessage',
        '新登入密碼長度需為 8 至 64 碼'
      );
      return;
    }

    if (newPasswordCode !== confirmNewPasswordCode) {
      setResultMessage('#accountSettingsMessage', '兩次輸入的新密碼不一致');
      return;
    }

    setLoading(true, '更新登入密碼...');

    callServer('updateMyPassword', {
      playerId: state.currentPlayer.playerId,
      currentPasswordCode: currentPasswordCode,
      newPasswordCode: newPasswordCode
    })
      .then((res) => {
        if (!isSuccess(res)) {
          setResultMessage(
            '#accountSettingsMessage',
            getResponseError(res, '更新登入密碼失敗')
          );
          return;
        }

        $('#currentPasswordCode').value = '';
        $('#newPasswordCode').value = '';
        $('#confirmNewPasswordCode').value = '';
        closeModal('accountSettingsModal');
        notifyOtherAppInstances_('passwordChanged');
        clearCurrentSession();
        showAuth();
        showAuthMessage(
          (res.data.message || '登入密碼已更新') + '，請重新登入。',
          true
        );
      })
      .catch((error) => {
        setResultMessage('#accountSettingsMessage', getErrorMessage(error));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function openVitalGroupsModal() {
    $('#createVitalGroupName').value = '';
    $('#joinVitalGroupCode').value = '';
    setResultMessage('#vitalGroupsMessage', '', false);
    updateVitalGroupModalState(state.vitalGroups || []);
    openModal('vitalGroupsModal');
    loadVitalGroups(true);
  }

  function updateVitalGroupModalState(groups) {
    groups = groups || [];
    const hasGroup = groups.length > 0;
    const modal = $('#vitalGroupsModal');
    const title = modal.querySelector('.modal-header h2');
    const infoTitle = modal.querySelector('.confirm-info-card strong');
    const infoText = modal.querySelector('.confirm-info-card p');
    const menuHint = $('#openVitalGroupsBtn small');

    if (title) {
      title.textContent = '活力組管理';
    }

    if (infoTitle) {
      infoTitle.textContent = '活力組';
    }

    if (infoText) {
      infoText.textContent = '一人只能加入一個活力組。';
    }

    if (menuHint) {
      menuHint.textContent = '建立或加入活力組';
    }

    $('#createVitalGroupForm').classList.toggle('hidden', hasGroup);
    $('#joinVitalGroupForm').classList.toggle('hidden', hasGroup);
  }

  function loadVitalGroups(refreshInBackground) {
    if (!state.currentPlayer) {
      return;
    }

    let renderedCachedGroups = false;

    if (isCacheValid_('groupInfo')) {
      state.vitalGroups = (getCache_('groupInfo') || {}).groups || [];
      renderVitalGroups();
      renderedCachedGroups = true;

      if (!refreshInBackground) {
        return;
      }

      invalidateCache_('groupInfo');
    }

    if (!renderedCachedGroups) {
      $('#vitalGroupsList').innerHTML =
        '<div class="empty-card">讀取活力組中...</div>';
    }

    loadOnce_('groupInfo', () => callServer(
      'getMyVitalGroups',
      state.currentPlayer.playerId
    ))
      .then((res) => {
        if (!isSuccess(res)) {
          if (renderedCachedGroups) {
            setResultMessage(
              '#vitalGroupsMessage',
              getResponseError(res, '活力組資料更新失敗，暫時顯示上次資料')
            );
          } else {
            $('#vitalGroupsList').innerHTML =
              '<div class="empty-card">' +
              escapeHtml(getResponseError(res, '讀取活力組失敗')) +
              '</div>';
          }
          return;
        }

        state.vitalGroups = res.data.groups || [];
        setCache_('groupInfo', {
          groups: state.vitalGroups
        });
        renderVitalGroups();
      })
      .catch((error) => {
        if (renderedCachedGroups) {
          setResultMessage(
            '#vitalGroupsMessage',
            '活力組資料更新失敗，暫時顯示上次資料：' +
              getErrorMessage(error)
          );
        } else {
          $('#vitalGroupsList').innerHTML =
            '<div class="empty-card">' +
            escapeHtml(getErrorMessage(error)) +
            '</div>';
        }
      });
  }

  function renderVitalGroups() {
    const groups = state.vitalGroups || [];
    updateVitalGroupModalState(groups);

    if (!groups.length) {
      $('#vitalGroupsList').innerHTML =
        '<div class="empty-card">尚未加入任何活力組。</div>';
      return;
    }

    $('#vitalGroupsList').innerHTML = groups.map((group) => {
      const roleText = group.role === 'owner' ? '負責人' : '成員';
      const groupEnabled = group.enabled !== false;
      const groupMembers = group.members || [];
      const members = groupMembers.map((member) => {
        return escapeHtml(member.playerName || '成員') +
          (member.role === 'owner' ? '（負責人）' : '');
      }).join('、');
      const ownershipActions = group.role === 'owner' && groupEnabled
        ? groupMembers.filter((member) => {
            return member.role !== 'owner' && String(member.playerId || '').trim();
          }).map((member) => {
            return '<button class="mini-outline-btn" type="button" ' +
              'data-action="transfer-owner" data-group-id="' +
              escapeHtml(group.groupId) + '" data-player-id="' +
              escapeHtml(member.playerId) + '" data-player-name="' +
              escapeHtml(member.playerName || '成員') + '">移交給 ' +
              escapeHtml(member.playerName || '成員') + '</button>';
          }).join('')
        : '';

      return [
        '<article class="vital-group-card">',
        '<div>',
        '<strong>' + escapeHtml(group.groupName || '活力組') + '</strong>',
        '<p>' + escapeHtml(roleText) + '｜' +
          Number(group.memberCount || 0) + ' 人' +
          (groupEnabled ? '' : '｜已停用') +
          '</p>',
        groupEnabled && group.inviteCode
          ? '<span class="invite-code-chip">邀請碼 ' +
            escapeHtml(group.inviteCode) +
            '</span>'
          : '',
        members ? '<small class="member-line">' + members + '</small>' : '',
        groupEnabled
          ? ''
          : '<small class="member-line">此活力組目前已停用，相關小組功能暫停使用。</small>',
        '</div>',
        '<div class="vital-group-actions">',
        groupEnabled && group.inviteCode
          ? '<button class="mini-outline-btn" type="button" data-action="copy-invite" data-code="' +
            escapeHtml(group.inviteCode) +
            '">複製邀請碼</button>'
          : '',
        ownershipActions,
        '<button class="mini-outline-btn danger-outline-btn" type="button" data-action="leave-group" data-group-id="' +
          escapeHtml(group.groupId) +
          '">離開</button>',
        '</div>',
        '</article>'
      ].join('');
    }).join('');
  }

  function handleCreateVitalGroup(event) {
    event.preventDefault();

    if (!state.currentPlayer) {
      return;
    }

    if ((state.vitalGroups || []).length || (state.currentPlayer && state.currentPlayer.groupId)) {
      setResultMessage('#vitalGroupsMessage', '您目前已在活力組內，無法重複建立小組；若欲新建小組請先退出當前小組。');
      return;
    }

    const groupName = $('#createVitalGroupName').value.trim();

    if (!groupName) {
      setResultMessage('#vitalGroupsMessage', '請輸入活力組名稱');
      return;
    }

    if (groupName.length < 2 || groupName.length > 10) {
      setResultMessage('#vitalGroupsMessage', '活力組名稱需為 2～10 字');
      return;
    }

    setLoading(true, '建立活力組...');
    state.pendingGroupCreateSignature = groupName;
    state.pendingGroupCreateRequestId = getPendingMutationRequestId_(
      'group-create', groupName
    );

    const completeCreation = (res, recoveredGroups) => {
      const group = res && res.data && res.data.group;
      const groups = Array.isArray(recoveredGroups)
        ? recoveredGroups
        : (group ? [group] : []);

      $('#createVitalGroupName').value = '';
      clearPendingMutationRequestId_(
        'group-create', state.pendingGroupCreateRequestId
      );
      state.pendingGroupCreateRequestId = '';
      state.pendingGroupCreateSignature = '';
      invalidateByRule_('groupChanged');
      state.vitalGroups = groups;
      setCache_('groupInfo', { groups: groups });
      renderVitalGroups();
      setResultMessage(
        '#vitalGroupsMessage',
        res.data.message || '活力組已建立',
        true
      );
    };

    const confirmAfterTransportFailure = (originalError) => callServer(
      'getMyVitalGroups',
      state.currentPlayer.playerId
    ).then((confirmation) => {
      const groups = isSuccess(confirmation)
        ? (confirmation.data.groups || [])
        : [];
      const createdGroup = groups.find((group) =>
        String(group.groupName || '').trim() === groupName
      );

      if (!createdGroup) {
        throw originalError;
      }

      completeCreation({
        success: true,
        data: {
          message: '活力組已建立',
          group: createdGroup,
          recovered: true
        }
      }, groups);
    }).catch(() => {
      throw originalError;
    });

    callServer('createVitalGroup', {
      playerId: state.currentPlayer.playerId,
      groupName: groupName,
      requestId: state.pendingGroupCreateRequestId
    })
      .then((res) => {
        if (!isSuccess(res)) {
          settlePendingMutationRequest_(
            'group-create', state.pendingGroupCreateRequestId, res
          );
          setResultMessage(
            '#vitalGroupsMessage',
            getResponseError(res, '建立活力組失敗')
          );
          return;
        }

        completeCreation(res);
      })
      .catch((error) => confirmAfterTransportFailure(error))
      .catch((error) => {
        setResultMessage('#vitalGroupsMessage', getErrorMessage(error));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function handleJoinVitalGroup(event) {
    event.preventDefault();

    if (!state.currentPlayer) {
      return;
    }

    const existingGroup = (state.vitalGroups || [])[0];
    if (existingGroup || (state.currentPlayer && state.currentPlayer.groupId)) {
      const gName = (existingGroup && existingGroup.groupName) || '當前活力組';
      const confirmed = window.confirm(`您目前已在「${gName}」，加入新組將會退出原組並結算在原組的貢獻分數。確定要更換小組嗎？`);
      if (!confirmed) {
        return;
      }
    }

    const inviteCode = $('#joinVitalGroupCode').value.trim();

    if (!inviteCode) {
      setResultMessage('#vitalGroupsMessage', '請輸入邀請碼');
      return;
    }

    setLoading(true, '加入活力組...');

    callServer('joinVitalGroupByInviteCode', {
      playerId: state.currentPlayer.playerId,
      inviteCode: inviteCode
    })
      .then((res) => {
        if (!isSuccess(res)) {
          setResultMessage(
            '#vitalGroupsMessage',
            getResponseError(res, '加入活力組失敗')
          );
          return;
        }

        $('#joinVitalGroupCode').value = '';
        invalidateByRule_('groupChanged');
        const joinedGroup = res.data && res.data.group
          ? res.data.group
          : null;

        if (joinedGroup) {
          state.vitalGroups = [joinedGroup];
          setCache_('groupInfo', {
            groups: state.vitalGroups
          });
          renderVitalGroups();
        }

        setResultMessage('#vitalGroupsMessage', res.data.message || '已加入活力組', true);
        loadVitalGroups(!!joinedGroup);
      })
      .catch((error) => {
        setResultMessage('#vitalGroupsMessage', getErrorMessage(error));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function handleVitalGroupListClick(event) {
    const button = event.target.closest('[data-action]');

    if (!button || !state.currentPlayer) {
      return;
    }

    const action = button.dataset.action || '';
    const groupId = button.dataset.groupId || '';

    if (action === 'copy-invite') {
      copyInviteCode(button.dataset.code || '');
      return;
    }

    if (!groupId) {
      return;
    }

    if (action === 'transfer-owner') {
      const newOwnerPlayerId = String(button.dataset.playerId || '').trim();
      const newOwnerName = String(button.dataset.playerName || '該成員').trim();

      if (!newOwnerPlayerId) return;

      openConfirmModal({
        title: '移交活力組負責人',
        heading: '確定將負責人移交給 ' + newOwnerName + ' 嗎？',
        description: '移交完成後，你會保留為一般成員；若要離組，可再執行離開。',
        confirmText: '確認移交',
        handler: () => transferVitalGroupOwnership(
          groupId,
          newOwnerPlayerId,
          newOwnerName
        )
      });
      return;
    }

    if (action === 'leave-group') {
      openConfirmModal({
        title: '離開活力組',
        heading: '確定要離開這個活力組嗎？',
        description: '若你是最後一位成員，離開後這個活力組與邀請碼會一併關閉。',
        confirmText: '確認離開',
        handler: () => leaveVitalGroup(groupId)
      });
      return;
    }

    if (action !== 'switch-group') {
      return;
    }

    setLoading(true, '更新活力組...');

    callServer('switchPrimaryVitalGroup', {
      playerId: state.currentPlayer.playerId,
      groupId: groupId
    })
      .then((res) => {
        if (!isSuccess(res)) {
          setResultMessage(
            '#vitalGroupsMessage',
            getResponseError(res, '切換活力組失敗')
          );
          return;
        }

        state.currentPlayer = res.data.player;
        persistCurrentPlayer();
        renderPlayer(state.currentPlayer);
        invalidateByRule_('groupChanged');
        setResultMessage('#vitalGroupsMessage', res.data.message || '活力組已更新', true);
        loadVitalGroups();
        refreshDashboard(false);
      })
      .catch((error) => {
        setResultMessage('#vitalGroupsMessage', getErrorMessage(error));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function copyInviteCode(code) {
    if (!code) {
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code)
        .then(() => {
          setResultMessage('#vitalGroupsMessage', '邀請碼已複製：' + code, true);
        })
        .catch(() => {
          setResultMessage('#vitalGroupsMessage', '邀請碼：' + code, true);
        });
      return;
    }

    setResultMessage('#vitalGroupsMessage', '邀請碼：' + code, true);
  }

  function transferVitalGroupOwnership(groupId, newOwnerPlayerId, newOwnerName) {
    setLoading(true, '移交活力組負責人...');

    callServer('transferVitalGroupOwnership', {
      groupId: groupId,
      newOwnerPlayerId: newOwnerPlayerId
    })
      .then((res) => {
        if (!isSuccess(res)) {
          setResultMessage(
            '#vitalGroupsMessage',
            getResponseError(res, '移交活力組負責人失敗')
          );
          return;
        }

        invalidateByRule_('groupChanged');
        notifyOtherAppInstances_('dataChanged');
        setResultMessage(
          '#vitalGroupsMessage',
          res.data.message || ('已將負責人移交給 ' + newOwnerName),
          true
        );
        loadVitalGroups();
        refreshDashboard(false);
      })
      .catch((error) => {
        setResultMessage('#vitalGroupsMessage', getErrorMessage(error));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function leaveVitalGroup(groupId) {
    setLoading(true, '離開活力組...');

    callServer('leaveVitalGroup', {
      playerId: state.currentPlayer.playerId,
      groupId: groupId
    })
      .then((res) => {
        if (!isSuccess(res)) {
          setResultMessage(
            '#vitalGroupsMessage',
            getResponseError(res, '離開活力組失敗')
          );
          return;
        }

        state.currentPlayer = res.data.player;
        persistCurrentPlayer();
        renderPlayer(state.currentPlayer);
        invalidateByRule_('groupChanged');
        setResultMessage('#vitalGroupsMessage', res.data.message || '已離開活力組', true);
        loadVitalGroups();
        refreshDashboard(false);
      })
      .catch((error) => {
        setResultMessage('#vitalGroupsMessage', getErrorMessage(error));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function refreshDashboard(showLoading) {
    if (!state.currentPlayer) {
      return Promise.resolve();
    }

    if (isCacheValid_('dashboard')) {
      renderDashboardData_(getCache_('dashboard'));
      return refreshOpenSynchronizedViews_();
    }

    if (showLoading) {
      setLoading(true, '讀取首頁資料...');
    }

    return loadOnce_('dashboard', () => callServer(
      'getHomeDashboard',
      state.currentPlayer.playerId
    ))
      .then((res) => {
        if (!isSuccess(res)) {
          setResultMessage(
            '#homeMessage',
            getResponseError(res, '首頁資料讀取失敗')
          );
          return null;
        }

        const data = res.data || {};
        const dataEpochId = data.dataEpochId ||
          (data.dataEpoch && data.dataEpoch.dataEpochId) ||
          state.currentDataEpochId;

        if (dataEpochId) {
          state.currentDataEpochId = dataEpochId;
        }

        state.homeSyncToken = String(
          data.syncToken || state.homeSyncToken || ''
        ).trim();
        state.businessDate = String(
          data.businessDate || getTaipeiBusinessDate_()
        ).trim();

        setCache_('dashboard', data);

        if (data.taskConfig) {
          applyTaskConfiguration_(data.taskConfig);
        }

        if (data.player) {
          state.currentPlayer = data.player;
          setCache_('accountProfile', {
            player: data.player
          });
          persistCurrentPlayer();
        }

        state.dailyRecord = data.daily && data.daily.record
          ? data.daily.record
          : createEmptyDailyRecord();

        state.weeklyTaskRecord = data.weekly && data.weekly.record
          ? data.weekly.record
          : (
            data.meeting && data.meeting.record
              ? data.meeting.record
              : createEmptyWeeklyTaskRecord()
          );

        state.groupJourney = data.journey && data.journey.group
          ? data.journey.group
          : null;
        setCache_('journey', state.groupJourney);
        state.chestSummary = data.chestSummary || createEmptyChestSummary();
        setCache_('chestSummary', state.chestSummary);
        applyMessageCenterData_(data.messageCenter, true);

        renderPlayer(state.currentPlayer);
        renderHomeChestSummary(state.chestSummary);
        renderDailyStatus();
        renderWeeklyTaskStatus();
        renderHomeSocial(data.social || {});
        renderGroupJourney(state.groupJourney);

        return refreshOpenSynchronizedViews_();
      })
      .catch((error) => {
        setResultMessage('#homeMessage', getErrorMessage(error));
      })
      .finally(() => {
        if (showLoading) {
          setLoading(false);
        }
      });
  }

  function renderDashboardData_(data) {
    data = data || {};

    state.homeSyncToken = String(
      data.syncToken || state.homeSyncToken || ''
    ).trim();
    state.businessDate = String(
      data.businessDate || state.businessDate ||
      getTaipeiBusinessDate_()
    ).trim();

    const dataEpochId = data.dataEpochId ||
      (data.dataEpoch && data.dataEpoch.dataEpochId) ||
      state.currentDataEpochId;

    if (dataEpochId) {
      state.currentDataEpochId = dataEpochId;
    }

    if (data.taskConfig) {
      applyTaskConfiguration_(data.taskConfig);
    }

    if (data.player) {
      state.currentPlayer = data.player;
      setCache_('accountProfile', {
        player: data.player
      });
      persistCurrentPlayer();
    }

    state.dailyRecord = data.daily && data.daily.record
      ? data.daily.record
      : createEmptyDailyRecord();

    state.weeklyTaskRecord = data.weekly && data.weekly.record
      ? data.weekly.record
      : (
        data.meeting && data.meeting.record
          ? data.meeting.record
          : createEmptyWeeklyTaskRecord()
      );

    state.groupJourney = data.journey && data.journey.group
      ? data.journey.group
      : null;
    setCache_('journey', state.groupJourney);
    state.chestSummary = data.chestSummary || createEmptyChestSummary();
    setCache_('chestSummary', state.chestSummary);
    applyMessageCenterData_(data.messageCenter, true);

    renderPlayer(state.currentPlayer);
    renderHomeChestSummary(state.chestSummary);
    renderDailyStatus();
    renderWeeklyTaskStatus();
    renderHomeSocial(data.social || {});
    renderGroupJourney(state.groupJourney);
  }

  

  

  function applyRewardSummaryToHome(rewardSummary) {
    const addedScore = Number(
      rewardSummary && rewardSummary.journeyScore
        ? rewardSummary.journeyScore
        : 0
    );

    if (!state.groupJourney || !addedScore) {
      return;
    }

    state.groupJourney = Object.assign({}, state.groupJourney, {
      totalScore: Number(state.groupJourney.totalScore || 0) + addedScore,
      myContributionScore: Number(
        state.currentPlayer && state.currentPlayer.totalScore
          ? state.currentPlayer.totalScore
          : state.groupJourney.myContributionScore || 0
      )
    });

    renderGroupJourney(state.groupJourney);
  }

  function renderPlayer(player) {
    if (!player) {
      return;
    }

    const contribution = Number(player.totalScore || 0);
    const displayName = player.displayName || player.playerName || '活力人';
    const groupSuffix = player.groupName
      ? '（' + player.groupName + '）'
      : '';

    $('#homePlayerName').textContent = displayName + groupSuffix;
    $('#homeGroupName').textContent = '';

    $('#heroGreetingText').textContent = '';

    $('#myPlayerName').textContent = displayName;
    $('#myGroupName').textContent = buildHandbookAffiliationText(player);

    $('#homeStreakText').textContent =
      Number(player.dailyStreak || 0) + ' 天';
    renderPendingTaskScorePreview_();
    renderHomeChestSummary(state.chestSummary || createEmptyChestSummary());

    renderAvatar(player);
  }

  function createEmptyChestSummary() {
    return {
      earnedCount: 0,
      totalCount: 8
    };
  }

  function renderHomeChestSummary(summary) {
    summary = summary || createEmptyChestSummary();

    const earned = Math.max(0, Number(summary.earnedCount || 0));
    const total = Math.max(1, Number(summary.totalCount || 8));
    const target = $('#homeChestCountText');
    const button = $('#openChestCollectionBtn');
    const summaryText = '已獲得 ' + earned + ' / ' + total;

    if (target) {
      target.textContent = summaryText;
      target.dataset.summary = summaryText;
    }

    if (button) {
      button.setAttribute('title', summaryText);
      button.setAttribute('aria-label', '寶藏收藏，' + summaryText);
    }
  }

  function buildHandbookAffiliationText(player) {
    player = player || {};

    const rows = [];

    if (player.careDistrict) {
      rows.push('' + player.careDistrict);
    }

    if (player.careArea) {
      rows.push('' + player.careArea);
    }

    if (player.groupName) {
      rows.push('組名：' + player.groupName);
    }

    return rows.length
      ? rows.join('｜')
      : '尚未設定照顧區、大區或活力組';
  }

  function refreshOpenSynchronizedViews_() {
    const infoModalTitle = isModalOpen_('infoModal')
      ? String($('#infoModalTitle').textContent || '').trim()
      : '';
    const collectionOpen = infoModalTitle === '寶藏收藏';
    const contributionOpen = infoModalTitle === '同行貢獻';
    const detailOpen = isModalOpen_('chestDetailModal') &&
      !!String(state.selectedChestDetail && state.selectedChestDetail.chestId || '').trim();
    const jobs = [];

    if (contributionOpen) {
      invalidateCache_('contribution');
      jobs.push(
        callServer('getMyGroupContributionSummary')
          .then((res) => {
            if (
              !isModalOpen_('infoModal') ||
              String($('#infoModalTitle').textContent || '').trim() !== '同行貢獻'
            ) {
              return;
            }

            if (!isSuccess(res)) {
              $('#infoModalContent').innerHTML =
                '<div class="empty-card">' +
                escapeHtml(getResponseError(res, '同行貢獻讀取失敗')) +
                '</div>';
              return;
            }

            const data = res.data || {};
            setCache_('contribution', data);
            $('#infoModalContent').innerHTML = buildGroupContributionModalHtml(data);
            hydrateExistingImages_($('#infoModalContent'));
          })
          .catch((error) => {
            if (
              isModalOpen_('infoModal') &&
              String($('#infoModalTitle').textContent || '').trim() === '同行貢獻'
            ) {
              $('#infoModalContent').innerHTML =
                '<div class="empty-card">' +
                escapeHtml(getErrorMessage(error)) +
                '</div>';
            }
          })
      );
    }

    if (collectionOpen || detailOpen) {
      invalidateCache_('chestCollection');
      invalidateCache_('chestSettingsForPlayer');

      jobs.push(
        callServer('getPlayerChestCollection')
          .then((res) => {
            if (!isSuccess(res)) {
              throw new Error(getResponseError(res, '讀取寶藏收藏失敗'));
            }

            const collection = res.data || {};
            setCache_('chestCollection', collection);
            setCache_(
              'chestSettingsForPlayer',
              Array.isArray(collection.chests) ? collection.chests : []
            );

            if (!collection.isPreviousDataEpoch) {
              state.chestSummary = {
                earnedCount: collection.earnedCount || 0,
                totalCount: collection.totalCount || 8
              };
              setCache_('chestSummary', state.chestSummary);
              renderHomeChestSummary(state.chestSummary);
            }

            if (
              collectionOpen &&
              isModalOpen_('infoModal') &&
              String($('#infoModalTitle').textContent || '').trim() === '寶藏收藏'
            ) {
              $('#infoModalContent').innerHTML = renderChestCollectionHtml(collection);
              hydrateExistingImages_($('#infoModalContent'));
            }

            if (detailOpen && isModalOpen_('chestDetailModal')) {
              const selected = state.selectedChestDetail || {};
              const chest = (collection.chests || []).find((item) =>
                String(item.chestId || '') === String(selected.chestId || '') &&
                String(item.dataEpochId || collection.dataEpochId || '') ===
                  String(selected.dataEpochId || '')
              );

              if (chest) {
                applyChestDetailModalData_(
                  buildChestDetailViewModel_(chest, collection.dataEpochId),
                  false
                );
              }
            }
          })
          .catch(() => {})
      );
    }

    return jobs.length
      ? Promise.all(jobs).then(() => undefined)
      : Promise.resolve();
  }

  function openChestCollectionModal() {
    closeModal('chestDetailModal');

    openInfoModal(
      '寶藏收藏',
      '<div id="chestCollectionContent" class="treasure-collection-shell"><div class="treasure-loading-card">讀取寶藏收藏中...</div></div>'
    );

    loadOnce_(
      'chestCollection',
      () => callServer('getPlayerChestCollection')
        .then((res) => {
          if (!isSuccess(res)) {
            throw new Error(getResponseError(res, '讀取寶藏收藏失敗'));
          }

          return res.data || {};
        })
    )
      .then((data) => {
        if (!data.isPreviousDataEpoch) {
          state.chestSummary = {
            earnedCount: data.earnedCount || 0,
            totalCount: data.totalCount || 8
          };

          setCache_('chestSummary', state.chestSummary);
          renderHomeChestSummary(state.chestSummary);
        }
        setCache_(
          'chestSettingsForPlayer',
          Array.isArray(data.chests) ? data.chests : []
        );

        $('#infoModalContent').innerHTML = renderChestCollectionHtml(data);
        hydrateExistingImages_($('#infoModalContent'));
      })
      .catch((error) => {
        $('#infoModalContent').innerHTML =
          '<div class="treasure-collection-shell"><div class="treasure-loading-card">' +
            escapeHtml(getErrorMessage(error)) +
          '</div></div>';
      });
  }

  function buildChestDetailViewModel_(chest, collectionDataEpochId) {
    chest = chest || {};

    const hasEarned = !!chest.earned;
    const hasClaimed = !!chest.claimed;
    const hasFulfilled = !!chest.fulfilled;
    const rewardType = String(
      chest.claimRewardType || chest.rewardType || 'other'
    );
    const chestName = chest.chestName || chest.chestId || '寶箱';
    const chestDetail = chest.displayRewardDescription ||
      chest.rewardDescription ||
      '尚無獎勵說明。';
    const chestStatus = hasEarned
      ? (rewardType === 'other'
          ? (hasFulfilled ? '已發放' : (hasClaimed ? '待發放' : '已獲得'))
          : (hasClaimed ? '已領取' : '已獲得'))
      : '待取得';

    return {
      chestId: String(chest.chestId || ''),
      dataEpochId: String(chest.dataEpochId || collectionDataEpochId || ''),
      chestName: chestName,
      chestStatus: chestStatus,
      chestDetail: chestDetail,
      chestImage: getChestImageUrl_(chest),
      hasEarned: hasEarned,
      hasClaimed: hasClaimed,
      hasFulfilled: hasFulfilled,
      rewardType: rewardType
    };
  }

  function renderChestCollectionHtml(data) {
    const chests = data && Array.isArray(data.chests)
      ? data.chests
      : [];

    const earned = Math.max(0, Number(data && data.earnedCount || 0));
    const total = Math.max(1, Number(data && data.totalCount || 8));
    const isPreviousDataEpoch = !!(data && data.isPreviousDataEpoch);
    const collectionDataEpochId = String(data && data.dataEpochId || '');

    if (!chests.length) {
      return [
        '<div class="treasure-collection-shell">',
        '<div class="treasure-loading-card">目前沒有寶箱設定。</div>',
        '</div>'
      ].join('');
    }

    return [
      '<section class="treasure-collection-shell">',
      '<div class="treasure-summary-card">',
      '<div class="treasure-summary-icon" aria-hidden="true"></div>',
      '<div class="treasure-summary-text">',
      '<span>' + (isPreviousDataEpoch ? '先前待領寶箱' : '收藏進度') + '</span>',
      '<strong>已獲得 ' + earned + ' / ' + total + '</strong>',
      '</div>',
      '</div>',
      isPreviousDataEpoch
        ? '<div class="empty-card">' +
            escapeHtml(
              data.collectionNotice ||
              '請先領取先前尚未領取的寶箱。'
            ) +
          '</div>'
        : '',
      '<div class="treasure-collection-grid">',

      chests.map((chest) => {
        const view = buildChestDetailViewModel_(chest, collectionDataEpochId);

        return [
          '<button ',
          'type="button" ',
          'class="treasure-collection-item ' +
          (view.hasEarned ? 'earned' : 'locked') + '" ',
          'data-chest-id="' + escapeHtml(view.chestId) + '" ',
          'data-chest-data-epoch-id="' + escapeHtml(view.dataEpochId) + '" ',
          'data-chest-name="' + escapeHtml(view.chestName) + '" ',
          'data-chest-status="' + escapeHtml(view.chestStatus) + '" ',
          'data-chest-detail="' + escapeHtml(view.chestDetail) + '" ',
          'data-chest-image="' + escapeHtml(view.chestImage) + '" ',
          'data-chest-claimed="' + (view.hasClaimed ? '1' : '0') + '" ',
          'data-chest-fulfilled="' + (view.hasFulfilled ? '1' : '0') + '" ',
          'data-chest-reward-type="' + escapeHtml(view.rewardType) + '" ',
          'data-chest-earned="' + (view.hasEarned ? '1' : '0') + '">',
          '<div class="treasure-collection-badge">' + escapeHtml(view.chestStatus) + '</div>',
          '<img src="' + escapeHtml(IMAGE_FALLBACK_DATA_URL) + '" ',
          'data-image-key="' + escapeHtml(getChestImageAssetKey_(view.chestId)) + '" ',
          'data-managed-url="' + escapeHtml(view.chestImage) + '" alt="">',
          '<span>' + escapeHtml(view.chestName) + '</span>',
          '</button>'
        ].join('');
      }).join(''),

      '</div>',
      '</section>'
    ].join('');
  }

  function handleInfoModalContentClick(event) {
    const chestButton = event.target.closest('[data-chest-detail]');

    if (!chestButton || !$('#infoModalContent').contains(chestButton)) {
      return;
    }

    openChestDetailModal({
      chestId: chestButton.dataset.chestId || '',
      dataEpochId: chestButton.dataset.chestDataEpochId || '',
      chestName: chestButton.dataset.chestName || '寶箱資訊',
      chestStatus: chestButton.dataset.chestStatus || '待取得',
      chestDetail: chestButton.dataset.chestDetail || '尚無獎勵說明。',
      chestImage: chestButton.dataset.chestImage || '',
      hasEarned: chestButton.dataset.chestEarned === '1',
      hasClaimed: chestButton.dataset.chestClaimed === '1',
      hasFulfilled: chestButton.dataset.chestFulfilled === '1',
      rewardType: chestButton.dataset.chestRewardType || 'other'
    });
  }

  function openChestDetailModal(chest) {
    applyChestDetailModalData_(chest, true);
  }

  function applyChestDetailModalData_(chest, shouldFocus) {
    chest = chest || {};

    const chestName = chest.chestName || '寶箱資訊';
    const chestStatus = chest.chestStatus || '待取得';
    const chestDetail = chest.chestDetail || '尚無獎勵說明。';
    const chestImage = chest.chestImage || '';

    const modal = $('#chestDetailModal');
    const visual = $('#chestDetailModalVisual');
    const image = $('#chestDetailModalImage');
    const status = $('#chestDetailModalStatus');
    const claimButton = $('#chestClaimRewardBtn');

    $('#chestDetailModalTitle').textContent = chestName;
    $('#chestDetailModalName').textContent = chestName;
    $('#chestDetailModalText').textContent = chestDetail;

    status.textContent = chestStatus;
    status.classList.toggle('is-earned', !!chest.hasEarned);
    status.classList.toggle('is-locked', !chest.hasEarned);

    state.selectedChestDetail = {
      chestId: String(chest.chestId || ''),
      dataEpochId: String(chest.dataEpochId || ''),
      hasEarned: !!chest.hasEarned,
      hasClaimed: !!chest.hasClaimed,
      hasFulfilled: !!chest.hasFulfilled,
      rewardType: String(chest.rewardType || 'other')
    };

    if (claimButton) {
      claimButton.disabled = !chest.hasEarned || !!chest.hasClaimed;

      if (!chest.hasEarned) {
        claimButton.textContent = '待取得';
      } else if (chest.hasClaimed) {
        claimButton.textContent = chest.rewardType === 'other'
          ? (chest.hasFulfilled ? '已發放' : '待管理者發放')
          : '已領取';
      } else {
        claimButton.textContent = '領取獎勵';
      }
    }

    if (chestImage) {
      image.alt = chestName;
      visual.classList.remove('hidden');
      setManagedImageSource_(
        image,
        chestImage,
        getChestImageAssetKey_(chest.chestId)
      );
    } else {
      image.removeAttribute('src');
      image.alt = '';
      visual.classList.add('hidden');
    }

    openModal('chestDetailModal');

    if (shouldFocus !== false) {
      window.setTimeout(() => {
        const focusButton = modal.querySelector('#chestClaimRewardBtn');

        if (focusButton) {
          focusButton.focus();
        }
      }, 0);
    }
  }

  function claimSelectedChestReward() {
    const selected = state.selectedChestDetail || {};
    const chestId = String(selected.chestId || '').trim();
    const button = $('#chestClaimRewardBtn');

    if (!chestId || !selected.hasEarned || selected.hasClaimed) {
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = '領取中...';
    }

    callServer('claimPlayerChestReward', {
      chestId,
      awardDataEpochId: String(selected.dataEpochId || '')
    })
      .then((res) => {
        if (!isSuccess(res)) {
          throw new Error(getResponseError(res, '領取寶箱獎勵失敗'));
        }

        const data = res.data || {};

        if (data.collection) {
          setCache_('chestCollection', data.collection);
          setCache_(
            'chestSettingsForPlayer',
            Array.isArray(data.collection.chests)
              ? data.collection.chests
              : []
          );
          $('#infoModalContent').innerHTML =
            renderChestCollectionHtml(data.collection);
          hydrateExistingImages_($('#infoModalContent'));
        } else {
          invalidateCache_('chestCollection');
          invalidateCache_('chestSettingsForPlayer');
        }

        if (data.chestSummary) {
          state.chestSummary = data.chestSummary;
          setCache_('chestSummary', data.chestSummary);
          renderHomeChestSummary(data.chestSummary);
        } else {
          invalidateCache_('chestSummary');
        }

        invalidateCaches_([
          'dashboard',
          'groupInfo',
          'growth',
          'journey',
          'contribution',
          'accountProfile'
        ]);

        if (
          data.groupJourney &&
          String(selected.dataEpochId || state.currentDataEpochId) ===
            String(state.currentDataEpochId || '')
        ) {
          state.groupJourney = data.groupJourney;

          if (state.currentPlayer) {
            state.currentPlayer = Object.assign({}, state.currentPlayer, {
              totalScore: Number(
                data.groupJourney.myContributionScore ||
                state.currentPlayer.totalScore ||
                0
              )
            });
          }

          setCache_('journey', data.groupJourney);
          renderGroupJourney(state.groupJourney);
        }

        const claimedChest = data.claimedChest || data.chest || {};
        state.selectedChestDetail = Object.assign({}, selected, {
          hasClaimed: true,
          hasFulfilled: !!claimedChest.fulfilled,
          rewardType: String(claimedChest.rewardType || selected.rewardType || 'other')
        });
        const statusText = state.selectedChestDetail.rewardType === 'other'
          ? (state.selectedChestDetail.hasFulfilled ? '已發放' : '待管理者發放')
          : '已領取';

        if (button) {
          button.textContent = statusText;
          button.disabled = true;
        }

        $('#chestDetailModalStatus').textContent = statusText;
        notifyOtherAppInstances_('chestClaimed');
      })
      .catch((error) => {
        if (button) {
          button.textContent = '領取獎勵';
          button.disabled = false;
        }

        window.alert(getErrorMessage(error));
      });
  }

  function renderHomeSocial(social) {
    social = social || {};

    const members = social.members || [];
    const posts = social.posts || [];
    const groupEnabled = social.groupEnabled !== false;
    const statusMessage = String(social.statusMessage || '').trim();
    state.homeGroupPosts = posts;
    state.myGroupPost = social.myPost || posts.find((post) => post.isMine) || null;
    state.homeGroupMemberCount = members.length;
    state.homeGroupEnabled = groupEnabled;
    state.homeGroupStatusMessage = statusMessage;

    $('#homeMemberCountText').textContent = members.length;
    $('#homeCampMeta').textContent = !groupEnabled
      ? (statusMessage || '此活力組目前已停用。')
      : (
        members.length
          ? '目前 ' + members.length + ' 位成員同行。'
          : '尚未加入活力組。'
      );

    renderHeroAnnouncements(groupEnabled ? posts : []);

    $('#homeGroupPosts').innerHTML = !groupEnabled
      ? '<div class="empty-card">' +
        escapeHtml(statusMessage || '此活力組目前已停用。') +
        '</div>'
      : (
        posts.length
          ? '<div class="empty-card">公告已顯示在上方旅程看板。</div>'
          : '<div class="empty-card">尚無公告。</div>'
      );
  }

  function renderHeroAnnouncements(posts) {
    const target = $('#homeHeroAnnouncements');
    const rows = (posts || []).slice(0, 5);
    const rowHeight = 34;

    clearHeroAnnouncementTimer();

    if (!target) {
      return;
    }

    target.classList.toggle('is-empty', !rows.length);

    if (!rows.length) {
      target.innerHTML =
        '<em class="hero-announcement-label">小組公告</em>' +
        '<div class="hero-announcement-window">' +
        '<div class="hero-announcement-item"><span>尚無公告</span></div>' +
        '</div>';
      return;
    }

    target.innerHTML = [
      '<em class="hero-announcement-label">小組公告</em>',
      '<div class="hero-announcement-window">',
      '<div class="hero-announcement-track">',
      rows.map((post) => {
        return [
          '<div class="hero-announcement-item">',
          '<strong>' + escapeHtml(post.playerName || '成員') + '</strong>',
          '<span>' + escapeHtml(post.content || '') + '</span>',
          '</div>'
        ].join('');
      }).join(''),
      '</div>',
      '</div>'
    ].join('');

    if (rows.length < 2) {
      return;
    }

    const track = target.querySelector('.hero-announcement-track');
    let index = 0;

    state.groupPostTimer = window.setInterval(() => {
      if (!document.body.contains(target)) {
        clearHeroAnnouncementTimer();
        return;
      }

      index = (index + 1) % rows.length;
      track.style.transform = 'translateY(-' + (index * rowHeight) + 'px)';
    }, 3200);
  }

  function clearHeroAnnouncementTimer() {
    if (state.groupPostTimer) {
      window.clearInterval(state.groupPostTimer);
      state.groupPostTimer = null;
    }
  }

  function openGroupPostModal() {
    if (!ensureGroupFeatureReady()) {
      return;
    }

    resetGroupPostEditor();
    setResultMessage('#groupPostMessage', '', false);
    renderMyGroupPostList();
    openModal('groupPostModal');
  }

  function resetGroupPostEditor() {
    const hasExistingPost = !!state.myGroupPost;
    const input = $('#homeGroupPostInput');
    const submitButton = $('#homeGroupPostSubmitBtn');

    state.editingGroupPostId = '';
    input.value = '';
    input.disabled = hasExistingPost;
    submitButton.disabled = hasExistingPost;
    submitButton.textContent = hasExistingPost
      ? '已有公告，請編輯原公告'
      : '發布公告';
    $('#cancelGroupPostEditBtn').classList.add('hidden');
  }

  function startEditGroupPost(postId) {
    const post = state.myGroupPost &&
      String(state.myGroupPost.postId || '') === String(postId || '')
        ? state.myGroupPost
        : null;

    if (!post) {
      setResultMessage('#groupPostMessage', '找不到小組公告資料');
      return;
    }

    state.editingGroupPostId = String(postId || '');
    $('#homeGroupPostInput').disabled = false;
    $('#homeGroupPostInput').value = post.content || '';
    $('#homeGroupPostSubmitBtn').disabled = false;
    $('#homeGroupPostSubmitBtn').textContent = '儲存公告';
    $('#cancelGroupPostEditBtn').classList.remove('hidden');
    setResultMessage('#groupPostMessage', '正在編輯小組公告', true);
  }

  function renderMyGroupPostList() {
    const list = $('#myGroupPostList');
    const post = state.myGroupPost;

    if (!list) {
      return;
    }

    if (!post) {
      list.innerHTML =
        '<div class="empty-card">尚未發布小組公告；每位組員最多 1 則。</div>';
      return;
    }

    list.innerHTML = [
      '<article class="group-post-manage-row">',
      '<div>',
      '<strong>' + escapeHtml(post.content || '') + '</strong>',
      '<small>' + escapeHtml(post.updatedAt || post.createdAt || '') + '</small>',
      '</div>',
      '<div class="group-post-actions">',
      '<button class="mini-outline-btn" type="button" data-edit-group-post="' +
        escapeHtml(post.postId || '') +
        '">編輯</button>',
      '<button class="mini-outline-btn danger-outline-btn" type="button" data-delete-group-post="' +
        escapeHtml(post.postId || '') +
        '">刪除</button>',
      '</div>',
      '</article>'
    ].join('');
  }

  function submitHomeGroupPost(event) {
    event.preventDefault();

    if (!state.currentPlayer) {
      return;
    }

    if (!ensureGroupFeatureReady('#groupPostMessage')) {
      return;
    }

    const content = $('#homeGroupPostInput').value.trim();

    if (!content) {
      setResultMessage('#groupPostMessage', '請輸入公告內容');
      return;
    }

    if (content.length > 15) {
      setResultMessage('#groupPostMessage', '公告內容最多 15 個中文字');
      return;
    }

    const editingPostId = String(state.editingGroupPostId || '');

    if (!editingPostId && state.myGroupPost) {
      setResultMessage(
        '#groupPostMessage',
        '每位組員只能發布 1 則小組公告，請編輯或刪除原公告。'
      );
      return;
    }

    const method = editingPostId ? 'updateGroupPost' : 'createGroupPost';
    if (!editingPostId) {
      state.pendingGroupPostCreateSignature = content;
      state.pendingGroupPostCreateRequestId = getPendingMutationRequestId_(
        'group-post-create', content
      );
    }

    setLoading(true, editingPostId ? '儲存公告...' : '發布公告...');

    callServer(method, {
      playerId: state.currentPlayer.playerId,
      postId: editingPostId,
      postType: 'announcement',
      content: content,
      requestId: editingPostId ? '' : state.pendingGroupPostCreateRequestId
    })
      .then((res) => {
        if (!isSuccess(res)) {
          if (!editingPostId) settlePendingMutationRequest_(
            'group-post-create', state.pendingGroupPostCreateRequestId, res
          );
          setResultMessage(
            '#groupPostMessage',
            getResponseError(res, editingPostId ? '儲存失敗' : '發布失敗')
          );
          return;
        }

        if (editingPostId) {
          state.homeGroupPosts = (state.homeGroupPosts || []).map((post) => {
            if (String(post.postId || '') !== editingPostId) {
              return post;
            }

            return Object.assign({}, post, { content: content });
          });
          state.myGroupPost = Object.assign({}, state.myGroupPost || {}, {
            postId: editingPostId,
            content: content,
            updatedAt: new Date().toLocaleString('zh-TW', { hour12: false })
          });
          resetGroupPostEditor();
          renderMyGroupPostList();
          invalidateByRule_('groupAnnouncementsChanged');
          setResultMessage('#groupPostMessage', res.data.message || '公告已更新', true);
          refreshDashboard(false);
          return;
        }

        resetGroupPostEditor();
        clearPendingMutationRequestId_(
          'group-post-create', state.pendingGroupPostCreateRequestId
        );
        state.pendingGroupPostCreateRequestId = '';
        state.pendingGroupPostCreateSignature = '';
        closeModal('groupPostModal');
        invalidateByRule_('groupAnnouncementsChanged');
        setResultMessage('#myMessage', res.data.message || '已發布', true);
        refreshDashboard(false);
      })
      .catch((error) => {
        setResultMessage('#groupPostMessage', getErrorMessage(error));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function confirmDeleteMyGroupPost(postId) {
    if (!state.currentPlayer || !postId || !state.myGroupPost) {
      return;
    }

    openConfirmModal({
      title: '刪除小組公告',
      heading: '確定要刪除這則小組公告嗎？',
      description: '刪除後將不再顯示；之後可以重新發布 1 則新的小組公告。',
      confirmText: '確認刪除',
      handler: () => deleteMyGroupPost(postId)
    });
  }

  function deleteMyGroupPost(postId) {
    if (!state.currentPlayer || !postId) {
      return;
    }

    setLoading(true, '刪除公告...');

    if (!ensureGroupFeatureReady('#groupPostMessage')) {
      setLoading(false);
      return;
    }

    callServer('deleteGroupPost', {
      playerId: state.currentPlayer.playerId,
      postId: postId
    })
      .then((res) => {
        if (!isSuccess(res)) {
          setResultMessage(
            '#groupPostMessage',
            getResponseError(res, '刪除公告失敗')
          );
          return;
        }

        setResultMessage('#groupPostMessage', res.data.message || '公告已刪除', true);
        if (String(state.editingGroupPostId || '') === String(postId)) {
          resetGroupPostEditor();
        }
        invalidateByRule_('groupAnnouncementsChanged');
        refreshDashboard(false);
        state.homeGroupPosts = (state.homeGroupPosts || [])
          .filter((post) => String(post.postId || '') !== String(postId));
        state.myGroupPost = null;
        resetGroupPostEditor();
        renderMyGroupPostList();
      })
      .catch((error) => {
        setResultMessage('#groupPostMessage', getErrorMessage(error));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function renderAvatar(player) {
    player = player || {};
    const localUrl = getAvatarUrl(player.avatarGender, player.avatarNo);
    const configuredUrl = String(player.avatarUrl || '').trim();
    const primaryUrl = localUrl || configuredUrl;
    const remoteFallback = localUrl
      ? (configuredUrl || getRemoteAvatarUrl_(player.avatarGender, player.avatarNo))
      : '';

    [
      ['#homeAvatarImg', '#homeAvatarPlaceholder'],
      ['#myAvatarImg', '#myAvatarPlaceholder']
    ].forEach(([imageSelector, placeholderSelector]) => {
      const image = $(imageSelector);
      const placeholder = $(placeholderSelector);

      if (primaryUrl) {
        setAvatarImageSource_(
          image,
          placeholder,
          primaryUrl,
          'playerAvatar:' + String(player.playerId || '') + ':' + primaryUrl,
          remoteFallback
        );
      } else {
        image.classList.add('hidden');
        image.removeAttribute('src');
        delete image.dataset.managedLoadedUrl;
        placeholder.classList.remove('hidden');
      }
    });
  }

  function renderGroupJourney(group) {
    if (state.homeGroupEnabled === false) {
      $('#homeJourneyChapterText').textContent = '已停用';

      const disabledGroupScore = $('#homeGroupScoreText');
      if (disabledGroupScore) disabledGroupScore.textContent = '0';
      renderPendingTaskScorePreview_();

      $('#homeJourneyProgressText').textContent = '0%';
      $('#homeJourneyNextText').textContent =
        state.homeGroupStatusMessage ||
        '此活力組目前已停用，相關小組功能暫停使用。';
      $$('#homeJourneyNodes .journey-node').forEach((node) => {
        node.classList.remove('passed', 'current');
      });
      return;
    }

    const journey = group && group.journey
      ? group.journey
      : {
        totalScore: 0,
        currentChapter: {
          index: 1,
          title: '信心',
          key: 'faith'
        },
        nextChapter: {
          title: '美德'
        },
        scoreToNext: 20000,
        progressPercent: 0,
        isLoveChapter: false
      };

    const current = journey.currentChapter || {
      index: 1,
      title: '信心',
      key: 'faith'
    };

    const currentIndex = Number(current.index || 1);
    const totalScore = group && group.totalScore
      ? group.totalScore
      : journey.totalScore || 0;

    $('#homeJourneyChapterText').textContent = current.title || '信心';

    const homeGroupScore = $('#homeGroupScoreText');

    if (homeGroupScore) {
      homeGroupScore.textContent = formatNumber(totalScore);
    }
    renderPendingTaskScorePreview_();

    $('#homeJourneyProgressText').textContent =
      Math.max(0, Number(journey.progressPercent || 0)) +
      '%';

    $('#homeJourneyNextText').textContent = journey.isLoveChapter
      ? '愛篇章已展開；同行積分仍持續累積。'
      : '距離' +
        (
          journey.nextChapter && journey.nextChapter.title
            ? '「' + journey.nextChapter.title + '」篇章'
            : '下一篇章'
        ) +
        '還有 ' +
        formatNumber(journey.scoreToNext || 0) +
        ' 點';

    $$('#homeJourneyNodes .journey-node').forEach((node, index) => {
      node.classList.toggle('passed', index + 1 < currentIndex);
      node.classList.toggle('current', index + 1 === currentIndex);
    });
  }

  function openGroupJourneyListModal() {
    if (isCacheValid_('groupJourneyList')) {
      const groups = (getCache_('groupJourneyList') || {}).groups || [];
      const html = [
        '<section class="journey-board-intro">',
        JOURNEY_CHAPTERS.map((chapter, index) => {
          return '<span>' + (index + 1) + ' ' + escapeHtml(chapter.title) + '</span>';
        }).join(''),
        '</section>',
        groups.length
          ? groups.map(renderGroupJourneyRow).join('')
          : '<div class="empty-card">目前沒有已啟用的活力組</div>'
      ].join('');

      openInfoModal('各活力組旅程', html);
      return;
    }

    setLoading(true, '讀取各活力組旅程...');

    loadOnce_('groupJourneyList', () => callServer('getGroupJourneyList'))
      .then((res) => {
        if (!isSuccess(res)) {
          openInfoModal(
            '活力組生命成長旅程',
            '<div class="empty-card">' +
              escapeHtml(getResponseError(res, '讀取失敗')) +
              '</div>'
          );
          return;
        }

        const groups = res.data.groups || [];
        setCache_('groupJourneyList', res.data || {});

        const html = [
          '<section class="journey-board-intro">',
          JOURNEY_CHAPTERS.map((chapter, index) => {
            return '<span>' + (index + 1) + ' ' + escapeHtml(chapter.title) + '</span>';
          }).join(''),
          '</section>',
          groups.length
            ? groups.map(renderGroupJourneyRow).join('')
            : '<div class="empty-card">目前沒有已啟用的活力組</div>'
        ].join('');

        openInfoModal('各活力組旅程', html);
      })
      .catch((error) => {
        openInfoModal(
          '各活力組旅程',
          '<div class="empty-card">' +
            escapeHtml(getErrorMessage(error)) +
            '</div>'
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function renderGroupJourneyRow(group) {
    const current = group.currentChapter ||
      (group.journey && group.journey.currentChapter) ||
      {};

    const score = Number(group.totalScore || 0);
    const percent = Math.max(
      0,
      Math.min(100, Number(group.progressPercent || 0))
    );

    return [
      '<article class="journey-party-card">',
      '<div class="journey-party-rank">' + escapeHtml(current.title || '信心') + '</div>',
      '<div class="journey-party-main">',
      '<strong>' + escapeHtml(group.groupName || '活力組') + '</strong>',
      '<div class="journey-party-meter" aria-hidden="true"><i style="width:' +
        percent +
        '%"></i></div>',
      '<span>同行總積分 ' + formatNumber(score) + ' 點</span>',
      '</div>',
      '<em>' + percent + '%</em>',
      '</article>'
    ].join('');
  }


  function renderDailyStatus() {
    const record = state.dailyRecord || createEmptyDailyRecord();

    const tasks = [
      ['morning', record.morningRevival, '#homeMorningStatus'],
      ['bible', record.bibleReading, '#homeBibleStatus'],
      ['prayer', record.prayer, '#homePrayerPracticeStatus'],
      ['book', record.bookPursuit, '#homeBookStatus']
    ];

    tasks.forEach(([type, value, homeStatus]) => {
      const done = toBool(value);
      const pending = isTaskUiPending_('DAILY', type);
      const visibleDone = done || pending;
      const status = $(homeStatus);

      if (status) {
        status.textContent = visibleDone ? '已完成' : '未完成';
      }

      const homeButton = $('.quest-card[data-practice="' + type + '"]');

      if (homeButton) {
        homeButton.classList.toggle('done', visibleDone);
        homeButton.classList.toggle('is-pending', pending);
        homeButton.disabled = pending;
      }
    });
  }

  function submitHomePracticeDirect_(type) {
    const config = PRACTICE_CONFIG[type];

    if (!config || isTaskUiPending_('DAILY', type)) {
      return;
    }

    if (!ensureGroupFeatureReady()) {
      return;
    }

    const dailyRecord = state.dailyRecord || {};
    const done = toBool(dailyRecord[config.field]);

    if (done) {
      openPracticeModal(type);
      return;
    }

    state.selectedPracticeType = type;
    submitPracticeModal({ directHome: true });
  }

  function openPracticeModal(type) {
    const config = PRACTICE_CONFIG[type];

    if (!config) {
      return;
    }

    if (!ensureGroupFeatureReady()) {
      return;
    }

    const dailyRecord = state.dailyRecord || {};
    const done = toBool(dailyRecord[config.field]);
    const pending = !done && isTaskUiPending_('DAILY', type);

    state.selectedPracticeType = type;

    $('#practiceModalHeading').textContent = config.title;
    $('#practiceModalDescription').textContent = config.description;
    $('#practiceModalReward').textContent = config.reward;

    $('#practiceSubmitBtn').textContent = done
      ? (TASK_PERFORMANCE_PROBE_ENABLED ? '防重測速' : '今日已完成')
      : '確認完成';

    $('#practiceSubmitBtn').disabled = pending ||
      (done && !TASK_PERFORMANCE_PROBE_ENABLED);

    setResultMessage(
      '#practiceModalMessage',
      done
        ? (TASK_PERFORMANCE_PROBE_ENABLED
            ? '防重測速只重送已完成狀態，不會新增任務或點數。'
            : '這項任務今天已完成，系統不會重複計入積分。')
        : '',
      false
    );

    openModal('practiceModal');
  }

  function submitPracticeModal(options) {
    const directHome = !!(options && options.directHome === true);
    const messageTarget = directHome ? '#homeMessage' : '#practiceModalMessage';
    const taskType = String(state.selectedPracticeType || '').trim();
    const config = PRACTICE_CONFIG[taskType];

    if (!config || !state.currentPlayer || isTaskUiPending_('DAILY', taskType)) {
      return;
    }

    const record = state.dailyRecord || createEmptyDailyRecord();

    const payload = {
      playerId: state.currentPlayer.playerId,
      morningRevival: toBool(record.morningRevival),
      bibleReading: toBool(record.bibleReading),
      prayer: toBool(record.prayer),
      bookPursuit: toBool(record.bookPursuit)
    };

    payload[config.field] = true;
    payload.selectedTaskField = config.field;
    payload.clientMutationPeriodKey = getTaipeiBusinessDate_();
    const pendingDaily = beginPendingMutationRequest_('daily-practice', payload);
    state.pendingDailyRequestId = pendingDaily.requestId;
    payload.requestId = pendingDaily.requestId;
    const localPreviewKey = 'LOCAL_DAILY::' + payload.requestId;
    const previousTaskValue = toBool(record[config.field]);

    setTaskUiPending_('DAILY', taskType, true);
    state.dailyRecord = Object.assign({}, record, {
      recordDate: String(record.recordDate || payload.clientMutationPeriodKey)
    });
    state.dailyRecord[config.field] = true;
    renderDailyStatus();
    if (!directHome) {
      const submitBtn = $('#practiceSubmitBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
      }
    }

    beginPendingTaskScorePreview_(
      localPreviewKey,
      buildClientTaskScorePreview_('DAILY', taskType)
    );
    if (!directHome) {
      closeModal('practiceModal');
    }
    setResultMessage('#homeMessage', '任務已完成', true);

    const taskRequestStartedAt = Date.now();
    showTaskSubmitLoadingBriefly_('儲存今日任務...');

    submitTaskWriteWithRecovery_('submitDailyPractice', payload)
      .then((res) => {
        if (!isSuccess(res)) {
          state.dailyRecord[config.field] = previousTaskValue;
          setTaskUiPending_('DAILY', taskType, false);
          state.pendingDailyRequestId = '';
          renderDailyStatus();
          removePendingTaskScorePreview_(localPreviewKey);
          settlePendingMutationRequest_('daily-practice', payload.requestId, res);
          if (!directHome) openPracticeModal(taskType);
          setResultMessage(
            messageTarget,
            getResponseError(res, '儲存失敗')
          );
          return;
        }

        if (shouldApplyCompletedTaskRecord_('DAILY', res.data.record)) {
          state.dailyRecord = mergeCompletedTaskRecord_(
            state.dailyRecord,
            res.data.record,
            ['morningRevival', 'bibleReading', 'prayer', 'bookPursuit']
          );
        }
        replacePendingTaskScorePreview_(
          localPreviewKey,
          res.data.eventId,
          res.data.optimisticDelta
        );
        settlePendingMutationRequest_('daily-practice', payload.requestId, res);
        state.pendingDailyRequestId = '';
        setTaskUiPending_('DAILY', taskType, false);
        invalidateByRule_('dailyPracticeChanged');
        renderDailyStatus();
        const performanceMessage = res.data.processingPending
          ? formatTaskQueueAcceptedMessage_(res.data.performance, taskRequestStartedAt)
          : formatTaskPerformanceMessage_(res.data.performance, taskRequestStartedAt);
        setResultMessage('#homeMessage', performanceMessage, true);
        if (res.data.processingPending && res.data.eventId) {
          continueTaskWriteProcessing_(
            res.data.eventId,
            'DAILY',
            res.data.queueRowNumber
          );
        } else {
          removePendingTaskScorePreview_(res.data.eventId || localPreviewKey, true);
          applyCompletedTaskWriteResult_('DAILY', res.data);
          rebasePendingTaskScorePreview_();
        }
      })
      .catch((error) => {
        state.dailyRecord[config.field] = previousTaskValue;
        setTaskUiPending_('DAILY', taskType, false);
        state.pendingDailyRequestId = '';
        renderDailyStatus();
        removePendingTaskScorePreview_(localPreviewKey);
        if (!directHome) openPracticeModal(taskType);
        setResultMessage(messageTarget, getErrorMessage(error));
      });
  }

  function renderDailyHistoryHtml(records) {
    if (!records.length) {
      return '<div class="empty-card">尚無每日任務紀錄</div>';
    }

    return records.map((record) => {
      const labels = [];

      if (toBool(record.morningRevival)) {
        labels.push(PRACTICE_CONFIG.morning.title);
      }

      if (toBool(record.bibleReading)) {
        labels.push(PRACTICE_CONFIG.bible.title);
      }

      if (toBool(record.prayer)) {
        labels.push(PRACTICE_CONFIG.prayer.title);
      }

      if (toBool(record.bookPursuit)) {
        labels.push(PRACTICE_CONFIG.book.title);
      }

      return [
        '<article class="history-entry">',
        '<strong>' + escapeHtml(record.recordDate || '') + '</strong>',
        '<span>完成：' +
          escapeHtml(labels.join('、') || '尚無項目') +
        '</span>',
        '</article>'
      ].join('');
    }).join('');
  }

  function renderWeeklyTaskStatus() {
    const record = state.weeklyTaskRecord || createEmptyWeeklyTaskRecord();

    const rows = [
      [
        'outreachVisit',
        record.outreachVisit,
        '#homeOutreachVisitStatus',
        '#homeOutreachVisitBtn'
      ],
      [
        'smallGroup',
        record.smallGroup,
        '#homeWeeklySmallGroupStatus',
        '#homeWeeklySmallGroupBtn'
      ],
      [
        'prayerMeeting',
        record.prayerMeeting,
        '#homeWeeklyPrayerMeetingStatus',
        '#homeWeeklyPrayerMeetingBtn'
      ],
      [
        'lordDayMeeting',
        record.lordDayMeeting,
        '#homeWeeklyLordDayStatus',
        '#homeWeeklyLordDayBtn'
      ]
    ];

    rows.forEach(([type, value, statusSelector, buttonSelector]) => {
      const done = toBool(value);
      const pending = isTaskUiPending_('MEETING', type);
      const visibleDone = done || pending;
      const button = $(buttonSelector) ||
        $('[data-weekly-task="' + type + '"]');
      const status = $(statusSelector) ||
        (button ? button.querySelector('em') : null);

      if (status) {
        status.textContent = visibleDone ? '已完成' : '未完成';
      }

      if (button) {
        button.classList.toggle('done', visibleDone);
        button.classList.toggle('is-pending', pending);
        button.disabled = pending;
      }
    });

    const weeklyDateText = $('#homeWeeklyDateText');

    if (weeklyDateText) {
      weeklyDateText.textContent =
        '日期：' + formatWeeklyTaskDateRange(record.weekKey);
    }
  }

  function submitHomeWeeklyTaskDirect_(type) {
    const config = WEEKLY_TASK_CONFIG[type];

    if (!config || isTaskUiPending_('MEETING', type)) {
      return;
    }

    if (!ensureGroupFeatureReady()) {
      return;
    }

    const weeklyRecord = state.weeklyTaskRecord || {};
    const done = toBool(weeklyRecord[config.field]);

    if (done) {
      openWeeklyTaskModal(type);
      return;
    }

    state.selectedWeeklyTaskType = type;
    submitWeeklyTaskModal({ directHome: true });
  }

  function openWeeklyTaskModal(type) {
    const config = WEEKLY_TASK_CONFIG[type];

    if (!config) {
      return;
    }

    if (!ensureGroupFeatureReady()) {
      return;
    }

    const weeklyRecord = state.weeklyTaskRecord || {};
    const done = toBool(weeklyRecord[config.field]);
    const pending = !done && isTaskUiPending_('MEETING', type);

    state.selectedWeeklyTaskType = type;

    $('#weeklyTaskModalHeading').textContent = config.title;
    $('#weeklyTaskModalDescription').textContent = config.description;
    $('#weeklyTaskModalReward').textContent = config.reward;

    $('#weeklyTaskSubmitBtn').textContent = done
      ? (TASK_PERFORMANCE_PROBE_ENABLED ? '防重測速' : '本週已完成')
      : '確認完成';

    $('#weeklyTaskSubmitBtn').disabled = pending ||
      (done && !TASK_PERFORMANCE_PROBE_ENABLED);

    setResultMessage(
      '#weeklyTaskModalMessage',
      done
        ? (TASK_PERFORMANCE_PROBE_ENABLED
            ? '防重測速只重送已完成狀態，不會新增任務或點數。'
            : '這項本週任務已完成，系統不會重複計入積分。')
        : '',
      false
    );

    openModal('weeklyTaskModal');
  }

  function submitWeeklyTaskModal(options) {
    const directHome = !!(options && options.directHome === true);
    const messageTarget = directHome ? '#homeMessage' : '#weeklyTaskModalMessage';
    const taskType = String(state.selectedWeeklyTaskType || '').trim();
    const config = WEEKLY_TASK_CONFIG[taskType];

    if (!config || !state.currentPlayer || isTaskUiPending_('MEETING', taskType)) {
      return;
    }

    const record = state.weeklyTaskRecord || createEmptyWeeklyTaskRecord();

    const payload = {
      playerId: state.currentPlayer.playerId,
      outreachVisit: toBool(record.outreachVisit),
      smallGroup: toBool(record.smallGroup),
      prayerMeeting: toBool(record.prayerMeeting),
      lordDayMeeting: toBool(record.lordDayMeeting)
    };

    payload[config.field] = true;
    payload.selectedTaskField = config.field;
    payload.clientMutationPeriodKey = String(
      state.weeklyTaskRecord && state.weeklyTaskRecord.weekKey || getTaipeiIsoWeekKey_()
    );
    const pendingMeeting = beginPendingMutationRequest_('meeting-practice', payload);
    state.pendingWeeklyRequestId = pendingMeeting.requestId;
    payload.requestId = pendingMeeting.requestId;
    const localPreviewKey = 'LOCAL_MEETING::' + payload.requestId;
    const previousTaskValue = toBool(record[config.field]);

    setTaskUiPending_('MEETING', taskType, true);
    state.weeklyTaskRecord = Object.assign({}, record, {
      weekKey: String(record.weekKey || payload.clientMutationPeriodKey)
    });
    state.weeklyTaskRecord[config.field] = true;
    renderWeeklyTaskStatus();
    if (!directHome) {
      const submitBtn = $('#weeklyTaskSubmitBtn');
      if (submitBtn) {
        submitBtn.disabled = true;
      }
    }

    beginPendingTaskScorePreview_(
      localPreviewKey,
      buildClientTaskScorePreview_('MEETING', taskType)
    );
    if (!directHome) {
      closeModal('weeklyTaskModal');
    }
    setResultMessage('#homeMessage', '任務已完成', true);

    const taskRequestStartedAt = Date.now();
    showTaskSubmitLoadingBriefly_('儲存本週任務...');

    submitTaskWriteWithRecovery_('submitMeetingPractice', payload)
      .then((res) => {
        if (!isSuccess(res)) {
          state.weeklyTaskRecord[config.field] = previousTaskValue;
          setTaskUiPending_('MEETING', taskType, false);
          state.pendingWeeklyRequestId = '';
          renderWeeklyTaskStatus();
          removePendingTaskScorePreview_(localPreviewKey);
          settlePendingMutationRequest_('meeting-practice', payload.requestId, res);
          if (!directHome) openWeeklyTaskModal(taskType);
          setResultMessage(
            messageTarget,
            getResponseError(res, '儲存失敗')
          );
          return;
        }

        if (shouldApplyCompletedTaskRecord_('MEETING', res.data.record)) {
          state.weeklyTaskRecord = mergeCompletedTaskRecord_(
            state.weeklyTaskRecord,
            res.data.record,
            ['smallGroup', 'prayerMeeting', 'lordDayMeeting', 'outreachVisit']
          );
        }
        replacePendingTaskScorePreview_(
          localPreviewKey,
          res.data.eventId,
          res.data.optimisticDelta
        );
        settlePendingMutationRequest_('meeting-practice', payload.requestId, res);
        state.pendingWeeklyRequestId = '';
        setTaskUiPending_('MEETING', taskType, false);
        invalidateByRule_('meetingPracticeChanged');
        renderWeeklyTaskStatus();
        const performanceMessage = res.data.processingPending
          ? formatTaskQueueAcceptedMessage_(res.data.performance, taskRequestStartedAt)
          : formatTaskPerformanceMessage_(res.data.performance, taskRequestStartedAt);
        setResultMessage('#homeMessage', performanceMessage, true);
        if (res.data.processingPending && res.data.eventId) {
          continueTaskWriteProcessing_(
            res.data.eventId,
            'MEETING',
            res.data.queueRowNumber
          );
        } else {
          removePendingTaskScorePreview_(res.data.eventId || localPreviewKey, true);
          applyCompletedTaskWriteResult_('MEETING', res.data);
          rebasePendingTaskScorePreview_();
        }
      })
      .catch((error) => {
        state.weeklyTaskRecord[config.field] = previousTaskValue;
        setTaskUiPending_('MEETING', taskType, false);
        state.pendingWeeklyRequestId = '';
        renderWeeklyTaskStatus();
        removePendingTaskScorePreview_(localPreviewKey);
        if (!directHome) openWeeklyTaskModal(taskType);
        setResultMessage(messageTarget, getErrorMessage(error));
      });
  }

  function renderWeeklyTaskHistoryHtml(records) {
    if (!records.length) {
      return '<div class="empty-card">尚無本週任務紀錄</div>';
    }

    return records.map((record) => {
      const labels = [];

      if (toBool(record.outreachVisit)) {
        labels.push(WEEKLY_TASK_CONFIG.outreachVisit.title);
      }

      if (toBool(record.smallGroup)) {
        labels.push(WEEKLY_TASK_CONFIG.smallGroup.title);
      }

      if (toBool(record.prayerMeeting)) {
        labels.push(WEEKLY_TASK_CONFIG.prayerMeeting.title);
      }

      if (toBool(record.lordDayMeeting)) {
        labels.push(WEEKLY_TASK_CONFIG.lordDayMeeting.title);
      }

      return [
        '<article class="history-entry">',
        '<strong>' + escapeHtml(formatWeeklyTaskDateRange(record.weekKey)) + '</strong>',
        '<span>完成：' +
          escapeHtml(labels.join('、') || '尚無項目') +
        '</span>',
        '</article>'
      ].join('');
    }).join('');
  }

  function refreshMyPage(options) {
    options = options || {};
    const force = options.force === true;

    /*
     * 首頁 Dashboard 已經包含同行手冊需要的玩家與旅程資料。
     * 切換到「我的」只重繪記憶體狀態，不再因快取同步時序而額外送 API。
     * 使用者明確按「更新」時才重新讀取。
     */
    if (!force && state.currentPlayer) {
      renderPlayer(state.currentPlayer);
      renderGroupJourney(state.groupJourney);
      return Promise.resolve();
    }

    if (!force && isCacheValid_('accountProfile') && isCacheValid_('journey')) {
      const profileData = getCache_('accountProfile') || {};
      const journeyData = getCache_('journey') || null;

      if (profileData.player) {
        state.currentPlayer = profileData.player;
        persistCurrentPlayer();
        renderPlayer(state.currentPlayer);
      }

      state.groupJourney = journeyData;
      renderGroupJourney(state.groupJourney);
      return Promise.resolve();
    }

    setLoading(true, '更新我的同行手冊...');

    const profilePromise = !force && isCacheValid_('accountProfile')
      ? Promise.resolve({
        success: true,
        data: getCache_('accountProfile') || {}
      })
      : loadOnce_('accountProfile', () => callServer(
        'getPlayerProfile',
        state.currentPlayer.playerId
      ));

    const journeyPromise = !force && isCacheValid_('journey')
      ? Promise.resolve({
        success: true,
        data: getCache_('journey') || {}
      })
      : loadOnce_('journey', () => callServer(
        'getGroupJourney',
        state.currentPlayer.playerId
      ));

    return Promise.all([profilePromise, journeyPromise])
      .then(([playerRes, journeyRes]) => {
        if (isSuccess(playerRes)) {
          state.currentPlayer = playerRes.data.player;
          setCache_('accountProfile', playerRes.data || {});
          persistCurrentPlayer();
          renderPlayer(state.currentPlayer);
        }

        if (isSuccess(journeyRes)) {
          state.groupJourney = journeyRes.data;
          setCache_('journey', state.groupJourney);
          renderGroupJourney(state.groupJourney);
        }
      })
      .catch((error) => {
        setResultMessage('#myMessage', getErrorMessage(error));
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function refreshProfileOnly() {
    if (!state.currentPlayer) {
      return Promise.resolve();
    }

    if (isCacheValid_('accountProfile')) {
      const cached = getCache_('accountProfile') || {};

      if (cached.player) {
        state.currentPlayer = cached.player;
        persistCurrentPlayer();
        renderPlayer(state.currentPlayer);
      }

      return Promise.resolve({
        success: true,
        data: cached
      });
    }

    return loadOnce_('accountProfile', () => callServer(
      'getPlayerProfile',
      state.currentPlayer.playerId
    ))
      .then((res) => {
        if (isSuccess(res)) {
          state.currentPlayer = res.data.player;
          setCache_('accountProfile', res.data || {});
          persistCurrentPlayer();
          renderPlayer(state.currentPlayer);
        }

        return res;
      });
  }

  function openGroupContributionModal() {
    if (
      state.currentPlayer &&
      state.currentPlayer.playerId &&
      isCacheValid_('contribution')
    ) {
      openInfoModal(
        '同行貢獻',
        buildGroupContributionModalHtml(getCache_('contribution') || {})
      );
      hydrateExistingImages_($('#infoModalContent'));
      return;
    }

    if (!state.currentPlayer || !state.currentPlayer.playerId) {
      openInfoModal(
        '同行貢獻',
        '<div class="empty-card">找不到目前登入的玩家資料。</div>'
      );
      return;
    }

    setLoading(true, '讀取活力組貢獻...');

    loadOnce_('contribution', () => callServer(
      'getMyGroupContributionSummary',
      state.currentPlayer.playerId
    ))
      .then((res) => {
        if (!isSuccess(res)) {
          throw new Error(
            getResponseError(res, '讀取活力組貢獻失敗')
          );
        }

        setCache_('contribution', res.data || {});
        openInfoModal(
          '同行貢獻',
          buildGroupContributionModalHtml(res.data || {})
        );
        hydrateExistingImages_($('#infoModalContent'));
      })
      .catch((error) => {
        openInfoModal(
          '同行貢獻',
          '<div class="empty-card">' +
            escapeHtml(getErrorMessage(error)) +
          '</div>'
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function buildGroupContributionModalHtml(data) {
    data = data || {};

    const members = Array.isArray(data.members)
      ? data.members
      : [];

    const groupName = String(data.groupName || '未命名活力組');
    const memberCount = Number(data.memberCount || members.length || 0);

    const summaryHtml = [
      '<section class="group-contribution-summary">',
      '<span>活力組總點數</span>',
      '<strong>',
      formatNumber(data.totalScore),
      '<small>點</small>',
      '</strong>',
      '<p>',
      escapeHtml(groupName),
      '｜',
      formatNumber(memberCount),
      ' 位組員',
      '</p>',
      '<div class="group-contribution-breakdown">',
      '<span>合作取得 <strong>' + formatNumber(data.cooperativeScore) + '</strong> 點</span>',
      '<span>個人貢獻 <strong>' + formatNumber(data.personalContributionTotal) + '</strong> 點</span>',
      '</div>',
      '</section>'
    ].join('');

    if (!members.length) {
      return summaryHtml +
        '<div class="empty-card">目前沒有可顯示的活力組員。</div>';
    }

    const memberRows = members.map((member) => {
      const isMe = !!member.isMe;
      const name = String(member.displayName || member.playerName || '活力人');

      return [
        '<article class="group-contribution-member',
        isMe ? ' is-me' : '',
        '">',
        buildContributionMemberAvatarHtml(member),
        '<div class="group-contribution-member-name">',
        '<strong>',
        escapeHtml(name),
        '</strong>',
        isMe ? '<small>我</small>' : '',
        '</div>',
        '<div class="group-contribution-member-score">',
        '<strong>',
        formatNumber(member.contributionScore),
        '</strong>',
        '<span>點</span>',
        '</div>',
        '</article>'
      ].join('');
    }).join('');

    return [
      summaryHtml,
      '<section class="group-contribution-section">',
      '<div class="group-contribution-list-head">',
      '<h3>個人貢獻</h3>',
      '<span>依點數排序</span>',
      '</div>',
      '<div class="group-contribution-list">',
      memberRows,
      '</div>',
      '</section>'
    ].join('');
  }

  function buildContributionMemberAvatarHtml(member) {
    member = member || {};

    const avatarUrl = String(member.avatarUrl || '').trim();
    const name = String(member.displayName || member.playerName || '活力人');
    const initial = name.charAt(0) || '?';

    if (avatarUrl) {
      return [
        '<span class="group-contribution-avatar">',
        '<img src="',
        escapeHtml(IMAGE_FALLBACK_DATA_URL),
        '" data-managed-url="',
        escapeHtml(avatarUrl),
        '" data-image-key="',
        escapeHtml('contributionAvatar:' + String(member.playerId || '') + ':' + avatarUrl),
        '" alt="',
        escapeHtml(name),
        '的頭像">',
        '</span>'
      ].join('');
    }

    return [
      '<span class="group-contribution-avatar is-placeholder" aria-hidden="true">',
      escapeHtml(initial),
      '</span>'
    ].join('');
  }

  function openAllPracticeHistoryModal() {
    if (isCacheValid_('practiceHistory')) {
      showFootprintDashboard_(getCache_('practiceHistory') || {});
      return;
    }

    setLoading(true, '讀取同行足跡彙總...');
    callServer('getMyFootprintDashboard')
      .then((res) => {
        if (!isSuccess(res)) throw new Error(getResponseError(res, '足跡讀取失敗'));
        const dashboard = res.data || {};
        setCache_('practiceHistory', dashboard);
        showFootprintDashboard_(dashboard);
      })
      .catch((error) => {
        openInfoModal(
          '我的同行足跡',
          '<div class="empty-card">' +
            escapeHtml(getErrorMessage(error)) +
          '</div>'
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }

  function getIsoWeekStartDateText_(weekKey) {
    const match = String(weekKey || '').trim().match(/^(\d{4})-W(\d{2})$/);
    if (!match) return '';

    const isoYear = Number(match[1]);
    const isoWeek = Number(match[2]);
    if (isoWeek < 1 || isoWeek > 53) return '';

    const januaryFourth = new Date(Date.UTC(isoYear, 0, 4));
    const januaryFourthIsoDay = januaryFourth.getUTCDay() || 7;
    const monday = new Date(Date.UTC(
      isoYear,
      0,
      4 - januaryFourthIsoDay + 1 + (isoWeek - 1) * 7
    ));

    return monday.toISOString().slice(0, 10);
  }

  function getFootprintCompletedCount_(row) {
    row = row || {};
    return [
      row.morningCompleted,
      row.bibleCompleted,
      row.prayerCompleted,
      row.readingCompleted
    ].filter(toBool).length;
  }

  function buildCurrentTaskFootprintDashboard_(dashboard) {
    const source = dashboard || {};
    const today = String(source.today || getTaipeiBusinessDate_()).trim();
    const currentWeekKey = String(
      source.currentWeekKey || getTaipeiIsoWeekKey_()
    ).trim();
    const monthKey = String(
      source.monthly && source.monthly.monthKey || today.slice(0, 7)
    ).trim();
    const daily = (Array.isArray(source.daily) ? source.daily : [])
      .map((row) => Object.assign({}, row));
    const weekly = (Array.isArray(source.weekly) ? source.weekly : [])
      .map((row) => Object.assign({}, row));
    const monthly = Object.assign({
      monthKey: monthKey,
      completedDays: 0,
      bibleDays: 0,
      prayerDays: 0,
      morningDays: 0,
      meetingCount: 0,
      visitCount: 0,
      longestStreak: 0,
      totalScore: 0
    }, source.monthly || {});

    const dailyIndex = daily.findIndex((row) =>
      String(row.recordDate || '').trim() === today
    );
    const formalToday = dailyIndex >= 0
      ? Object.assign({}, daily[dailyIndex])
      : {
          recordDate: today,
          morningCompleted: false,
          bibleCompleted: false,
          prayerCompleted: false,
          readingCompleted: false,
          completedCount: 0,
          dailyScore: 0,
          streakStatus: '',
          hasChest: false,
          hasSpecialTask: false
        };
    const displayToday = Object.assign({}, formalToday);
    const dailyRecord = state.dailyRecord || {};
    const dailyRecordDate = String(dailyRecord.recordDate || today).trim();

    if (dailyRecordDate === today) {
      displayToday.morningCompleted =
        toBool(formalToday.morningCompleted) || toBool(dailyRecord.morningRevival);
      displayToday.bibleCompleted =
        toBool(formalToday.bibleCompleted) || toBool(dailyRecord.bibleReading);
      displayToday.prayerCompleted =
        toBool(formalToday.prayerCompleted) || toBool(dailyRecord.prayer);
      displayToday.readingCompleted =
        toBool(formalToday.readingCompleted) || toBool(dailyRecord.bookPursuit);
    }

    const formalDailyCount = getFootprintCompletedCount_(formalToday);
    const displayDailyCount = getFootprintCompletedCount_(displayToday);
    const newlyVisibleDailyScore = [
      ['bibleCompleted', 'bible'],
      ['prayerCompleted', 'prayer'],
      ['readingCompleted', 'book']
    ].reduce((total, item) => {
      if (!toBool(formalToday[item[0]]) && toBool(displayToday[item[0]])) {
        return total + Math.max(0, Number(
          PRACTICE_CONFIG[item[1]] && PRACTICE_CONFIG[item[1]].score || 0
        ));
      }
      return total;
    }, 0);

    displayToday.completedCount = displayDailyCount;
    displayToday.dailyScore = Math.max(
      Number(formalToday.dailyScore || 0),
      Number(formalToday.dailyScore || 0) + newlyVisibleDailyScore
    );
    displayToday.streakStatus = displayDailyCount >= 4
      ? 'FULL'
      : (displayDailyCount > 0 ? 'PARTIAL' : String(formalToday.streakStatus || ''));

    if (dailyIndex >= 0) {
      daily[dailyIndex] = displayToday;
    } else if (displayDailyCount > 0) {
      daily.unshift(displayToday);
    }
    daily.sort((left, right) =>
      String(right.recordDate || '').localeCompare(String(left.recordDate || ''))
    );

    if (today.slice(0, 7) === monthKey) {
      if (formalDailyCount === 0 && displayDailyCount > 0) {
        monthly.completedDays = Number(monthly.completedDays || 0) + 1;
      }
      if (!toBool(formalToday.bibleCompleted) && toBool(displayToday.bibleCompleted)) {
        monthly.bibleDays = Number(monthly.bibleDays || 0) + 1;
      }
      if (!toBool(formalToday.prayerCompleted) && toBool(displayToday.prayerCompleted)) {
        monthly.prayerDays = Number(monthly.prayerDays || 0) + 1;
      }
      if (!toBool(formalToday.morningCompleted) && toBool(displayToday.morningCompleted)) {
        monthly.morningDays = Number(monthly.morningDays || 0) + 1;
      }
      monthly.totalScore = Number(monthly.totalScore || 0) + newlyVisibleDailyScore;
      if (displayDailyCount > 0) {
        monthly.longestStreak = Math.max(1, Number(monthly.longestStreak || 0));
      }
    }

    const weeklyIndex = weekly.findIndex((row) =>
      String(row.weekKey || '').trim() === currentWeekKey
    );
    const formalWeek = weeklyIndex >= 0
      ? Object.assign({}, weekly[weeklyIndex])
      : {
          weekKey: currentWeekKey,
          completedDays: 0,
          morningDays: 0,
          bibleDays: 0,
          prayerDays: 0,
          readingDays: 0,
          groupMeetingCompleted: false,
          prayerMeetingCompleted: false,
          lordDayCompleted: false,
          visitCompleted: false,
          weeklyScore: 0,
          longestStreak: 0,
          chestCount: 0,
          specialTaskCount: 0
        };
    const displayWeek = Object.assign({}, formalWeek);

    if (formalDailyCount === 0 && displayDailyCount > 0) {
      displayWeek.completedDays = Number(formalWeek.completedDays || 0) + 1;
    }
    if (!toBool(formalToday.morningCompleted) && toBool(displayToday.morningCompleted)) {
      displayWeek.morningDays = Number(formalWeek.morningDays || 0) + 1;
    }
    if (!toBool(formalToday.bibleCompleted) && toBool(displayToday.bibleCompleted)) {
      displayWeek.bibleDays = Number(formalWeek.bibleDays || 0) + 1;
    }
    if (!toBool(formalToday.prayerCompleted) && toBool(displayToday.prayerCompleted)) {
      displayWeek.prayerDays = Number(formalWeek.prayerDays || 0) + 1;
    }
    if (!toBool(formalToday.readingCompleted) && toBool(displayToday.readingCompleted)) {
      displayWeek.readingDays = Number(formalWeek.readingDays || 0) + 1;
    }
    displayWeek.weeklyScore = Number(formalWeek.weeklyScore || 0) + newlyVisibleDailyScore;
    if (displayDailyCount > 0) {
      displayWeek.longestStreak = Math.max(1, Number(formalWeek.longestStreak || 0));
    }

    const weeklyRecord = state.weeklyTaskRecord || {};
    const weeklyRecordKey = String(weeklyRecord.weekKey || currentWeekKey).trim();
    let newlyVisibleMeetingCount = 0;
    let newlyVisibleVisitCount = 0;
    let newlyVisibleMeetingScore = 0;

    if (weeklyRecordKey === currentWeekKey) {
      [
        ['groupMeetingCompleted', 'smallGroup', 'smallGroup', true],
        ['prayerMeetingCompleted', 'prayerMeeting', 'prayerMeeting', true],
        ['lordDayCompleted', 'lordDayMeeting', 'lordDayMeeting', true],
        ['visitCompleted', 'outreachVisit', 'outreachVisit', false]
      ].forEach((item) => {
        const footprintField = item[0];
        const recordField = item[1];
        const configKey = item[2];
        const personalScore = item[3];
        const before = toBool(formalWeek[footprintField]);
        const after = before || toBool(weeklyRecord[recordField]);
        displayWeek[footprintField] = after;

        if (!before && after) {
          if (footprintField === 'visitCompleted') {
            newlyVisibleVisitCount += 1;
          } else {
            newlyVisibleMeetingCount += 1;
          }
          if (personalScore) {
            newlyVisibleMeetingScore += Math.max(0, Number(
              WEEKLY_TASK_CONFIG[configKey] && WEEKLY_TASK_CONFIG[configKey].score || 0
            ));
          }
        }
      });
    }

    displayWeek.weeklyScore += newlyVisibleMeetingScore;
    const hasCurrentWeekDisplay =
      Number(displayWeek.completedDays || 0) > 0 ||
      toBool(displayWeek.groupMeetingCompleted) ||
      toBool(displayWeek.prayerMeetingCompleted) ||
      toBool(displayWeek.lordDayCompleted) ||
      toBool(displayWeek.visitCompleted);

    if (weeklyIndex >= 0) {
      weekly[weeklyIndex] = displayWeek;
    } else if (hasCurrentWeekDisplay) {
      weekly.unshift(displayWeek);
    }
    weekly.sort((left, right) =>
      String(right.weekKey || '').localeCompare(String(left.weekKey || ''))
    );

    if (getIsoWeekStartDateText_(currentWeekKey).slice(0, 7) === monthKey) {
      monthly.meetingCount = Number(monthly.meetingCount || 0) + newlyVisibleMeetingCount;
      monthly.visitCount = Number(monthly.visitCount || 0) + newlyVisibleVisitCount;
    }

    return Object.assign({}, source, {
      today: today,
      currentWeekKey: currentWeekKey,
      monthly: monthly,
      daily: daily,
      weekly: weekly
    });
  }

  function showFootprintDashboard_(dashboard) {
    const displayDashboard = buildCurrentTaskFootprintDashboard_(dashboard || {});
    openInfoModal('我的同行足跡', renderFootprintDashboardHtml_(displayDashboard));
    bindFootprintDayButtons_(displayDashboard);
  }

  function renderFootprintDashboardHtml_(dashboard) {
    const month = dashboard.monthly || {};
    const stats = [
      ['完成天數', month.completedDays, '📅'],
      ['讀經天數', month.bibleDays, '📖'],
      ['禱告天數', month.prayerDays, '🙏'],
      ['晨興天數', month.morningDays, '🌅'],
      ['聚會次數', month.meetingCount, '🏠'],
      ['探訪次數', month.visitCount, '👣'],
      ['最長連續', month.longestStreak, '🔥'],
      ['本月點數', month.totalScore, '⭐']
    ].map((item) => [
      '<article class="footprint-stat">',
      '<span aria-hidden="true">', item[2], '</span>',
      '<strong>', formatNumber(item[1] || 0), '</strong>',
      '<small>', escapeHtml(item[0]), '</small>',
      '</article>'
    ].join('')).join('');
    const daily = Array.isArray(dashboard.daily) ? dashboard.daily : [];
    const heat = daily.slice().reverse().map((day) => {
      const level = Math.max(0, Math.min(4, Number(day.completedCount || 0)));
      const badges = (day.hasChest ? ' 🎁' : '') + (day.hasSpecialTask ? ' ✨' : '') +
        (String(day.streakStatus || '') === 'FULL' ? ' 🔥' : '');
      return [
        '<button class="footprint-day level-', level, '" type="button" data-footprint-day="',
        escapeHtml(day.recordDate || ''), '" aria-label="', escapeHtml(day.recordDate || ''),
        ' 完成 ', level, ' 項">',
        '<span>', escapeHtml(String(day.recordDate || '').slice(8,10)), '</span>',
        '<small>', level ? level + '/4' : '—', badges, '</small>',
        '</button>'
      ].join('');
    }).join('');
    const weekly = Array.isArray(dashboard.weekly) ? dashboard.weekly : [];
    const route = weekly.map((week, index) => {
      const high = Number(week.completedDays || 0) >= 5;
      const partial = Number(week.completedDays || 0) > 0;
      const stateClass = high ? 'is-high' : (partial ? 'is-partial' : 'is-empty');
      return [
        '<article class="footprint-week ', stateClass, '">',
        '<div class="footprint-week-marker">', high ? '★' : (partial ? '●' : '○'), '</div>',
        '<div><strong>', escapeHtml(week.weekKey || '本週'), '</strong>',
        '<p>📖 ', formatNumber(week.bibleDays || 0), '天　🙏 ', formatNumber(week.prayerDays || 0),
        '天　🌅 ', formatNumber(week.morningDays || 0), '天</p>',
        '<p>', week.groupMeetingCompleted ? '✅ 小排' : '▫️ 小排', '　',
        week.prayerMeetingCompleted ? '✅ 禱告聚會' : '▫️ 禱告聚會', '　',
        week.lordDayCompleted ? '✅ 主日' : '▫️ 主日', '　',
        week.visitCompleted ? '✅ 探訪' : '▫️ 探訪', '</p>',
        '<small>本週 ', formatNumber(week.weeklyScore || 0), ' 點',
        Number(week.chestCount || 0) ? '　🎁 ' + formatNumber(week.chestCount) : '',
        Number(week.specialTaskCount || 0) ? '　✨ ' + formatNumber(week.specialTaskCount) : '',
        '</small></div></article>'
      ].join('');
    }).join('');
    return [
      '<div class="footprint-dashboard">',
      '<section class="footprint-section"><div class="footprint-heading"><h3>本月成果卡</h3><span>',
      escapeHtml(month.monthKey || ''), '</span></div><div class="footprint-stats">', stats, '</div></section>',
      '<section class="footprint-section"><div class="footprint-heading"><h3>月曆熱度圖</h3><span>最近30天</span></div>',
      heat ? '<div class="footprint-heatmap">' + heat + '</div>' : '<div class="empty-card">目前還沒有每日足跡</div>',
      '</section>',
      '<section class="footprint-section"><div class="footprint-heading"><h3>每週足跡路線</h3><span>最近20週</span></div>',
      route ? '<div class="footprint-route">' + route + '</div>' : '<div class="empty-card">目前還沒有每週足跡</div>',
      '</section></div>'
    ].join('');
  }

  function bindFootprintDayButtons_(dashboard) {
    const rows = Array.isArray(dashboard.daily) ? dashboard.daily : [];
    const byDate = {};
    rows.forEach((row) => { byDate[String(row.recordDate || '')] = row; });
    $$('[data-footprint-day]').forEach((button) => {
      button.addEventListener('click', () => {
        const row = byDate[String(button.dataset.footprintDay || '')] || {};
        openInfoModal('每日足跡', [
          '<section class="info-block footprint-day-detail"><h3>', escapeHtml(row.recordDate || ''), '</h3>',
          '<p>', row.morningCompleted ? '✅ 晨興' : '▫️ 晨興', '　',
          row.bibleCompleted ? '✅ 讀經' : '▫️ 讀經', '　',
          row.prayerCompleted ? '✅ 禱告' : '▫️ 禱告', '　',
          row.readingCompleted ? '✅ 書報' : '▫️ 書報', '</p>',
          '<strong>當日 ', formatNumber(row.dailyScore || 0), ' 點</strong>',
          '</section>'
        ].join(''));
      });
    });
  }

  function openLogoutConfirm() {
    openConfirmModal({
      title: '登出',
      heading: '確定要登出嗎？',
      description: '登出後需要再次輸入姓名與登入密碼。',
      confirmText: '確認登出',
      handler: logout
    });
  }

  function openConfirmModal(options) {
    state.pendingConfirm = options || {};

    $('#confirmModalTitle').textContent =
      state.pendingConfirm.title || '確認操作';

    $('#confirmModalHeading').textContent =
      state.pendingConfirm.heading || '確定要繼續嗎？';

    $('#confirmModalDescription').textContent =
      state.pendingConfirm.description || '';

    $('#confirmModalSubmitBtn').textContent =
      state.pendingConfirm.confirmText || '確認';

    openModal('confirmModal');
  }

  function executePendingConfirm() {
    const pending = state.pendingConfirm;

    closeModal('confirmModal');

    if (pending && typeof pending.handler === 'function') {
      pending.handler();
    }
  }

  function logout() {
    const token = String(state.sessionToken || '').trim();

    notifyOtherAppInstances_('sessionRevoked');
    clearCurrentSession();
    $('#loginPassword').value = '';
    showAuth();
    setLoading(false);

    revokeSessionInBackground_(token);
  }

  function revokeSessionInBackground_(token) {
    token = String(token || '').trim();

    if (!token || !window.GasBackend || typeof window.GasBackend.invoke !== 'function') {
      return;
    }

    window.GasBackend.invoke('logoutPlayer', [token]).catch(() => null);
  }

  function establishCurrentSession_(sessionToken, player, keepLogin) {
    const normalizedToken = String(sessionToken || '').trim();

    if (!normalizedToken) {
      throw new Error('登入成功，但後端未回傳有效登入憑證');
    }

    const previousPlayerId = String(
      state.currentPlayer && state.currentPlayer.playerId || ''
    ).trim();
    const nextPlayerId = String(player && player.playerId || '').trim();

    if (previousPlayerId && previousPlayerId !== nextPlayerId) {
      clearPendingMutationRequestsForPlayer_(previousPlayerId);
      clearMessageSuppressionRetryForPlayer_(previousPlayerId);
      clearPendingTaskScorePreviews_();
    }

    state.sessionGeneration += 1;
    state.sessionToken = normalizedToken;
    state.keepLogin = keepLogin === true;
    state.sessionInvalidated = false;
    state.currentPlayer = player || null;
    clearAllAppCache_();
    persistCurrentPlayer();
  }

  function clearPendingMutationRequestsForPlayer_(playerId) {
    playerId = String(playerId || '').trim();

    if (!playerId) {
      return;
    }

    const prefix = 'vital-pending-mutation::' + playerId + '::';

    try {
      for (let index = localStorage.length - 1; index >= 0; index -= 1) {
        const key = localStorage.key(index);

        if (key && key.indexOf(prefix) === 0) {
          localStorage.removeItem(key);
        }
      }
    } catch (error) {}
  }

  function clearMessageSuppressionRetryForPlayer_(playerId) {
    playerId = String(playerId || '').trim();

    if (!playerId) {
      return;
    }

    const retained = readMessageCenterSuppressionRetryQueue_().filter(
      (record) => String(record && record.playerId || '').trim() !== playerId
    );

    writeMessageCenterSuppressionRetryQueue_(retained);
  }

  function clearCurrentSession(options) {
    options = options || {};

    const previousPlayerId = String(
      state.currentPlayer && state.currentPlayer.playerId || ''
    ).trim();

    state.sessionGeneration += 1;
    state.currentPlayer = null;
    state.sessionToken = '';
    state.keepLogin = false;
    state.sessionInvalidated = !!options.preserveSessionInvalidated;
    state.currentDataEpochId = '';
    state.pendingDailyRequestId = '';
    state.pendingWeeklyRequestId = '';
    state.pendingTaskUi = { daily: {}, weekly: {} };
    if (state.taskSubmitLoadingTimer) {
      window.clearTimeout(state.taskSubmitLoadingTimer);
    }
    state.taskSubmitLoadingTimer = null;
    state.taskSubmitLoadingGeneration = Number(state.taskSubmitLoadingGeneration || 0) + 1;
    state.pendingTaskScorePreviews = {};
    state.pendingTaskScoreBaseline = { personalPoints: 0, groupPoints: 0 };
    state.pendingGroupCreateRequestId = '';
    state.pendingGroupCreateSignature = '';
    state.pendingGroupPostCreateRequestId = '';
    state.pendingGroupPostCreateSignature = '';
    state.dailyRecord = null;
    state.weeklyTaskRecord = null;
    state.groupJourney = null;
    state.homeGroupPosts = [];
    state.myGroupPost = null;
    state.homeGroupMemberCount = 0;
    state.homeGroupEnabled = true;
    state.homeGroupStatusMessage = '';
    state.messageCenter = createEmptyMessageCenterState_();
    state.messageCenterFilter = 'ANNOUNCEMENT';
    state.selectedMessageKey = '';
    state.messageCenterAutoOpenedKey = '';
    state.messageReadInFlight.clear();
    state.pendingMessageCenterSuppressions.clear();
    state.messageCenterSuppressionFlushInFlight.clear();
    state.messageCenterSuppressionRetryAttempts.clear();
    if (state.messageCenterSuppressionRetryTimer) {
      window.clearTimeout(state.messageCenterSuppressionRetryTimer);
      state.messageCenterSuppressionRetryTimer = null;
    }
    renderHomeMessageBadge_();
    clearAllAppCache_();
    clearPendingMutationRequestsForPlayer_(previousPlayerId);
    clearMessageSuppressionRetryForPlayer_(previousPlayerId);

    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (ignored) {}
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (ignored) {}
  }

  function openInfoModal(title, html) {
    $('#infoModalTitle').textContent = title || '詳細資料';

    $('#infoModalContent').innerHTML =
      html || '<div class="empty-card">沒有資料</div>';

    openModal('infoModal');
  }

  function ensureGroupFeatureReady(messageSelector) {
    const player = state.currentPlayer || {};
    const groupId = String(player.groupId || '').trim();
    const memberCount = Number(state.homeGroupMemberCount || 0);
    const groupEnabled = state.homeGroupEnabled !== false;
    const message = !groupId
      ? '請先建立或加入活力組。'
      : (!groupEnabled
          ? (state.homeGroupStatusMessage || '此活力組目前已停用。')
          : '活力組至少需要 2 位成員，才能使用此功能。');

    if (groupId && groupEnabled && memberCount >= 2) {
      return true;
    }

    if (messageSelector) {
      setResultMessage(messageSelector, message);
    } else {
      openInfoModal(
        '需要活力組',
        '<div class="empty-card">' + escapeHtml(message) + '</div>'
      );
    }

    return false;
  }

  function persistCurrentPlayer() {
    if (!state.sessionToken) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (ignored) {}
      try { sessionStorage.removeItem(STORAGE_KEY); } catch (ignored) {}
      return;
    }

    const record = JSON.stringify({
      sessionToken: state.sessionToken,
      savedAt: new Date().toISOString(),
      playerId: state.currentPlayer && state.currentPlayer.playerId
        ? state.currentPlayer.playerId
        : '',
      persistent: state.keepLogin === true
    });

    try {
      if (state.keepLogin === true) {
        localStorage.setItem(STORAGE_KEY, record);
        sessionStorage.removeItem(STORAGE_KEY);
      } else {
        sessionStorage.setItem(STORAGE_KEY, record);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      throw new Error('無法保存登入狀態，請確認瀏覽器允許本機儲存。');
    }
  }

  function showAuthMessage(message, success) {
    const box = $('#authMessage');

    box.textContent = message || '';
    box.classList.toggle('hidden', !message);
    box.classList.toggle('success', !!success);
  }

  function setResultMessage(selector, message, showWhenEmpty) {
    const box = $(selector);

    if (!box) {
      return;
    }

    box.textContent = message || '';
    box.classList.toggle(
      'hidden',
      !(message || showWhenEmpty)
    );

    box.classList.remove('success');
  }

  function clearLoadingActions_(overlay) {
    overlay.querySelectorAll('.loading-actions').forEach((element) => {
      element.remove();
    });
  }

  function setLoading(show, text) {
    const overlay = $('#loadingOverlay');
    const card = overlay.querySelector('.loading-card');
    const spinner = overlay.querySelector('.spinner');

    clearLoadingActions_(overlay);
    overlay.classList.toggle('hidden', !show);
    overlay.classList.remove('is-error');

    if (card) {
      card.classList.remove('is-error');
    }

    if (spinner) {
      spinner.classList.remove('hidden');
    }

    $('#loadingText').textContent = text || '處理中...';
  }

  function setLoadingError_(message, actions) {
    const overlay = $('#loadingOverlay');
    const card = overlay.querySelector('.loading-card');
    const spinner = overlay.querySelector('.spinner');
    const actionList = Array.isArray(actions) ? actions : [];

    clearLoadingActions_(overlay);
    overlay.classList.remove('hidden');
    overlay.classList.add('is-error');

    if (card) {
      card.classList.add('is-error');
    }

    if (spinner) {
      spinner.classList.add('hidden');
    }

    $('#loadingText').textContent =
      message || '資料載入失敗，請重新整理或稍後再試';

    if (!card || !actionList.length) {
      return;
    }

    const actionContainer = document.createElement('div');
    actionContainer.className = 'loading-actions';

    actionList.forEach((action) => {
      if (!action || !action.text || typeof action.handler !== 'function') {
        return;
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = action.secondary
        ? 'loading-action-btn is-secondary'
        : 'loading-action-btn';
      button.textContent = action.text;
      button.addEventListener('click', action.handler);
      actionContainer.appendChild(button);
    });

    if (actionContainer.childElementCount) {
      card.appendChild(actionContainer);
    }
  }

  function isSuccess(res) {
    return !!(res && res.success);
  }

  function getResponseError(res, fallback) {
    return res && res.error
      ? res.error
      : fallback;
  }

  function getErrorMessage(error) {
    if (typeof error === 'string') {
      return error;
    }

    return error && error.message
      ? error.message
      : '系統錯誤';
  }

  function isSessionErrorResponse(res) {
    return !!(
      res &&
      SESSION_ERROR_CODES.indexOf(String(res.code || '').trim()) >= 0
    );
  }

  function handleSessionExpired(requestContext) {
    requestContext = requestContext || {};

    if (!requestContext.sessionToken) {
      return;
    }

    if (
      requestContext.sessionToken !== state.sessionToken ||
      Number(requestContext.sessionGeneration) !== Number(state.sessionGeneration)
    ) {
      return;
    }

    if (state.sessionInvalidated) {
      return;
    }

    state.sessionInvalidated = true;
    notifyOtherAppInstances_('sessionRevoked');
    clearCurrentSession({ preserveSessionInvalidated: true });
    showAuth();
    showAuthMessage('登入狀態已失效，請重新登入。');
  }

  function createClientRequestId_() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'REQ-' + Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 12);
  }

  function getPendingMutationStorageKey_(kind) {
    const playerId = String(
      state.currentPlayer && state.currentPlayer.playerId || 'anonymous'
    );
    return 'vital-pending-mutation::' + playerId + '::' + String(kind || '');
  }

  function digestPendingMutationPayload_(value) {
    const text = typeof value === 'string'
      ? value : buildPendingMutationSignature_(value);
    let first = 2166136261;
    let second = 2246822519;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      first = Math.imul(first ^ code, 16777619) >>> 0;
      second = Math.imul(second ^ code, 3266489917) >>> 0;
    }
    return 'pending-v1-' + first.toString(16).padStart(8, '0') +
      second.toString(16).padStart(8, '0');
  }

  function cleanupExpiredPendingMutationRequests_() {
    const now = Date.now();
    try {
      for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
        const key = window.localStorage.key(index);
        if (!key || key.indexOf('vital-pending-mutation::') !== 0) continue;
        let record = null;
        try { record = JSON.parse(window.localStorage.getItem(key) || '{}'); }
        catch (error) {}
        if (!record || Number(record.expiresAt || 0) <= now) {
          window.localStorage.removeItem(key);
        }
      }
    } catch (error) {}
  }

  function getPendingMutationRequestId_(kind, signature) {
    const storageKey = getPendingMutationStorageKey_(kind);
    const payloadDigest = digestPendingMutationPayload_(signature);
    const now = Date.now();
    cleanupExpiredPendingMutationRequests_();
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
      if (String(saved.payloadDigest || '') === payloadDigest && saved.requestId &&
          Number(saved.expiresAt || 0) > now &&
          String(saved.actionType || '') === String(kind || '')) {
        return String(saved.requestId);
      }
    } catch (error) {}

    const requestId = createClientRequestId_();
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        requestId: requestId,
        payloadDigest: payloadDigest,
        actionType: String(kind || ''),
        createdAt: new Date(now).toISOString(),
        expiresAt: now + PENDING_MUTATION_TTL_MS
      }));
    } catch (error) {}
    return requestId;
  }

  function clearPendingMutationRequestId_(kind, requestId) {
    const storageKey = getPendingMutationStorageKey_(kind);
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || '{}');
      if (!requestId || String(saved.requestId || '') === String(requestId || '')) {
        window.localStorage.removeItem(storageKey);
      }
    } catch (error) {
      try { window.localStorage.removeItem(storageKey); } catch (ignored) {}
    }
  }

  function normalizePendingMutationSignatureValue_(value) {
    if (value === null || typeof value === 'undefined') return '';
    if (Array.isArray(value)) return value.map(normalizePendingMutationSignatureValue_);
    if (value && typeof value === 'object') {
      return Object.keys(value).sort().reduce((result, key) => {
        if (key !== 'requestId' && key !== 'sessionToken') {
          result[key] = normalizePendingMutationSignatureValue_(value[key]);
        }
        return result;
      }, {});
    }
    return value;
  }

  function buildPendingMutationSignature_(payload) {
    return JSON.stringify(normalizePendingMutationSignatureValue_(payload || {}));
  }

  function beginPendingMutationRequest_(kind, payload) {
    const signature = buildPendingMutationSignature_(payload);
    return {
      signature,
      payloadDigest: digestPendingMutationPayload_(signature),
      requestId: getPendingMutationRequestId_(kind, signature)
    };
  }

  function isExplicitNonRetryableMutationResponse_(response) {
    if (!response || isSuccess(response)) return false;
    const code = String(response.code || response.errorCode || '').toUpperCase();
    const message = String(response.message || response.error || '').toUpperCase();
    return ['DATA_CONFLICT', 'VALIDATION_ERROR', 'FORBIDDEN', 'UNAUTHORIZED']
      .indexOf(code) >= 0 || /(^|:)DATA_CONFLICT:/.test(message);
  }

  function settlePendingMutationRequest_(kind, requestId, response) {
    if (isSuccess(response) || isExplicitNonRetryableMutationResponse_(response)) {
      clearPendingMutationRequestId_(kind, requestId);
      return true;
    }
    return false;
  }

  function prepareServerCallArgs(functionName, args) {
    const list = Array.from(args || []);

    if (SESSION_TOKEN_ARG_APIS.indexOf(functionName) >= 0) {
      return [state.sessionToken].concat(list.slice(1));
    }

    if (SESSION_PAYLOAD_APIS.indexOf(functionName) >= 0) {
      const payload = Object.assign({}, list[0] || {});

      payload.sessionToken = state.sessionToken;
      delete payload.playerId;
      delete payload.responderId;
      delete payload.dataEpochId;

      return [payload].concat(list.slice(1));
    }

    return list;
  }

  function createStaleRequestError_() {
    const error = new Error('資料狀態已更新，舊請求已忽略');
    error.code = STALE_REQUEST_ERROR_CODE;
    error.isStaleRequest = true;
    return error;
  }

  function isServerRequestContextCurrent_(requestContext) {
    requestContext = requestContext || {};

    return (
      String(requestContext.sessionToken || '') === String(state.sessionToken || '') &&
      Number(requestContext.sessionGeneration) === Number(state.sessionGeneration)
    );
  }

  function callServer(functionName, ...args) {
    const requestContext = {
      sessionToken: state.sessionToken,
      sessionGeneration: state.sessionGeneration
    };
    const finalArgs = prepareServerCallArgs(functionName, args);
    const isMutation = SERVER_MUTATION_APIS.has(functionName);

    return new Promise((resolve, reject) => {
      let settled = false;
      // 讀取與共用傳輸層使用相同等待期限；寫入交由共用傳輸層統一終止等待。
      // 具 requestId 的寫入重試會沿用原 requestId，避免重複建立資料。
      const timeoutId = isMutation ? 0 : window.setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;

        if (!isServerRequestContextCurrent_(requestContext)) {
          reject(createStaleRequestError_());
          return;
        }

        reject(new Error('伺服器回應逾時，請確認網路後再試一次'));
      }, SERVER_READ_CALL_TIMEOUT_MS);

      const clearCallTimeout = () => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
      };

      const resolveOnce = (res) => {
        if (settled) {
          return;
        }

        settled = true;
        clearCallTimeout();

        if (!isServerRequestContextCurrent_(requestContext)) {
          reject(createStaleRequestError_());
          return;
        }

        if (isSessionErrorResponse(res)) {
          handleSessionExpired(requestContext);
        }

        resolve(res);
      };

      const rejectOnce = (error) => {
        if (settled) {
          return;
        }

        settled = true;
        clearCallTimeout();

        if (!isServerRequestContextCurrent_(requestContext)) {
          reject(createStaleRequestError_());
          return;
        }

        reject(error);
      };

      try {
        window.GasBackend
          .invoke(functionName, finalArgs)
          .then(resolveOnce)
          .catch(rejectOnce);
      } catch (error) {
        rejectOnce(error);
      }
    });
  }

  function getCacheTtlMs_(key) {
    key = String(key || '').trim();

    return Number(
      Object.prototype.hasOwnProperty.call(
        CACHE_POLICIES,
        key
      )
        ? CACHE_POLICIES[key]
        : CACHE_DEFAULT_TTL_MS
    );
  }

  function getCacheScope_() {
    return {
      sessionGeneration: Number(state.sessionGeneration),
      playerId: state.currentPlayer && state.currentPlayer.playerId
        ? String(state.currentPlayer.playerId)
        : '',
      dataEpochId: String(state.currentDataEpochId || ''),
      businessDate: getTaipeiBusinessDate_()
    };
  }

  function isCacheScopeCurrent_(scope) {
    scope = scope || {};
    const currentScope = getCacheScope_();

    return (
      Number(scope.sessionGeneration) === Number(currentScope.sessionGeneration) &&
      String(scope.playerId || '') === currentScope.playerId &&
      String(scope.dataEpochId || '') === currentScope.dataEpochId &&
      String(scope.businessDate || '') === currentScope.businessDate
    );
  }

  function getCacheEntry_(key) {
    key = String(key || '').trim();

    if (!key) {
      return null;
    }

    state.cache = state.cache || {};

    const entry = state.cache[key] || null;

    if (!entry) {
      return null;
    }

    const scope = getCacheScope_();

    if (
      Number(entry.sessionGeneration) !== Number(scope.sessionGeneration) ||
      String(entry.playerId || '') !== scope.playerId ||
      String(entry.dataEpochId || '') !== scope.dataEpochId ||
      String(entry.businessDate || '') !== scope.businessDate
    ) {
      delete state.cache[key];
      return null;
    }

    if (entry.loadingPromise) {
      if (
        Date.now() - Number(entry.loadedAt || 0) <=
        CACHE_LOADING_PROMISE_TTL_MS
      ) {
        return entry;
      }

      delete state.cache[key];
      return null;
    }

    if (!entry.valid) {
      delete state.cache[key];
      return null;
    }

    if (
      Number(entry.expiresAt || 0) > 0 &&
      Date.now() >= Number(entry.expiresAt)
    ) {
      delete state.cache[key];
      return null;
    }

    return entry;
  }

  function isCacheValid_(key) {
    const entry = getCacheEntry_(key);

    return !!(entry && entry.valid);
  }

  function getCache_(key) {
    const entry = getCacheEntry_(key);

    return entry && entry.valid ? entry.data : null;
  }

  function writeCacheEntry_(key, data, scope) {
    key = String(key || '').trim();

    if (!key) {
      return data;
    }

    scope = scope || getCacheScope_();
    const loadedAt = Date.now();
    const ttlMs = getCacheTtlMs_(key);

    state.cache = state.cache || {};
    state.cache[key] = {
      data: data,
      valid: true,
      loadedAt: loadedAt,
      expiresAt: loadedAt + ttlMs,
      loadingPromise: null,
      requestId: 0,
      sessionGeneration: Number(scope.sessionGeneration),
      playerId: String(scope.playerId || ''),
      dataEpochId: String(scope.dataEpochId || ''),
      businessDate: String(scope.businessDate || '')
    };

    return data;
  }

  function setCache_(key, data) {
    return writeCacheEntry_(key, data, getCacheScope_());
  }

  function invalidateCache_(key) {
    key = String(key || '').trim();

    if (key && state.cache) {
      delete state.cache[key];
    }
  }

  function invalidateCaches_(keys) {
    (keys || []).forEach(invalidateCache_);
  }

  function clearAllAppCache_() {
    state.cache = {};
  }

  function isApiResponseEnvelope_(value) {
    return !!(
      value &&
      typeof value === 'object' &&
      Object.prototype.hasOwnProperty.call(value, 'success')
    );
  }

  function isCacheRequestCurrent_(key, requestId, scope) {
    const entry = state.cache && state.cache[key];

    return !!(
      entry &&
      entry.loadingPromise &&
      Number(entry.requestId) === Number(requestId) &&
      isCacheScopeCurrent_(scope)
    );
  }

  function clearCacheRequestIfCurrent_(key, requestId) {
    const entry = state.cache && state.cache[key];

    if (entry && Number(entry.requestId) === Number(requestId)) {
      delete state.cache[key];
    }
  }

  function loadOnce_(key, loader) {
    key = String(key || '').trim();
    const cached = getCacheEntry_(key);

    if (cached && cached.valid) {
      return Promise.resolve(cached.data);
    }

    if (cached && cached.loadingPromise) {
      return cached.loadingPromise;
    }

    const scope = getCacheScope_();
    const requestId = ++state.cacheRequestSequence;
    let promise = null;

    promise = Promise.resolve()
      .then(loader)
      .then((data) => {
        if (!isCacheRequestCurrent_(key, requestId, scope)) {
          throw createStaleRequestError_();
        }

        if (isApiResponseEnvelope_(data) && !isSuccess(data)) {
          clearCacheRequestIfCurrent_(key, requestId);
          return data;
        }

        return writeCacheEntry_(key, data, scope);
      })
      .catch((error) => {
        clearCacheRequestIfCurrent_(key, requestId);
        throw error;
      });

    state.cache = state.cache || {};
    state.cache[key] = {
      data: null,
      valid: false,
      loadedAt: Date.now(),
      expiresAt: 0,
      loadingPromise: promise,
      requestId: requestId,
      sessionGeneration: Number(scope.sessionGeneration),
      playerId: scope.playerId,
      dataEpochId: scope.dataEpochId,
      businessDate: scope.businessDate
    };

    return promise;
  }

  function invalidateByRule_(rule) {
    const map = {
      dailyPracticeChanged: [
        'dashboard',
        'dailyPractice',
        'practiceHistory',
        'growth',
        'journey',
        'chestSummary',
        'chestCollection',
        'chestSettingsForPlayer',
        'accountProfile'
      ],
      meetingPracticeChanged: [
        'dashboard',
        'meetingPractice',
        'practiceHistory',
        'growth',
        'journey',
        'chestSummary',
        'chestCollection',
        'chestSettingsForPlayer',
        'accountProfile'
      ],
      groupAnnouncementsChanged: [
        'groupAnnouncements',
        'dashboard'
      ],
      groupChanged: [
        'groupInfo',
        'groupAnnouncements',
        'contribution',
        'journey',
        'groupJourneyList',
        'dashboard',
        'growth',
        'chestSummary',
        'chestCollection',
        'chestSettingsForPlayer',
        'accountProfile'
      ],
      contributionChanged: [
        'contribution',
        'dashboard',
        'growth',
        'journey',
        'chestSummary',
        'chestCollection',
        'chestSettingsForPlayer',
        'accountProfile'
      ],
      accountChanged: [
        'accountProfile',
        'dashboard'
      ]
    };

    invalidateCaches_(map[rule] || []);
  }

  function toBool(value) {
    if (value === true) {
      return true;
    }

    if (value === false) {
      return false;
    }

    return [
      'true',
      '1',
      'yes',
      'y',
      '完成',
      '已完成',
      'done',
      'checked'
    ].includes(
      String(value || '').trim().toLowerCase()
    );
  }

  function createEmptyDailyRecord() {
    return {
      recordDate: formatLocalDate(new Date()),
      morningRevival: false,
      bibleReading: false,
      prayer: false,
      bookPursuit: false
    };
  }

  function createEmptyWeeklyTaskRecord() {
    return {
      weekKey: '',
      outreachVisit: false,
      smallGroup: false,
      prayerMeeting: false,
      lordDayMeeting: false
    };
  }

  function formatLocalDate(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');

    return yyyy + '-' + mm + '-' + dd;
  }

  function formatWeeklyTaskDateRange(weekKey) {
    const normalizedWeekKey = String(weekKey || '').trim();

    if (!normalizedWeekKey) {
      return '讀取中...';
    }

    let start = null;
    const isoWeekMatch = normalizedWeekKey.match(/^(\d{4})-W(\d{2})$/);

    if (isoWeekMatch) {
      const isoYear = Number(isoWeekMatch[1]);
      const isoWeek = Number(isoWeekMatch[2]);

      if (isoWeek < 1 || isoWeek > 53) {
        return '日期格式錯誤';
      }

      // ISO week 1 is the week containing January 4; Monday is day 1.
      const januaryFourth = new Date(isoYear, 0, 4, 12, 0, 0, 0);
      const januaryFourthIsoDay = januaryFourth.getDay() || 7;
      start = new Date(
        isoYear,
        0,
        4 - januaryFourthIsoDay + 1 + (isoWeek - 1) * 7,
        12,
        0,
        0,
        0
      );

      // Reject impossible week 53 values instead of displaying a wrong year/week.
      const thursday = new Date(start);
      thursday.setDate(start.getDate() + 3);
      const thursdayYear = thursday.getFullYear();
      const yearStart = new Date(thursdayYear, 0, 1, 12, 0, 0, 0);
      const resolvedWeek = Math.ceil(
        (((thursday - yearStart) / 86400000) + 1) / 7
      );
      if (thursdayYear !== isoYear || resolvedWeek !== isoWeek) {
        return '日期格式錯誤';
      }
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedWeekKey)) {
      // Keep compatibility with older deployments that returned Monday as YYYY-MM-DD.
      const parts = normalizedWeekKey.split('-').map(Number);
      start = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
      if (
        start.getFullYear() !== parts[0] ||
        start.getMonth() !== parts[1] - 1 ||
        start.getDate() !== parts[2]
      ) {
        return '日期格式錯誤';
      }
    } else {
      return '日期格式錯誤';
    }

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const weekNames = ['日', '一', '二', '三', '四', '五', '六'];
    const toText = (date) =>
      (date.getMonth() + 1) + '/' + date.getDate() + '(' + weekNames[date.getDay()] + ')';

    return toText(start) + '~' + toText(end);
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString('zh-TW');
  }

  function normalizeAvatarGender(value) {
    const text = String(value || '').trim().toLowerCase();

    if (['male', 'm', '男'].includes(text)) {
      return 'male';
    }

    if (['female', 'f', '女'].includes(text)) {
      return 'female';
    }

    return '';
  }

  function getAvatarMaxNo(gender) {
    return normalizeAvatarGender(gender) === 'female'
      ? 100
      : 80;
  }

  function getAvatarUrl(gender, no) {
    const normalized = normalizeAvatarGender(gender) || 'male';
    const number = Number(no || 0);

    if (
      number < 1 ||
      number > getAvatarMaxNo(normalized)
    ) {
      return '';
    }

    const padded = String(number).padStart(3, '0');

    return LOCAL_AVATAR_BASE_URL +
      (
        normalized === 'female'
          ? '/avatar-female/avatar-female-direct-'
          : '/avatar-male/avatar-male-direct-'
      ) +
      padded +
      '.png';
  }

  function getRemoteAvatarUrl_(gender, no) {
    const localUrl = getAvatarUrl(gender, no);
    if (!localUrl) return '';
    return localUrl.replace(LOCAL_AVATAR_BASE_URL, REMOTE_AVATAR_BASE_URL);
  }

  function buildRandomAvatar(gender) {
    const normalized = normalizeAvatarGender(gender) || 'male';

    const avatarNo =
      Math.floor(
        Math.random() * getAvatarMaxNo(normalized)
      ) + 1;

    return {
      avatarGender: normalized,
      avatarNo: avatarNo,
      avatarUrl: getAvatarUrl(normalized, avatarNo)
    };
  }

  function buildSteppedAvatar(gender, currentNo, delta) {
    const normalized = normalizeAvatarGender(gender) || 'male';
    const maxNo = getAvatarMaxNo(normalized);
    const baseNo = Number(currentNo || 1);
    const nextNo = ((baseNo - 1 + delta + maxNo) % maxNo) + 1;

    return {
      avatarGender: normalized,
      avatarNo: nextNo,
      avatarUrl: getAvatarUrl(normalized, nextNo)
    };
  }

  function getGenderLabel(gender) {
    return normalizeAvatarGender(gender) === 'female'
      ? '姊妹'
      : '弟兄';
  }

  function applySavedTheme() {
    setTheme(localStorage.getItem('yct_theme') || 'adventure', false);
  }

  function setTheme(theme, persist = true) {
    const allowed = ['adventure', 'fresh', 'night'];
    const nextTheme = allowed.includes(theme) ? theme : 'adventure';

    document.body.dataset.theme = nextTheme;

    if (persist) {
      localStorage.setItem('yct_theme', nextTheme);
    }

    $$('[data-theme-choice]').forEach((button) => {
      button.classList.toggle(
        'active',
        button.dataset.themeChoice === nextTheme
      );
    });
  }

  function infoAttributeHtml(label, value) {
    return [
      '<div>',
      '<span>' + escapeHtml(label) + '</span>',
      '<strong>' + formatNumber(value) + '</strong>',
      '</div>'
    ].join('');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
