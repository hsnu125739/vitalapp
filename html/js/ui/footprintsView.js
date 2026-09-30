/**
 * footprintsView.js
 * 同行足跡視圖深層模組 (Footprints View Deep Module)
 * 負責：最近 30 天每日操練歷程、累計完成天數與每日各項操練明細彈窗
 */

(function(global) {
  'use strict';

  class FootprintsView {
    constructor({ apiClient }) {
      this.apiClient = apiClient;

      this.infoModal = document.getElementById('infoModal');
      this.infoModalTitle = document.getElementById('infoModalTitle');
      this.infoModalContent = document.getElementById('infoModalContent');
    }

    async openFootprintsModal() {
      if (this.infoModalTitle) this.infoModalTitle.textContent = '30 天同行足跡歷程';
      if (this.infoModal) this.infoModal.classList.remove('hidden');

      if (this.infoModalContent) {
        this.infoModalContent.innerHTML = '<div style="text-align:center;padding:30px;color:#64748b;">讀取足跡中...</div>';
      }

      try {
        const res = await this.apiClient.getFootprints();
        if (res && res.success && res.data) {
          this.renderFootprints_(res.data);
        } else {
          if (this.infoModalContent) {
            this.infoModalContent.innerHTML = '<div style="text-align:center;padding:30px;color:#ef4444;">讀取足跡紀錄失敗</div>';
          }
        }
      } catch (err) {
        console.warn('[FootprintsView] 讀取同行足跡失敗', err);
        if (this.infoModalContent) {
          this.infoModalContent.innerHTML = '<div style="text-align:center;padding:30px;color:#ef4444;">連線異常，請稍後再試</div>';
        }
      }
    }

    renderFootprints_(data) {
      if (!this.infoModalContent) return;

      const totalDays = data.totalDaysWithRecord || 0;
      const details = data.dailyDetails || [];

      const html = `
        <div style="padding: 12px;">
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; margin-bottom: 16px; text-align: center;">
            <div style="font-size: 13px; color: #166534;">最近 30 天內完成操練天數</div>
            <div style="font-size: 28px; font-weight: 700; color: #15803d; margin-top: 4px;">${totalDays} <span style="font-size: 14px;">天</span></div>
          </div>

          <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px; color: #1e293b;">操練日誌</div>

          ${details.length === 0 ? `
            <div style="text-align: center; color: #94a3b8; padding: 20px; font-size: 13px;">
              過去 30 天尚無操練紀錄，從今天開始同奔賽程吧！
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 8px; max-height: 350px; overflow-y: auto;">
              ${details.map(d => `
                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center;">
                  <div>
                    <div style="font-weight: 600; font-size: 13px; color: #1e293b;">${d.date}</div>
                    <div style="display: flex; gap: 4px; margin-top: 4px;">
                      ${(d.completedPractices || []).map(p => `
                        <span style="background: #e0f2fe; color: #0369a1; font-size: 11px; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${p}</span>
                      `).join('')}
                    </div>
                  </div>
                  <div style="font-weight: 700; color: #0284c7; font-size: 14px;">+${d.points} 分</div>
                </div>
              `).join('')}
            </div>
          `}
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
