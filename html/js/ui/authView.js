/**
 * authView.js
 * 認證與帳號視圖深層模組 (Auth & Account View Module)
 * 負責：登入畫面、註冊彈窗、四照顧區與大區 SWR 下拉選單、Session 狀態協調
 */

(function(global) {
  'use strict';

  class AuthView {
    constructor({ apiClient, onLoginSuccess }) {
      this.apiClient = apiClient;
      this.onLoginSuccess = onLoginSuccess;

      this.authViewEl = document.getElementById('authView');
      this.homeViewEl = document.getElementById('homeView');
      this.loginForm = document.getElementById('loginForm');
      this.openRegisterBtn = document.getElementById('openRegisterBtn');
      this.registerModal = document.getElementById('registerModal');
      this.registerForm = document.getElementById('registerForm');
      this.districtSelect = document.getElementById('registerCareDistrict');
      this.areaSelect = document.getElementById('registerCareArea');
      this.authMessage = document.getElementById('authMessage');

      this.areaData = [];

      this.initEvents_();
    }

    initEvents_() {
      // 登入提交
      if (this.loginForm) {
        this.loginForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const username = (document.getElementById('loginName') || {}).value?.trim();
          const password = (document.getElementById('loginPassword') || {}).value;
          const keepLogin = (document.getElementById('keepLoginCheckbox') || {}).checked;

          if (!username || !password) {
            this.showMessage('請輸入帳號與密碼', 'error');
            return;
          }

          const submitBtn = this.loginForm.querySelector('button[type="submit"]');
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '進入旅程中...';
          }

          try {
            const res = await this.apiClient.login(username, password);
            if (res && res.success) {
              const profile = (res.data && res.data.player) || res.data || {};
              if (keepLogin && typeof localStorage !== 'undefined') {
                localStorage.setItem('vital_keep_login', 'true');
              }
              this.hideAuth();
              if (typeof this.onLoginSuccess === 'function') {
                this.onLoginSuccess(profile);
              }
            } else {
              this.showMessage((res && (res.error || res.message)) || '帳號或密碼錯誤', 'error');
            }
          } catch (err) {
            this.showMessage(err.message || '連線逾時，請檢查網路後再試一次', 'error');
          } finally {
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = '進入旅程';
            }
          }
        });
      }

      // 開啟註冊彈窗
      if (this.openRegisterBtn) {
        this.openRegisterBtn.addEventListener('click', () => {
          this.openRegisterModal();
        });
      }

      // 關閉 Modal 按鈕
      document.querySelectorAll('[data-close-modal="registerModal"]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (this.registerModal) this.registerModal.classList.add('hidden');
        });
      });

      // 照顧區聯動
      if (this.districtSelect) {
        this.districtSelect.addEventListener('change', () => {
          this.updateAreaOptions_(this.districtSelect.value);
        });
      }

      // 註冊提交
      if (this.registerForm) {
        this.registerForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const district = this.districtSelect?.value;
          const area = this.areaSelect?.value;
          const username = (document.getElementById('registerLoginName') || {}).value?.trim();
          const password = (document.getElementById('registerPassword') || {}).value;
          const confirmPassword = (document.getElementById('registerPasswordConfirm') || {}).value;
          const name = (document.getElementById('registerName') || {}).value?.trim();
          const birthYear = (document.getElementById('registerBirthYear') || {}).value;
          const gender = (document.getElementById('registerAvatarGender') || {}).value || 'male';

          if (password !== confirmPassword) {
            alert('兩次輸入的密碼不一致，請重新確認');
            return;
          }

          const regBtn = this.registerForm.querySelector('button[type="submit"]') || this.registerForm.querySelector('.primary-btn');
          if (regBtn) {
            regBtn.disabled = true;
            regBtn.textContent = '註冊中...';
          }

          try {
            const avatarUrl = gender === 'female'
              ? '../avatar-female/Avatar_Female_01.png'
              : '../avatar-male/Avatar_Male_01.png';

            const res = await this.apiClient.register({
              username,
              password,
              name,
              careDistrict: district,
              careArea: area,
              birthYear,
              avatarUrl
            });

            if (res && res.success) {
              alert('註冊成功！已為您自動登入進入旅程');
              if (this.registerModal) this.registerModal.classList.add('hidden');
              this.hideAuth();
              const profile = (res.data && res.data.player) || res.data || {};
              if (typeof this.onLoginSuccess === 'function') {
                this.onLoginSuccess(profile);
              }
            } else {
              alert((res && (res.error || res.message)) || '註冊失敗');
            }
          } catch (err) {
            alert(err.message || '註冊失敗，請稍後再試');
          } finally {
            if (regBtn) {
              regBtn.disabled = false;
              regBtn.textContent = '完成註冊並登入';
            }
          }
        });
      }
    }

    async openRegisterModal() {
      if (this.registerModal) {
        this.registerModal.classList.remove('hidden');
      }
      await this.loadAreaOptions_();
    }

    async loadAreaOptions_() {
      if (!this.districtSelect) return;
      try {
        const res = await this.apiClient.getRegistrationAreaOptions();
        const districts = (res && (res.districts || (res.data && res.data.districts))) || [];
        this.areaData = districts;

        this.districtSelect.innerHTML = '<option value="">請選擇照顧區</option>';
        districts.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.careDistrict;
          opt.textContent = d.careDistrict;
          this.districtSelect.appendChild(opt);
        });
        this.districtSelect.disabled = false;

        if (districts.length > 0) {
          this.districtSelect.value = districts[0].careDistrict;
          this.updateAreaOptions_(districts[0].careDistrict);
        }
      } catch (err) {
        console.warn('[AuthView] 讀取照顧區選單失敗', err);
      }
    }

    updateAreaOptions_(selectedDistrict) {
      if (!this.areaSelect) return;
      const target = this.areaData.find(d => d.careDistrict === selectedDistrict);
      const areas = target?.careAreas || [];

      this.areaSelect.innerHTML = '<option value="">請選擇大區</option>';
      areas.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.careArea;
        opt.textContent = a.careArea;
        this.areaSelect.appendChild(opt);
      });
      this.areaSelect.disabled = areas.length === 0;
      if (areas.length > 0) {
        this.areaSelect.value = areas[0].careArea;
      }
    }

    showAuth() {
      if (this.authViewEl) this.authViewEl.classList.remove('hidden');
      if (this.homeViewEl) this.homeViewEl.classList.add('hidden');
      const bottomNav = document.getElementById('bottomNav');
      if (bottomNav) bottomNav.classList.add('hidden');
    }

    hideAuth() {
      if (this.authViewEl) this.authViewEl.classList.add('hidden');
      if (this.homeViewEl) this.homeViewEl.classList.remove('hidden');
      const bottomNav = document.getElementById('bottomNav');
      if (bottomNav) bottomNav.classList.remove('hidden');
    }

    showMessage(msg, type = 'info') {
      if (!this.authMessage) return;
      this.authMessage.textContent = msg;
      this.authMessage.className = `message-box ${type}`;
      this.authMessage.classList.remove('hidden');
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AuthView };
  }
  global.AuthView = AuthView;

})(typeof window !== 'undefined' ? window : global);
