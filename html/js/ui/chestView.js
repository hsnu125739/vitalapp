/**
 * chestView.js
 * 成就寶箱與進度領取視圖模組 (Chest View Module)
 * 負責：成長篇章成就寶箱列表展示、各級寶箱詳情彈窗與即時領取獎勵
 */

(function(global) {
  'use strict';

  class ChestView {
    constructor({ apiClient, onChestClaimed }) {
      this.apiClient = apiClient;
      this.onChestClaimed = onChestClaimed;

      this.chestsModal = document.getElementById('chestsModal');
      this.chestsGrid = document.getElementById('chestsGrid');
      this.detailModal = document.getElementById('chestDetailModal');

      this.detailIcon = document.getElementById('chestDetailIcon');
      this.detailTitle = document.getElementById('chestDetailTitle');
      this.detailDesc = document.getElementById('chestDetailDesc');
      this.detailPoints = document.getElementById('chestDetailPoints');
      this.claimBtn = document.getElementById('claimChestRewardBtn');

      this.activeChest = null;
      this.currentUserProfile = null;

      this.initEvents_();
    }

    initEvents_() {
      // 點擊開啟寶箱總覽 Modal 按鈕
      const openChestsBtns = [
        document.getElementById('openChestsModalBtn'),
        document.getElementById('homeChestsBtn')
      ];

      openChestsBtns.forEach(btn => {
        if (btn) {
          btn.addEventListener('click', () => this.openChestsModal());
        }
      });

      // 關閉 Modal 按鈕
      document.querySelectorAll('[data-close-modal="chestsModal"]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (this.chestsModal) this.chestsModal.classList.add('hidden');
        });
      });

      document.querySelectorAll('[data-close-modal="chestDetailModal"]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (this.detailModal) this.detailModal.classList.add('hidden');
        });
      });

      // 領取獎勵
      if (this.claimBtn) {
        this.claimBtn.addEventListener('click', async () => {
          if (!this.activeChest) return;
          const tierId = this.activeChest.tierId;
          const chestName = this.activeChest.name || '寶箱';

          this.claimBtn.disabled = true;
          this.claimBtn.textContent = '領取中...';

          try {
            const res = await this.apiClient.claimChest(tierId);
            if (res && res.success) {
              alert(`恭喜！成功領取【${chestName}】！`);
              this.activeChest.isClaimed = true;
              this.applyDetailModal_(this.activeChest);
              if (this.detailModal) this.detailModal.classList.add('hidden');
              if (typeof this.onChestClaimed === 'function') {
                this.onChestClaimed();
              }
              // 重新渲染清單
              this.renderChestGrid_();
            } else {
              alert((res && (res.error || res.message)) || '領取失敗');
            }
          } catch (err) {
            alert(err.message || '連線逾時，請稍後再試');
          } finally {
            this.claimBtn.disabled = false;
            this.claimBtn.textContent = '立即領取';
          }
        });
      }
    }

    async openChestsModal(userProfile = null) {
      if (userProfile) this.currentUserProfile = userProfile;
      if (this.chestsModal) this.chestsModal.classList.remove('hidden');

      if (this.chestsGrid) {
        this.chestsGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:24px;color:#64748b;">讀取寶箱進度中...</div>';
      }

      try {
        const res = await this.apiClient.getPlayerChestCollection();
        if (res && res.success) {
          const chests = res.chests || (res.data && res.data.chests) || [];
          this.chestsList = chests;
          this.renderChestGrid_();
        } else {
          if (this.chestsGrid) {
            this.chestsGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:24px;color:#ef4444;">${(res && res.error) || '讀取寶箱失敗'}</div>`;
          }
        }
      } catch (err) {
        if (this.chestsGrid) {
          this.chestsGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:24px;color:#ef4444;">連線異常：${err.message}</div>`;
        }
      }
    }

    renderChestGrid_() {
      if (!this.chestsGrid) return;
      if (!this.chestsList || this.chestsList.length === 0) {
        this.chestsGrid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:24px;color:#64748b;">目前無可用成就寶箱</div>';
        return;
      }

      this.chestsGrid.innerHTML = this.chestsList.map((chest, index) => {
        const isUnlocked = Boolean(chest.isUnlocked || chest.unlocked);
        const isClaimed = Boolean(chest.isClaimed || chest.claimed);
        const icon = chest.iconUrl || chest.icon || `../UI/chest-tier-${(index % 6) + 1}.png`;
        const name = chest.name || chest.title || `階段寶箱 ${index + 1}`;
        const pts = chest.requiredPoints || chest.pointsThreshold || 0;

        let statusClass = 'locked';
        let statusBadge = '<span style="font-size:11px;color:#94a3b8;background:#f1f5f9;padding:2px 8px;border-radius:12px;">未解鎖</span>';

        if (isClaimed) {
          statusClass = 'claimed';
          statusBadge = '<span style="font-size:11px;color:#16a34a;background:#dcfce7;padding:2px 8px;border-radius:12px;font-weight:600;">已領取</span>';
        } else if (isUnlocked) {
          statusClass = 'unlocked';
          statusBadge = '<span style="font-size:11px;color:#ea580c;background:#ffedd5;padding:2px 8px;border-radius:12px;font-weight:700;animation:pulse 2s infinite;">可領取！</span>';
        }

        return `
          <div class="chest-card ${statusClass}" data-chest-index="${index}" style="background:#fff;border:2px solid ${isUnlocked && !isClaimed ? '#f97316' : '#e2e8f0'};border-radius:14px;padding:12px;text-align:center;cursor:pointer;position:relative;transition:transform 0.15s ease;">
            <div style="width:52px;height:52px;margin:0 auto 8px auto;display:flex;align-items:center;justify-content:center;">
              <img src="${icon}" alt="${name}" style="max-width:100%;max-height:100%;object-fit:contain;filter:${!isUnlocked ? 'grayscale(100%) opacity(0.6)' : 'none'};">
            </div>
            <div style="font-size:13px;font-weight:700;color:#1e293b;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${name}</div>
            <div style="font-size:11px;color:#64748b;margin-bottom:8px;">${pts.toLocaleString()} 操練分</div>
            <div>${statusBadge}</div>
          </div>
        `;
      }).join('');

      this.chestsGrid.querySelectorAll('.chest-card').forEach(card => {
        card.addEventListener('click', () => {
          const idx = Number(card.getAttribute('data-chest-index'));
          const selected = this.chestsList[idx];
          if (selected) this.openDetailModal(selected);
        });
      });
    }

    openDetailModal(chest) {
      this.activeChest = chest;
      this.applyDetailModal_(chest);
      if (this.detailModal) this.detailModal.classList.remove('hidden');
    }

    applyDetailModal_(chest) {
      const isUnlocked = Boolean(chest.isUnlocked || chest.unlocked);
      const isClaimed = Boolean(chest.isClaimed || chest.claimed);
      const icon = chest.iconUrl || chest.icon || '../UI/app-icon.png';
      const name = chest.name || chest.title || '成就寶箱';
      const pts = chest.requiredPoints || chest.pointsThreshold || 0;
      const desc = chest.description || chest.rewardDescription || '達成個人與同伴共同操練點數門檻即可解鎖豐富獎勵！';

      if (this.detailIcon) this.detailIcon.src = icon;
      if (this.detailTitle) this.detailTitle.textContent = name;
      if (this.detailDesc) this.detailDesc.textContent = desc;
      if (this.detailPoints) this.detailPoints.textContent = `解鎖條件：累計 ${pts.toLocaleString()} 點`;

      if (this.claimBtn) {
        if (isClaimed) {
          this.claimBtn.disabled = true;
          this.claimBtn.textContent = '已領取獎勵';
          this.claimBtn.style.background = '#94a3b8';
        } else if (isUnlocked) {
          this.claimBtn.disabled = false;
          this.claimBtn.textContent = '立即領取獎勵';
          this.claimBtn.style.background = '#ea580c';
        } else {
          this.claimBtn.disabled = true;
          this.claimBtn.textContent = '未達解鎖門檻';
          this.claimBtn.style.background = '#cbd5e1';
        }
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ChestView };
  }
  global.ChestView = ChestView;

})(typeof window !== 'undefined' ? window : global);
