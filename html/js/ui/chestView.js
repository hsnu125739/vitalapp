/**
 * chestView.js
 * 成就寶箱視圖深層模組 (Chest & Rewards View Deep Module)
 * 負責：八階成就寶藏收藏列表、寶箱詳情彈窗、一鍵領取獎勵與防止重複履約
 */

(function(global) {
  'use strict';

  const DEFAULT_CHESTS = [
    { tierId: 'tier_1', name: '信心寶箱', minPoints: 100, desc: '個人累積達到 100 點操練分', img: '../Chest_Assets/Chest_01.png' },
    { tierId: 'tier_2', name: '美德寶箱', minPoints: 300, desc: '個人累積達到 300 點操練分', img: '../Chest_Assets/Chest_02.png' },
    { tierId: 'tier_3', name: '知識寶箱', minPoints: 600, desc: '個人累積達到 600 點操練分', img: '../Chest_Assets/Chest_03.png' },
    { tierId: 'tier_4', name: '節制寶箱', minPoints: 1000, desc: '個人累積達到 1,000 點操練分', img: '../Chest_Assets/Chest_04.png' },
    { tierId: 'tier_5', name: '忍耐寶箱', minPoints: 1500, desc: '個人累積達到 1,500 點操練分', img: '../Chest_Assets/Chest_05.png' },
    { tierId: 'tier_6', name: '敬虔寶箱', minPoints: 2100, desc: '個人累積達到 2,100 點操練分', img: '../Chest_Assets/Chest_06.png' },
    { tierId: 'tier_7', name: '弟兄相愛寶箱', minPoints: 2800, desc: '個人累積達到 2,800 點操練分', img: '../Chest_Assets/Chest_07.png' },
    { tierId: 'tier_8', name: '愛之榮耀寶箱', minPoints: 3600, desc: '個人累積達到 3,600 點操練分', img: '../Chest_Assets/Chest_08.png' }
  ];

  function resolveChestImg(c, index) {
    if (c && c.img && typeof c.img === 'string' && (c.img.startsWith('http') || c.img.startsWith('data:') || c.img.includes('Chest_0'))) {
      return c.img;
    }
    const raw = String((c && (c.icon || c.tierId || c.tier || c.name || c.title)) || '');
    const match = raw.match(/\d+/);
    let num = (index % 8) + 1;
    if (match) {
      const parsed = parseInt(match[0], 10);
      if (!isNaN(parsed) && parsed >= 1) {
        num = ((parsed - 1) % 8) + 1;
      }
    }
    return `../Chest_Assets/Chest_0${num}.png`;
  }

  class ChestView {
    constructor({ apiClient, onChestClaimed }) {
      this.apiClient = apiClient;
      this.onChestClaimed = onChestClaimed;

      this.infoModal = document.getElementById('infoModal');
      this.infoModalTitle = document.getElementById('infoModalTitle');
      this.infoModalContent = document.getElementById('infoModalContent');

      this.detailModal = document.getElementById('chestDetailModal');
      this.detailImage = document.getElementById('chestDetailModalImage');
      this.detailName = document.getElementById('chestDetailModalName');
      this.detailText = document.getElementById('chestDetailModalText');
      this.detailStatus = document.getElementById('chestDetailModalStatus');
      this.claimBtn = document.getElementById('chestClaimRewardBtn');

      this.currentChestData = [];
      this.activeChest = null;
      this.currentUserProfile = null;

      this.initEvents_();
    }

    initEvents_() {
      // 關閉 Modal
      document.querySelectorAll('[data-close-modal="infoModal"]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (this.infoModal) this.infoModal.classList.add('hidden');
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
          const tierId = this.activeChest.tierId || this.activeChest.tier;
          const chestName = this.activeChest.name || this.activeChest.title || '寶箱';
          const resolvedPlayerId = (this.currentUserProfile && (this.currentUserProfile.playerId || this.currentUserProfile.id)) || this.apiClient.getPlayerIdFromToken();

          this.claimBtn.disabled = true;
          this.claimBtn.textContent = '領取中...';

          try {
            const res = await this.apiClient.claimChest(tierId, resolvedPlayerId);
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
          }
        });
      }
    }

    async openChestModal(userPoints = 0, claimedList = [], userProfile = null) {
      if (userProfile) this.currentUserProfile = userProfile;
      if (this.infoModalTitle) this.infoModalTitle.textContent = '成就寶藏收藏';
      if (this.infoModal) this.infoModal.classList.remove('hidden');

      if (this.infoModalContent) {
        this.infoModalContent.innerHTML = '<div style="text-align:center;padding:30px;color:#64748b;">讀取寶藏收藏中...</div>';
      }

      try {
        const res = await this.apiClient.getPlayerChestCollection();
        let rawChests = (res && res.data && res.data.chests) || (res && res.chests) || [];
        let chests = [];

        if (Array.isArray(rawChests) && rawChests.length > 0) {
          chests = rawChests.map((c, index) => {
            const tierId = c.tierId || c.tier || `tier_${index + 1}`;
            const name = c.name || c.title || `成就寶箱 ${index + 1}`;
            const minPoints = c.minPoints !== undefined ? c.minPoints : (c.pointsThreshold !== undefined ? c.pointsThreshold : (c.points || 0));
            const desc = c.desc || c.description || `個人累積達到 ${minPoints.toLocaleString()} 點操練分`;
            const img = resolveChestImg(c, index);
            const isClaimed = Boolean(c.isClaimed !== undefined ? c.isClaimed : c.claimed);
            const isUnlocked = Boolean(c.isUnlocked !== undefined ? c.isUnlocked : (c.unlocked !== undefined ? c.unlocked : (userPoints >= minPoints)));
            return {
              tierId,
              tier: tierId,
              name,
              title: name,
              minPoints,
              pointsThreshold: minPoints,
              desc,
              description: desc,
              img,
              icon: img,
              isClaimed,
              claimed: isClaimed,
              isUnlocked,
              unlocked: isUnlocked,
              statusText: isClaimed ? '已領取' : (isUnlocked ? '可領取' : '未達成')
            };
          });
        } else {
          // 本地計算預設階梯
          const claimedSet = new Set(claimedList || []);
          chests = DEFAULT_CHESTS.map((c, index) => {
            const isClaimed = claimedSet.has(c.tierId) || claimedSet.has(c.tier);
            const isUnlocked = userPoints >= c.minPoints;
            const img = resolveChestImg(c, index);
            return {
              ...c,
              tier: c.tierId,
              title: c.name,
              img,
              icon: img,
              isClaimed,
              claimed: isClaimed,
              isUnlocked,
              unlocked: isUnlocked,
              statusText: isClaimed ? '已領取' : (isUnlocked ? '可領取' : '未達成')
            };
          });
        }

        this.currentChestData = chests;
        this.renderChestGrid_();
      } catch (err) {
        if (this.infoModalContent) {
          this.infoModalContent.innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444;">讀取失敗：${err.message}</div>`;
        }
      }
    }

    renderChestGrid_() {
      if (!this.infoModalContent) return;

      const html = `
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:12px; padding:12px;">
          ${this.currentChestData.map((chest, index) => {
            const imgUrl = resolveChestImg(chest, index);
            const isClaimed = Boolean(chest.isClaimed);
            const isUnlocked = Boolean(chest.isUnlocked);
            const statusLabel = isClaimed ? '已領取' : (isUnlocked ? '可領取' : '待解鎖');
            const statusColor = isClaimed ? '#10b981' : (isUnlocked ? '#f59e0b' : '#94a3b8');

            return `
              <div class="chest-card-item" data-index="${index}" style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:12px; text-align:center; cursor:pointer; transition:transform 0.15s ease;">
                <img src="${imgUrl}" alt="${chest.name}" onerror="this.onerror=null; this.src='../Chest_Assets/Chest_01.png';" style="width:64px; height:64px; object-fit:contain; margin:0 auto; filter:${!isUnlocked ? 'grayscale(0.8) opacity(0.6)' : 'none'};">
                <div style="font-weight:700; font-size:13px; margin-top:8px; color:#1e293b;">${chest.name}</div>
                <div style="font-size:11px; font-weight:600; color:${statusColor}; margin-top:4px;">${statusLabel}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      this.infoModalContent.innerHTML = html;

      // 點擊事件
      this.infoModalContent.querySelectorAll('.chest-card-item').forEach(card => {
        card.addEventListener('click', () => {
          const idx = Number(card.getAttribute('data-index'));
          const chest = this.currentChestData[idx];
          if (chest) {
            this.openChestDetail(chest);
          }
        });
      });
    }

    openChestDetail(chest) {
      this.activeChest = chest;
      this.applyDetailModal_(chest);
      if (this.detailModal) this.detailModal.classList.remove('hidden');
    }

    applyDetailModal_(chest) {
      if (this.detailImage) {
        this.detailImage.onerror = () => {
          this.detailImage.onerror = null;
          this.detailImage.src = '../Chest_Assets/Chest_01.png';
        };
        this.detailImage.src = resolveChestImg(chest, 0);
      }
      if (this.detailName) this.detailName.textContent = chest.name;
      if (this.detailText) this.detailText.textContent = chest.desc || chest.description || `達到門檻即可領取專屬獎勵`;

      const isClaimed = Boolean(chest.isClaimed);
      const isUnlocked = Boolean(chest.isUnlocked);

      if (this.detailStatus) {
        this.detailStatus.textContent = isClaimed ? '已領取' : (isUnlocked ? '達成可領取' : '尚未達成解鎖門檻');
        this.detailStatus.style.color = isClaimed ? '#10b981' : (isUnlocked ? '#f59e0b' : '#94a3b8');
      }

      if (this.claimBtn) {
        if (isClaimed) {
          this.claimBtn.textContent = '已完成領取';
          this.claimBtn.disabled = true;
          this.claimBtn.style.opacity = '0.6';
        } else if (isUnlocked) {
          this.claimBtn.textContent = '立即領取獎勵';
          this.claimBtn.disabled = false;
          this.claimBtn.style.opacity = '1';
        } else {
          this.claimBtn.textContent = '未達解鎖門檻';
          this.claimBtn.disabled = true;
          this.claimBtn.style.opacity = '0.6';
        }
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ChestView };
  }
  global.ChestView = ChestView;

})(typeof window !== 'undefined' ? window : global);
