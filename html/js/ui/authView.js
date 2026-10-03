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
      this.myViewEl = document.getElementById('myView');
      this.loginForm = document.getElementById('loginForm');
      this.openRegisterBtn = document.getElementById('openRegisterBtn');
      this.registerModal = document.getElementById('registerModal');
      this.registerForm = document.getElementById('registerForm');
      this.districtSelect = document.getElementById('registerCareDistrict');
      this.areaSelect = document.getElementById('registerCareArea');
      this.authMessage = document.getElementById('authMessage');

      // 預設資料：在尚未抓到後端資料時提供即時預設連動 (最新 6 照顧區與 45 大區)
      const defaultDistricts = (apiClient && apiClient.cachedAreaOptions && apiClient.cachedAreaOptions.length)
        ? apiClient.cachedAreaOptions
        : ((typeof ApiClient !== 'undefined' && ApiClient.DEFAULT_DISTRICTS) || []);
      this.areaData = defaultDistricts;
      this.registerAvatarNo = 1;
      this.registerAvatarGender = 'male';

      this.initEvents_();

      // 在尚未抓到後端資料時，立即以前端預設值填充下拉選單
      if (this.districtSelect && this.areaData.length > 0) {
        this.renderDistrictOptions_(this.areaData);
      }
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
              const profile = (res.data && res.data.player) || res.player || (res.data && res.data.profile) || res.profile || res.data || {};
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

      // 監聽照顧區資料熱更新事件
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('vital_area_options_updated', (evt) => {
          if (Array.isArray(evt.detail) && evt.detail.length > 0) {
            this.renderDistrictOptions_(evt.detail);
          }
        });
      }

      // 註冊頭像選擇器
      const genderSelect = document.getElementById('registerAvatarGender');
      if (genderSelect) {
        genderSelect.addEventListener('change', () => {
          this.registerAvatarGender = genderSelect.value || 'male';
          this.updateRegisterAvatar_();
        });
      }

      const prevBtn = document.getElementById('registerPrevAvatarBtn');
      if (prevBtn) {
        prevBtn.addEventListener('click', () => this.stepRegisterAvatar_(-1));
      }

      const nextBtn = document.getElementById('registerNextAvatarBtn');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => this.stepRegisterAvatar_(1));
      }

      const randomBtn = document.getElementById('registerRandomAvatarBtn');
      if (randomBtn) {
        randomBtn.addEventListener('click', () => this.randomizeRegisterAvatar_());
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
          const name = (document.getElementById('registerName') || document.getElementById('regName') || {}).value?.trim() || username;
          const birthYear = (document.getElementById('registerBirthYear') || {}).value;
          const phone = (document.getElementById('registerPhone') || {}).value?.trim() || '';
          const gender = (document.getElementById('registerAvatarGender') || {}).value || 'male';

          const regMsgEl = document.getElementById('registerMessage');
          if (regMsgEl) regMsgEl.classList.add('hidden');

          if (!district || !area) {
            this.showRegisterMessage_('請選擇照顧區與大區');
            return;
          }

          if (password !== confirmPassword) {
            this.showRegisterMessage_('兩次輸入的密碼不一致，請重新確認');
            return;
          }

          const regBtn = this.registerForm.querySelector('button[type="submit"]') || this.registerForm.querySelector('.primary-btn');
          if (regBtn) {
            regBtn.disabled = true;
            regBtn.textContent = '註冊中...';
          }

          try {
            const avatarUrl = this.updateRegisterAvatar_();

            const res = await this.apiClient.register({
              username,
              password,
              name,
              phone,
              careDistrict: district,
              careArea: area,
              birthYear,
              gender: gender === 'female' ? 'SISTER' : 'BROTHER',
              avatarUrl
            });

            if (res && res.success) {
              alert('註冊成功！已為您自動登入進入旅程');
              if (this.registerModal) this.registerModal.classList.add('hidden');
              this.hideAuth();
              const profile = (res.data && res.data.player) || res.player || (res.data && res.data.profile) || res.profile || res.data || {};
              if (typeof this.onLoginSuccess === 'function') {
                this.onLoginSuccess(profile);
              }
            } else {
              const errMsg = (res && (res.error || res.message)) || '註冊失敗';
              this.showRegisterMessage_(errMsg);
            }
          } catch (err) {
            this.showRegisterMessage_(err.message || '註冊失敗，請稍後再試');
          } finally {
            if (regBtn) {
              regBtn.disabled = false;
              regBtn.textContent = '完成註冊';
            }
          }
        });
      }
    }

    stepRegisterAvatar_(delta) {
      let no = this.registerAvatarNo + delta;
      if (no < 1) no = 8;
      if (no > 8) no = 1;
      this.registerAvatarNo = no;
      this.updateRegisterAvatar_();
    }

    randomizeRegisterAvatar_() {
      this.registerAvatarNo = Math.floor(Math.random() * 8) + 1;
      this.updateRegisterAvatar_();
    }

    updateRegisterAvatar_() {
      const img = document.getElementById('registerAvatarPreview');
      const info = document.getElementById('registerAvatarInfo');
      const gender = this.registerAvatarGender || 'male';
      const no = this.registerAvatarNo || 1;
      const genderLabel = gender === 'female' ? '姊妹' : '弟兄';
      const folder = gender === 'female' ? 'avatar-female' : 'avatar-male';
      const prefix = gender === 'female' ? 'avatar-female-direct' : 'avatar-male-direct';
      const padNo = String(no).padStart(3, '0');
      const url = `../${folder}/${prefix}-${padNo}.png`;

      if (img) img.src = url;
      if (info) info.textContent = `${genderLabel}｜第 ${no} 號`;
      return url;
    }

    showRegisterMessage_(msg) {
      const regMsgEl = document.getElementById('registerMessage');
      if (regMsgEl) {
        regMsgEl.textContent = msg;
        regMsgEl.className = 'result-box error';
        regMsgEl.classList.remove('hidden');
      } else {
        alert(msg);
      }
    }

    async openRegisterModal() {
      if (this.registerModal) {
        this.registerModal.classList.remove('hidden');
      }
      this.registerAvatarNo = 1;
      const gSel = document.getElementById('registerAvatarGender');
      if (gSel) this.registerAvatarGender = gSel.value || 'male';
      this.updateRegisterAvatar_();
      await this.loadAreaOptions_();
    }

    async loadAreaOptions_(force = false) {
      if (!this.districtSelect) return;
      try {
        const res = await this.apiClient.getRegistrationAreaOptions(force);
        const districts = (res && (res.districts || (res.data && res.data.districts))) || [];
        if (districts.length > 0) {
          this.renderDistrictOptions_(districts);
        }
      } catch (err) {
        console.warn('[AuthView] 讀取照顧區選單失敗', err);
      }
    }

    renderDistrictOptions_(districts) {
      if (!this.districtSelect) return;
      const prevDistrict = this.districtSelect.value;
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
        const stillExists = districts.some(d => d.careDistrict === prevDistrict);
        const targetVal = (prevDistrict && stillExists) ? prevDistrict : districts[0].careDistrict;
        this.districtSelect.value = targetVal;
        this.updateAreaOptions_(targetVal);
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
      if (this.myViewEl) this.myViewEl.classList.add('hidden');
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
