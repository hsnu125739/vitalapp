/**
 * chestView.js
 * 成就寶箱視圖深層模組 (Chest & Rewards View Deep Module)
 * 負責：八階成就寶藏收藏列表、寶箱詳情彈窗、一鍵領取獎勵與防止重複履約
 */

(function(global) {
  'use strict';

  const DEFAULT_CHESTS = [
    { tierId: 'tier_1', name: '信心寶箱', minPoints: 100, desc: '個人累積達到 100 點操練分', img: '../Chest_Assets/Chest_01.webp' },
    { tierId: 'tier_2', name: '美德寶箱', minPoints: 300, desc: '個人累積達到 300 點操練分', img: '../Chest_Assets/Chest_02.webp' },
    { tierId: 'tier_3', name: '知識寶箱', minPoints: 600, desc: '個人累積達到 600 點操練分', img: '../Chest_Assets/Chest_03.webp' },
    { tierId: 'tier_4', name: '節制寶箱', minPoints: 1000, desc: '個人累積達到 1,000 點操練分', img: '../Chest_Assets/Chest_04.webp' },
    { tierId: 'tier_5', name: '忍耐寶箱', minPoints: 1500, desc: '個人累積達到 1,500 點操練分', img: '../Chest_Assets/Chest_05.webp' },
    { tierId: 'tier_6', name: '敬虔寶箱', minPoints: 2100, desc: '個人累積達到 2,100 點操練分', img: '../Chest_Assets/Chest_06.webp' },
    { tierId: 'tier_7', name: '弟兄相愛寶箱', minPoints: 2800, desc: '個人累積達到 2,800 點操練分', img: '../Chest_Assets/Chest_07.webp' },
    { tierId: 'tier_8', name: '愛之榮耀寶箱', minPoints: 3600, desc: '個人累積達到 3,600 點操練分', img: '../Chest_Assets/Chest_08.webp' }
  ];

  const PRELOADED_CHEST_IMAGES = [];

  function preloadChestAssets() {
    if (typeof window === 'undefined' || typeof Image === 'undefined') return;
    for (let i = 1; i <= 8; i++) {
      const num = String(i).padStart(2, '0');
      // Preload WebP first
      const imgWebp = new Image();
      imgWebp.src = `../Chest_Assets/Chest_${num}.webp`;
      PRELOADED_CHEST_IMAGES.push(imgWebp);

      // Preload PNG fallback
      const imgPng = new Image();
      imgPng.src = `../Chest_Assets/Chest_${num}.png`;
      PRELOADED_CHEST_IMAGES.push(imgPng);
    }
  }

  // Preload in background when idle
  if (typeof window !== 'undefined') {
    const schedulePreload = () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(preloadChestAssets, { timeout: 1500 });
      } else {
        setTimeout(preloadChestAssets, 200);
      }
    };

    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', schedulePreload);
    } else {
      schedulePreload();
    }
  }

  function resolveChestImg(c, index, format = 'webp') {
    const ext = format === 'png' ? 'png' : 'webp';
    if (c && c.img && typeof c.img === 'string') {
      if (c.img.startsWith('http') || c.img.startsWith('data:')) {
        return c.img;
      }
      if (c.img.includes('Chest_0')) {
        return c.img.replace(/\.(png|webp)$/i, `.${ext}`);
      }
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
    return `../Chest_Assets/Chest_0${num}.${ext}`;
  }

  class ChestView {
    constructor({ apiClient }) {
      this.apiClient = apiClient;

      this.infoModal = document.getElementById('infoModal');
      this.infoModalTitle = document.getElementById('infoModalTitle');
      this.infoModalContent = document.getElementById('infoModalContent');

      this.detailModal = document.getElementById('chestDetailModal');
      this.detailImage = document.getElementById('chestDetailModalImage');
      this.detailName = document.getElementById('chestDetailModalName');
      this.detailText = document.getElementById('chestDetailModalText');
      this.detailStatus = document.getElementById('chestDetailModalStatus');

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
    }

    openChestModal(userPoints = 0, selectedIdx = null, passedMilestones = null) {
      if (this.infoModalTitle) this.infoModalTitle.textContent = '成就寶藏收藏';
      if (this.infoModal) this.infoModal.classList.remove('hidden');

      let milestones = passedMilestones;
      if (!milestones && typeof localStorage !== 'undefined') {
        try {
          milestones = JSON.parse(localStorage.getItem('vital_player_milestones') || '[]');
        } catch (e) {
          milestones = [];
        }
      }
      if (!Array.isArray(milestones)) milestones = [];

      const claimedSet = new Set(
        milestones
          .filter(m => m && (m.id || m.tierId))
          .map(m => m.id || m.tierId)
      );

      this.currentChestData = DEFAULT_CHESTS.map((c, index) => {
        const isClaimed = claimedSet.has(c.tierId) || claimedSet.has(`CHEST_${c.tierId}`) || claimedSet.has(`T${index + 1}`) || claimedSet.has(`CHEST_T${index + 1}`);
        const isUnlocked = isClaimed || userPoints >= c.minPoints;
        const img = resolveChestImg(c, index, 'webp');
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
          statusText: isClaimed ? '已獲得' : (isUnlocked ? '達標待結算' : '未達門檻')
        };
      });

      this.renderChestGrid_();

      if (selectedIdx !== null && selectedIdx !== undefined && this.currentChestData[selectedIdx]) {
        this.openChestDetail(this.currentChestData[selectedIdx]);
      }
    }

    renderChestGrid_() {
      if (!this.infoModalContent) return;

      const html = `
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:12px; padding:12px;">
          ${this.currentChestData.map((chest, index) => {
            const webpUrl = resolveChestImg(chest, index, 'webp');
            const pngUrl = resolveChestImg(chest, index, 'png');
            const isClaimed = Boolean(chest.isClaimed);
            const isUnlocked = Boolean(chest.isUnlocked);
            const statusLabel = isClaimed ? '已獲得' : (isUnlocked ? '達標待結算' : '待解鎖');
            const statusColor = isClaimed ? '#10b981' : (isUnlocked ? '#f59e0b' : '#94a3b8');

            return `
              <div class="chest-card-item" data-index="${index}" style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:12px; text-align:center; cursor:pointer; transition:transform 0.15s ease;">
                <picture>
                  <source srcset="${webpUrl}" type="image/webp">
                  <img src="${pngUrl}" alt="${chest.name}" loading="eager" decoding="async" onerror="this.onerror=null; this.src='${pngUrl}';" style="width:64px; height:64px; object-fit:contain; margin:0 auto; display:block; filter:${!isUnlocked ? 'grayscale(0.8) opacity(0.6)' : 'none'};">
                </picture>
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
        const webpUrl = resolveChestImg(chest, 0, 'webp');
        const pngUrl = resolveChestImg(chest, 0, 'png');
        this.detailImage.onerror = () => {
          this.detailImage.onerror = null;
          this.detailImage.src = pngUrl;
        };
        this.detailImage.src = webpUrl;
      }
      if (this.detailName) this.detailName.textContent = chest.name;
      if (this.detailText) this.detailText.textContent = chest.desc || chest.description || `達到門檻即可自動解鎖入庫`;

      const isClaimed = Boolean(chest.isClaimed);
      const isUnlocked = Boolean(chest.isUnlocked);

      if (this.detailStatus) {
        this.detailStatus.textContent = isClaimed ? '✅ 已解鎖入庫' : (isUnlocked ? '⏳ 已達標，每日結算後自動發放' : `🔒 尚未達成解鎖門檻（需 ${chest.minPoints.toLocaleString()} 分）`);
        this.detailStatus.style.color = isClaimed ? '#10b981' : (isUnlocked ? '#f59e0b' : '#94a3b8');
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ChestView, resolveChestImg, preloadChestAssets };
  }
  global.ChestView = ChestView;

})(typeof window !== 'undefined' ? window : global);
