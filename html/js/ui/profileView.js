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
    constructor({ apiClient, onAvatarUpdated, onLogout, onFootprintClick, onFellowshipClick, onContributionClick }) {
      this.apiClient = apiClient;
      this.onAvatarUpdated = onAvatarUpdated;
      this.onLogout = onLogout;
      this.onFootprintClick = onFootprintClick;
      this.onFellowshipClick = onFellowshipClick;
      this.onContributionClick = onContributionClick;

      this.homeViewEl = document.getElementById('homeView');
      this.myViewEl = document.getElementById('myView');

      this.avatarModal = document.getElementById('avatarModal');
      this.avatarList = document.getElementById('avatarList');
      this.avatarPreview = document.getElementById('avatarModalPreview');
      this.avatarInfo = document.getElementById('avatarModalInfo');
      this.avatarSaveBtn = document.getElementById('avatarSaveBtn');

      this.accountSettingsModal = document.getElementById('accountSettingsModal');

      this.infoModal = document.getElementById('infoModal');
      this.infoModalTitle = document.getElementById('infoModalTitle');
      this.infoModalContent = document.getElementById('infoModalContent');

      this.selectedAvatarUrl = '';
      this.currentUserProfile = null;
      this.currentJourneyData = null;

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

      // 同行貢獻按鈕 (展示活力組成長篇章與同行點數貢獻總覽)
      const growthBtn = document.getElementById('openGrowthModalBtn');
      if (growthBtn) {
        growthBtn.addEventListener('click', () => {
          if (typeof this.onContributionClick === 'function') {
            this.onContributionClick();
          } else {
            this.openContributionModal();
          }
        });
      }

      // 操練紀錄與小組公告捷徑 (展示30天操練足跡)
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

    render(userProfile, journeyData = null) {
      if (!userProfile) return;
      this.currentUserProfile = userProfile;
      if (journeyData) this.currentJourneyData = journeyData;

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

    async openContributionModal() {
      if (this.infoModalTitle) this.infoModalTitle.textContent = '同行貢獻總覽';
      if (this.infoModal) this.infoModal.classList.remove('hidden');
      if (this.infoModalContent) {
        this.infoModalContent.innerHTML = '<div style="text-align:center;padding:30px;color:#64748b;">讀取同行貢獻資料中...</div>';
      }

      const p = this.currentUserProfile || {};
      const groupId = p.groupId;
      const myPoints = Number((p.totalPoints !== undefined ? p.totalPoints : p.totalScore) || 0);

      if (!groupId) {
        if (this.infoModalContent) {
          this.infoModalContent.innerHTML = `
            <div style="text-align:center; padding:32px 16px;">
              <div style="font-size:42px; margin-bottom:12px;">🌱</div>
              <h4 style="font-size:16px; font-weight:700; color:#1e293b; margin-bottom:8px;">尚未加入活力組</h4>
              <p style="font-size:13px; color:#64748b; line-height:1.6; margin-bottom:20px;">
                同行貢獻記錄您與活力組同伴共同奔跑的點數與篇章進度。<br>
                您目前累積個人操練分為 <strong>${myPoints.toLocaleString()}</strong> 點。<br>
                請先至「活力組管理」建立小組或以邀請碼加入，開始與同伴同心建造！
              </p>
              <button id="contribGoVitalBtn" class="primary-btn" style="display:inline-block; padding:8px 20px; font-size:13px; font-weight:600; border-radius:8px; background:#2563eb; color:#fff; border:none; cursor:pointer;">
                前往活力組管理
              </button>
            </div>
          `;
          const goBtn = document.getElementById('contribGoVitalBtn');
          if (goBtn) {
            goBtn.addEventListener('click', () => {
              if (this.infoModal) this.infoModal.classList.add('hidden');
              const vitalModal = document.getElementById('vitalGroupsModal');
              if (vitalModal) vitalModal.classList.remove('hidden');
            });
          }
        }
        return;
      }

      try {
        let journeyData = this.currentJourneyData;
        if (!journeyData) {
          try {
            const jRes = await this.apiClient.getGroupJourney(groupId);
            if (jRes && jRes.success) {
              journeyData = jRes.data || jRes.journey || jRes;
            }
          } catch (e) {}
        }

        let contribSummary = null;
        try {
          const cRes = await this.apiClient.getMyGroupContributionSummary(groupId);
          if (cRes && cRes.success) {
            contribSummary = cRes.data || cRes;
          }
        } catch (e) {}

        const groupName = (journeyData && journeyData.groupName) || p.groupName || groupId;
        const totalGroupScore = Number((journeyData && journeyData.totalScore) || (contribSummary && contribSummary.groupTotalPoints) || myPoints);
        const chapterTitle = (journeyData && journeyData.currentChapter && (journeyData.currentChapter.title || journeyData.currentChapter.name)) || '初信成長';
        const chapterIndex = (journeyData && journeyData.currentChapter && (journeyData.currentChapter.index || journeyData.currentChapter.chapterIndex)) || 1;
        const percent = totalGroupScore > 0 ? Math.min(100, Math.round((myPoints / totalGroupScore) * 100)) : 100;
        const coScore = Math.max(0, totalGroupScore - myPoints);

        if (this.infoModalContent) {
          this.infoModalContent.innerHTML = `
            <div style="padding:16px;">
              <div style="background:linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%); border:1px solid #bae6fd; border-radius:14px; padding:16px; margin-bottom:16px; text-align:center;">
                <div style="font-size:12px; font-weight:700; color:#0284c7; text-transform:uppercase; letter-spacing:0.5px;">VITAL GROUP JOURNEY</div>
                <h3 style="font-size:18px; font-weight:800; color:#0f172a; margin:4px 0 8px 0;">${groupName}</h3>
                <div style="display:inline-flex; align-items:center; gap:6px; background:#fff; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:700; color:#16a34a; box-shadow:0 1px 3px rgba(0,0,0,0.06);">
                  <span>🏆 當前篇章：第 ${chapterIndex} 篇【${chapterTitle}】</span>
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:14px; text-align:center;">
                  <div style="font-size:12px; color:#64748b; font-weight:600;">小組總累積點數</div>
                  <div style="font-size:24px; font-weight:800; color:#2563eb; margin-top:4px;">${totalGroupScore.toLocaleString()}<small style="font-size:12px; font-weight:600; margin-left:2px;">分</small></div>
                </div>
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:14px; text-align:center;">
                  <div style="font-size:12px; color:#64748b; font-weight:600;">我的個人奉獻點數</div>
                  <div style="font-size:24px; font-weight:800; color:#16a34a; margin-top:4px;">${myPoints.toLocaleString()}<small style="font-size:12px; font-weight:600; margin-left:2px;">分</small></div>
                </div>
              </div>

              <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:14px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-size:12px; font-weight:700;">
                  <span style="color:#334155;">個人操練貢獻比例</span>
                  <span style="color:#2563eb;">${percent}%</span>
                </div>
                <div style="height:8px; background:#f1f5f9; border-radius:4px; overflow:hidden;">
                  <div style="height:100%; width:${percent}%; background:linear-gradient(90deg, #3b82f6, #10b981); border-radius:4px; transition:width 0.3s ease;"></div>
                </div>
                <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:11px; color:#64748b;">
                  <span>我的操練：${myPoints.toLocaleString()} 分</span>
                  <span>組員同心同行：${coScore.toLocaleString()} 分</span>
                </div>
              </div>

              <div style="background:#f8fafc; border-radius:10px; padding:12px; text-align:center; font-size:12px; color:#475569; line-height:1.5;">
                💡 每日晨興、讀經、禱告、書報與聚會回報，均會為小組累積活力點數，推進篇章突破！
              </div>
            </div>
          `;
        }
      } catch (err) {
        if (this.infoModalContent) {
          this.infoModalContent.innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444;">讀取同行貢獻失敗：${err.message}</div>`;
        }
      }
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ProfileView };
  }
  global.ProfileView = ProfileView;

})(typeof window !== 'undefined' ? window : global);
