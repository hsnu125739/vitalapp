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
                  leaveBtn.disabled = false;
                  leaveBtn.textContent = leaveBtnText;
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
                  leaveBtn.disabled = false;
                  leaveBtn.textContent = leaveBtnText;
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
                      <img src="${(typeof window.AppCoordinator !== 'undefined' ? '' : '../') + 'images/avatar-male-direct-001.png'}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;background:#e2e8f0;" />
                      <span style="font-size:14px;color:#334155;font-weight:500;">${this.escapeHtml(m.name || m.playerId)}</span>
                    </div>
                    <button type="button" class="primary-btn" style="padding:4px 10px;font-size:12px;border-radius:4px;">交接</button>
                  `;
                  const tBtn = item.querySelector('button');
                  tBtn.addEventListener('click', async () => {
                    if (confirm(`確定要將組長交接給「${m.name || m.playerId}」嗎？`)) {
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
                          tBtn.disabled = false;
                          tBtn.textContent = '交接';
                        }
                      } catch (err) {
                        alert('交接失敗：' + err.message);
                        tBtn.disabled = false;
                        tBtn.textContent = '交接';
                      }
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
                  }
                  this.currentJourneyData = null;
                  this.render(this.currentUserProfile, null);
                  if (typeof window.AppCoordinator?.updateUserGroupState === 'function') {
                    window.AppCoordinator.updateUserGroupState('');
                  }

                  alert('活力組已成功解散！');
                  if (vitalModal) vitalModal.classList.add('hidden');
                  if (typeof window.AppCoordinator?.refreshUserData === 'function') {
                    window.AppCoordinator.refreshUserData();
                  }
                } else {
                  alert((res && (res.error || res.message)) || '解散活力組失敗');
                  leaveBtn.disabled = false;
                  leaveBtn.textContent = '解散活力組';
                }
              } catch (err) {
                alert(err.message || '連線逾時，請稍後再試');
                leaveBtn.disabled = false;
                leaveBtn.textContent = '解散活力組';
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
                  }
                  this.currentJourneyData = null;
                  this.render(this.currentUserProfile, null);
                  if (typeof window.AppCoordinator?.updateUserGroupState === 'function') {
                    window.AppCoordinator.updateUserGroupState('');
                  }

                  alert('已成功退出活力組！');
                  if (vitalModal) vitalModal.classList.add('hidden');
                  if (typeof window.AppCoordinator?.refreshUserData === 'function') {
                    window.AppCoordinator.refreshUserData();
                  }
                } else {
                  alert((res && (res.error || res.message)) || '退出活力組失敗');
                  leaveBtn.disabled = false;
                  leaveBtn.textContent = '退出活力組';
                }
              } catch (err) {
                alert(err.message || '連線逾時，請稍後再試');
                leaveBtn.disabled = false;
                leaveBtn.textContent = '退出活力組';
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
                    btn.disabled = false;
                    btn.textContent = '指定為組長 →';
                  }
                } catch (err) {
                  alert(err.message || '連線逾時，請稍後再試');
                  btn.disabled = false;
                  btn.textContent = '指定為組長 →';
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
          if (this.currentUserProfile && this.currentUserProfile.groupId) {
            alert('您目前已在活力組中，無法重複建立小組。若需換組請先退出原小組。');
            return;
          }
          const nameInput = document.getElementById('createVitalGroupName');
          const groupName = nameInput ? nameInput.value.trim() : '';
          if (!groupName) {
            alert('請輸入活力組名稱');
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
              }
              this.render(this.currentUserProfile, null);
              if (typeof window.AppCoordinator?.updateUserGroupState === 'function') {
                window.AppCoordinator.updateUserGroupState(createdGId, groupName, true);
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
          }
        });
      }

      if (joinGrpForm) {
        joinGrpForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (this.currentUserProfile && this.currentUserProfile.groupId) {
            alert('您目前已在活力組中，無法重複加入小組。若需換組請先退出原小組。');
            return;
          }
          const codeInput = document.getElementById('joinVitalGroupCode');
          const inviteCode = codeInput ? codeInput.value.trim() : '';
          if (!inviteCode) {
            alert('請輸入邀請碼');
            return;
          }

          try {
            const res = await this.apiClient.joinGroup({ inviteCode });
            if (res && res.success) {
              const joinedGroup = res.group || (res.data && res.data.group) || {};
              const newGId = joinedGroup.groupId || res.groupId || (res.data && res.data.groupId) || '';
              const newGName = joinedGroup.groupName || res.groupName || (res.data && res.data.groupName) || '';

              // 1. 立即樂觀更新為組員身分（零延遲）
              if (this.currentUserProfile) {
                this.currentUserProfile.groupId = newGId;
                this.currentUserProfile.groupName = newGName;
                this.currentUserProfile.isLeader = false;
              }
              this.render(this.currentUserProfile, null);
              if (typeof window.AppCoordinator?.updateUserGroupState === 'function') {
                window.AppCoordinator.updateUserGroupState(newGId, newGName, false);
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
      const myPersonalPoints = Number(p.personalPoints !== undefined ? p.personalPoints : (p.totalPoints !== undefined ? p.totalPoints : (p.totalScore || 0)));
      const myContribPoints = Number(p.contributionPoints !== undefined ? p.contributionPoints : (p.contribution || 0));

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

      try {
        let summary = null;
        if (this.apiClient && typeof this.apiClient.getMyGroupContributionSummary === 'function') {
          const res = await this.apiClient.getMyGroupContributionSummary(groupId);
          if (res && res.success) {
            summary = res.data || res;
          }
        }

        let journeyData = this.currentJourneyData;
        if (!journeyData && typeof localStorage !== 'undefined') {
          try {
            journeyData = JSON.parse(localStorage.getItem('vital_group_journey') || 'null');
          } catch (e) {}
        }

        const groupName = (journeyData && journeyData.groupName) || p.groupName || groupId;
        const totalGroupScore = Number((summary && summary.groupTotalPoints) || (journeyData && (journeyData.totalPoints || journeyData.totalScore)) || 0);
        const myContribScore = Number(summary && summary.individualPoints !== undefined ? summary.individualPoints : myContribPoints);
        
        let percent = (summary && summary.contributionPercent);
        if (typeof percent === 'string') {
          percent = parseInt(percent, 10) || 0;
        } else if (typeof percent === 'number') {
          percent = Math.round(percent);
        } else {
          percent = totalGroupScore > 0 ? Math.min(100, Math.round((myContribScore / totalGroupScore) * 100)) : (myContribScore > 0 ? 100 : 0);
        }
        const coScore = Math.max(0, totalGroupScore - myContribScore);

        const chapterTitle = (journeyData && journeyData.currentChapter && (journeyData.currentChapter.title || journeyData.currentChapter.name)) || (journeyData && journeyData.chapterTitle) || '起步啟航';
        const chapterIndex = (journeyData && journeyData.currentChapter && (journeyData.currentChapter.index || journeyData.currentChapter.chapterIndex)) || (journeyData && journeyData.currentChapter) || 1;

        if (this.infoModalContent) {
          this.infoModalContent.innerHTML = `
            <div style="padding:16px;">
              <div style="background:linear-gradient(135deg, #f0fdf4 0%, #e0f2fe 100%); border:1px solid #bae6fd; border-radius:14px; padding:16px; margin-bottom:16px; text-align:center;">
                <div style="font-size:12px; font-weight:700; color:#0284c7; text-transform:uppercase; letter-spacing:0.5px;">VITAL GROUP JOURNEY</div>
                <h3 style="font-size:18px; font-weight:800; color:#0f172a; margin:4px 0 8px 0;">${this.escapeHtml(groupName)}</h3>
                <div style="display:inline-flex; align-items:center; gap:6px; background:#fff; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:700; color:#16a34a; box-shadow:0 1px 3px rgba(0,0,0,0.06);">
                  <span>🏆 當前篇章：第 ${chapterIndex} 篇【${this.escapeHtml(chapterTitle)}】</span>
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:14px; text-align:center;">
                  <div style="font-size:12px; color:#64748b; font-weight:600;">小組當年度累積點數</div>
                  <div style="font-size:24px; font-weight:800; color:#2563eb; margin-top:4px;">${totalGroupScore.toLocaleString()}<small style="font-size:12px; font-weight:600; margin-left:2px;">分</small></div>
                </div>
                <div style="background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:14px; text-align:center;">
                  <div style="font-size:12px; color:#64748b; font-weight:600;">個人當年度貢獻點數</div>
                  <div style="font-size:24px; font-weight:800; color:#16a34a; margin-top:4px;">${myContribScore.toLocaleString()}<small style="font-size:12px; font-weight:600; margin-left:2px;">分</small></div>
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
                  <span>我的貢獻：${myContribScore.toLocaleString()} 分</span>
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
          this.infoModalContent.innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444;">讀取同行貢獻失敗：${this.escapeHtml(err.message || '連線逾時')}</div>`;
        }
      }
    }
    
    escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ProfileView };
  }
  global.ProfileView = ProfileView;

})(typeof window !== 'undefined' ? window : global);
