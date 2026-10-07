/**
 * avatarManager.js
 * 活力人頭像前瞻快取與環形隨機池管理模組 (Avatar Prefetch & Ring Buffer Manager)
 * 
 * 核心機制：
 * 1. 進站初始化：產生長度為 10 的環形隨機數池 [a1, ..., a10] (範圍 1~80)，相鄰不重複，背景預載對應弟兄/姊妹共 20 張頭像。
 * 2. 打開面板：註冊預設顯示 a1，設定預設顯示使用者頭像；啟動滑動視窗預載 (x-2, x-1, x+1, x+2)。
 * 3. 上下步進：滑動視窗連續平移並預載前後各 2 個。
 * 4. 點選隨機：自陣列 arr[rand_cnt % 10] 取出並秒開，背景生成新隨機數 R 替換該位置 (R 不等於前後鄰居與當前值)，並預載 R 之頭像。
 */

(function(global) {
  'use strict';

  const TOTAL_AVATARS = 80;
  const POOL_SIZE = 10;

  class AvatarManager {
    constructor(options = {}) {
      this.total = Number(options.total) || TOTAL_AVATARS;
      this.poolSize = Number(options.poolSize) || POOL_SIZE;
      this.pool = [];
      this.randCnt = 10; // 預設 idx=10 起步，避免負數索引問題
      this.prefetchedSet = new Set();
      this.initPool();
    }

    /**
     * 環形循環計算號碼 (1 ~ 80)
     */
    wrapNo(no, delta = 0) {
      const n = Number(no) || 1;
      return (((n - 1 + delta) % this.total + this.total) % this.total) + 1;
    }

    /**
     * 產生單個隨機號碼 (1 ~ 80)，可傳入排除清單
     */
    getRandomNo(exclude = []) {
      const excludeSet = new Set(exclude.map(Number));
      let candidate;
      let guard = 0;
      do {
        candidate = Math.floor(Math.random() * this.total) + 1;
        guard++;
      } while (excludeSet.has(candidate) && guard < 100);
      return candidate;
    }

    /**
     * 進站初始化：產生長度為 10 的環形隨機數陣列，且相鄰兩個不重複
     */
    initPool() {
      this.pool = [];
      for (let i = 0; i < this.poolSize; i++) {
        const exclude = [];
        if (i > 0) exclude.push(this.pool[i - 1]);
        if (i === this.poolSize - 1 && this.pool.length > 0) exclude.push(this.pool[0]);
        this.pool.push(this.getRandomNo(exclude));
      }
      this.randCnt = 10;
      this.prefetchPool();
    }

    /**
     * 預載單一號碼之弟兄與姊妹頭像
     */
    prefetchNo(no) {
      const n = Number(no);
      if (!n || n < 1 || n > this.total || this.prefetchedSet.has(n)) return;
      this.prefetchedSet.add(n);

      if (typeof window === 'undefined' || typeof Image === 'undefined') return;

      const padNo = String(n).padStart(3, '0');
      const folders = ['avatar-male', 'avatar-female'];
      folders.forEach(folder => {
        try {
          const img = new Image();
          img.src = `../${folder}/${folder}-direct-${padNo}.png`;
        } catch (e) {}
      });
    }

    /**
     * 預載整個隨機池中的 10 組弟兄姊妹頭像 (共 20 張)
     */
    prefetchPool() {
      if (!Array.isArray(this.pool)) return;
      this.pool.forEach(no => this.prefetchNo(no));
    }

    /**
     * 滑動視窗：預載目前顯示頭像前後各 2 個 (x-2, x-1, x+1, x+2)
     */
    prefetchSurroundings(currentNo) {
      if (!currentNo) return;
      const targets = [
        this.wrapNo(currentNo, -2),
        this.wrapNo(currentNo, -1),
        this.wrapNo(currentNo, 1),
        this.wrapNo(currentNo, 2)
      ];
      targets.forEach(no => this.prefetchNo(no));
    }

    /**
     * 註冊面板開啟時的預設顯示號碼 (a1 即 pool[0])
     */
    getInitialRegisterNo() {
      if (!this.pool || this.pool.length === 0) {
        this.initPool();
      }
      return this.pool[0];
    }

    /**
     * 上一個 / 下一個步進切換
     * @param {number} currentNo 目前號碼
     * @param {number} delta 步進量 (-1 或 +1)
     * @returns {number} 計算後的新號碼
     */
    step(currentNo, delta) {
      const nextNo = this.wrapNo(currentNo, delta);
      this.prefetchSurroundings(nextNo);
      return nextNo;
    }

    /**
     * 點選【隨機】的核心運算：
     * 1. 採用 arr[rand_cnt % 10] 作為輸出顯示
     * 2. 背景產生新隨機數 R 取代該位置，且不可與 (rand_cnt-1)%10, (rand_cnt+1)%10 相同
     * 3. 預先抓取 R 對應的頭像
     * 4. rand_cnt++
     * @returns {number} 隨機選中的頭像號碼
     */
    nextRandom() {
      if (!this.pool || this.pool.length === 0) {
        this.initPool();
      }

      const idx = this.randCnt % this.poolSize;
      const chosenNo = this.pool[idx];

      // 取得前後鄰居索引
      const prevIdx = (idx - 1 + this.poolSize) % this.poolSize;
      const nextIdx = (idx + 1) % this.poolSize;
      const exclude = [this.pool[prevIdx], this.pool[nextIdx], chosenNo];

      // 產生新隨機數 R 替換該位置
      const newNo = this.getRandomNo(exclude);
      this.pool[idx] = newNo;

      // 背景預先載入 R 與選中項前後鄰居
      this.prefetchNo(newNo);
      this.prefetchSurroundings(chosenNo);

      this.randCnt++;
      return chosenNo;
    }
  }

  const defaultAvatarManager = new AvatarManager();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      AvatarManager,
      defaultAvatarManager
    };
  }

  global.AvatarManager = AvatarManager;
  global.avatarManager = defaultAvatarManager;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
