/**
 * footprintsView.js
 * 同行足跡視圖深層模組 (Footprints View Deep Module)
 * 負責：最近 30 天個人操練足跡、項目明細與每日加分統計
 */

(function(global) {
  'use strict';

  class FootprintsView {
    constructor({ apiClient, onChestClaimed = null }) {
      this.apiClient = apiClient;
      this.onChestClaimed = onChestClaimed;

      this.infoModal = document.getElementById('infoModal');
      this.infoModalTitle = document.getElementById('infoModalTitle');
      this.infoModalContent = document.getElementById('infoModalContent');
    }

    async openFootprintsModal() {
      if (this.infoModalTitle) this.infoModalTitle.textContent = '👣 個人同行足跡（近 30 天）';
      if (this.infoModal) this.infoModal.classList.remove('hidden');

      if (this.infoModalContent) {
        this.infoModalContent.innerHTML = '<div style="text-align:center;padding:30px;color:#64748b;">讀取操練足跡中...</div>';
      }

      try {
        const res = await this.apiClient.getFootprints();
        const data = (res && res.data) || res || {};
        const list = Array.isArray(data) ? data : (data.dailyDetails || data.footprints || []);

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

            const points = item.points || item.pointsEarned || 0;

            return `
              <div style="border-bottom: 1px solid #e2e8f0; padding: 12px 6px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 700; font-size: 14px; color: #1e293b;">${item.date}</div>
                  <div style="font-size: 12px; color: #64748b; margin-top: 4px; display: flex; gap: 6px; flex-wrap: wrap;">
                    ${badges.map(b => `<span style="background:#f1f5f9; padding:2px 6px; border-radius:4px;">${b}</span>`).join('') || '<span style="color:#94a3b8;">無操練項目</span>'}
                  </div>
                </div>
                <div style="font-weight: 700; color: #0284c7; font-size: 15px; white-space: nowrap; margin-left: 12px;">
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
