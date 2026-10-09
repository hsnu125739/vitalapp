/**
 * practiceStore.js
 * 前端樂觀操練狀態庫 (Optimistic Practice Store)
 * 
 * 核心架構規範：
 * 1. 10ms 立即響應：卡片點擊立即完成本機打勾與數值更新，介面零阻斷轉圈。
 * 2. 序列發送鎖 (isSending)：嚴格確保同一使用者的請求依序單向送出。
 * 3. 狀態收斂佇列 (Coalescing Queue)：連續點擊時，自動收斂為最新 PackedValue，消除空中賽跑。
 * 4. 後令覆前令 (Latest-Wins)：前次請求失敗時，若佇列已有新值則直接捨棄失敗重試，派發新值。
 * 5. 無後令容錯重試（選項 3 ＋ 選項 1）：
 *    - 若無後令且請求失敗，等待 2 秒（帶 200ms Jitter）自動發起第 2 次重試。
 *    - 若第 2 次仍失敗，絕不回滾介面打勾（維持使用者操練心血），卡片標記琥珀色未同步提示 (Amber Dot)，並寫入 localStorage.vital_offline_queue。
 *    - 當網路恢復 (online 事件)、使用者下次操作或重開 App 時自動補送。
 */

(function(global) {
  'use strict';

function normalizeDailyKey(k) {
  if (k === 'morningRevival' || k === 'morning') return 'morning';
  if (k === 'bibleReading' || k === 'bible') return 'bible';
  if (k === 'prayer') return 'prayer';
  if (k === 'bookPursuit' || k === 'book') return 'book';
  return k;
}

function normalizeMeetingKey(k) {
  if (k === 'smallGroup' || k === 'group') return 'smallGroup';
  if (k === 'prayerMeeting' || k === 'prayer') return 'prayerMeeting';
  if (k === 'lordDayMeeting' || k === 'lordDay') return 'lordDayMeeting';
  if (k === 'outreachVisit' || k === 'outreach') return 'outreachVisit';
  return k;
}

function packBase100(a, b, c, d) {
  return ((d ? 1 : 0) * 1000000) + ((c ? 1 : 0) * 10000) + ((b ? 1 : 0) * 100) + (a ? 1 : 0);
}

function unpackBase100(val) {
  const n = Number(val) || 0;
  return {
    a: (n % 100) > 0,
    b: (Math.floor(n / 100) % 100) > 0,
    c: (Math.floor(n / 10000) % 100) > 0,
    d: (Math.floor(n / 1000000) % 100) > 0
  };
}

class OptimisticPracticeStore {
  constructor({ apiClient, storage = null, onStateChange = null, retryDelayMs = 2000 }) {
    this.apiClient = apiClient;
    this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : {
      store: {},
      getItem(k) { return this.store[k] || null; },
      setItem(k, v) { this.store[k] = String(v); },
      removeItem(k) { delete this.store[k]; }
    });
    this.onStateChange = onStateChange;
    this.retryDelayMs = retryDelayMs;

    // 本機狀態快照
    this.dailyState = {};   // { [date]: { morning, bible, prayer, book, packedValue, syncStatus, hasAmberDot } }
    this.meetingState = {}; // { [weekKey]: { smallGroup, prayerMeeting, lordDayMeeting, outreachVisit, packedValue, syncStatus, hasAmberDot } }

    // 併發與收斂佇列控制
    this.isSending = false;
    this.isReplaying = false;        // 離線佇列補發互斥鎖，防止並發操作同一 localStorage queue
    this.pendingDaily = new Map();   // key: date, value: latest payload
    this.pendingMeeting = new Map(); // key: weekKey, value: latest payload

    // 冷啟動離線狀態水合
    this.hydrateFromOfflineQueue();

    // 監聽網路連線恢復（互斥鎖防止冷啟動 replay 尚未完成時 online 事件重複觸發）
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', () => {
        if (!this.isReplaying) this.replayOfflineQueue();
      });
    }

    // 冷啟動自動補發（不受 isReplaying 鎖影響，保證首次一定執行）
    this.replayOfflineQueue().catch(() => {});
  }

  notify(type, key, state) {
    if (typeof this.onStateChange === 'function') {
      this.onStateChange({ type, key, state });
    }
  }

  // --- 每日操練打卡操作 ---

  /**
   * 點擊每日操練卡片（10ms 立即樂觀打勾）
   */
  toggleDailyPractice(date, itemKey, forcedValue = null) {
    if (!this.dailyState[date]) {
      this.dailyState[date] = {
        morning: false,
        morningRevival: false,
        bible: false,
        bibleReading: false,
        prayer: false,
        book: false,
        bookPursuit: false,
        packedValue: 0,
        syncStatus: 'synced',
        hasAmberDot: false
      };
    }

    const current = this.dailyState[date];
    const normKey = normalizeDailyKey(itemKey);
    const nextVal = forcedValue !== null ? Boolean(forcedValue) : !current[normKey];

    current[normKey] = nextVal;
    if (normKey === 'morning') current.morningRevival = nextVal;
    if (normKey === 'bible') current.bibleReading = nextVal;
    if (normKey === 'book') current.bookPursuit = nextVal;

    current.syncStatus = 'pending';

    // 重新計算 Base-100 打包值
    current.packedValue = packBase100(current.morning, current.bible, current.prayer, current.book);

    // 10ms 立即通知 UI 更新（零卡頓）
    this.notify('DAILY', date, { ...current });

    // 壓入收斂佇列並調度發送
    this.pendingDaily.set(date, { ...current });
    this.dispatchDailyQueue(date);

    return { ...current };
  }

  /**
   * 調度每日操練收斂佇列與後令覆前令
   */
  async dispatchDailyQueue(date) {
    if (this.isSending) {
      // 序列鎖保護中，最新狀態已由 pendingDaily 保留（收斂）
      return;
    }

    const payload = this.pendingDaily.get(date);
    if (!payload) {
      this.drainPendingQueues();
      return;
    }

    this.isSending = true;
    this.pendingDaily.delete(date);

    try {
      await this.sendDailyPracticeWithRetry(date, payload);
    } finally {
      this.isSending = false;
      this.drainPendingQueues();
    }
  }

  /**
   * 發送每日操練打卡（包含無後令 2s 重試與琥珀色未同步降級）
   */
  async sendDailyPracticeWithRetry(date, payload) {
    const currentState = this.dailyState[date];

    try {
      // 第 1 次嘗試：使用 Base-100 打包值直傳，去除冗餘布林值
      const dailyPayload = {
        date,
        packedValue: payload.packedValue
      };
      const res = await this.apiClient.submitDailyPractice(dailyPayload);

      if (res && res.success) {
        currentState.syncStatus = 'synced';
        currentState.hasAmberDot = false;
        const { groupTotalPoints, personalPoints, deltaPoints } = res.data || res;
        this.notify('DAILY', date, {
          ...currentState,
          serverPoints: { groupTotalPoints, personalPoints, deltaPoints }
        });
        return;
      }
      throw new Error((res && res.error) || 'Daily practice submit failed');
    } catch (err1) {
      // 檢查是否有後令覆前令 (Latest-Wins)
      if (this.pendingDaily.has(date)) {
        // 佇列已有新值，直接捨棄本次重試，派發新值！
        return;
      }

      // 無後令：等待 2 秒（帶 200ms Jitter）自動發起第 2 次重試
      await new Promise(resolve => setTimeout(resolve, this.retryDelayMs + Math.random() * (this.retryDelayMs > 100 ? 200 : 0)));

      // 再次檢查是否有後令注入
      if (this.pendingDaily.has(date)) {
        return;
      }

      try {
        // 第 2 次嘗試：使用 Base-100 打包值直傳，去除冗餘布林值
        const retryDailyPayload = {
          date,
          packedValue: payload.packedValue
        };
        const res2 = await this.apiClient.submitDailyPractice(retryDailyPayload);

        if (res2 && res2.success) {
          currentState.syncStatus = 'synced';
          currentState.hasAmberDot = false;
          this.notify('DAILY', date, { ...currentState });
          return;
        }
        throw new Error((res2 && res2.error) || 'Retry failed');
      } catch (err2) {
        // 第 2 次仍失敗：【絕不回滾介面打勾】（維持使用者心血）
        currentState.syncStatus = 'error';
        currentState.hasAmberDot = true; // 標記琥珀色未同步圓點
        this.notify('DAILY', date, { ...currentState });

        // 存入離線佇列
        this.enqueueOfflinePractice('DAILY', date, payload);
      }
    }
  }

  // --- 每週聚會打卡操作 ---

  /**
   * 點擊每週聚會卡片（10ms 立即樂觀打勾）
   */
  toggleMeetingPractice(weekKey, itemKey, forcedValue = null) {
    if (!this.meetingState[weekKey]) {
      this.meetingState[weekKey] = {
        smallGroup: false,
        prayerMeeting: false,
        lordDayMeeting: false,
        outreachVisit: false,
        packedValue: 0,
        syncStatus: 'synced',
        hasAmberDot: false
      };
    }

    const current = this.meetingState[weekKey];
    const normKey = normalizeMeetingKey(itemKey);
    const nextVal = forcedValue !== null ? Boolean(forcedValue) : !current[normKey];
    current[normKey] = nextVal;
    current.syncStatus = 'pending';

    current.packedValue = packBase100(current.smallGroup, current.prayerMeeting, current.lordDayMeeting, current.outreachVisit);

    this.notify('MEETING', weekKey, { ...current });

    this.pendingMeeting.set(weekKey, { ...current });
    this.dispatchMeetingQueue(weekKey);

    return { ...current };
  }

  async dispatchMeetingQueue(weekKey) {
    if (this.isSending) return;

    const payload = this.pendingMeeting.get(weekKey);
    if (!payload) {
      this.drainPendingQueues();
      return;
    }

    this.isSending = true;
    this.pendingMeeting.delete(weekKey);

    try {
      const currentState = this.meetingState[weekKey];
      // 使用 Base-100 打包值直傳，去除冗餘布林值
      const meetingPayload = {
        weekKey,
        packedValue: payload.packedValue
      };
      const res = await this.apiClient.submitMeetingPractice(meetingPayload);

      if (res && res.success) {
        currentState.syncStatus = 'synced';
        currentState.hasAmberDot = false;
        const { groupTotalPoints, personalPoints, deltaPoints } = res.data || res;
        this.notify('MEETING', weekKey, {
          ...currentState,
          serverPoints: { groupTotalPoints, personalPoints, deltaPoints }
        });
      } else {
        throw new Error('Meeting practice failed');
      }
    } catch (err) {
      if (this.pendingMeeting.has(weekKey)) return;

      // 重試
      await new Promise(resolve => setTimeout(resolve, this.retryDelayMs + Math.random() * (this.retryDelayMs > 100 ? 200 : 0)));
      if (this.pendingMeeting.has(weekKey)) return;

      try {
        // 使用 Base-100 打包值直傳，去除冗餘布林值
        const retryMeetingPayload = {
          weekKey,
          packedValue: payload.packedValue
        };
        const res2 = await this.apiClient.submitMeetingPractice(retryMeetingPayload);
        if (res2 && res2.success) {
          const currentState = this.meetingState[weekKey];
          currentState.syncStatus = 'synced';
          currentState.hasAmberDot = false;
          this.notify('MEETING', weekKey, { ...currentState });
        } else {
          throw new Error('Retry failed');
        }
      } catch (err2) {
        const currentState = this.meetingState[weekKey];
        currentState.syncStatus = 'error';
        currentState.hasAmberDot = true;
        this.notify('MEETING', weekKey, { ...currentState });
        this.enqueueOfflinePractice('MEETING', weekKey, payload);
      }
    } finally {
      this.isSending = false;
      this.drainPendingQueues();
    }
  }

  /**
   * 清空待發送佇列：防止跨日期、跨模組並行點擊導致佇列飢餓遺失
   */
  drainPendingQueues() {
    if (this.isSending) return;

    if (this.pendingDaily.size > 0) {
      const nextDate = this.pendingDaily.keys().next().value;
      this.dispatchDailyQueue(nextDate);
      return;
    }

    if (this.pendingMeeting.size > 0) {
      const nextWeekKey = this.pendingMeeting.keys().next().value;
      this.dispatchMeetingQueue(nextWeekKey);
      return;
    }
  }

  // --- 離線暫存佇列管理 ---

  /**
   * 冷啟動離線狀態水合 (Hydration)：從 storage 載入未送出的琥珀色標記
   */
  hydrateFromOfflineQueue() {
    const raw = this.storage.getItem('vital_offline_queue');
    if (!raw) return;

    let queue = [];
    try {
      queue = JSON.parse(raw);
    } catch (e) {
      return;
    }

    if (!Array.isArray(queue)) return;

    for (const item of queue) {
      if (item.type === 'DAILY' && item.key && !this.dailyState[item.key]) {
        const p = item.payload || {};
        const unp = unpackBase100(p.packedValue);
        const morning = p.packedValue !== undefined ? unp.a : Boolean(p.morning || p.morningRevival);
        const bible = p.packedValue !== undefined ? unp.b : Boolean(p.bible || p.bibleReading);
        const prayer = p.packedValue !== undefined ? unp.c : Boolean(p.prayer);
        const book = p.packedValue !== undefined ? unp.d : Boolean(p.book || p.bookPursuit);
        this.dailyState[item.key] = {
          morning, morningRevival: morning,
          bible, bibleReading: bible,
          prayer, book, bookPursuit: book,
          packedValue: packBase100(morning, bible, prayer, book),
          syncStatus: 'error',
          hasAmberDot: true
        };
      } else if (item.type === 'MEETING' && item.key && !this.meetingState[item.key]) {
        const p = item.payload || {};
        const unp = unpackBase100(p.packedValue);
        const smallGroup = p.packedValue !== undefined ? unp.a : Boolean(p.smallGroup || p.group);
        const prayerMeeting = p.packedValue !== undefined ? unp.b : Boolean(p.prayerMeeting || p.prayerMtg);
        const lordDayMeeting = p.packedValue !== undefined ? unp.c : Boolean(p.lordDayMeeting || p.lordDay);
        const outreachVisit = p.packedValue !== undefined ? unp.d : Boolean(p.outreachVisit || p.outreach);
        this.meetingState[item.key] = {
          smallGroup, prayerMeeting, lordDayMeeting, outreachVisit,
          packedValue: packBase100(smallGroup, prayerMeeting, lordDayMeeting, outreachVisit),
          syncStatus: 'error',
          hasAmberDot: true
        };
      }
    }
  }

  enqueueOfflinePractice(type, key, payload) {
    const raw = this.storage.getItem('vital_offline_queue');
    let queue = [];
    try {
      queue = raw ? JSON.parse(raw) : [];
    } catch (e) {
      queue = [];
    }

    // 覆蓋同 key 之舊紀錄 (Coalescing in Storage)
    queue = queue.filter(item => !(item.type === type && item.key === key));
    queue.push({
      type,
      key,
      payload,
      targetDate: type === 'DAILY' ? key : undefined,
      timestamp: Date.now()
    });

    this.storage.setItem('vital_offline_queue', JSON.stringify(queue));
  }

  async replayOfflineQueue() {
    const raw = this.storage.getItem('vital_offline_queue');
    if (!raw) return;

    let queue = [];
    try {
      queue = JSON.parse(raw);
    } catch (e) {
      return;
    }

    if (queue.length === 0) return;

    this.isReplaying = true;
    try {
      const promises = queue.map(item => {
      if (item.type === 'DAILY') {
        const p = item.payload || {};
        return this.apiClient.submitDailyPractice({
          date: item.key,
          packedValue: p.packedValue
        }).then(res => {
          if (res && res.success) {
            if (this.dailyState[item.key]) {
              this.dailyState[item.key].syncStatus = 'synced';
              this.dailyState[item.key].hasAmberDot = false;
              this.notify('DAILY', item.key, { ...this.dailyState[item.key] });
            }
            return { item, success: true };
          }
          return { item, success: false };
        }).catch(() => ({ item, success: false }));
      } else if (item.type === 'MEETING') {
        const p = item.payload || {};
        return this.apiClient.submitMeetingPractice({
          weekKey: item.key,
          packedValue: p.packedValue
        }).then(res => {
          if (res && res.success) {
            if (this.meetingState[item.key]) {
              this.meetingState[item.key].syncStatus = 'synced';
              this.meetingState[item.key].hasAmberDot = false;
              this.notify('MEETING', item.key, { ...this.meetingState[item.key] });
            }
            return { item, success: true };
          }
          return { item, success: false };
        }).catch(() => ({ item, success: false }));
      }
      return Promise.resolve({ item, success: false });
    });

      const results = await Promise.allSettled(promises);
      const remaining = results
        .filter(r => r.status === 'fulfilled' && !r.value?.success)
        .map(r => r.value.item);

      if (remaining.length > 0) {
        this.storage.setItem('vital_offline_queue', JSON.stringify(remaining));
      } else {
        this.storage.removeItem('vital_offline_queue');
      }
    } finally {
      this.isReplaying = false;
    }
  }

  /**
   * 三向聯集整併演算法 (Three-Way Union Merge)
   * 當背景 getPractice 返回伺服器狀態 S 時，若本地存在在途點擊 P 或離線佇列 O，採單調邏輯 OR 聯集：
   * Merged = S or P or O
   * 任何一端已打卡的項目，整併後絕對保留，操練成果只增不減、絕不覆蓋。
   */
  mergeServerPractice(serverData) {
    if (!serverData) return { dailyState: this.dailyState, meetingState: this.meetingState };
    const payload = serverData.data || serverData;

    // 1. 今日操練整併
    const todayStr = payload.todayStr;
    const sDaily = payload.daily || payload.todayDaily;
    if (todayStr && sDaily) {
      if (!this.dailyState[todayStr]) {
        this.dailyState[todayStr] = {
          morning: false,
          morningRevival: false,
          bible: false,
          bibleReading: false,
          prayer: false,
          book: false,
          bookPursuit: false,
          packedValue: 0,
          syncStatus: 'synced',
          hasAmberDot: false
        };
      }
      const cur = this.dailyState[todayStr];
      const pending = (this.pendingDaily && this.pendingDaily.get(todayStr)) || null;

      const morning = Boolean(cur.morning || sDaily.morning || sDaily.morningRevival || (pending && (pending.morning || pending.morningRevival)));
      const bible = Boolean(cur.bible || sDaily.bible || sDaily.bibleReading || (pending && (pending.bible || pending.bibleReading)));
      const prayer = Boolean(cur.prayer || sDaily.prayer || (pending && pending.prayer));
      const book = Boolean(cur.book || sDaily.book || sDaily.bookPursuit || (pending && (pending.book || pending.bookPursuit)));

      cur.morning = morning;
      cur.morningRevival = morning;
      cur.bible = bible;
      cur.bibleReading = bible;
      cur.prayer = prayer;
      cur.book = book;
      cur.bookPursuit = book;
      cur.packedValue = packBase100(morning, bible, prayer, book);

      const isFullyConfirmed = (!cur.morning || sDaily.morning || sDaily.morningRevival) &&
                                (!cur.bible || sDaily.bible || sDaily.bibleReading) &&
                                (!cur.prayer || sDaily.prayer) &&
                                (!cur.book || sDaily.book || sDaily.bookPursuit);

      if (!pending && (cur.syncStatus !== 'error' || isFullyConfirmed)) {
        cur.syncStatus = 'synced';
        cur.hasAmberDot = false;
      }
      this.notify('DAILY', todayStr, { ...cur });
    }

    // 2. 昨日操練整併
    const yesterdayStr = payload.yesterdayStr;
    const sYDaily = payload.yesterdayDaily;
    if (yesterdayStr && sYDaily) {
      if (!this.dailyState[yesterdayStr]) {
        this.dailyState[yesterdayStr] = {
          morning: false,
          morningRevival: false,
          bible: false,
          bibleReading: false,
          prayer: false,
          book: false,
          bookPursuit: false,
          packedValue: 0,
          syncStatus: 'synced',
          hasAmberDot: false
        };
      }
      const curY = this.dailyState[yesterdayStr];
      const pendingY = (this.pendingDaily && this.pendingDaily.get(yesterdayStr)) || null;

      const morningY = Boolean(curY.morning || sYDaily.morning || sYDaily.morningRevival || (pendingY && (pendingY.morning || pendingY.morningRevival)));
      const bibleY = Boolean(curY.bible || sYDaily.bible || sYDaily.bibleReading || (pendingY && (pendingY.bible || pendingY.bibleReading)));
      const prayerY = Boolean(curY.prayer || sYDaily.prayer || (pendingY && pendingY.prayer));
      const bookY = Boolean(curY.book || sYDaily.book || sYDaily.bookPursuit || (pendingY && (pendingY.book || pendingY.bookPursuit)));

      curY.morning = morningY;
      curY.morningRevival = morningY;
      curY.bible = bibleY;
      curY.bibleReading = bibleY;
      curY.prayer = prayerY;
      curY.book = bookY;
      curY.bookPursuit = bookY;
      curY.packedValue = packBase100(morningY, bibleY, prayerY, bookY);

      const isFullyConfirmedY = (!curY.morning || sYDaily.morning || sYDaily.morningRevival) &&
                                (!curY.bible || sYDaily.bible || sYDaily.bibleReading) &&
                                (!curY.prayer || sYDaily.prayer) &&
                                (!curY.book || sYDaily.book || sYDaily.bookPursuit);

      if (!pendingY && (curY.syncStatus !== 'error' || isFullyConfirmedY)) {
        curY.syncStatus = 'synced';
        curY.hasAmberDot = false;
      }
      this.notify('DAILY', yesterdayStr, { ...curY });
    }

    // 3. 本週聚會整併
    const weekKey = payload.weekKey;
    const sMeeting = payload.meeting;
    if (weekKey && sMeeting) {
      if (!this.meetingState[weekKey]) {
        this.meetingState[weekKey] = {
          smallGroup: false,
          prayerMeeting: false,
          lordDayMeeting: false,
          outreachVisit: false,
          packedValue: 0,
          syncStatus: 'synced',
          hasAmberDot: false
        };
      }
      const curM = this.meetingState[weekKey];
      const pendingM = (this.pendingMeeting && this.pendingMeeting.get(weekKey)) || null;

      const smallGroup = Boolean(curM.smallGroup || sMeeting.smallGroup || sMeeting.group || (pendingM && (pendingM.smallGroup || pendingM.group)));
      const prayerMeeting = Boolean(curM.prayerMeeting || sMeeting.prayerMeeting || sMeeting.prayerMtg || (pendingM && (pendingM.prayerMeeting || pendingM.prayerMtg)));
      const lordDayMeeting = Boolean(curM.lordDayMeeting || sMeeting.lordDayMeeting || sMeeting.lordDay || (pendingM && (pendingM.lordDayMeeting || pendingM.lordDay)));
      const outreachVisit = Boolean(curM.outreachVisit || sMeeting.outreachVisit || sMeeting.outreach || sMeeting.blend || sMeeting.mutual || (pendingM && (pendingM.outreachVisit || pendingM.outreach)));

      curM.smallGroup = smallGroup;
      curM.prayerMeeting = prayerMeeting;
      curM.lordDayMeeting = lordDayMeeting;
      curM.outreachVisit = outreachVisit;
      curM.packedValue = packBase100(smallGroup, prayerMeeting, lordDayMeeting, outreachVisit);

      const isFullyConfirmedM = (!curM.smallGroup || sMeeting.smallGroup || sMeeting.group) &&
                                (!curM.prayerMeeting || sMeeting.prayerMeeting || sMeeting.prayerMtg) &&
                                (!curM.lordDayMeeting || sMeeting.lordDayMeeting || sMeeting.lordDay) &&
                                (!curM.outreachVisit || sMeeting.outreachVisit || sMeeting.outreach || sMeeting.blend || sMeeting.mutual);

      if (!pendingM && (curM.syncStatus !== 'error' || isFullyConfirmedM)) {
        curM.syncStatus = 'synced';
        curM.hasAmberDot = false;
      }
      this.notify('MEETING', weekKey, { ...curM });
    }

    // 4. 上週聚會整併
    const lastWeekKey = payload.lastWeekKey;
    const sLastMeeting = payload.lastWeekMeeting;
    if (lastWeekKey && sLastMeeting) {
      if (!this.meetingState[lastWeekKey]) {
        this.meetingState[lastWeekKey] = {
          smallGroup: false,
          prayerMeeting: false,
          lordDayMeeting: false,
          outreachVisit: false,
          packedValue: 0,
          syncStatus: 'synced',
          hasAmberDot: false
        };
      }
      const curLM = this.meetingState[lastWeekKey];
      const pendingLM = (this.pendingMeeting && this.pendingMeeting.get(lastWeekKey)) || null;

      const smallGroupLM = Boolean(curLM.smallGroup || sLastMeeting.smallGroup || sLastMeeting.group || (pendingLM && (pendingLM.smallGroup || pendingLM.group)));
      const prayerMeetingLM = Boolean(curLM.prayerMeeting || sLastMeeting.prayerMeeting || sLastMeeting.prayerMtg || (pendingLM && (pendingLM.prayerMeeting || pendingLM.prayerMtg)));
      const lordDayMeetingLM = Boolean(curLM.lordDayMeeting || sLastMeeting.lordDayMeeting || sLastMeeting.lordDay || (pendingLM && (pendingLM.lordDayMeeting || pendingLM.lordDay)));
      const outreachVisitLM = Boolean(curLM.outreachVisit || sLastMeeting.outreachVisit || sLastMeeting.outreach || sLastMeeting.blend || sLastMeeting.mutual || (pendingLM && (pendingLM.outreachVisit || pendingLM.outreach)));

      curLM.smallGroup = smallGroupLM;
      curLM.prayerMeeting = prayerMeetingLM;
      curLM.lordDayMeeting = lordDayMeetingLM;
      curLM.outreachVisit = outreachVisitLM;
      curLM.packedValue = packBase100(smallGroupLM, prayerMeetingLM, lordDayMeetingLM, outreachVisitLM);

      const isFullyConfirmedLM = (!curLM.smallGroup || sLastMeeting.smallGroup || sLastMeeting.group) &&
                                 (!curLM.prayerMeeting || sLastMeeting.prayerMeeting || sLastMeeting.prayerMtg) &&
                                 (!curLM.lordDayMeeting || sLastMeeting.lordDayMeeting || sLastMeeting.lordDay) &&
                                 (!curLM.outreachVisit || sLastMeeting.outreachVisit || sLastMeeting.outreach || sLastMeeting.blend || sLastMeeting.mutual);

      if (!pendingLM && (curLM.syncStatus !== 'error' || isFullyConfirmedLM)) {
        curLM.syncStatus = 'synced';
        curLM.hasAmberDot = false;
      }
      this.notify('MEETING', lastWeekKey, { ...curLM });
    }

    return { dailyState: this.dailyState, meetingState: this.meetingState };
  }
}

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OptimisticPracticeStore };
  }
  global.OptimisticPracticeStore = OptimisticPracticeStore;

})(typeof window !== 'undefined' ? window : global);
