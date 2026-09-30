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
    this.pendingDaily = new Map();   // key: date, value: latest payload
    this.pendingMeeting = new Map(); // key: weekKey, value: latest payload

    // 冷啟動離線狀態水合
    this.hydrateFromOfflineQueue();

    // 監聽網路連線恢復
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('online', () => this.replayOfflineQueue());
    }

    // 冷啟動自動補發
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
    current.packedValue = ((current.book ? 1 : 0) * 1000000) +
                          ((current.prayer ? 1 : 0) * 10000) +
                          ((current.bible ? 1 : 0) * 100) +
                          (current.morning ? 1 : 0);

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
        this.notify('DAILY', date, { ...currentState });
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

    current.packedValue = ((current.outreachVisit ? 1 : 0) * 1000000) +
                          ((current.lordDayMeeting ? 1 : 0) * 10000) +
                          ((current.prayerMeeting ? 1 : 0) * 100) +
                          (current.smallGroup ? 1 : 0);

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
        this.notify('MEETING', weekKey, { ...currentState });
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
      if (item.type === 'DAILY' && item.key) {
        if (!this.dailyState[item.key]) {
          const p = item.payload || {};
          let packed = Number(p.packedValue);
          let morning = false;
          let bible = false;
          let prayer = false;
          let book = false;
          if (!isNaN(packed) && packed > 0) {
            book = Math.floor(packed / 1000000) % 100 > 0;
            prayer = Math.floor(packed / 10000) % 100 > 0;
            bible = Math.floor(packed / 100) % 100 > 0;
            morning = packed % 100 > 0;
          } else {
            morning = Boolean(p.morning || p.morningRevival);
            bible = Boolean(p.bible || p.bibleReading);
            prayer = Boolean(p.prayer);
            book = Boolean(p.book || p.bookPursuit);
            packed = ((book ? 1 : 0) * 1000000) + ((prayer ? 1 : 0) * 10000) + ((bible ? 1 : 0) * 100) + (morning ? 1 : 0);
          }
          this.dailyState[item.key] = {
            morning,
            morningRevival: morning,
            bible,
            bibleReading: bible,
            prayer,
            book,
            bookPursuit: book,
            packedValue: packed,
            syncStatus: 'error',
            hasAmberDot: true
          };
        }
      } else if (item.type === 'MEETING' && item.key) {
        if (!this.meetingState[item.key]) {
          const p = item.payload || {};
          let packed = Number(p.packedValue);
          let smallGroup = false;
          let prayerMeeting = false;
          let lordDayMeeting = false;
          let outreachVisit = false;
          if (!isNaN(packed) && packed > 0) {
            outreachVisit = Math.floor(packed / 1000000) % 100 > 0;
            lordDayMeeting = Math.floor(packed / 10000) % 100 > 0;
            prayerMeeting = Math.floor(packed / 100) % 100 > 0;
            smallGroup = packed % 100 > 0;
          } else {
            smallGroup = Boolean(p.smallGroup || p.group);
            prayerMeeting = Boolean(p.prayerMeeting || p.prayerMtg);
            lordDayMeeting = Boolean(p.lordDayMeeting || p.lordDay);
            outreachVisit = Boolean(p.outreachVisit || p.outreach);
            packed = ((outreachVisit ? 1 : 0) * 1000000) + ((lordDayMeeting ? 1 : 0) * 10000) + ((prayerMeeting ? 1 : 0) * 100) + (smallGroup ? 1 : 0);
          }
          this.meetingState[item.key] = {
            smallGroup,
            prayerMeeting,
            lordDayMeeting,
            outreachVisit,
            packedValue: packed,
            syncStatus: 'error',
            hasAmberDot: true
          };
        }
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

    const remaining = [];
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
    for (const res of results) {
      if (res.status === 'fulfilled') {
        if (!res.value.success) remaining.push(res.value.item);
      } else {
        // Fallback (won't happen because we catch)
      }
    }

    if (remaining.length > 0) {
      this.storage.setItem('vital_offline_queue', JSON.stringify(remaining));
    } else {
      this.storage.removeItem('vital_offline_queue');
    }
  }
}

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { OptimisticPracticeStore };
  }
  global.OptimisticPracticeStore = OptimisticPracticeStore;

})(typeof window !== 'undefined' ? window : global);
