/**
 * profileView.js
 * 個人同行手冊與帳號設定視圖深層模組 (Profile & Account View Deep Module)
 * 負責：「我的」頁面切換、更換頭像彈窗、密碼更新、登出確認與活力組管理導航
 */

(function(global) {
  'use strict';

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
      document.querySelectorAll('#openAvatarBtn, #myAvatarBtn, #homeAvatarBtn').forEach(btn => {
        btn.addEventListener('click', () => this.openAvatarModal());
      });

      // 關閉 Modal 按鈕
      document.querySelectorAll('[data-close-modal="avatarModal"], [data-close-modal="accountSettingsModal"]').forEach(btn => {
        btn.addEventListener('click', () => {
          const modal = document.getElementById(btn.getAttribute('data-close-modal'));
          if (modal) modal.classList.add('hidden');
        });
      });

      // 儲存頭像與顯示名稱
      if (this.avatarSaveBtn) {
        this.avatarSaveBtn.addEventListener('click', async () => {
          if (!this.selectedAvatarUrl) {
            alert('請先點選想更換的頭像');
            return;
          }

          const nameInput = document.getElementById('avatarDisplayNameInput');
          const newName = nameInput ? nameInput.value.trim() : '';
          if (nameInput && !newName) {
            alert('請輸入顯示名稱');
            return;
          }

          this.avatarSaveBtn.disabled = true;
          this.avatarSaveBtn.textContent = '更新中...';

          try {
            const res = await this.apiClient.updateAvatar(this.selectedAvatarUrl, newName);
            if (res && res.success) {
              alert('個人資料更新成功！');
              if (this.currentUserProfile) {
                if (this.selectedAvatarUrl) this.currentUserProfile.avatarUrl = this.selectedAvatarUrl;
                if (newName) this.currentUserProfile.name = newName;
              }
              if (this.avatarModal) this.avatarModal.classList.add('hidden');
              if (typeof this.onAvatarUpdated === 'function') {
                this.onAvatarUpdated(this.selectedAvatarUrl, newName);
              }
            } else {
              alert((res && (res.error || res.message)) || '更新失敗');
            }
          } catch (err) {
            alert(err.message || '更新逾時，請稍後再試');
          } finally {
            this.avatarSaveBtn.textContent = '儲存頭像';
            this.avatarSaveBtn.disabled = false;
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
          const submitBtn = changePwdForm.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.disabled = true;
          const currentPwd = (document.getElementById('currentPasswordCode') || {}).value?.trim();
          const newPwd = (document.getElementById('newPasswordCode') || {}).value?.trim();
          const confirmPwd = (document.getElementById('confirmNewPasswordCode') || {}).value?.trim();

          if (!currentPwd || !newPwd) {
            alert('請填寫目前密碼與新密碼');
            if (submitBtn) submitBtn.disabled = false;
            return;
          }
          if (newPwd !== confirmPwd) {
            alert('兩次輸入的新密碼不一致，請重新確認');
            if (submitBtn) submitBtn.disabled = false;
            return;
          }
          if (newPwd.length < 6) {
            alert('新密碼長度至少需 6 碼以上');
            if (submitBtn) submitBtn.disabled = false;
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
          } finally {
            if (submitBtn) submitBtn.disabled = false;
          }
        });
      }

      // 活力組管理彈窗與操作
      const vitalModal = document.getElementById('vitalGroupsModal');
      const openVitalBtn = document.getElementById('openVitalGroupsBtn');
      const createGrpForm = document.getElementById('createVitalGroupForm');
      const joinGrpForm = document.getElementById('joinVitalGroupForm');

      const renderVitalGroupsModal = async () => {
        const listMount = document.getElementById('vitalGroupsList');
        if (!listMount) return;

        const hasGroup = Boolean(this.currentUserProfile && this.currentUserProfile.groupId);
        if (createGrpForm) {
          createGrpForm.classList.toggle('hidden', hasGroup);
        }
        if (joinGrpForm) {
          joinGrpForm.classList.toggle('hidden', hasGroup);
        }

        if (!hasGroup) {
          listMount.innerHTML = `<div class="empty-card" style="padding:16px;text-align:center;color:#64748b;">目前尚未加入任何活力組，可於下方建立新組或以邀請碼加入。</div>`;
          return;
        }

        const groupId = this.currentUserProfile.groupId;
        const fallbackGrpName = this.currentUserProfile.groupName || groupId;
        
        let dashboard = null;
        try {
          if (typeof localStorage !== 'undefined') {
            dashboard = JSON.parse(localStorage.getItem(`vital_group_profile_${groupId}`) || 'null');
          }
        } catch(e) {}
        
        if (!dashboard) {
          listMount.innerHTML = `<div style="padding:16px;text-align:center;color:#64748b;">載入小組資訊中...</div>`;
        }

        // 定義渲染函式以便 SWR 重複使用
        const renderDashboard = (dash) => {
          if (!dash) return;
          // 關鍵防禦：若後端判定無小組或小組已解散，即刻清除前端快照
          if (dash.hasGroup === false) {
            if (this.currentUserProfile) {
              this.currentUserProfile.groupId = '';
              delete this.currentUserProfile.groupName;
              delete this.currentUserProfile.isLeader;
            }
            this.currentJourneyData = null;
            this.render(this.currentUserProfile, null);
            if (typeof window.AppCoordinator?.updateUserGroupState === 'function') {
              window.AppCoordinator.updateUserGroupState('');
            }
            if (createGrpForm) createGrpForm.classList.remove('hidden');
            if (joinGrpForm) joinGrpForm.classList.remove('hidden');
            listMount.innerHTML = `<div class="empty-card" style="padding:16px;text-align:center;color:#64748b;">目前尚未加入任何活力組，可於下方建立新組或以邀請碼加入。</div>`;
            return;
          }

          const grpName = dash.groupName || fallbackGrpName;
          const members = dash.members || [];
          const memberCount = (typeof dash.memberCount === 'number')
            ? dash.memberCount
            : (members.length > 0 ? members.length : 1);
          const isLeader = Boolean(
            (dash.isLeader !== undefined)
              ? dash.isLeader
              : (this.currentUserProfile.isLeader || dash.leaderPlayerId === this.currentUserProfile.playerId)
          );

          // 依人數判斷按鈕文字：只剩 1 人為「解散活力組」，2 人以上為「退出活力組」
          const leaveBtnText = memberCount <= 1 ? '解散活力組' : '退出活力組';

          // 若為隊長且人數 > 1，顯示「轉讓組長」按鈕
          const canTransferLeader = isLeader && memberCount > 1;

          listMount.innerHTML = `
            <div class="vital-group-item active-group" style="padding:14px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px;margin-bottom:8px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
                <div>
                  <strong style="color:#15803d;font-size:15px;">現屬活力組：${this.escapeHtml(grpName)}</strong>
                  <div style="font-size:13px;color:#475569;margin-top:4px;">組別代碼：${this.escapeHtml(groupId)}</div>
                  ${dash.inviteCode ? `<div style="font-size:13px;color:#475569;margin-top:2px;">邀請代碼：<span style="font-weight:700;color:#334155;letter-spacing:1px;background:#e2e8f0;padding:2px 6px;border-radius:4px;margin-left:4px;user-select:all;">${this.escapeHtml(dash.inviteCode)}</span></div>` : ""}
                  <div style="font-size:13px;color:#475569;margin-top:2px;">組員人數：${memberCount} 人 ${isLeader ? '<span style="color:#2563eb;font-weight:600;">(組長)</span>' : ''}</div>
                </div>
                <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
                  <button type="button" id="btnLeaveVitalGroup" class="danger-btn" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;flex-shrink:0;">${leaveBtnText}</button>
                  ${canTransferLeader ? '<button type="button" id="btnToggleTransferLeader" class="secondary-btn" style="background:#eff6ff;color:#2563eb;border:1px solid #93c5fd;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;flex-shrink:0;">轉讓組長</button>' : ''}
                </div>
              </div>
              ${canTransferLeader ? `
                <div id="vitalGroupMembersPicker" style="display:none;margin-top:12px;padding-top:12px;border-top:1px dashed #cbd5e1;">
                  <div style="font-size:13px;font-weight:600;color:#334155;margin-bottom:8px;">請選擇欲交接組長之成員：</div>
                  <div id="membersPickerList" style="display:flex;flex-direction:column;gap:6px;"></div>
                </div>
              ` : ''}
            </div>
          `;

          // 退出 / 解散 按鈕點擊處理
          const leaveBtn = listMount.querySelector('#btnLeaveVitalGroup');
          if (leaveBtn) {
            leaveBtn.addEventListener('click', async () => {
              if (memberCount <= 1) {
                const ok = confirm(`確定要解散「${grpName}」嗎？解散後，此活力組的所有紀錄將會全面刪除。您可自由加入新組。`);
                if (!ok) return;
                leaveBtn.disabled = true;
                leaveBtn.textContent = '正在解散...';
                try {
                  const res = await this.apiClient.leaveGroup(groupId);
                  if (res && res.success) {
                    alert('已成功解散該活力組。');
                    if (typeof window.AppCoordinator?.updateUserGroupState === 'function') {
                      window.AppCoordinator.updateUserGroupState('');
                    }
                  } else {
                    alert('解散失敗：' + (res.error || res.message || '網路異常'));
                  }
                } catch (e) {
                  alert('解散失敗：' + e.message);
                } finally {
                  leaveBtn.textContent = leaveBtnText;
                  leaveBtn.disabled = false;
                }
              } else {
                if (isLeader) {
                  alert('您是組長，請先轉讓組長身份後再退出！');
                  return;
                }
                const ok = confirm(`確定要退出「${grpName}」嗎？您先前的操練貢獻仍會保留在該組，但您未來的操練將不會計入。您可自由加入新組。`);
                if (!ok) return;

                leaveBtn.disabled = true;
                leaveBtn.textContent = '正在退出...';
                try {
                  const res = await this.apiClient.leaveGroup(groupId);
                  if (res && res.success) {
                    alert('已成功退出該活力組。');
                    if (typeof window.AppCoordinator?.updateUserGroupState === 'function') {
                      window.AppCoordinator.updateUserGroupState('');
                    }
                  } else {
                    alert('退出失敗：' + (res.error || res.message || '網路異常'));
                  }
                } catch (e) {
                  alert('退出失敗：' + e.message);
                } finally {
                  leaveBtn.textContent = leaveBtnText;
                  leaveBtn.disabled = false;
                }
              }
            });
          }

          const btnToggleTransfer = listMount.querySelector('#btnToggleTransferLeader');
          if (btnToggleTransfer && canTransferLeader) {
            const pickerDiv = listMount.querySelector('#vitalGroupMembersPicker');
            const pickerList = listMount.querySelector('#membersPickerList');
            btnToggleTransfer.addEventListener('click', () => {
              const isHidden = (pickerDiv.style.display === 'none');
              pickerDiv.style.display = isHidden ? 'block' : 'none';
              if (isHidden) {
                pickerList.innerHTML = '';
                members.forEach(m => {
                  if (m.playerId === this.currentUserProfile.playerId) return;
                  const item = document.createElement('div');
                  item.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px;background:#fff;border:1px solid #e2e8f0;border-radius:6px;';
                  item.innerHTML = `
                    <div style="display:flex;align-items:center;gap:8px;">
                      <img src="../avatar-male/avatar-male-direct-001.png" style="width:24px;height:24px;border-radius:50%;object-fit:cover;background:#e2e8f0;" onerror="this.style.display='none';" />
                      <span style="font-size:14px;color:#334155;font-weight:500;">${this.escapeHtml(m.name || m.playerId)}</span>
                    </div>
                    <button type="button" class="primary-btn" style="padding:4px 10px;font-size:12px;border-radius:4px;">交接</button>
                  `;
                  const tBtn = item.querySelector('button');
                  tBtn.addEventListener('click', async () => {
                    const ok = confirm(`確定要將組長交接給「${m.name || m.playerId}」嗎？`);
                    if (!ok) return;

                    tBtn.disabled = true;
                    tBtn.textContent = '交接中...';
                    try {
                      const res = await this.apiClient.transferGroupLeader(m.playerId, groupId);
                      if (res && res.success) {
                        alert('交接成功！您已卸任組長。');
                        if (typeof window.AppCoordinator?.refreshUserData === 'function') {
                          window.AppCoordinator.refreshUserData();
                        }
                      } else {
                        alert('交接失敗：' + (res.error || res.message || '未知錯誤'));
                      }
                    } catch (err) {
                      alert('交接失敗：' + err.message);
                    } finally {
                      tBtn.textContent = '交接';
                      tBtn.disabled = false;
                    }
                  });
                  pickerList.appendChild(item);
                });
              }
            });
          }
        };

        // 如果有快取，先同步渲染
        if (dashboard) {
          renderDashboard(dashboard);
        }
        
        // 背景異步請求最新資料 (SWR)
        try {
          if (this.apiClient && typeof this.apiClient.getGroupProfile === 'function') {
            const dashRes = await this.apiClient.getGroupProfile(groupId);
            if (dashRes && dashRes.success) {
              const newDashboard = dashRes.data || dashRes;
              // 更新快取
              if (typeof localStorage !== 'undefined') {
                try {
                  localStorage.setItem(`vital_group_profile_${groupId}`, JSON.stringify(newDashboard));
                } catch(e) {}
              }
              // 覆寫渲染
              renderDashboard(newDashboard);
            }
          }
        } catch (e) {
          console.warn('獲取活力組資訊失敗', e);
        }
        if (dashboard && dashboard.hasGroup === false) {
          if (this.currentUserProfile) {
            this.currentUserProfile.groupId = '';
            delete this.currentUserProfile.groupName;
            delete this.currentUserProfile.isLeader;
          }
          this.currentJourneyData = null;
          this.render(this.currentUserProfile, null);
          if (typeof window.AppCoordinator?.updateUserGroupState === 'function') {
            window.AppCoordinator.updateUserGroupState('');
          }
          if (createGrpForm) createGrpForm.classList.remove('hidden');
          if (joinGrpForm) joinGrpForm.classList.remove('hidden');
          listMount.innerHTML = `<div class="empty-card" style="padding:16px;text-align:center;color:#64748b;">目前尚未加入任何活力組，可於下方建立新組或以邀請碼加入。</div>`;
          return;
        }

        const grpName = (dashboard && dashboard.groupName) || fallbackGrpName;
        const members = (dashboard && dashboard.members) || [];
        const memberCount = (dashboard && typeof dashboard.memberCount === 'number')
          ? dashboard.memberCount
          : (members.length > 0 ? members.length : 1);
        const isLeader = Boolean(
          (dashboard && dashboard.isLeader !== undefined)
            ? dashboard.isLeader
            : (this.currentUserProfile.isLeader || (dashboard && dashboard.leaderPlayerId === this.currentUserProfile.playerId))
        );

        // 依人數判斷按鈕文字：只剩 1 人為「解散活力組」，2 人以上為「退出活力組」
        const leaveBtnText = memberCount <= 1 ? '解散活力組' : '退出活力組';

        // 若為隊長且人數 > 1，顯示「轉讓組長」按鈕
        const canTransferLeader = isLeader && memberCount > 1;

        listMount.innerHTML = `
          <div class="vital-group-item active-group" style="padding:14px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px;margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
              <div>
                <strong style="color:#15803d;font-size:15px;">現屬活力組：${this.escapeHtml(grpName)}</strong>
                <div style="font-size:13px;color:#475569;margin-top:4px;">組別代碼：${this.escapeHtml(groupId)}</div>
                ${(dashboard && dashboard.inviteCode) ? `<div style="font-size:13px;color:#475569;margin-top:2px;">邀請代碼：<span style="font-weight:700;color:#334155;letter-spacing:1px;background:#e2e8f0;padding:2px 6px;border-radius:4px;margin-left:4px;user-select:all;">${this.escapeHtml(dashboard.inviteCode)}</span></div>` : ""}
                <div style="font-size:13px;color:#475569;margin-top:2px;">組員人數：${memberCount} 人 ${isLeader ? '<span style="color:#2563eb;font-weight:600;">(組長)</span>' : ''}</div>
              </div>
              <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end;">
                <button type="button" id="btnLeaveVitalGroup" class="danger-btn" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;flex-shrink:0;">${leaveBtnText}</button>
                ${canTransferLeader ? `<button type="button" id="btnToggleTransferLeader" class="secondary-btn" style="background:#eff6ff;color:#2563eb;border:1px solid #93c5fd;padding:6px 12px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;flex-shrink:0;">轉讓組長</button>` : ''}
              </div>
            </div>
            ${canTransferLeader ? `
              <div id="vitalGroupMembersPicker" style="display:none;margin-top:12px;padding-top:12px;border-top:1px dashed #cbd5e1;">
                <div style="font-size:13px;font-weight:600;color:#334155;margin-bottom:8px;">請選擇欲交接組長之成員：</div>
                <div id="membersPickerList" style="display:flex;flex-direction:column;gap:6px;"></div>
              </div>
            ` : ''}
          </div>
        `;

        // 退出 / 解散 按鈕點擊處理
        const leaveBtn = listMount.querySelector('#btnLeaveVitalGroup');
        if (leaveBtn) {
          leaveBtn.addEventListener('click', async () => {
            if (memberCount <= 1) {
              // 只剩最後 1 人：解散二次確認
              const ok = confirm(`確定要解散「${grpName}」嗎？解散後，此活力組的所有紀錄將會全面刪除。您可自由加入新組。`);
              if (!ok) return;

              leaveBtn.disabled = true;
              leaveBtn.textContent = '正在解散...';

              try {
                const res = await this.apiClient.leaveGroup(groupId);
                if (res && res.success) {
                  // 1. 立即樂觀清除所有前端狀態（零延遲）
                  if (this.currentUserProfile) {
                    this.currentUserProfile.groupId = '';
                    delete this.currentUserProfile.groupName;
                    delete this.currentUserProfile.isLeader;
                    this.currentUserProfile.memberCount = 0;
                  }
                  this.currentJourneyData = null;
                  this.render(this.currentUserProfile, null);
                  if (typeof window.AppCoordinator?.updateUserGroupState === 'function') {
                    window.AppCoordinator.updateUserGroupState('', '', false, 0);
                  }

                  alert('活力組已成功解散！');
                  if (vitalModal) vitalModal.classList.add('hidden');
                  if (typeof window.AppCoordinator?.refreshUserData === 'function') {
                    window.AppCoordinator.refreshUserData();
                  }
                } else {
                  alert((res && (res.error || res.message)) || '解散活力組失敗');
                }
              } catch (err) {
                alert(err.message || '連線逾時，請稍後再試');
              } finally {
                leaveBtn.textContent = '解散活力組';
                leaveBtn.disabled = false;
              }
            } else {
              // 多人小組：組長無法退組
              if (isLeader) {
                alert('請先指定新的組長才能退出');
                return;
              }

              // 一般組員退出確認
              const ok = confirm(`確定要退出「${grpName}」嗎？\n\n退出後，您在組期間的操練分數將保留沉澱於該小組，您可自由加入新組。`);
              if (!ok) return;

              leaveBtn.disabled = true;
              leaveBtn.textContent = '正在退出...';

              try {
                const res = await this.apiClient.leaveGroup(groupId);
                if (res && res.success) {
                  // 1. 立即樂觀清除所有前端狀態（零延遲）
                  if (this.currentUserProfile) {
                    this.currentUserProfile.groupId = '';
                    delete this.currentUserProfile.groupName;
                    delete this.currentUserProfile.isLeader;
                    this.currentUserProfile.memberCount = 0;
                  }
                  this.currentJourneyData = null;
                  this.render(this.currentUserProfile, null);
                  if (typeof window.AppCoordinator?.updateUserGroupState === 'function') {
                    window.AppCoordinator.updateUserGroupState('', '', false, 0);
                  }

                  alert('已成功退出活力組！');
                  if (vitalModal) vitalModal.classList.add('hidden');
                  if (typeof window.AppCoordinator?.refreshUserData === 'function') {
                    window.AppCoordinator.refreshUserData();
                  }
                } else {
                  alert((res && (res.error || res.message)) || '退出活力組失敗');
                }
              } catch (err) {
                alert(err.message || '連線逾時，請稍後再試');
              } finally {
                leaveBtn.textContent = '退出活力組';
                leaveBtn.disabled = false;
              }
            }
          });
        }

        // 轉讓組長按鈕與成員選取處理
        const transferToggleBtn = listMount.querySelector('#btnToggleTransferLeader');
        const picker = listMount.querySelector('#vitalGroupMembersPicker');
        const pickerList = listMount.querySelector('#membersPickerList');

        if (transferToggleBtn && picker && pickerList) {
          const currentUserId = (this.currentUserProfile && this.currentUserProfile.playerId) || '';
          const otherMembers = members.filter(m => m.playerId !== currentUserId);

          if (otherMembers.length === 0) {
            pickerList.innerHTML = `<div style="font-size:12px;color:#94a3b8;padding:4px 0;">無其他成員可轉讓</div>`;
          } else {
            pickerList.innerHTML = otherMembers.map(m => `
              <button type="button" class="btn-select-new-leader" data-player-id="${this.escapeHtml(m.playerId)}" data-player-name="${this.escapeHtml(m.name || m.playerId)}" style="display:flex;justify-content:space-between;align-items:center;background:#ffffff;border:1px solid #cbd5e1;padding:8px 12px;border-radius:6px;cursor:pointer;text-align:left;font-size:13px;color:#1e293b;">
                <span style="font-weight:600;">${this.escapeHtml(m.name || m.playerId)}</span>
                <span style="color:#2563eb;font-size:12px;">指定為組長 →</span>
              </button>
            `).join('');

            pickerList.querySelectorAll('.btn-select-new-leader').forEach(btn => {
              btn.addEventListener('click', async () => {
                const targetId = btn.getAttribute('data-player-id');
                const targetName = btn.getAttribute('data-player-name') || targetId;
                const ok = confirm(`確定要將組長職責轉讓給「${targetName}」嗎？\n\n轉讓後您將成為組員，該成員將擁有小組管理權限。`);
                if (!ok) return;

                btn.disabled = true;
                btn.textContent = '移交中...';

                try {
                  const res = await this.apiClient.transferGroupLeader(targetId, groupId);
                  if (res && res.success) {
                    if (this.currentUserProfile) {
                      this.currentUserProfile.isLeader = false;
                    }
                    if (typeof window.AppCoordinator?.updateUserGroupState === 'function') {
                      window.AppCoordinator.updateUserGroupState(groupId, grpName, false);
                    }

                    alert(`組長職責已成功移交給「${targetName}」！`);
                    if (vitalModal) vitalModal.classList.add('hidden');
                    if (typeof window.AppCoordinator?.refreshUserData === 'function') {
                      window.AppCoordinator.refreshUserData();
                    }
                  } else {
                    alert((res && (res.error || res.message)) || '轉讓組長失敗');
                  }
                } catch (err) {
                  alert(err.message || '連線逾時，請稍後再試');
                } finally {
                  btn.textContent = '指定為組長 →';
                  btn.disabled = false;
                }
              });
            });
          }

          transferToggleBtn.addEventListener('click', () => {
            const isHidden = (picker.style.display === 'none' || !picker.style.display);
            picker.style.display = isHidden ? 'block' : 'none';
            transferToggleBtn.textContent = isHidden ? '收起名單' : '轉讓組長';
          });
        }
      };

      if (openVitalBtn && vitalModal) {
        openVitalBtn.addEventListener('click', async () => {
          vitalModal.classList.remove('hidden');
          await renderVitalGroupsModal();
        });
      }

      document.querySelectorAll('[data-close-modal="vitalGroupsModal"]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (vitalModal) vitalModal.classList.add('hidden');
        });
      });

      if (createGrpForm) {
        createGrpForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const submitBtn = createGrpForm.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.disabled = true;

          if (this.currentUserProfile && this.currentUserProfile.groupId) {
            alert('您目前已在活力組中，無法重複建立小組。若需換組請先退出原小組。');
            if (submitBtn) submitBtn.disabled = false;
            return;
          }
          const nameInput = document.getElementById('createVitalGroupName');
          const groupName = nameInput ? nameInput.value.trim() : '';
          if (!groupName) {
            alert('請輸入活力組名稱');
            if (submitBtn) submitBtn.disabled = false;
            return;
          }

          try {
            const res = await this.apiClient.createGroup({ groupName });
            if (res && res.success) {
              const createdGId = res.groupId || (res.group && res.group.groupId) || (res.data && res.data.groupId) || '';
              // 1. 立即樂觀更新為組長身分（零延遲）
              if (this.currentUserProfile) {
                this.currentUserProfile.groupId = createdGId;
                this.currentUserProfile.groupName = groupName;
                this.currentUserProfile.isLeader = true;
                this.currentUserProfile.memberCount = 1;
              }
              this.render(this.currentUserProfile, null);
              if (typeof window.AppCoordinator?.updateUserGroupState === 'function') {
                window.AppCoordinator.updateUserGroupState(createdGId, groupName, true, 1);
              }

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
          } finally {
            if (submitBtn) submitBtn.disabled = false;
          }
        });
      }

      if (joinGrpForm) {
        joinGrpForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const submitBtn = joinGrpForm.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.disabled = true;

          if (this.currentUserProfile && this.currentUserProfile.groupId) {
            alert('您目前已在活力組中，無法重複加入小組。若需換組請先退出原小組。');
            if (submitBtn) submitBtn.disabled = false;
            return;
          }
          const codeInput = document.getElementById('joinVitalGroupCode');
          const inviteCode = codeInput ? codeInput.value.trim() : '';
          if (!inviteCode) {
            alert('請輸入邀請碼');
            if (submitBtn) submitBtn.disabled = false;
            return;
          }

          try {
            const res = await this.apiClient.joinGroup({ inviteCode });
            if (res && res.success) {
              const joinedGroup = res.group || (res.data && res.data.group) || {};
              const newGId = joinedGroup.groupId || res.groupId || (res.data && res.data.groupId) || '';
              const newGName = joinedGroup.groupName || res.groupName || (res.data && res.data.groupName) || '';
              const mCount = typeof joinedGroup.memberCount === 'number'
                ? joinedGroup.memberCount
                : (this.currentUserProfile?.memberCount ? this.currentUserProfile.memberCount + 1 : 2);

              // 1. 立即樂觀更新為組員身分（零延遲）
              if (this.currentUserProfile) {
                this.currentUserProfile.groupId = newGId;
                this.currentUserProfile.groupName = newGName;
                this.currentUserProfile.isLeader = false;
                this.currentUserProfile.memberCount = mCount;
              }
              this.render(this.currentUserProfile, null);
              if (typeof window.AppCoordinator?.updateUserGroupState === 'function') {
                window.AppCoordinator.updateUserGroupState(newGId, newGName, false, mCount);
              }

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
          } finally {
            if (submitBtn) submitBtn.disabled = false;
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

      // 背景預載聊天室
      if (typeof chatStore !== 'undefined' && chatStore.prefetch) {
        chatStore.prefetch();
      }
    }

    render(userProfile, journeyData = null) {
      if (!userProfile) return;
      this.currentUserProfile = userProfile;
      this.currentJourneyData = journeyData || null;

      const myNameEl = document.getElementById('myPlayerName');
      const myGroupEl = document.getElementById('myGroupName');
      const myAvatarImg = document.getElementById('myAvatarImg');
      const myAvatarPlaceholder = document.getElementById('myAvatarPlaceholder');

      if (myNameEl) myNameEl.textContent = userProfile.name || userProfile.username || '活力人';
      const hasGroup = Boolean(userProfile.groupId);
      if (myGroupEl) myGroupEl.textContent = hasGroup ? (userProfile.groupName || `活力組 #${userProfile.groupId}`) : '未加入活力組';

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
      const nameInput = document.getElementById('avatarDisplayNameInput');
      if (nameInput) {
        let currentName = '';
        if (this.currentUserProfile) {
          currentName = this.currentUserProfile.name || this.currentUserProfile.displayName || this.currentUserProfile.username || '';
        }
        if (!currentName && typeof window !== 'undefined' && window.AppCoordinator && window.AppCoordinator.currentUserProfile) {
          const cp = window.AppCoordinator.currentUserProfile;
          currentName = cp.name || cp.displayName || cp.username || '';
        }
        if (!currentName && typeof localStorage !== 'undefined') {
          try {
            const p = JSON.parse(localStorage.getItem('vital_current_player') || '{}');
            currentName = p.name || p.displayName || p.username || '';
          } catch (e) {}
        }
        if (!currentName) {
          const myEl = document.getElementById('myPlayerName');
          const homeEl = document.getElementById('homePlayerName');
          currentName = (myEl && myEl.textContent ? myEl.textContent.trim() : '')
            || (homeEl && homeEl.textContent ? homeEl.textContent.trim() : '')
            || '';
        }
        nameInput.value = currentName;
      }

      const currentAvatar = (this.currentUserProfile && this.currentUserProfile.avatarUrl)
        || (typeof localStorage !== 'undefined' && (JSON.parse(localStorage.getItem('vital_current_player') || '{}')).avatarUrl)
        || '';
      if (currentAvatar) {
        if (currentAvatar.includes('female')) {
          this.avatarGender = 'female';
        } else if (currentAvatar.includes('male')) {
          this.avatarGender = 'male';
        }
        const numMatch = currentAvatar.match(/(\d+)\.png/i);
        if (numMatch) {
          const parsed = parseInt(numMatch[1], 10);
          if (!isNaN(parsed) && parsed >= 1 && parsed <= 8) {
            this.avatarNo = parsed;
          }
        }
        const genderSel = document.getElementById('avatarGenderSelect');
        if (genderSel) genderSel.value = this.avatarGender;
      }

      this.updateAvatarPreview_();
    }

    async openContributionModal() {
      if (this.infoModalTitle) this.infoModalTitle.textContent = '當年度同行貢獻總覽';
      if (this.infoModal) this.infoModal.classList.remove('hidden');
      if (this.infoModalContent) {
        this.infoModalContent.innerHTML = '<div style="text-align:center;padding:30px;color:#64748b;">讀取當年度同行貢獻資料中...</div>';
      }

      const p = this.currentUserProfile || {};
      const groupId = p.groupId;
      
      // 樂觀加上今天的未結算本機打卡分數
      const localDelta = (window.dashboardView && typeof window.dashboardView.calculateTodayLocalPointsDelta_ === 'function') 
        ? window.dashboardView.calculateTodayLocalPointsDelta_() 
        : 0;
        
      const myPersonalPoints = Number(p.personalPoints !== undefined ? p.personalPoints : (p.totalPoints !== undefined ? p.totalPoints : (p.totalScore || 0))) + localDelta;
      const myContribPoints = Number(p.contributionPoints !== undefined ? p.contributionPoints : (p.contribution || 0)) + localDelta;

      if (!groupId) {
        if (this.infoModalContent) {
          this.infoModalContent.innerHTML = `
            <div style="text-align:center; padding:32px 16px;">
              <div style="font-size:42px; margin-bottom:12px;">🌱</div>
              <h4 style="font-size:16px; font-weight:700; color:#1e293b; margin-bottom:8px;">尚未加入活力組</h4>
              <p style="font-size:13px; color:#64748b; line-height:1.6; margin-bottom:20px;">
                同行貢獻記錄您與活力組同伴共同奔跑的點數與篇章進度。<br>
                您目前累積個人點數為 <strong>${myPersonalPoints.toLocaleString()}</strong> 點。<br>
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

      // 先嘗試讀取本地快取（SWR 策略：先展示快取資料，隨後背景拉取最新並更新）
      let cachedSummary = null;
      if (typeof localStorage !== 'undefined') {
        try {
          cachedSummary = JSON.parse(localStorage.getItem(`vital_group_progress_${groupId}`) || 'null');
        } catch (e) {}
      }

      let journeyData = this.currentJourneyData;
      if (!journeyData && typeof localStorage !== 'undefined') {
        try {
          journeyData = JSON.parse(localStorage.getItem('vital_group_journey') || 'null');
        } catch (e) {}
      }

      const groupName = (journeyData && journeyData.groupName) || p.groupName || groupId;
      const chapterTitle = (journeyData && journeyData.currentChapter && (journeyData.currentChapter.title || journeyData.currentChapter.name)) || (journeyData && journeyData.chapterTitle) || '起步啟航';
      const chapterIndex = (journeyData && journeyData.currentChapter && (journeyData.currentChapter.index || journeyData.currentChapter.chapterIndex)) || (journeyData && journeyData.currentChapter) || 1;

      // 內部渲染輔助函式
      const renderModalContent = (summaryData, isRefreshing = false) => {
        if (!this.infoModalContent) return;

        const totalGroupScore = Number(
          (summaryData && (summaryData.groupTotalPoints !== undefined ? summaryData.groupTotalPoints : summaryData.totalPoints)) ||
          (journeyData && (journeyData.totalPoints || journeyData.totalScore)) ||
          0
        );

        let groupProfile = null;
        if (typeof localStorage !== 'undefined') {
          try { groupProfile = JSON.parse(localStorage.getItem(`vital_group_profile_${groupId}`) || 'null'); } catch(e){}
        }

        const contribs = (summaryData && (summaryData.memberContribution || summaryData.meberContribution)) || {};

        // 收集小組成員資訊
        const membersMap = new Map();
        const membersMeta = (groupProfile && groupProfile.members) || [];
        if (Array.isArray(membersMeta)) {
          membersMeta.forEach(m => {
            if (m && m.playerId) {
              membersMap.set(m.playerId, {
                playerId: m.playerId,
                name: m.name || m.playerName || m.playerId,
                avatarUrl: m.avatarUrl || '',
                avatarKey: m.avatarKey || '001',
                gender: m.gender || '',
                points: 0
              });
            }
          });
        }

        // 匯入各組員貢獻點數
        for (const mId in contribs) {
          const pts = Number(contribs[mId]) || 0;
          if (membersMap.has(mId)) {
            membersMap.get(mId).points = pts;
          } else {
            membersMap.set(mId, {
              playerId: mId,
              name: mId,
              avatarUrl: '',
              avatarKey: '001',
              gender: '',
              points: pts
            });
          }
        }

        // 若當前使用者尚未在 membersMap 中
        const currentPid = p.playerId || (this.currentUserProfile && (this.currentUserProfile.playerId || this.currentUserProfile.id));
        if (currentPid && !membersMap.has(currentPid)) {
          membersMap.set(currentPid, {
            playerId: currentPid,
            name: p.name || p.username || currentPid,
            avatarUrl: p.avatarUrl || '',
            avatarKey: p.avatarKey || '001',
            gender: p.gender || '',
            points: Number(summaryData?.individualPoints !== undefined ? summaryData.individualPoints : myContribPoints)
          });
        }

        const membersArray = Array.from(membersMap.values());
        // 依點數由高至低排序
        membersArray.sort((a, b) => b.points - a.points);

        // 計算「小組所有成員當年度的總貢獻」
        const allMembersTotalContrib = membersArray.reduce((acc, m) => acc + (Number(m.points) || 0), 0);

        // 計算「共同取得」= group total points 減去「小組所有成員當年度的總貢獻」
        const cooperativeScore = Math.max(0, totalGroupScore - allMembersTotalContrib);

        const memberCount = (groupProfile && (typeof groupProfile.memberCount === 'number' ? groupProfile.memberCount : groupProfile.members?.length)) || (membersArray.length > 0 ? membersArray.length : 1);

        // 組員卡片 HTML
        const memberRows = membersArray.map(m => {
          const isMe = (m.playerId === currentPid) || (m.playerId === p.id);
          const name = m.name || m.playerId;
          const initial = name ? name.charAt(0) : '?';

          // 解析頭像
          let avatarUrl = m.avatarUrl;
          if (!avatarUrl && m.avatarKey) {
            if (String(m.avatarKey).includes('.png')) {
              avatarUrl = m.avatarKey;
            } else {
              const currentGender = String(m.gender).toUpperCase();
              const isFemale = currentGender === 'SISTER' || currentGender === 'FEMALE';
              const folder = isFemale ? 'avatar-female' : 'avatar-male';
              const prefix = isFemale ? 'avatar-female-direct' : 'avatar-male-direct';
              const match = String(m.avatarKey).match(/\d+/);
              const no = match ? String(match[0]).padStart(3, '0') : '001';
              avatarUrl = `../${folder}/${prefix}-${no}.png`;
            }
          }
          if (isMe && this.currentUserProfile?.avatarUrl) {
            avatarUrl = this.currentUserProfile.avatarUrl;
          }

          const avatarContent = avatarUrl
            ? `<img src="${this.escapeHtml(avatarUrl)}" alt="${this.escapeHtml(name)}頭像" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';"><span class="group-contribution-avatar is-placeholder" style="display:none;">${this.escapeHtml(initial)}</span>`
            : `<span class="group-contribution-avatar is-placeholder">${this.escapeHtml(initial)}</span>`;

          return `
            <article class="group-contribution-member${isMe ? ' is-me' : ''}">
              <span class="group-contribution-avatar">
                ${avatarContent}
              </span>
              <div class="group-contribution-member-name">
                <strong>${this.escapeHtml(name)}</strong>
                ${isMe ? '<small>我</small>' : ''}
              </div>
              <div class="group-contribution-member-score">
                <strong>${m.points.toLocaleString()}</strong>
                <span>點</span>
              </div>
            </article>
          `;
        }).join('');

        this.infoModalContent.innerHTML = `
          <div class="group-contribution-container" style="max-height: 72vh; overflow-y: auto; padding: 4px;">
            <section class="group-contribution-summary">
              <span>活力組總點數</span>
              <strong>${totalGroupScore.toLocaleString()}<small>點</small></strong>
              <p>${this.escapeHtml(groupName)} ｜ ${memberCount} 位組員</p>
              <div class="group-contribution-breakdown">
                <span>共同取得 <strong>${cooperativeScore.toLocaleString()} 點</strong></span>
                <span>個人貢獻 <strong>${allMembersTotalContrib.toLocaleString()} 點</strong></span>
              </div>
            </section>

            <section class="group-contribution-section">
              <div class="group-contribution-list-head">
                <h3>個人貢獻</h3>
                <span>依點數排序</span>
              </div>
              <div class="group-contribution-list">
                ${memberRows || '<div class="empty-card" style="padding:16px;text-align:center;color:#64748b;">目前尚無組員貢獻資料</div>'}
              </div>
            </section>

            <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:10px 14px; text-align:center; font-size:12px; color:#64748b; line-height:1.5; margin-top:14px;">
              ${isRefreshing ? '<span style="color:#0284c7; font-weight:600;">🔄 正在即時同步最新進度...</span><br>' : ''}
              💡 每日晨興、讀經、禱告、書報與聚會回報，均會為小組累積活力點數，推進篇章突破！
            </div>
          </div>
        `;
      };

      // 1. 若有快取，先立即展示快取，提供秒開體驗
      if (cachedSummary && (cachedSummary.groupTotalPoints !== undefined || cachedSummary.totalPoints !== undefined)) {
        renderModalContent(cachedSummary, true);
      } else {
        if (this.infoModalContent) {
          this.infoModalContent.innerHTML = '<div style="text-align:center;padding:30px;color:#64748b;">讀取當年度同行貢獻資料中...</div>';
        }
      }

      // 2. 向後端非同步請求 getGroupProgress 與 getGroupProfile 更新最新數據
      try {
        const promises = [];
        if (this.apiClient && typeof this.apiClient.getGroupProgress === 'function') {
          promises.push(this.apiClient.getGroupProgress(groupId));
        } else {
          promises.push(Promise.resolve(null));
        }
        if (this.apiClient && typeof this.apiClient.getGroupProfile === 'function') {
          promises.push(this.apiClient.getGroupProfile(groupId));
        } else {
          promises.push(Promise.resolve(null));
        }

        const [progressRes, profileRes] = await Promise.allSettled(promises);
        let latestProgress = null;

        if (profileRes.status === 'fulfilled' && profileRes.value && (profileRes.value.success || profileRes.value.data)) {
          const profileData = profileRes.value.data || profileRes.value;
          if (typeof localStorage !== 'undefined') {
            try { localStorage.setItem(`vital_group_profile_${groupId}`, JSON.stringify(profileData)); } catch(e){}
          }
        }

        if (progressRes.status === 'fulfilled' && progressRes.value && (progressRes.value.success || progressRes.value.data)) {
          latestProgress = progressRes.value.data || progressRes.value;
          if (typeof localStorage !== 'undefined') {
            try { localStorage.setItem(`vital_group_progress_${groupId}`, JSON.stringify(latestProgress)); } catch(e){}
          }
          renderModalContent(latestProgress, false);

          // 即時同步最新小組點數至首頁旅程 (currentJourneyData 與 dashboardView)
          try {
            const latestPts = Number(latestProgress.totalPoints !== undefined ? latestProgress.totalPoints : (latestProgress.groupTotalPoints !== undefined ? latestProgress.groupTotalPoints : 0));
            if (latestPts > 0 && typeof window !== 'undefined') {
              if (window.currentJourneyData) {
                window.currentJourneyData.totalPoints = latestPts;
                window.currentJourneyData.totalScore = latestPts;
                window.currentJourneyData.groupTotalPoints = latestPts;
              }
              if (window.dashboardView && typeof window.dashboardView.render === 'function') {
                window.dashboardView.render(this.currentUserProfile, window.currentJourneyData);
              }
            }
          } catch(syncErr) {}
        }
      } catch (err) {
        console.warn('[ProfileView] 獲取最新小組進度失敗:', err);
        if (!cachedSummary || (cachedSummary.groupTotalPoints === undefined && cachedSummary.totalPoints === undefined)) {
          if (this.infoModalContent) {
            this.infoModalContent.innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444;">讀取同行貢獻失敗：${this.escapeHtml(err.message || '連線逾時')}</div>`;
          }
        }
      }
    }
    
    escapeHtml(str) {
      if (typeof VitalUtils !== 'undefined' && VitalUtils.escapeHtml) {
        return VitalUtils.escapeHtml(str);
      }
      return String(str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ProfileView };
  }
  global.ProfileView = ProfileView;

})(typeof window !== 'undefined' ? window : global);
