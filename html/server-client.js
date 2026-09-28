'use strict';

/**
 * ======================================================================
 * 高雄青職「活力同行」前端 GAS RPC 通訊調度客戶端 (Iframe Bridge Client)
 * 依據 gas_speed_test/GAS_COMM_BEST_PRACTICE.md 規範實作
 * 特性：
 * 1. 支援 Core / Chat / Progression 三微服務獨立 Iframe 橋接，請求全面平行化
 * 2. 採用 google.script.run 內部長連線 RPC，徹底免除 doPost 之 302 跨域跳轉與延遲
 * 3. 100% 相容舊專案 window.GasBackend.invoke(action, args) 呼叫契約
 * ======================================================================
 */
(function(global) {
  const DEFAULT_REQUEST_TIMEOUT_MS = 45 * 1000;
  const LONG_REQUEST_TIMEOUT_MS = 3 * 60 * 1000;
  const LONG_RUNNING_ACTIONS = new Set([
    'adminRunDailyHotDataReconciliation',
    'adminRunWeeklyArchive',
    'adminRunArchiveCleanup',
    'adminPreviewFix12DataRepairs',
    'adminRunFix12DataRepairBatch',
    'adminEnsureDataMaintenanceTriggers'
  ]);

  const CHAT_ACTIONS = new Set([
    'getGroupPosts',
    'getGroupMessages',
    'getGroupMessageMatrix',
    'postGroupMessage',
    'createGroupPost',
    'deleteGroupPost',
    'setPinnedPost'
  ]);

  const PROGRESSION_ACTIONS = new Set([
    'getPlayerChestCollection',
    'claimPlayerChestReward',
    'claimChest',
    'getMyGroupContributionSummary',
    'getMilestonesConfig',
    'getPointsConfig',
    'getGroupJourney',
    'getGroupJourneyList',
    'settleMemberDeparture',
    'archiveAnnualGroupProgress'
  ]);

  // 各微服務連接實體池
  const channels = {
    CORE: { name: 'CORE', url: '', frame: null, source: null, readyPromise: null, readyResolve: null },
    CHAT: { name: 'CHAT', url: '', frame: null, source: null, readyPromise: null, readyResolve: null },
    PROGRESSION: { name: 'PROGRESSION', url: '', frame: null, source: null, readyPromise: null, readyResolve: null }
  };

  const pendingRequests = new Map();
  let requestSeq = 0;

  function getTargetService_(action) {
    if (CHAT_ACTIONS.has(action)) return 'CHAT';
    if (PROGRESSION_ACTIONS.has(action)) return 'PROGRESSION';
    return 'CORE';
  }

  function getServiceUrl_(serviceName) {
    const config = global.APP_RUNTIME_CONFIG || {};
    const fallbackUrl = String(config.gasWebAppUrl || '').trim();
    if (serviceName === 'CHAT') {
      return String(config.chatGasWebAppUrl || fallbackUrl).trim();
    }
    if (serviceName === 'PROGRESSION') {
      return String(config.progressionGasWebAppUrl || fallbackUrl).trim();
    }
    // CORE
    const adminUrl = String(config.adminGasWebAppUrl || '').trim();
    return String(config.coreGasWebAppUrl || (String(action_ || '').indexOf('admin') === 0 && adminUrl ? adminUrl : fallbackUrl)).trim();
  }

  let action_ = '';

  function ensureChannel_(serviceName) {
    const channel = channels[serviceName];
    if (!channel) return Promise.reject(new Error('Unknown service: ' + serviceName));
    if (channel.readyPromise) return channel.readyPromise;

    const url = getServiceUrl_(serviceName);
    channel.url = url;

    channel.readyPromise = new Promise((resolve) => {
      channel.readyResolve = resolve;

      if (!url) {
        console.warn(`[GasRpc] 尚未配置 ${serviceName} 的 Web App URL，呼叫將會暫緩或失敗。`);
        // 不卡死，等待動態設定
        return;
      }

      const mount = () => {
        if (channel.frame || !global.document.body) return;
        const iframe = global.document.createElement('iframe');
        iframe.id = 'gas_bridge_' + serviceName.toLowerCase();
        iframe.setAttribute('aria-hidden', 'true');
        iframe.setAttribute('tabindex', '-1');
        iframe.style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;border:0;opacity:0;pointer-events:none;';
        iframe.src = url;
        channel.frame = iframe;
        global.document.body.appendChild(iframe);
      };

      if (global.document.body) {
        mount();
      } else {
        global.document.addEventListener('DOMContentLoaded', mount, { once: true });
      }
    });

    return channel.readyPromise;
  }

  // 監聽來自所有 Bridge iframe 的 postMessage
  global.addEventListener('message', function(event) {
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;

    // 1. 收到 Bridge 就緒廣播
    if (msg.type === 'GAS_BRIDGE_READY') {
      const sName = (msg.service || '').toUpperCase();
      if (channels[sName]) {
        channels[sName].source = event.source;
        if (channels[sName].readyResolve) channels[sName].readyResolve(event.source);
        console.log(`[GasRpc] 微服務 ${sName} Bridge 就緒！`);
      } else {
        // 若 Bridge 未標註 service，預設綁定到全部未就緒通道
        Object.keys(channels).forEach(k => {
          if (!channels[k].source) {
            channels[k].source = event.source;
            if (channels[k].readyResolve) channels[k].readyResolve(event.source);
          }
        });
      }
      return;
    }

    // 2. 收到 RPC 回應 (相容 GAS_COMM_BEST_PRACTICE 之 { id, success, data, error })
    if (msg.id && pendingRequests.has(String(msg.id))) {
      const { resolve, reject, timer } = pendingRequests.get(String(msg.id));
      clearTimeout(timer);
      pendingRequests.delete(String(msg.id));

      if (msg.success) {
        resolve(msg.data);
      } else {
        const err = new Error(msg.error || 'GAS RPC 執行失敗');
        err.code = msg.code || 'GAS_RPC_ERROR';
        reject(err);
      }
    }
  });

  const DEFAULT_DISTRICTS = [
    {
      careDistrict: '西照顧區',
      districtSortOrder: 1,
      careAreas: [{ careArea: '西一區' }, { careArea: '西二區' }, { careArea: '鼓山大區' }]
    },
    {
      careDistrict: '東照顧區',
      districtSortOrder: 2,
      careAreas: [{ careArea: '東一區' }, { careArea: '東二區' }, { careArea: '鳳山大區' }]
    },
    {
      careDistrict: '北照顧區',
      districtSortOrder: 3,
      careAreas: [{ careArea: '北一區' }, { careArea: '北二區' }, { careArea: '三民大區' }]
    },
    {
      careDistrict: '南照顧區',
      districtSortOrder: 4,
      careAreas: [{ careArea: '南一區' }, { careArea: '南二區' }, { careArea: '前鎮大區' }]
    }
  ];

  let cachedAreaOptions = null;
  try {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('vital_area_options_cache') : null;
    if (stored) cachedAreaOptions = JSON.parse(stored);
  } catch (e) {}

  /**
   * 執行 GAS 呼叫 (統一透過 Iframe RPC)
   */
  async function invoke(functionName, args) {
    const act = String(functionName || '').trim();
    if (!act) throw new Error('缺少後端函式名稱');

    // 照顧區與大區：Stale-While-Revalidate，0ms 秒開絕不空白，背景自動向後端刷新
    if (act === 'getRegistrationAreaOptions') {
      // 背景非同步向 CORE 請求最新 AreaMappings
      invokeRemote_(act, args).then((res) => {
        const dList = (res && (res.districts || (res.data && res.data.districts)));
        if (dList && Array.isArray(dList) && dList.length > 0) {
          cachedAreaOptions = dList;
          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('vital_area_options_cache', JSON.stringify(dList));
            }
          } catch (e) {}
        }
      }).catch((e) => {
        console.warn('[GasRpc] 背景同步 AreaMappings 失敗（繼續使用可用資料）', e);
      });

      // 立即回傳可用資料 (快取優先，其次為預設四大照顧區)
      const activeOptions = (cachedAreaOptions && cachedAreaOptions.length) ? cachedAreaOptions : DEFAULT_DISTRICTS;
      return {
        success: true,
        districts: activeOptions,
        data: {
          districts: activeOptions
        }
      };
    }

    return invokeRemote_(act, args);
  }

  async function invokeRemote_(actionName, args) {
    action_ = actionName;
    const serviceName = getTargetService_(actionName);
    const channel = channels[serviceName];

    // 確保 Iframe 已掛載
    await ensureChannel_(serviceName);

    // 等待 Bridge 就緒 (最多等待 15 秒)
    if (!channel.source) {
      await Promise.race([
        channel.readyPromise,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`微服務 [${serviceName}] 連線逾時，請確認 Web App 已發布且允許嵌入`)), 15000);
        })
      ]);
    }

    const reqId = 'req_' + serviceName.toLowerCase() + '_' + Date.now().toString(36) + '_' + (++requestSeq);
    const timeoutMs = LONG_RUNNING_ACTIONS.has(action_) ? LONG_REQUEST_TIMEOUT_MS : DEFAULT_REQUEST_TIMEOUT_MS;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pendingRequests.delete(reqId);
        reject(new Error(`呼叫 [${action_}] 回應逾時 (${Math.round(timeoutMs / 1000)}s)，請確認網路或重新整理。`));
      }, timeoutMs);

      pendingRequests.set(reqId, { resolve, reject, timer });

      // 直連 iframe WindowProxy 發送
      try {
        channel.source.postMessage({
          type: 'GAS_CALL',
          id: reqId,
          targetService: serviceName,
          action: action_,
          args: Array.isArray(args) ? args : [args],
          payload: (args && typeof args[0] === 'object') ? args[0] : {}
        }, '*');
      } catch (postErr) {
        clearTimeout(timer);
        pendingRequests.delete(reqId);
        reject(postErr);
      }
    });
  }

  // 自動在頁面初始化時預熱三個微服務 Bridge
  ensureChannel_('CORE');
  ensureChannel_('CHAT');
  ensureChannel_('PROGRESSION');

  // 對外導出標準介面
  global.GasBackend = Object.freeze({
    invoke: invoke,
    getServiceUrl: getServiceUrl_,
    channels: channels
  });

})(window);