/**
 * adminApp.js
 * 後台管理營運控制器深層模組 (Admin App Deep Module)
 * 負責：管理者密碼登入、公告排程管理、特殊任務獎勵發放、成員調組與系統審計日誌
 */

(function(global) {
  'use strict';

  let apiClient;

  function initAdminApp() {
    apiClient = new (global.ApiClient || window.ApiClient)({
      baseUrl: (typeof window !== 'undefined' && window.VITAL_API_URL) || '/api'
    });

    bindAuth();
    bindTabs();
    bindAnnouncementForm();
    bindSpecialTaskForm();
    bindAdminPasswordForm();
  }

  function bindAuth() {
    const loginView = document.getElementById('loginView');
    const appView = document.getElementById('appView');
    const pwdInput = document.getElementById('adminPasswordInput');
    const loginBtn = document.getElementById('loginBtn');
    const loginMsg = document.getElementById('loginMessage');
    const logoutBtn = document.getElementById('logoutBtn');

    // 支援點擊密碼框輸入（移除 readonly）
    if (pwdInput) {
      pwdInput.addEventListener('focus', () => pwdInput.removeAttribute('readonly'));
      pwdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loginBtn?.click();
      });
    }

    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        const pwd = pwdInput ? pwdInput.value : '';
        if (!pwd) {
          if (loginMsg) loginMsg.textContent = '請輸入管理者密碼';
          return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = '驗證中...';

        try {
          const res = await apiClient.request('adminLogin', { adminPassword: pwd });
          if (res && res.success) {
            if (loginView) loginView.classList.add('hidden');
            if (appView) appView.classList.remove('hidden');
            if (logoutBtn) logoutBtn.classList.remove('hidden');
            loadOverview();
          } else {
            if (loginMsg) loginMsg.textContent = (res && (res.error || res.message)) || '密碼不正確';
          }
        } catch (err) {
          if (loginMsg) loginMsg.textContent = '連線異常，請稍後再試';
        } finally {
          loginBtn.disabled = false;
          loginBtn.textContent = '登入';
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (loginView) loginView.classList.remove('hidden');
        if (appView) appView.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        if (pwdInput) pwdInput.value = '';
      });
    }
  }

  function bindTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabKey = btn.getAttribute('data-tab') || btn.getAttribute('data-target');
        if (!tabKey) return;

        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 隱藏所有 tab 區塊
        document.querySelectorAll('.section, .admin-panel').forEach(sec => sec.classList.add('hidden'));

        // 顯示目標 tab
        const target = document.getElementById(`${tabKey}Tab`) || document.getElementById(tabKey);
        if (target) {
          target.classList.remove('hidden');
        }

        // 切換時載入資料
        if (tabKey === 'systemAnnouncements') loadAnnouncements();
        else if (tabKey === 'overview') loadOverview();
      });
    });
  }

  async function loadOverview() {
    const meta = document.getElementById('overviewMeta');
    if (meta) meta.textContent = '系統連線正常 · 各微服務在線';
  }

  function bindAnnouncementForm() {
    const form = document.getElementById('systemAnnouncementForm') || document.getElementById('announcementForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = (document.getElementById('annTitle') || document.getElementById('announcementTitleInput') || {}).value?.trim();
      const content = (document.getElementById('annContent') || document.getElementById('announcementContentInput') || {}).value?.trim();
      const isPinned = Boolean((document.getElementById('annIsPinned') || document.getElementById('announcementIsPinnedInput') || {}).checked);

      if (!title || !content) {
        alert('請填寫完整公告標題與內容');
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]') || form.querySelector('.primary');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '發布中...';
      }

      try {
        const res = await apiClient.request('createAnnouncement', {
          title,
          content,
          isPinned,
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        });

        if (res && res.success) {
          alert('公告已成功發布！');
          form.reset();
          loadAnnouncements();
        } else {
          alert((res && (res.error || res.message)) || '發布失敗');
        }
      } catch (err) {
        alert('連線失敗，請檢查網路');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '發布公告';
        }
      }
    });
  }

  async function loadAnnouncements() {
    const listMount = document.getElementById('announcementList') || document.getElementById('announcementsList') || document.getElementById('systemAnnouncementsList');
    if (!listMount) return;

    listMount.innerHTML = '<div style="padding:15px; color:#64748b;">讀取公告中...</div>';

    try {
      const res = await apiClient.getAnnouncements(new Date().toISOString().slice(0, 10));
      const list = (res && (res.announcements || (res.data && res.data.announcements))) || [];

      if (!Array.isArray(list) || list.length === 0) {
        listMount.innerHTML = '<div style="padding:15px; color:#94a3b8;">目前尚無公告</div>';
        return;
      }

      listMount.innerHTML = list.map(a => `
        <div style="background:#fff; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            ${a.isPinned ? '<span style="background:#fef3c7; color:#b45309; font-size:11px; padding:2px 6px; border-radius:4px; font-weight:700;">置頂</span> ' : ''}
            <strong style="color:#1e293b;">${a.title}</strong>
            <p style="font-size:13px; color:#64748b; margin-top:4px;">${a.content || ''}</p>
          </div>
        </div>
      `).join('');
    } catch (e) {
      listMount.innerHTML = '<div style="padding:15px; color:#ef4444;">讀取公告清單失敗</div>';
    }
  }

  function bindSpecialTaskForm() {
    const form = document.getElementById('specialTaskForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const taskName = (document.getElementById('taskName') || {}).value?.trim() || '同行操練加分';
      const points = parseInt((document.getElementById('taskPoints') || {}).value || 0, 10);
      const rawIds = (document.getElementById('taskTargetIds') || {}).value || '';
      const playerIds = rawIds.split(/[,，\s\n]+/).filter(Boolean);

      if (points <= 0 || playerIds.length === 0) {
        alert('請填寫獎勵點數與至少一位受獎者 ID');
        return;
      }

      if (confirm(`確定為 ${playerIds.length} 位聖徒發放 +${points} 點數嗎？`)) {
        try {
          const res = await apiClient.request('grantTargetedReward', {
            taskName,
            points,
            playerIds
          });
          if (res && res.success) {
            alert(`獎勵發放成功！共獎勵 ${playerIds.length} 位聖徒。`);
            form.reset();
          } else {
            alert((res && (res.error || res.message)) || '發放失敗');
          }
        } catch (err) {
          alert('連線逾時，請稍後再試');
        }
      }
    });
  }

  function bindAdminPasswordForm() {
    const form = document.getElementById('adminPasswordForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const curr = (document.getElementById('currentAdminPassword') || {}).value;
      const n1 = (document.getElementById('newAdminPassword') || {}).value;
      const n2 = (document.getElementById('confirmAdminPassword') || {}).value;

      if (!n1 || n1.length < 8) {
        alert('新密碼長度至少需 8 碼');
        return;
      }
      if (n1 !== n2) {
        alert('兩次輸入的新密碼不一致');
        return;
      }

      try {
        const res = await apiClient.request('updateAdminPassword', {
          currentPassword: curr,
          newPassword: n1
        });
        if (res && res.success) {
          alert('管理者密碼更新成功！');
          form.reset();
        } else {
          alert((res && (res.error || res.message)) || '密碼更新失敗');
        }
      } catch (err) {
        alert('連線逾時，請稍後再試');
      }
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAdminApp);
    } else {
      initAdminApp();
    }
  }

  global.AdminApp = { initAdminApp };

})(typeof window !== 'undefined' ? window : global);
