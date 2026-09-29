/**
 * profileView.js
 * 個人同行手冊與帳號設定視圖深層模組 (Profile & Account View Deep Module)
 * 負責：「我的」頁面切換、更換頭像彈窗、密碼更新、登出確認與活力組管理導航
 */

(function(global) {
  'use strict';

  const MALE_AVATARS = Array.from({ length: 8 }, (_, i) => `../avatar-male/avatar-male-direct-${String(i + 1).padStart(3, '0')}.png`);
  const FEMALE_AVATARS = Array.from({ length: 8 }, (_, i) => `../avatar-female/avatar-female-direct-${String(i + 1).padStart(3, '0')}.png`);

  class ProfileView {
    constructor({ apiClient, onAvatarUpdated, onLogout, onFootprintClick, onFellowshipClick }) {
      this.apiClient = apiClient;
      this.onAvatarUpdated = onAvatarUpdated;
      this.onLogout = onLogout;
      this.onFootprintClick = onFootprintClick;
      this.onFellowshipClick = onFellowshipClick;

      this.homeViewEl = document.getElementById('homeView');
      this.myViewEl = document.getElementById('myView');

      this.avatarModal = document.getElementById('avatarModal');
      this.avatarList = document.getElementById('avatarList');
      this.avatarPreview = document.getElementById('avatarModalPreview');
      this.avatarInfo = document.getElementById('avatarModalInfo');
      this.avatarSaveBtn = document.getElementById('avatarSaveBtn');

      this.accountSettingsModal = document.getElementById('accountSettingsModal');

      this.selectedAvatarUrl = '';

      this.initEvents_();
    }

    initEvents_() {
      // 底部導航切換
      const navHomeBtn = document.getElementById('navHomeBtn');
      const navMyBtn = document.getElementById('navMyBtn');
      const backHomeBtn = document.querySelector('.back-view-btn[data-view="home"]');

      if (navHomeBtn) {
        navHomeBtn.addEventListener('click', () => this.showHome());
      }
      if (navMyBtn) {
        navMyBtn.addEventListener('click', () => this.showMy());
      }
      if (backHomeBtn) {
        backHomeBtn.addEventListener('click', () => this.showHome());
      }

      // 開啟更換頭像彈窗
      const openAvatarBtns = [
        document.getElementById('openAvatarBtn'),
        document.getElementById('myAvatarBtn'),
        document.getElementById('homeAvatarBtn')
      ];

      openAvatarBtns.forEach(btn => {
        if (btn) {
          btn.addEventListener('click', () => this.openAvatarModal());
        }
      });

      // 關閉 Modal 按鈕
      document.querySelectorAll('[data-close-modal="avatarModal"]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (this.avatarModal) this.avatarModal.classList.add('hidden');
        });
      });

      document.querySelectorAll('[data-close-modal="accountSettingsModal"]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (this.accountSettingsModal) this.accountSettingsModal.classList.add('hidden');
        });
      });

      // 儲存頭像
      if (this.avatarSaveBtn) {
        this.avatarSaveBtn.addEventListener('click', async () => {
          if (!this.selectedAvatarUrl) {
            alert('請先點選想更換的頭像');
            return;
          }

          this.avatarSaveBtn.disabled = true;
          this.avatarSaveBtn.textContent = '更新中...';

          try {
            const res = await this.apiClient.updateAvatar(this.selectedAvatarUrl);
            if (res && res.success) {
              alert('頭像更新成功！');
              if (this.avatarModal) this.avatarModal.classList.add('hidden');
              if (typeof this.onAvatarUpdated === 'function') {
                this.onAvatarUpdated(this.selectedAvatarUrl);
              }
            } else {
              alert((res && (res.error || res.message)) || '更新頭像失敗');
            }
          } catch (err) {
            alert(err.message || '更新頭像逾時，請稍後再試');
          } finally {
            this.avatarSaveBtn.disabled = false;
            this.avatarSaveBtn.textContent = '確認更換';
          }
        });
      }

      // 開啟帳號設定彈窗 (密碼更新)
      const openSettingsBtn = document.getElementById('openAccountSettingsBtn');
      if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', () => {
          if (this.accountSettingsModal) this.accountSettingsModal.classList.remove('hidden');
        });
      }

      // 操練紀錄與小組公告捷徑
      const practiceHistoryBtn = document.getElementById('openPracticeHistoryBtn');
      if (practiceHistoryBtn) {
        practiceHistoryBtn.addEventListener('click', () => {
          if (typeof this.onFootprintClick === 'function') this.onFootprintClick();
        });
      }

      const fellowshipBtn = document.getElementById('openGroupPostModalBtn');
      if (fellowshipBtn) {
        fellowshipBtn.addEventListener('click', () => {
          if (typeof this.onFellowshipClick === 'function') this.onFellowshipClick();
        });
      }

      // 登出
      const logoutConfirmBtn = document.getElementById('openLogoutConfirmBtn');
      if (logoutConfirmBtn) {
        logoutConfirmBtn.addEventListener('click', () => {
          if (confirm('確定要登出並結束本次旅程嗎？')) {
            if (typeof this.onLogout === 'function') this.onLogout();
          }
        });
      }
    }

    showHome() {
      if (this.homeViewEl) this.homeViewEl.classList.remove('hidden');
      if (this.myViewEl) this.myViewEl.classList.add('hidden');
      const navHome = document.getElementById('navHomeBtn');
      const navMy = document.getElementById('navMyBtn');
      if (navHome) navHome.classList.add('active');
      if (navMy) navMy.classList.remove('active');
    }

    showMy() {
      if (this.homeViewEl) this.homeViewEl.classList.add('hidden');
      if (this.myViewEl) this.myViewEl.classList.remove('hidden');
      const navHome = document.getElementById('navHomeBtn');
      const navMy = document.getElementById('navMyBtn');
      if (navHome) navHome.classList.remove('active');
      if (navMy) navMy.classList.add('active');
    }

    render(userProfile) {
      if (!userProfile) return;

      const myNameEl = document.getElementById('myPlayerName');
      const myGroupEl = document.getElementById('myGroupName');
      const myAvatarImg = document.getElementById('myAvatarImg');
      const myAvatarPlaceholder = document.getElementById('myAvatarPlaceholder');

      if (myNameEl) myNameEl.textContent = userProfile.name || userProfile.username || '活力人';
      if (myGroupEl) myGroupEl.textContent = userProfile.groupName || (userProfile.groupId ? `活力組 #${userProfile.groupId}` : '未加入活力組');

      if (myAvatarImg && userProfile.avatarUrl) {
        myAvatarImg.src = userProfile.avatarUrl;
        myAvatarImg.classList.remove('hidden');
        if (myAvatarPlaceholder) myAvatarPlaceholder.classList.add('hidden');
      }
    }

    openAvatarModal() {
      if (this.avatarModal) this.avatarModal.classList.remove('hidden');
      this.renderAvatarGrid_();
    }

    renderAvatarGrid_() {
      if (!this.avatarList) return;

      const allAvatars = [
        ...MALE_AVATARS.map((url, i) => ({ url, label: `弟兄 ${i + 1}` })),
        ...FEMALE_AVATARS.map((url, i) => ({ url, label: `姊妹 ${i + 1}` }))
      ];

      this.avatarList.innerHTML = allAvatars.map(av => `
        <button class="avatar-option-btn" type="button" data-avatar-url="${av.url}" style="border:2px solid #e2e8f0; border-radius:12px; padding:6px; background:#fff; cursor:pointer;">
          <img src="${av.url}" alt="${av.label}" style="width:56px; height:56px; object-fit:contain; border-radius:8px;">
          <div style="font-size:11px; margin-top:4px; color:#475569;">${av.label}</div>
        </button>
      `).join('');

      this.avatarList.querySelectorAll('.avatar-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          this.avatarList.querySelectorAll('.avatar-option-btn').forEach(b => b.style.borderColor = '#e2e8f0');
          btn.style.borderColor = '#0284c7';
          this.selectedAvatarUrl = btn.getAttribute('data-avatar-url');

          if (this.avatarPreview) {
            this.avatarPreview.src = this.selectedAvatarUrl;
            this.avatarPreview.classList.remove('hidden');
          }
          if (this.avatarInfo) {
            this.avatarInfo.textContent = '已選擇新頭像';
          }
        });
      });
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ProfileView };
  }
  global.ProfileView = ProfileView;

})(typeof window !== 'undefined' ? window : global);
