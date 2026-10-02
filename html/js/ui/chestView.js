/**
 * chestView.js
 * 成就寶箱視圖深層模組 (Chest & Achievement View Deep Module)
 * 負責：動態個人成就列表渲染、成就詳情彈窗、隱藏成就防爆雷、達成狀態比對與資產快取容錯
 */

(function(global) {
  'use strict';

  const DEFAULT_ACHIEVEMENTS = [
    { achievementId: 'tier_1', order: 1, status: 'ACTIVE', name: '信心寶箱', subtitle: '信是所望之事的質實', description: '個人累積達到 100 點操練分', rewardDesc: '解鎖信心階梯徽章', pictureKey: 'Chest_01.webp', minPoints: 100, isHidden: false },
    { achievementId: 'tier_2', order: 2, status: 'ACTIVE', name: '美德寶箱', subtitle: '在信上充足的供應美德', description: '個人累積達到 300 點操練分', rewardDesc: '解鎖美德階梯徽章', pictureKey: 'Chest_02.webp', minPoints: 300, isHidden: false },
    { achievementId: 'tier_3', order: 3, status: 'ACTIVE', name: '知識寶箱', subtitle: '在美德上供應知識', description: '個人累積達到 600 點操練分', rewardDesc: '解鎖知識階梯徽章', pictureKey: 'Chest_03.webp', minPoints: 600, isHidden: false },
    { achievementId: 'tier_4', order: 4, status: 'ACTIVE', name: '節制寶箱', subtitle: '在知識上供應節制', description: '個人累積達到 1,000 點操練分', rewardDesc: '解鎖節制階梯徽章', pictureKey: 'Chest_04.webp', minPoints: 1000, isHidden: false },
    { achievementId: 'tier_5', order: 5, status: 'ACTIVE', name: '忍耐寶箱', subtitle: '在節制上供應忍耐', description: '個人累積達到 1,500 點操練分', rewardDesc: '解鎖忍耐階梯徽章', pictureKey: 'Chest_05.webp', minPoints: 1500, isHidden: false },
    { achievementId: 'tier_6', order: 6, status: 'ACTIVE', name: '敬虔寶箱', subtitle: '在忍耐上供應敬虔', description: '個人累積達到 2,100 點操練分', rewardDesc: '解鎖敬虔階梯徽章', pictureKey: 'Chest_06.webp', minPoints: 2100, isHidden: false },
    { achievementId: 'tier_7', order: 7, status: 'ACTIVE', name: '弟兄相愛寶箱', subtitle: '在敬虔上供應弟兄相愛', description: '個人累積達到 2,800 點操練分', rewardDesc: '解鎖弟兄相愛階梯徽章', pictureKey: 'Chest_07.webp', minPoints: 2800, isHidden: false },
    { achievementId: 'tier_8', order: 8, status: 'ACTIVE', name: '愛之榮耀寶箱', subtitle: '在弟兄相愛上供應愛', description: '個人累積達到 3,600 點操練分', rewardDesc: '解鎖愛之榮耀徽章', pictureKey: 'Chest_08.webp', minPoints: 3600, isHidden: false }
  ];

  // 向後相容既有參照
  const DEFAULT_CHESTS = DEFAULT_ACHIEVEMENTS.map(a => ({
    ...a,
    tierId: a.achievementId,
    desc: a.description,
    img: `../Chest_Assets/${a.pictureKey}`
  }));

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

  // 瀏覽器閒置時預載入資產
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
    if (c) {
      const p = c.pictureKey || c.img;
      if (p && typeof p === 'string') {
        const trimmed = p.trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
          return trimmed;
        }
        if (trimmed.startsWith('../')) {
          return trimmed.replace(/\.(png|webp)$/i, `.${ext}`);
        }
        if (trimmed.startsWith('Chest_')) {
          return `../Chest_Assets/${trimmed}`.replace(/\.(png|webp)$/i, `.${ext}`);
        }
        if (trimmed.startsWith('Chapter_')) {
          const matched = trimmed.replace(/^Chapter_/, 'Chest_');
          return `../Chest_Assets/${matched}`.replace(/\.(png|webp)$/i, `.${ext}`);
        }
        if (trimmed.startsWith('Cute_Icon_')) {
          return `../Cute_Icons/${trimmed}`;
        }
        return `../Chest_Assets/${trimmed}`.replace(/\.(png|webp)$/i, `.${ext}`);
      }
    }
    const raw = String((c && (c.icon || c.tierId || c.achievementId || c.tier || c.name || c.title)) || '');
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

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
      this.detailSubtitle = document.getElementById('chestDetailModalSubtitle');
      this.detailText = document.getElementById('chestDetailModalText');
      this.detailReward = document.getElementById('chestDetailModalReward');
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

    openChestModal(userPoints = 0, selectedIdx = null, passedMilestones = null, passedAchievements = null) {
      if (this.infoModalTitle) this.infoModalTitle.textContent = '個人成就收藏';
      if (this.infoModal) this.infoModal.classList.remove('hidden');

      // 1. 取得玩家里程碑成就紀錄
      let milestones = passedMilestones;
      if (!milestones && typeof localStorage !== 'undefined') {
        try {
          const pStr = localStorage.getItem('vital_current_player');
          const p = pStr ? JSON.parse(pStr) : null;
          if (p && p.playerId) {
            milestones = JSON.parse(localStorage.getItem(`vital_player_milestones_${p.playerId}`) || '[]');
          }
        } catch (e) {}
        if (!milestones) {
          try {
            milestones = JSON.parse(localStorage.getItem('vital_player_milestones') || '[]');
          } catch (e) {
            milestones = [];
          }
        }
      }
      if (!Array.isArray(milestones)) milestones = [];

      const claimedSet = new Set(
        milestones
          .filter(m => m && (m.id || m.tierId || m.achievementId))
          .map(m => String(m.id || m.tierId || m.achievementId).trim())
      );

      // 2. 取得成就設定清單（優先傳入 > 快取 > 預設）
      let rawList = passedAchievements;
      if (!Array.isArray(rawList) || rawList.length === 0) {
        if (typeof localStorage !== 'undefined') {
          try {
            const stored = localStorage.getItem('vital_achievements_config');
            if (stored) rawList = JSON.parse(stored);
          } catch (e) {}
        }
      }
      if (!Array.isArray(rawList) || rawList.length === 0) {
        rawList = DEFAULT_ACHIEVEMENTS;
      }

      // 3. 過濾狀態並嚴格按 order 升冪排序
      const list = rawList
        .filter(item => item && item.status === 'ACTIVE')
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

      const effectiveList = list.length > 0 ? list : DEFAULT_ACHIEVEMENTS;

      // 4. 計算每個成就的解鎖狀態與防爆雷隱藏邏輯
      this.currentChestData = effectiveList.map((ach, index) => {
        const achId = String(ach.achievementId || ach.tierId || ach.id || `tier_${index + 1}`).trim();
        const isClaimed = claimedSet.has(achId) ||
                          claimedSet.has(`CHEST_${achId}`) ||
                          claimedSet.has(`ACH_${achId}`) ||
                          claimedSet.has(`tier_${index + 1}`) ||
                          claimedSet.has(`CHEST_tier_${index + 1}`) ||
                          claimedSet.has(`T${index + 1}`) ||
                          claimedSet.has(`CHEST_T${index + 1}`);

        const minPoints = Number(ach.minPoints || 0);
        const isUnlocked = isClaimed || (minPoints > 0 && userPoints >= minPoints);

        const isHiddenRaw = ach.isHidden === true || ach.isHidden === 'TRUE' || ach.isHidden === 1 || ach.isHidden === '1';
        const isMystery = isHiddenRaw && !isClaimed;

        const displayName = isMystery ? '???' : (ach.name || ach.title || '未命名成就');
        const displaySubtitle = isMystery ? '探索以解鎖' : (ach.subtitle || '');
        const displayDesc = isMystery
          ? '此為隱藏成就，請持續在各樣召會生活與操練中探索以解鎖！'
          : (ach.description || ach.desc || '暫無成就說明。');
        const displayReward = isMystery ? '達成後揭曉' : (ach.rewardDesc || '');

        const statusText = isClaimed ? '已獲得' : (isUnlocked ? '達標待結算' : '未達門檻');
        const statusLabel = isMystery ? '🔒 待探索' : (isClaimed ? '🏆 已獲得' : (isUnlocked ? '⏳ 達標待結算' : '🔒 未達門檻'));
        const statusColor = isClaimed ? '#10b981' : (isUnlocked ? '#f59e0b' : '#94a3b8');

        const webpUrl = resolveChestImg(ach, index, 'webp');
        const pngUrl = resolveChestImg(ach, index, 'png');

        return {
          ...ach,
          achievementId: achId,
          tierId: ach.tierId || achId,
          name: ach.name || ach.title,
          title: ach.name || ach.title,
          desc: ach.description || ach.desc,
          description: ach.description || ach.desc,
          rewardDesc: ach.rewardDesc || '',
          minPoints,
          isClaimed,
          claimed: isClaimed,
          isUnlocked,
          unlocked: isUnlocked,
          isMystery,
          displayName,
          displaySubtitle,
          displayDesc,
          displayReward,
          statusText,
          statusLabel,
          statusColor,
          webpUrl,
          pngUrl,
          img: webpUrl,
          icon: webpUrl
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
            const safeWebp = escapeHtml(chest.webpUrl);
            const safePng = escapeHtml(chest.pngUrl);
            const isClaimed = Boolean(chest.isClaimed);
            const isUnlocked = Boolean(chest.isUnlocked);
            const isMystery = Boolean(chest.isMystery);
            const imgFilter = !isUnlocked || isMystery ? 'grayscale(0.8) opacity(0.6)' : 'none';

            return `
              <div class="chest-card-item" data-index="${index}" style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:12px; text-align:center; cursor:pointer; transition:transform 0.15s ease;">
                <picture>
                  <source srcset="${safeWebp}" type="image/webp">
                  <img src="${safePng}" alt="${escapeHtml(chest.displayName)}" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='../Chest_Assets/Chest_01.png';" style="width:64px; height:64px; object-fit:contain; margin:0 auto; display:block; filter:${imgFilter};">
                </picture>
                <div style="font-weight:700; font-size:13px; margin-top:8px; color:#1e293b;">${escapeHtml(chest.displayName)}</div>
                ${chest.displaySubtitle ? `<div style="font-size:11px; color:#64748b; margin-top:2px;">${escapeHtml(chest.displaySubtitle)}</div>` : ''}
                <div style="font-size:11px; font-weight:600; color:${chest.statusColor}; margin-top:4px;">${escapeHtml(chest.statusLabel)}</div>
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
      if (!chest) return;
      this.activeChest = chest;
      this.applyDetailModal_(chest);
      if (this.detailModal) this.detailModal.classList.remove('hidden');
    }

    applyDetailModal_(chest) {
      if (!chest) return;

      if (this.detailImage) {
        this.detailImage.onerror = () => {
          this.detailImage.onerror = null;
          this.detailImage.src = chest.pngUrl;
        };
        this.detailImage.src = chest.webpUrl;
        const imgFilter = !chest.isUnlocked || chest.isMystery ? 'grayscale(0.8) opacity(0.6)' : 'none';
        this.detailImage.style.filter = imgFilter;
      }

      if (this.detailName) {
        this.detailName.textContent = chest.displayName;
      }

      if (this.detailSubtitle) {
        if (chest.displaySubtitle) {
          this.detailSubtitle.textContent = chest.displaySubtitle;
          this.detailSubtitle.style.display = 'block';
        } else {
          this.detailSubtitle.style.display = 'none';
        }
      }

      if (this.detailText) {
        this.detailText.textContent = chest.displayDesc;
      }

      if (this.detailReward) {
        if (chest.displayReward) {
          this.detailReward.textContent = `🎁 獎勵：${chest.displayReward}`;
          this.detailReward.style.display = 'inline-flex';
        } else {
          this.detailReward.style.display = 'none';
        }
      }

      if (this.detailStatus) {
        this.detailStatus.textContent = chest.statusLabel;
        this.detailStatus.style.color = chest.statusColor;
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      ChestView,
      resolveChestImg,
      preloadChestAssets,
      DEFAULT_CHESTS,
      DEFAULT_ACHIEVEMENTS
    };
  }
  ChestView.DEFAULT_CHESTS = DEFAULT_CHESTS;
  ChestView.DEFAULT_ACHIEVEMENTS = DEFAULT_ACHIEVEMENTS;
  global.ChestView = ChestView;

})(typeof window !== 'undefined' ? window : global);
