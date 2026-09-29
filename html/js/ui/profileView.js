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

      // 頭像步進器與選擇
      this.avatarGender = 'male';
      this.avatarNo = 1;

      const genderSel = document.getElementById('avatarGenderSelect');
      if (genderSel) {
        genderSel.addEventListener('change', () => {
          this.avatarGender = genderSel.value || 'male';
          this.updateAvatarPreview_();
        });
      }

      const prevBtn = document.getElementById('avatarPrevBtn');
      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          this.avatarNo = this.avatarNo > 1 ? this.avatarNo - 1 : 8;
          this.updateAvatarPreview_();
        });
      }

      const nextBtn = document.getElementById('avatarNextBtn');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          this.avatarNo = this.avatarNo < 8 ? this.avatarNo + 1 : 1;
          this.updateAvatarPreview_();
        });
      }

      const randomBtn = document.getElementById('avatarRandomBtn');
      if (randomBtn) {
        randomBtn.addEventListener('click', () => {
          this.avatarNo = Math.floor(Math.random() * 8) + 1;
          this.updateAvatarPreview_();
        });
      }

      // 開啟帳號設定彈窗 (密碼更新)
      const openSettingsBtn = document.getElementById('openAccountSettingsBtn');
      if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', () => {
          if (this.accountSettingsModal) this.accountSettingsModal.classList.remove('hidden');
        });
      }

      const changePwdForm = document.getElementById('changePasswordForm');
      if (changePwdForm) {
        changePwdForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const currentPwd = (document.getElementById('currentPasswordCode') || {}).value?.trim();
          const newPwd = (document.getElementById('newPasswordCode') || {}).value?.trim();
          const confirmPwd = (document.getElementById('confirmNewPasswordCode') || {}).value?.trim();

          if (!currentPwd || !newPwd) {
            alert('請填寫目前密碼與新密碼');
            return;
          }
          if (newPwd !== confirmPwd) {
            alert('兩次輸入的新密碼不一致，請重新確認');
            return;
          }
          if (newPwd.length < 6) {
            alert('新密碼長度至少需 6 碼以上');
            return;
          }

          try {
            const res = await this.apiClient.updatePassword(currentPwd, newPwd);
            if (res && res.success) {
              alert('密碼更新成功！');
              if (this.accountSettingsModal) this.accountSettingsModal.classList.add('hidden');
              changePwdForm.reset();
            } else {
              alert((res && (res.error || res.message)) || '更新密碼失敗');
            }
          } catch (err) {
            alert(err.message || '更新密碼逾時，請稍後再試');
          }
        });
      }

      // 活力組管理彈窗與操作
      const vitalModal = document.getElementById('vitalGroupsModal');
      const openVitalBtn = document.getElementById('openVitalGroupsBtn');
      if (openVitalBtn && vitalModal) {
        openVitalBtn.addEventListener('click', () => {
          vitalModal.classList.remove('hidden');
          const listMount = document.getElementById('vitalGroupsList');
          if (listMount) {
            if (this.currentUserProfile && this.currentUserProfile.groupId) {
              listMount.innerHTML = `
                <div class="vital-group-item active-group" style="padding:12px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px;margin-bottom:8px;">
                  <strong style="color:#15803d;font-size:15px;">現屬活力組：${this.currentUserProfile.groupName || this.currentUserProfile.groupId}</strong>
                  <div style="font-size:13px;color:#475569;margin-top:4px;">組別代碼：${this.currentUserProfile.groupId}</div>
                </div>
              `;
            } else {
              listMount.innerHTML = `<div class="empty-card" style="padding:16px;text-align:center;color:#64748b;">目前尚未加入任何活力組，可於下方建立新組或以邀請碼加入。</div>`;
            }
          }
        });
      }

      document.querySelectorAll('[data-close-modal="vitalGroupsModal"]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (vitalModal) vitalModal.classList.add('hidden');
        });
      });

      const createGrpForm = document.getElementById('createVitalGroupForm');
      if (createGrpForm) {
        createGrpForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const nameInput = document.getElementById('createVitalGroupName');
          const groupName = nameInput ? nameInput.value.trim() : '';
          if (!groupName) {
            alert('請輸入活力組名稱');
            return;
          }

          try {
            const res = await this.apiClient.createGroup({ groupName });
            if (res && res.success) {
              alert(`恭喜！活力組【${groupName}】建立成功！`);
              if (vitalModal) vitalModal.classList.add('hidden');
              if (nameInput) nameInput.value = '';
              if (typeof window.AppCoordinator?.refreshUserData === 'function') {
                window.AppCoordinator.refreshUserData();
              }
            } else {
              alert((res && (res.error || res.message)) || '建立活力組失敗');
            }
          } catch (err) {
            alert(err.message || '連線逾時，請稍後再試');
          }
        });
      }

      const joinGrpForm = document.getElementById('joinVitalGroupForm');
      if (joinGrpForm) {
        joinGrpForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const codeInput = document.getElementById('joinVitalGroupCode');
          const inviteCode = codeInput ? codeInput.value.trim() : '';
          if (!inviteCode) {
            alert('請輸入邀請碼');
            return;
          }

          try {
            const res = await this.apiClient.joinGroup({ inviteCode });
            if (res && res.success) {
              alert('成功加入活力組！歡迎一同在主裡奔跑！');
              if (vitalModal) vitalModal.classList.add('hidden');
              if (codeInput) codeInput.value = '';
              if (typeof window.AppCoordinator?.refreshUserData === 'function') {
                window.AppCoordinator.refreshUserData();
              }
            } else {
              alert((res && (res.error || res.message)) || '加入活力組失敗，請檢查邀請碼');
            }
          } catch (err) {
            alert(err.message || '連線逾時，請稍後再試');
          }
        });
      }

      // 同行貢獻按鈕
      const growthBtn = document.getElementById('openGrowthModalBtn');
      if (growthBtn) {
        growthBtn.addEventListener('click', () => {
          if (typeof this.onFootprintClick === 'function') {
            this.onFootprintClick();
          }
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
          if (this.currentUserProfile && !this.currentUserProfile.groupId) {
            alert('您尚未加入任何活力組！請先加入或建立活力組，才能使用小組公告與交通功能。');
            return;
          }
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
      this.currentUserProfile = userProfile;

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

    updateAvatarPreview_() {
      const folder = this.avatarGender === 'female' ? 'avatar-female' : 'avatar-male';
      const prefix = this.avatarGender === 'female' ? 'avatar-female-direct' : 'avatar-male-direct';
      const num = String(this.avatarNo).padStart(3, '0');
      this.selectedAvatarUrl = `../${folder}/${prefix}-${num}.png`;
      if (this.avatarPreview) {
        this.avatarPreview.src = this.selectedAvatarUrl;
        this.avatarPreview.classList.remove('hidden');
      }
      if (this.avatarInfo) {
        const label = this.avatarGender === 'female' ? '姊妹' : '弟兄';
        this.avatarInfo.textContent = `${label} ${this.avatarNo}`;
      }
      return this.selectedAvatarUrl;
    }

    openAvatarModal() {
      if (this.avatarModal) this.avatarModal.classList.remove('hidden');
      this.updateAvatarPreview_();
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
