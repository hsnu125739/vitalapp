const ADMIN_STORAGE_KEY = 'yct_admin_token';
    const state = {overviewSummary:null,overviewRequest:0,token:'',tab:'overview',loadingDepth:0,players:[],groups:[],groupPosts:[],groupPostNextPageToken:'',groupPostHasMore:false,adminLogs:[],rewardLogs:[],adminLogNextPageToken:'',rewardLogNextPageToken:'',groupRewardLogNextPageToken:'',adminLogHasMore:false,rewardLogHasMore:false,groupRewardLogHasMore:false,activityAnalysis:null,rewardAnalysis:null,chests:[],chestClaims:[],chestClaimNextPageToken:'',chestClaimHasMore:false,systemAnnouncements:[],specialTasks:[],selectedSpecialTaskId:'',specialTaskResults:null,specialTaskCsvText:'',specialTaskCsvPreview:null,settings:[],settingsHealth:null};
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => [...document.querySelectorAll(s)];
    const USER_APP_SYNC_SIGNAL_KEY = 'yct_app_sync_signal';
    const USER_APP_SYNC_CHANNEL_NAME = 'yct_app_sync_v1';

    function notifyUserAppInstances_(reason){
      const payload = {
        playerId:'',
        reason:String(reason || 'adminDataChanged'),
        timestamp:Date.now()
      };

      if('BroadcastChannel' in window){
        try{
          const channel = new BroadcastChannel(USER_APP_SYNC_CHANNEL_NAME);
          channel.postMessage(payload);
          channel.close();
        }catch(error){}
      }

      try{
        localStorage.setItem(USER_APP_SYNC_SIGNAL_KEY,JSON.stringify(payload));
      }catch(error){}
    }

    document.addEventListener('DOMContentLoaded', () => { initializeAdminLoginFieldProtection_(); bindEvents(); restoreSession(); });

    function clearLockedAdminLoginField_(){
      const field = $('#adminPasswordInput');
      if(field && field.hasAttribute('readonly')) field.value = '';
    }

    function unlockAdminLoginField_(event){
      const field = event.currentTarget;
      if(!field.hasAttribute('readonly')) return;
      field.removeAttribute('readonly');
      field.value = '';
    }

    function lockAndClearAdminLoginField_(){
      const field = $('#adminPasswordInput');
      if(!field) return;
      field.value = '';
      field.setAttribute('readonly','');
    }

    function scheduleAdminLoginFieldClear_(){
      [100,500,1000].forEach((delay) => window.setTimeout(clearLockedAdminLoginField_,delay));
    }

    function initializeAdminLoginFieldProtection_(){
      const field = $('#adminPasswordInput');
      if(!field) return;
      field.addEventListener('focus',unlockAdminLoginField_);
      field.addEventListener('pointerdown',unlockAdminLoginField_);
      lockAndClearAdminLoginField_();
      scheduleAdminLoginFieldClear_();
      window.addEventListener('pageshow',() => {
        clearLockedAdminLoginField_();
        scheduleAdminLoginFieldClear_();
      });
    }

    function bindEvents(){
      $('#summaryWeek').addEventListener('change',loadOverview);
      ['#summaryTask','#summaryComparison','#summaryCount'].forEach((selector) => {
        $(selector).addEventListener('change',renderTaskDistribution);
      });
      $('#summaryCount').addEventListener('input',renderTaskDistribution);
      $('#loginBtn').addEventListener('click', login);
      $('#adminPasswordInput').addEventListener('keydown', (e) => { if(e.key === 'Enter') login(); });
      $('#logoutBtn').addEventListener('click', () => logout());
      $$('.tab-btn').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
      $$('[data-refresh]').forEach((b) => b.addEventListener('click', () => loadTab(b.dataset.refresh, true)));
      $('#playerSearch').addEventListener('input', renderPlayers);
      $('#playerAgeGroupFilter').addEventListener('change', renderPlayers);
      $('#playerStatusFilter').addEventListener('change', renderPlayers);
      $('#groupSearch').addEventListener('input', renderGroups);
      $('#groupStatusFilter').addEventListener('change', renderGroups);
      $('#groupPostSearch').addEventListener('input', renderGroupPosts);
      $('#groupPostStatusFilter').addEventListener('change', () => loadGroupPosts(true));
      $('#loadMoreGroupPostsBtn').addEventListener('click', loadMoreGroupPosts);
      $('#loadMoreAdminLogsBtn').addEventListener('click', loadMoreAdminLogs);
      $('#loadMoreRewardLogsBtn').addEventListener('click', loadMoreRewardLogs);
      $('#playersBody').addEventListener('click', handlePlayerAction);
      $('#groupsBody').addEventListener('click', handleGroupAction);
      $('#groupPostsBody').addEventListener('click', handleGroupPostAction);
      $('#chestsList').addEventListener('click', handleChestAction);
      $('#chestsList').addEventListener('change', handleChestRewardTypeChange);
      $('#chestRewardClaimsBody').addEventListener('click', handleChestRewardClaimAction);
      $('#chestRewardClaimFilter').addEventListener('change', () => loadChestRewardClaims(true));
      $('#refreshChestClaimsBtn').addEventListener('click', () => loadChestRewardClaims(true));
      $('#loadMoreChestClaimsBtn').addEventListener('click', () => loadChestRewardClaims(false));
      $('#newSystemAnnouncementBtn').addEventListener('click', resetSystemAnnouncementForm);
      $('#cancelSystemAnnouncementEditBtn').addEventListener('click', resetSystemAnnouncementForm);
      $('#systemAnnouncementForm').addEventListener('submit', saveSystemAnnouncement);
      $('#systemAnnouncementsBody').addEventListener('click', handleSystemAnnouncementAction);
      $('#newSpecialTaskBtn').addEventListener('click', resetSpecialTaskForm);
      $('#cancelSpecialTaskEditBtn').addEventListener('click', resetSpecialTaskForm);
      $('#specialTaskForm').addEventListener('submit', saveSpecialTask);
      $('#specialTaskRewardType').addEventListener('change', renderSpecialTaskRewardFields);
      $('#specialTasksBody').addEventListener('click', handleSpecialTaskAction);
      $('#closeSpecialTaskWorkspaceBtn').addEventListener('click', closeSpecialTaskWorkspace);
      $('#downloadSpecialTaskCsvTemplateBtn').addEventListener('click', downloadSpecialTaskCsvTemplate);
      $('#specialTaskCsvFile').addEventListener('change', handleSpecialTaskCsvFile);
      $('#clearSpecialTaskCsvPreviewBtn').addEventListener('click', clearSpecialTaskCsvPreview);
      $('#confirmSpecialTaskCsvBtn').addEventListener('click', confirmSpecialTaskCsv);
      $('#refreshSpecialTaskResultsBtn').addEventListener('click', loadSelectedSpecialTaskResults);
      $('#sendSpecialTaskRewardsBtn').addEventListener('click', sendSelectedSpecialTaskRewards);
      $('#specialTaskResultsBody').addEventListener('click', handleSpecialTaskResultAction);
      $('#settingsList').addEventListener('click', handleSettingAction);
      $('#normalizeSettingsBtn').addEventListener('click', normalizeManagedSettings);
      $('#adminPasswordForm').addEventListener('submit', updateAdminPassword);
    }

    function restoreSession(){
      let token = '';
      try{
        token = sessionStorage.getItem(ADMIN_STORAGE_KEY) || '';
        localStorage.removeItem(ADMIN_STORAGE_KEY);
      }catch(ignored){}
      if(!token) return showLogin();
      state.token = token;
      showApp();
      switchTab('overview');
    }

    function showLogin(){
      lockAndClearAdminLoginField_();
      scheduleAdminLoginFieldClear_();
      $('#loginView').classList.remove('hidden');
      $('#appView').classList.add('hidden');
      $('#logoutBtn').classList.add('hidden');
    }

    function showApp(){
      $('#loginView').classList.add('hidden');
      $('#appView').classList.remove('hidden');
      $('#logoutBtn').classList.remove('hidden');
    }

    function login(){
      const password = $('#adminPasswordInput').value.trim();
      if(!password) return showMessage('#loginMessage','請輸入管理者登入密碼','error');

      setLoading(true,'登入中...');
      callServer('adminLogin', password).then((res) => {
        if(!isSuccess(res)) return showMessage('#loginMessage', responseError(res,'登入失敗'),'error');

        state.token = res.data.adminToken || '';
        lockAndClearAdminLoginField_();
        sessionStorage.setItem(ADMIN_STORAGE_KEY,state.token);
        localStorage.removeItem(ADMIN_STORAGE_KEY);
        showMessage(
          '#loginMessage',
          res.data.mustChangePassword
            ? '登入成功。請到設定頁更新管理者密碼。'
            : '登入成功',
          'success'
        );
        showApp();
        if (res.data.mustChangePassword) {
          state.tab = 'settings';
          $$('.tab-btn').forEach((b) => {
            b.classList.toggle('active', b.dataset.tab === 'settings');
          });
          ['overview','players','groups','groupPosts','activityLogs','rewardLogs','chests','systemAnnouncements','specialTasks','migration','settings'].forEach((name) => {
            $('#' + name + 'Tab').classList.toggle('hidden', name !== 'settings');
          });
        } else {
          switchTab('overview');
        }
      }).catch((err) => showMessage('#loginMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function clearLocalAdminSession_(message){
      state.token = '';
      state.loadingDepth = 0;
      sessionStorage.removeItem(ADMIN_STORAGE_KEY);
      localStorage.removeItem(ADMIN_STORAGE_KEY);
      $('#loading').classList.add('hidden');
      showLogin();
      if(message) showMessage('#loginMessage',message,'error');
    }

    function logout(message){
      clearLocalAdminSession_(message);
    }

    function switchTab(tab){
      state.tab = tab;

      $$('.tab-btn').forEach((b) => {
        b.classList.toggle('active',b.dataset.tab === tab);
      });

      ['overview','players','groups','groupPosts','activityLogs','rewardLogs','chests','systemAnnouncements','specialTasks','settings'].forEach((name) => {
        $('#' + name + 'Tab').classList.toggle('hidden',name !== tab);
      });

      loadTab(tab,false);
    }

    function loadTab(tab,force){
      const loaders = {
        overview:loadOverview,
        players:loadPlayers,
        groups:loadGroups,
        groupPosts:loadGroupPosts,
        activityLogs:loadActivityLogs,
        rewardLogs:loadRewardLogs,
        chests:loadChests,
        systemAnnouncements:loadSystemAnnouncements,
        specialTasks:loadSpecialTasks,
        settings:loadSettings
      };

      return loaders[tab] && loaders[tab](force);
    }

    function loadOverview(){
      const request = ++state.overviewRequest;
      const token = state.token;
      setLoading(true,'讀取總覽...');
      return callServer('adminGetDashboardStats',state.token,{weekKey:$('#summaryWeek').value || ''}).then((res) => {
        if(request !== state.overviewRequest || token !== state.token) return;
        if(!isSuccess(res)) throw new Error(responseError(res,'總覽讀取失敗'));
        const stats = res.data || {};
        state.overviewSummary = stats;
        $('#metricPlayers').textContent = number(stats.playersTotal);
        $('#metricSocialYoungPlayers').textContent = number(stats.socialYoungPlayers);
        $('#metricOtherPlayers').textContent = number(stats.otherPlayers);
        $('#metricGroups').textContent = number(stats.groupsTotal);
        $('#overviewMeta').textContent = '資料更新：' + (stats.updatedAt || '-') + '｜未設定出生年 ' + number(stats.unsetAgePlayers) + ' 位';
        $('#summaryWeek').innerHTML = (stats.availableWeeks || []).map((week) => '<option value="' + esc(week) + '">' + esc(week) + '</option>').join('');
        $('#summaryWeek').value = stats.selectedWeekKey || '';
        $('#ageDistributionBody').innerHTML = (stats.ageDistribution || []).map((row) => '<tr><td>' + esc(row.age === '未設定' ? row.age : row.age + ' 歲') + '</td><td>' + number(row.people) + '</td></tr>').join('') || '<tr><td colspan="2">尚無活力人資料</td></tr>';
        const tasks = stats.completion && stats.completion.tasks || [];
        const selected = $('#summaryTask').value;
        $('#summaryTask').innerHTML = tasks.map((task) => '<option value="' + esc(task.key) + '">' + esc(task.title) + '</option>').join('');
        if(tasks.some((task) => task.key === selected)) $('#summaryTask').value = selected;
        $('#taskSummaryBody').innerHTML = tasks.map((task) => '<tr><td>' + esc(task.title) + '</td><td>' + number(task.completedPeople) + '</td><td>' + number(task.completionCount) + '</td></tr>').join('');
        $('#summaryPopulationNote').textContent = (stats.populationNote || '') + ' 統計母數：' + number(stats.completion && stats.completion.population) + ' 位。';
        renderTaskDistribution();
        showMessage('#overviewMessage','總覽已更新','success');
      }).catch((err) => {
        if(request === state.overviewRequest && token === state.token) showMessage('#overviewMessage',errorMessage(err),'error');
      }).finally(() => setLoading(false));
    }

    function renderTaskDistribution(){
      const stats = state.overviewSummary || {};
      const tasks = stats.completion && stats.completion.tasks || [];
      const task = tasks.find((entry) => entry.key === $('#summaryTask').value);
      if(!task) return;
      const rawCount = $('#summaryCount').value;
      const count = Number(rawCount);
      const comparison = $('#summaryComparison').value;
      const valid = rawCount !== '' && Number.isInteger(count) && count >= 0;
      const people = task.distribution.reduce((sum,row) => sum + ((comparison === 'gte' ? row.count >= count : row.count === count) ? row.people : 0),0);
      $('#summaryFilterResult').textContent = valid ? task.title + '完成' + (comparison === 'gte' ? '至少 ' : ' ') + count + ' 次：' + number(people) + ' 人' : '請輸入大於或等於 0 的整數';
      $('#taskDistributionBody').innerHTML = task.distribution.map((row) => '<tr><td>' + row.count + ' 次</td><td>' + number(row.people) + '</td></tr>').join('') || '<tr><td colspan="2">尚無活力人資料</td></tr>';
    }

    function loadPlayers(force){
      if(state.players.length && !force) return renderPlayers();

      setLoading(true,'讀取活力人...');
      callServer('adminGetPlayers',state.token).then((res) => {
        if(!isSuccess(res)) return showMessage('#playersMessage',responseError(res,'讀取活力人失敗'),'error');

        state.players = res.data.players || [];
        renderPlayers();
        showMessage('#playersMessage','已讀取 ' + state.players.length + ' 位活力人','success');
      }).catch((err) => showMessage('#playersMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function renderPlayers(){
      const key = normalize($('#playerSearch').value);
      const status = $('#playerStatusFilter').value;
      const ageGroup = $('#playerAgeGroupFilter').value;

      const rows = state.players.filter((p) => {
        const text = normalize([
          p.playerName,
          p.loginName,
          p.playerId,
          p.careDistrict,
          p.careArea,
          p.groupName,
          p.groupId,
          p.birthYear,
          p.ageGroup,
          p.status
        ].join(' '));

        return (!key || text.includes(key)) &&
          (status === 'all' || p.status === status) &&
          (ageGroup === 'all' || p.ageGroup === ageGroup);
      });

      $('#playersBody').innerHTML = rows.length ? rows.map((p) => {
        const active = p.status === 'active';
        const affiliation = [p.careDistrict,p.careArea].filter(Boolean).join('｜') || '-';
        const age = p.age === '' || p.age == null
          ? '出生年未設定'
          : esc(p.birthYear) + '｜' + number(p.age) + ' 歲';

        return '<tr>' +
          '<td><div class="cell-main"><strong>' + esc(p.playerName) + '</strong><small>帳號：' + esc(p.loginName || '-') + '｜' + esc(p.playerId) + '</small></div></td>' +
          '<td><div class="cell-main"><strong>' + esc(p.ageGroup || '未設定') + '</strong><small>' + age + '</small></div></td>' +
          '<td>' + esc(affiliation) + '</td>' +
          '<td><div class="cell-main"><strong>' + esc(p.groupName || '-') + '</strong><small>編號：' + esc(p.groupId || '-') + '</small></div></td>' +
          '<td><span class="pill ' + esc(p.status) + '">' + (active ? '啟用' : '停用') + '</span></td>' +
          '<td><strong>' + number(p.totalScore) + '</strong></td>' +
          '<td>' + esc(p.lastLoginAt || '-') + '<br><small>失敗 ' + number(p.loginFailCount) + '</small></td>' +
          '<td><div class="row-actions">' +
            '<button class="btn small ' + (active ? 'red' : 'green') + '" data-action="player-status" data-player-id="' + esc(p.playerId) + '" data-status="' + (active ? 'disabled' : 'active') + '">' + (active ? '停用' : '啟用') + '</button>' +
            '<button class="btn small amber" data-action="player-reset" data-player-id="' + esc(p.playerId) + '">重設碼</button>' +
          '</div></td>' +
        '</tr>';
      }).join('') : '<tr><td colspan="8">沒有符合條件的活力人</td></tr>';
    }

    function handlePlayerAction(e){
      const b = e.target.closest('button[data-action]');
      if(!b) return;

      if(b.dataset.action === 'player-status'){
        updatePlayerStatus(b.dataset.playerId,b.dataset.status);
      }

      if(b.dataset.action === 'player-reset'){
        resetPlayerPassword(b.dataset.playerId);
      }
    }

    function updatePlayerStatus(playerId,status){
      if(!confirm('確定要' + (status === 'active' ? '啟用' : '停用') + '這位活力人？')) return;

      setLoading(true,'更新活力人狀態...');
      callServer('adminUpdatePlayerStatus',state.token,{playerId,status}).then((res) => {
        if(!isSuccess(res)) return showMessage('#playersMessage',responseError(res,'更新失敗'),'error');

        state.players = [];
        state.groups = [];
        loadPlayers(true);
      }).catch((err) => showMessage('#playersMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function resetPlayerPassword(playerId){
      if(!confirm('確定要重設這位活力人的登入密碼？系統會產生一次性臨時密碼。')) return;

      setLoading(true,'產生臨時密碼...');
      callServer('adminResetPlayerPassword',state.token,{playerId}).then((res) => {
        if(!isSuccess(res)){
          showMessage('#playersMessage',responseError(res,'重設失敗'),'error');
          return;
        }

        const temporaryPassword = String(res.data.temporaryPassword || '');
        showMessage(
          '#playersMessage',
          '一次性臨時密碼：' + temporaryPassword + '。玩家登入後必須立即修改密碼。',
          'success'
        );
        alert('一次性臨時密碼：' + temporaryPassword + '\n請交給該玩家；登入後系統會要求立即修改密碼。');
      }).catch((err) => showMessage('#playersMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function loadGroups(force){
      if(state.groups.length && !force) return renderGroups();

      setLoading(true,'讀取活力組...');
      callServer('adminGetGroups',state.token).then((res) => {
        if(!isSuccess(res)) return showMessage('#groupsMessage',responseError(res,'讀取活力組失敗'),'error');

        state.groups = res.data.groups || [];
        renderGroups();
        showMessage('#groupsMessage','已讀取 ' + state.groups.length + ' 個活力組','success');
      }).catch((err) => showMessage('#groupsMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function renderGroups(){
      const key = normalize($('#groupSearch').value);
      const status = $('#groupStatusFilter').value;

      const rows = state.groups.filter((g) => {
        const matched = !key || normalize([
          g.groupName,
          g.ownerPlayerName,
          g.inviteCode,
          g.groupId
        ].join(' ')).includes(key);

        const statusMatched =
          status === 'all' ||
          (status === 'enabled' && g.enabled) ||
          (status === 'disabled' && !g.enabled);

        return matched && statusMatched;
      });

      $('#groupsBody').innerHTML = rows.length ? rows.map((g) => {
        return '<tr>' +
          '<td><div class="cell-main"><strong>' + esc(g.groupName) + '</strong><small>' + esc(g.groupId) + '</small></div></td>' +
          '<td>' + esc(g.ownerPlayerName || '-') + '</td>' +
          '<td><span class="pill">' + esc(g.enabled ? (g.inviteCode || '-') : '-') + '</span></td>' +
          '<td>' + number(g.memberCount) + '</td>' +
          '<td>旅程 ' + number(g.journeyScore) + '<br><small>活力人合計 ' + number(g.playerScoreTotal) + '</small></td>' +
          '<td><span class="pill ' + (g.enabled ? 'enabled' : 'disabled') + '">' + (g.enabled ? '啟用' : '停用') + '</span></td>' +
          '<td><div class="row-actions">' +
            '<button class="btn small ' + (g.enabled ? 'red' : 'green') + '" data-action="group-enabled" data-group-id="' + esc(g.groupId) + '" data-enabled="' + (!g.enabled) + '">' + (g.enabled ? '停用' : '啟用') + '</button>' +
            (g.enabled
              ? '<button class="btn small amber" data-action="group-invite" data-group-id="' + esc(g.groupId) + '">重發邀請碼</button>'
              : '') +
          '</div></td>' +
        '</tr>';
      }).join('') : '<tr><td colspan="7">沒有符合條件的活力組</td></tr>';
    }

    function handleGroupAction(e){
      const b = e.target.closest('button[data-action]');
      if(!b) return;

      if(b.dataset.action === 'group-enabled'){
        updateGroupEnabled(b.dataset.groupId,b.dataset.enabled === 'true');
      }

      if(b.dataset.action === 'group-invite'){
        regenerateInvite(b.dataset.groupId);
      }
    }

    function updateGroupEnabled(groupId,enabled){
      if(!confirm('確定要' + (enabled ? '啟用' : '停用') + '這個活力組？')) return;

      setLoading(true,'更新活力組...');
      callServer('adminUpdateGroupEnabled',state.token,{groupId,enabled}).then((res) => {
        if(!isSuccess(res)) return showMessage('#groupsMessage',responseError(res,'更新失敗'),'error');

        notifyUserAppInstances_('groupEnabledChanged');
        state.groups = [];
        loadGroups(true);
      }).catch((err) => showMessage('#groupsMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function regenerateInvite(groupId){
      if(!confirm('確定要重新產生邀請碼？舊邀請碼會失效。')) return;

      setLoading(true,'重新產生邀請碼...');
      callServer('adminRegenerateGroupInviteCode',state.token,groupId).then((res) => {
        if(!isSuccess(res)) return showMessage('#groupsMessage',responseError(res,'重發失敗'),'error');

        state.groups = [];
        loadGroups(true);
        showMessage('#groupsMessage','新邀請碼：' + res.data.inviteCode,'success');
      }).catch((err) => showMessage('#groupsMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function loadActivityLogs(force){
      if(state.adminLogs.length && !force) return renderActivityLogs();
      loadLogRecords(true,'#activityLogsMessage','讀取活動紀錄...','活動紀錄已更新');
    }

    function loadRewardLogs(force){
      if(state.rewardLogs.length && !force) return renderRewardLogs();
      loadLogRecords(true,'#rewardLogsMessage','讀取積分紀錄...','積分紀錄已更新');
    }

    function loadLogRecords(includeAnalysis,messageSelector,loadingText,successText){
      setLoading(true,loadingText);

      callServer('adminGetActivityLogs',state.token,{limit:100,includeAnalysis:!!includeAnalysis}).then((res) => {
        if(!isSuccess(res)) return showMessage(messageSelector,responseError(res,'讀取紀錄失敗'),'error');

        const data = res.data || {};
        const pagination = data.pagination || {};
        state.adminLogs = data.adminLogs || [];
        state.rewardLogs = data.rewardLogs || [];
        state.adminLogNextPageToken = pagination.adminNextPageToken || '';
        state.rewardLogNextPageToken = pagination.rewardNextPageToken || '';
        state.groupRewardLogNextPageToken = pagination.groupRewardNextPageToken || '';
        state.adminLogHasMore = !!pagination.adminHasMore;
        state.rewardLogHasMore = !!pagination.rewardHasMore;
        state.groupRewardLogHasMore = !!pagination.groupRewardHasMore;
        state.activityAnalysis = data.activityAnalysis || null;
        state.rewardAnalysis = data.rewardAnalysis || null;

        renderActivityLogs();
        renderRewardLogs();
        showMessage(messageSelector,successText,'success');
      }).catch((err) => showMessage(messageSelector,errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function loadMoreAdminLogs(){
      if(!state.adminLogHasMore || !state.adminLogNextPageToken) return;
      const button = $('#loadMoreAdminLogsBtn');
      button.disabled = true;
      callServer('adminGetActivityLogs',state.token,{
        limit:100,
        includeAdmin:true,
        includeReward:false,
        includeAnalysis:false,
        adminPageToken:state.adminLogNextPageToken
      }).then((res) => {
        if(!isSuccess(res)) return showMessage('#activityLogsMessage',responseError(res,'載入較舊紀錄失敗'),'error');
        const data = res.data || {};
        const pagination = data.pagination || {};
        state.adminLogs = appendUniqueRows_(state.adminLogs,data.adminLogs || [],'adminLogId');
        state.adminLogNextPageToken = pagination.adminNextPageToken || '';
        state.adminLogHasMore = !!pagination.adminHasMore;
        renderActivityLogs();
      }).catch((err) => showMessage('#activityLogsMessage',errorMessage(err),'error'))
        .finally(() => { button.disabled = false; });
    }

    function loadMoreRewardLogs(){
      const hasPlayerMore = state.rewardLogHasMore && state.rewardLogNextPageToken;
      const hasGroupMore = state.groupRewardLogHasMore && state.groupRewardLogNextPageToken;
      if(!hasPlayerMore && !hasGroupMore) return;

      const button = $('#loadMoreRewardLogsBtn');
      button.disabled = true;
      callServer('adminGetActivityLogs',state.token,{
        limit:100,
        includeAdmin:false,
        includeReward:true,
        includePlayerReward:!!hasPlayerMore,
        includeGroupReward:!!hasGroupMore,
        includeAnalysis:false,
        rewardPageToken:hasPlayerMore ? state.rewardLogNextPageToken : '',
        groupRewardPageToken:hasGroupMore ? state.groupRewardLogNextPageToken : ''
      }).then((res) => {
        if(!isSuccess(res)) return showMessage('#rewardLogsMessage',responseError(res,'載入較舊紀錄失敗'),'error');
        const data = res.data || {};
        const pagination = data.pagination || {};
        state.rewardLogs = appendUniqueRows_(state.rewardLogs,data.rewardLogs || [],'rewardLogId')
          .sort((a,b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        state.rewardLogNextPageToken = pagination.rewardNextPageToken || '';
        state.groupRewardLogNextPageToken = pagination.groupRewardNextPageToken || '';
        state.rewardLogHasMore = !!pagination.rewardHasMore;
        state.groupRewardLogHasMore = !!pagination.groupRewardHasMore;
        renderRewardLogs();
      }).catch((err) => showMessage('#rewardLogsMessage',errorMessage(err),'error'))
        .finally(() => { button.disabled = false; });
    }

    function appendUniqueRows_(currentRows,newRows,idField){
      const rows = Array.isArray(currentRows) ? currentRows.slice() : [];
      const seen = new Set(rows.map((row) => String(row[idField] || '')));
      (newRows || []).forEach((row) => {
        const id = String(row[idField] || '');
        if(id && seen.has(id)) return;
        if(id) seen.add(id);
        rows.push(row);
      });
      return rows;
    }

    function renderActivityAnalysis(){
      const analysis = state.activityAnalysis || {};

      $('#activityAnalysis').innerHTML =
        '<div class="metric"><span>近期操作</span><strong>' + number(analysis.totalCount) + '</strong></div>' +
        '<div class="metric"><span>近期資料中的近 7 日</span><strong>' + number(analysis.recent7DaysCount) + '</strong></div>' +
        '<div class="metric"><span>操作種類</span><strong>' + number(analysis.actionTypeCount) + '</strong></div>' +
        '<div class="metric"><span>最後操作</span><strong>' + esc(analysis.latestAt || '-').replace(/ /g,'<br>') + '</strong></div>';

      renderMiniList('#activityTopActions',analysis.topActions || [],(row) => ({
        title:row.name,
        note:'共 ' + number(row.count) + ' 次',
        time:''
      }));

      renderMiniList('#activityTopTargets',analysis.topTargets || [],(row) => ({
        title:row.name,
        note:'共 ' + number(row.count) + ' 次',
        time:''
      }));
    }

    function renderRewardAnalysis(){
      const analysis = state.rewardAnalysis || {};

      $('#rewardAnalysis').innerHTML =
        '<div class="metric"><span>近期積分紀錄</span><strong>' + number(analysis.totalCount) + '</strong></div>' +
        '<div class="metric"><span>個人貢獻</span><strong>' + number(analysis.totalScore) + '</strong></div>' +
        '<div class="metric"><span>小組共同</span><strong>' + number(analysis.totalCooperativeScore) + '</strong></div>' +
        '<div class="metric"><span>旅程總點數</span><strong>' + number(analysis.totalJourneyScore) + '</strong></div>' +
        '<div class="metric"><span>近 7 日旅程</span><strong>' + number(analysis.recent7DaysScore) + '</strong></div>';

      renderMiniList('#rewardTopPlayers',analysis.topPlayers || [],(row) => ({
        title:row.name,
        note:'小組 +' + number(row.journeyScore) + '｜貢獻 +' + number(row.totalScore) + '｜' + number(row.count) + ' 筆',
        time:row.lastAt || ''
      }));

      renderMiniList('#rewardTopGroups',analysis.topGroups || [],(row) => ({
        title:row.name,
        note:'旅程 +' + number(row.journeyScore) + '｜個人 +' + number(row.totalScore) + '｜共同 +' + number(row.cooperativeScore) + '｜' + number(row.count) + ' 筆',
        time:''
      }));

      renderMiniList('#rewardSourceBreakdown',analysis.sourceBreakdown || [],(row) => ({
        title:row.name,
        note:number(row.count) + ' 筆｜旅程 +' + number(row.journeyScore) + '｜共同 +' + number(row.cooperativeScore),
        time:''
      }));

      renderMiniList('#rewardDailyTrend',analysis.dailyTrend || [],(row) => ({
        title:row.name,
        note:number(row.count) + ' 筆｜旅程 +' + number(row.journeyScore) + '｜共同 +' + number(row.cooperativeScore),
        time:''
      }));
    }

    function renderActivityLogs(){
      renderActivityAnalysis();

      $('#adminLogsBody').innerHTML = state.adminLogs.length
        ? state.adminLogs.map((l) =>
          '<tr><td>' + esc(l.adminAction) + '</td>' +
          '<td>' + esc(l.targetType) + '<br><small>' + esc(l.targetId) + '</small></td>' +
          '<td>' + esc(l.detail) + '</td>' +
          '<td>' + esc(l.createdAt) + '</td></tr>'
        ).join('')
        : '<tr><td colspan="4">尚無活動紀錄</td></tr>';

      $('#loadMoreAdminLogsBtn').classList.toggle('hidden',!state.adminLogHasMore);
    }

    function renderRewardLogs(){
      renderRewardAnalysis();

      $('#rewardLogsBody').innerHTML = state.rewardLogs.length
        ? state.rewardLogs.map((l) => {
          const isGroupReward = l.recordKind === 'GROUP';
          const ownerText = isGroupReward ? '小組共同獎勵' : (l.playerName || l.playerId);
          const scoreText = isGroupReward
            ? '共同 ' + number(l.cooperativeScore) + '<br><small>旅程 ' + number(l.journeyScore) + '</small>'
            : '個人 ' + number(l.totalScore) + '<br><small>旅程 ' + number(l.journeyScore) + '</small>';

          return '<tr><td>' + esc(ownerText) + '<br><small>' + esc(l.groupName || '-') + '</small></td>' +
            '<td>' + esc(l.sourceType) + '</td>' +
            '<td>' + scoreText + '</td>' +
            '<td>' + esc(l.createdAt) + '</td></tr>';
        }).join('')
        : '<tr><td colspan="4">尚無積分紀錄</td></tr>';

      $('#loadMoreRewardLogsBtn').classList.toggle(
        'hidden',
        !state.rewardLogHasMore && !state.groupRewardLogHasMore
      );
    }

    function loadGroupPosts(force){
      if(state.groupPosts.length && !force) return renderGroupPosts();

      if(force){
        state.groupPosts = [];
        state.groupPostNextPageToken = '';
        state.groupPostHasMore = false;
      }

      setLoading(true,'讀取小組公告...');
      callServer('adminGetGroupPosts',state.token,{
        status:$('#groupPostStatusFilter').value || 'active',
        pageSize:50,
        pageToken:''
      }).then((res) => {
        if(!isSuccess(res)) return showMessage('#groupPostsMessage',responseError(res,'讀取小組公告失敗'),'error');
        state.groupPosts = res.data.posts || [];
        state.groupPostNextPageToken = res.data.nextPageToken || '';
        state.groupPostHasMore = !!res.data.hasMore;
        renderGroupPosts();
        showMessage('#groupPostsMessage','小組公告已更新','success');
      }).catch((err) => showMessage('#groupPostsMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function loadMoreGroupPosts(){
      if(!state.groupPostHasMore || !state.groupPostNextPageToken) return;
      setLoading(true,'載入較舊小組公告...');
      callServer('adminGetGroupPosts',state.token,{
        status:$('#groupPostStatusFilter').value || 'active',
        pageSize:50,
        pageToken:state.groupPostNextPageToken
      }).then((res) => {
        if(!isSuccess(res)) return showMessage('#groupPostsMessage',responseError(res,'載入較舊公告失敗'),'error');
        state.groupPosts = state.groupPosts.concat(res.data.posts || []);
        state.groupPostNextPageToken = res.data.nextPageToken || '';
        state.groupPostHasMore = !!res.data.hasMore;
        renderGroupPosts();
      }).catch((err) => showMessage('#groupPostsMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function renderGroupPosts(){
      const key = normalize($('#groupPostSearch').value);
      const rows = (state.groupPosts || []).filter((post) => {
        const text = normalize([post.groupName,post.playerName,post.content].join(' '));
        return !key || text.includes(key);
      });

      $('#groupPostsBody').innerHTML = rows.length ? rows.map((post) => {
        const active = post.status === 'active';
        const action = active
          ? '<button class="btn small red" data-action="group-post-delete" data-post-id="' + esc(post.postId || '') + '">移除</button>'
          : '';
        return '<tr>' +
          '<td>' + esc(post.groupName || post.groupId || '-') + '</td>' +
          '<td>' + esc(post.playerName || post.playerId || '-') + '</td>' +
          '<td>' + esc(post.content || '') + '</td>' +
          '<td><span class="pill ' + (active ? 'active' : 'disabled') + '">' + (active ? '顯示中' : '已移除') + '</span></td>' +
          '<td>' + esc(post.updatedAt || post.createdAt || '-') + '</td>' +
          '<td><div class="row-actions">' + action + '</div></td>' +
        '</tr>';
      }).join('') : '<tr><td colspan="6">沒有符合條件的小組公告</td></tr>';
      $('#loadMoreGroupPostsBtn').classList.toggle('hidden',!state.groupPostHasMore);
    }

    function handleGroupPostAction(event){
      const button = event.target.closest('button[data-action="group-post-delete"]');
      if(!button) return;
      const postId = String(button.dataset.postId || '').trim();
      if(!postId || !confirm('確定要由管理者移除這則小組公告？')) return;

      setLoading(true,'移除小組公告...');
      callServer('adminDeleteGroupPost',state.token,postId).then((res) => {
        if(!isSuccess(res)) return showMessage('#groupPostsMessage',responseError(res,'移除小組公告失敗'),'error');
        if($('#groupPostStatusFilter').value === 'active'){
          state.groupPosts = (state.groupPosts || []).filter((post) => String(post.postId || '') !== postId);
        }else{
          state.groupPosts = (state.groupPosts || []).map((post) =>
            String(post.postId || '') === postId
              ? Object.assign({},post,{status:'deleted'})
              : post
          );
        }
        renderGroupPosts();
        showMessage('#groupPostsMessage',res.data.message || '小組公告已移除','success');
      }).catch((err) => showMessage('#groupPostsMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    

    

    function loadChests(force){
      if(state.chests.length && !force){
        renderChests();
        return loadChestRewardClaims(true);
      }

      setLoading(true,'讀取寶箱設定...');
      callServer('adminGetChestSettings',state.token).then((res) => {
        if(!isSuccess(res)) return showMessage('#chestsMessage',responseError(res,'讀取寶箱設定失敗'),'error');

        state.chests = res.data.chests || [];
        renderChests();
        showMessage('#chestsMessage','寶箱設定已更新','success');
        loadChestRewardClaims(true);
      }).catch((err) => showMessage('#chestsMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function loadChestRewardClaims(reset){
      if(reset){
        state.chestClaims = [];
        state.chestClaimNextPageToken = '';
        state.chestClaimHasMore = false;
      }else if(!state.chestClaimHasMore || !state.chestClaimNextPageToken){
        return;
      }

      setLoading(true,reset ? '讀取寶箱發放紀錄...' : '載入較舊寶箱發放紀錄...');
      callServer('adminGetChestRewardClaims',state.token,{
        filter:$('#chestRewardClaimFilter').value || 'PENDING',
        pageSize:50,
        pageToken:reset ? '' : state.chestClaimNextPageToken
      }).then((res) => {
        if(!isSuccess(res)) return showMessage('#chestsMessage',responseError(res,'讀取寶箱發放紀錄失敗'),'error');
        const rows = res.data.claims || [];
        state.chestClaims = reset ? rows : state.chestClaims.concat(rows);
        state.chestClaimNextPageToken = res.data.nextPageToken || '';
        state.chestClaimHasMore = !!res.data.hasMore;
        renderChestRewardClaims();
      }).catch((err) => showMessage('#chestsMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function renderChests(){
      if(!state.chests.length){
        $('#chestsList').innerHTML = '<div class="message">目前沒有寶箱設定</div>';
        return;
      }

      $('#chestsList').innerHTML = state.chests.map((chest) => {
        const chestId = chest.chestId || '';
        const rewardType = chest.rewardType === 'groupPoints' ? 'groupPoints' : 'other';
        const pointsField =
          '<label class="field' + (rewardType === 'groupPoints' ? '' : ' hidden') + '" data-chest-points-wrap="' + esc(chestId) + '">小組點數<input type="number" min="0" max="1000000" step="1" value="' + esc(chest.groupBonusPoints || 0) + '" data-chest-points="' + esc(chestId) + '"></label>';

        return '<section class="setting-row">' +
          '<div class="setting-meta chest-setting-preview">' +
            '<img src="' + esc(chest.imageUrl || '') + '" alt="">' +
            '<div><strong>' + esc(chest.chestId || '') + '</strong><p>' + esc(chest.stationKey ? '站點：' + chest.stationKey : '加入活力組取得') + '</p></div>' +
          '</div>' +
          '<div class="chest-setting-fields">' +
            '<label class="field">寶箱名稱<input type="text" maxlength="50" value="' + esc(chest.chestName || '') + '" data-chest-name="' + esc(chestId) + '"></label>' +
            '<label class="field">獎勵方式<select data-chest-reward-type="' + esc(chestId) + '">' +
              '<option value="groupPoints"' + (rewardType === 'groupPoints' ? ' selected' : '') + '>小組點數</option>' +
              '<option value="other"' + (rewardType === 'other' ? ' selected' : '') + '>其他</option>' +
            '</select></label>' +
            '<label class="field">獎勵說明<textarea maxlength="500" rows="3" data-chest-description="' + esc(chestId) + '">' + esc(chest.rewardDescription || '') + '</textarea></label>' +
            pointsField +
          '</div>' +
          '<button class="btn small primary" data-action="chest-save" data-chest-id="' + esc(chestId) + '">儲存</button>' +
        '</section>';
      }).join('');
    }

    function renderChestRewardClaims(){
      const body = $('#chestRewardClaimsBody');
      const rows = state.chestClaims || [];

      body.innerHTML = rows.length ? rows.map((row) => {
        const statusLabel = row.status === 'FULFILLED'
          ? '已發放'
          : (row.status === 'REQUESTED' ? '待發放' : '尚未領取');
        const statusClass = row.status === 'FULFILLED'
          ? 'active'
          : (row.status === 'REQUESTED' ? '' : 'disabled');
        const action = row.status === 'REQUESTED'
          ? '<button class="btn small green" data-action="chest-fulfill" data-record-id="' + esc(row.recordId || '') + '">標記已發放</button>'
          : '';

        return '<tr>' +
          '<td><div class="cell-main"><strong>' + esc(row.playerName || row.playerId || '') + '</strong><small>' + esc(row.groupName || '未分組') + '</small></div></td>' +
          '<td><div class="cell-main"><strong>' + esc(row.chestName || row.chestId || '') + '</strong><small>' + esc(row.rewardDescription || '') + '</small></div></td>' +
          '<td>' + esc(row.earnedAt || '-') +
            (row.claimedAt ? '<br><small>申請：' + esc(row.claimedAt) + '</small>' : '') +
            (row.fulfilledAt ? '<br><small>發放：' + esc(row.fulfilledAt) + '</small>' : '') + '</td>' +
          '<td><span class="pill ' + statusClass + '">' + statusLabel + '</span></td>' +
          '<td><div class="row-actions">' + action + '</div></td>' +
        '</tr>';
      }).join('') : '<tr><td colspan="5">目前沒有符合篩選條件的其他獎勵紀錄</td></tr>';
      $('#loadMoreChestClaimsBtn').classList.toggle('hidden',!state.chestClaimHasMore);
    }

    function handleChestRewardClaimAction(e){
      const button = e.target.closest('button[data-action="chest-fulfill"]');
      if(!button) return;
      const recordId = String(button.dataset.recordId || '').trim();
      if(!recordId || !confirm('確定此寶箱獎勵已完成發放？')) return;

      setLoading(true,'更新寶箱獎勵狀態...');
      callServer('adminMarkChestRewardFulfilled',state.token,{recordId}).then((res) => {
        if(!isSuccess(res)) return showMessage('#chestsMessage',responseError(res,'更新寶箱獎勵狀態失敗'),'error');
        notifyUserAppInstances_('chestFulfillmentChanged');
        loadChestRewardClaims(true);
        showMessage('#chestsMessage',res.data.message || '獎勵已標記為已發放','success');
      }).catch((err) => showMessage('#chestsMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function handleChestAction(e){
      const b = e.target.closest('button[data-action="chest-save"]');
      if(!b) return;

      const chestId = b.dataset.chestId || '';
      const nameInput = document.querySelector('input[data-chest-name="' + cssEscape(chestId) + '"]');
      const descriptionInput = document.querySelector('[data-chest-description="' + cssEscape(chestId) + '"]');
      const rewardTypeInput = document.querySelector('select[data-chest-reward-type="' + cssEscape(chestId) + '"]');
      const pointsInput = document.querySelector('input[data-chest-points="' + cssEscape(chestId) + '"]');
      const chestName = nameInput ? nameInput.value.trim() : '';
      const rewardDescription = descriptionInput ? descriptionInput.value.trim() : '';
      const groupBonusPoints = Number(pointsInput ? pointsInput.value : 0);

      if(chestName.length > 50){
        showMessage('#chestsMessage','寶箱名稱不可超過 50 個字','error');
        return;
      }
      if(rewardDescription.length > 500){
        showMessage('#chestsMessage','獎勵說明不可超過 500 個字','error');
        return;
      }
      if(!Number.isFinite(groupBonusPoints) || groupBonusPoints < 0 || groupBonusPoints > 1000000){
        showMessage('#chestsMessage','小組點數需為 0 至 1,000,000','error');
        return;
      }

      setLoading(true,'儲存寶箱設定...');
      callServer('adminUpdateChestSetting',state.token,{
        chestId,
        chestName,
        rewardDescription,
        rewardType:rewardTypeInput ? rewardTypeInput.value : 'other',
        groupBonusPoints
      }).then((res) => {
        if(!isSuccess(res)) return showMessage('#chestsMessage',responseError(res,'儲存寶箱設定失敗'),'error');

        state.chests = [];
        loadChests(true);
      }).catch((err) => showMessage('#chestsMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function handleChestRewardTypeChange(e){
      const select = e.target.closest('select[data-chest-reward-type]');
      if(!select) return;

      const chestId = select.dataset.chestRewardType || '';
      const pointsWrap = document.querySelector('[data-chest-points-wrap="' + cssEscape(chestId) + '"]');

      if(pointsWrap){
        pointsWrap.classList.toggle('hidden', select.value !== 'groupPoints');
      }
    }

    function loadSystemAnnouncements(force){
      if(state.systemAnnouncements.length && !force) return renderSystemAnnouncements();

      setLoading(true,'讀取系統公告...');
      callServer('adminGetSystemAnnouncements',state.token).then((res) => {
        if(!isSuccess(res)) return showMessage('#systemAnnouncementsMessage',responseError(res,'讀取系統公告失敗'),'error');

        state.systemAnnouncements = res.data.announcements || [];
        renderSystemAnnouncements();
        showMessage('#systemAnnouncementsMessage','系統公告已更新','success');
      }).catch((err) => showMessage('#systemAnnouncementsMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function resetSystemAnnouncementForm(){
      $('#systemAnnouncementId').value = '';
      $('#systemAnnouncementTitle').value = '';
      $('#systemAnnouncementContent').value = '';
      $('#systemAnnouncementStartAt').value = '';
      $('#systemAnnouncementEndAt').value = '';
      $('#systemAnnouncementStatus').value = 'draft';
      setDraftStatusOptionEnabled('#systemAnnouncementStatus',true);
    }

    function saveSystemAnnouncement(event){
      event.preventDefault();

      const payload = {
        announcementId:$('#systemAnnouncementId').value.trim(),
        title:$('#systemAnnouncementTitle').value.trim(),
        content:$('#systemAnnouncementContent').value.trim(),
        startAt:$('#systemAnnouncementStartAt').value,
        endAt:$('#systemAnnouncementEndAt').value,
        status:$('#systemAnnouncementStatus').value
      };

      if(!payload.title || !payload.content){
        showMessage('#systemAnnouncementsMessage','請完整輸入公告標題與內容','error');
        return;
      }

      setLoading(true,'儲存系統公告...');
      callServer('adminSaveSystemAnnouncement',state.token,payload).then((res) => {
        if(!isSuccess(res)) return showMessage('#systemAnnouncementsMessage',responseError(res,'儲存系統公告失敗'),'error');

        notifyUserAppInstances_('systemAnnouncementChanged');
        resetSystemAnnouncementForm();
        state.systemAnnouncements = [];
        showMessage('#systemAnnouncementsMessage',res.data.message || '系統公告已儲存','success');
        loadSystemAnnouncements(true);
      }).catch((err) => showMessage('#systemAnnouncementsMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function renderSystemAnnouncements(){
      const body = $('#systemAnnouncementsBody');

      if(!state.systemAnnouncements.length){
        body.innerHTML = '<tr><td colspan="6">目前沒有系統公告</td></tr>';
        return;
      }

      body.innerHTML = state.systemAnnouncements.map((item) => {
        const id = esc(item.announcementId || '');
        const status = item.status || 'draft';
        const statusClass = status === 'active' ? 'active' : status === 'inactive' ? 'disabled' : '';
        const period = formatDisplayPeriod(item.startAt,item.endAt);
        const actionStatus = status === 'active'
          ? '<button class="btn small amber" data-action="announcement-status" data-id="' + id + '" data-status="inactive">停用</button>'
          : '<button class="btn small green" data-action="announcement-status" data-id="' + id + '" data-status="active">啟用</button>';
        const deleteButton = status === 'draft'
          ? '<button class="btn small red" data-action="announcement-delete" data-id="' + id + '">刪除</button>'
          : '';

        return '<tr>' +
          '<td><div class="cell-main"><strong>' + esc(item.title || '') + '</strong><small>' + esc(truncate(item.content || '',90)) + '</small></div></td>' +
          '<td>' + esc(period) + '</td>' +
          '<td><span class="pill ' + statusClass + '">' + esc(moduleStatusLabel(status)) + '</span></td>' +
          '<td>v' + number(item.version || 1) + '</td>' +
          '<td><div class="cell-main"><strong>' + esc(item.updatedAt || '') + '</strong><small>' + esc(item.updatedBy || '') + '</small></div></td>' +
          '<td><div class="row-actions"><button class="btn small" data-action="announcement-edit" data-id="' + id + '">編輯</button>' + actionStatus + deleteButton + '</div></td>' +
        '</tr>';
      }).join('');
    }

    function handleSystemAnnouncementAction(event){
      const button = event.target.closest('button[data-action]');
      if(!button) return;

      const item = state.systemAnnouncements.find((row) => String(row.announcementId || '') === String(button.dataset.id || ''));
      if(!item) return;

      if(button.dataset.action === 'announcement-edit'){
        $('#systemAnnouncementId').value = item.announcementId || '';
        $('#systemAnnouncementTitle').value = item.title || '';
        $('#systemAnnouncementContent').value = item.content || '';
        $('#systemAnnouncementStartAt').value = item.startAt || '';
        $('#systemAnnouncementEndAt').value = item.endAt || '';
        $('#systemAnnouncementStatus').value = item.status || 'draft';
        setDraftStatusOptionEnabled('#systemAnnouncementStatus',item.status === 'draft');
        $('#systemAnnouncementForm').scrollIntoView({behavior:'smooth',block:'start'});
        return;
      }

      if(button.dataset.action === 'announcement-status'){
        setSystemAnnouncementStatus(item.announcementId,button.dataset.status);
        return;
      }

      if(button.dataset.action === 'announcement-delete'){
        if(!confirm('確定刪除這則尚未正式使用的草稿公告？')) return;
        deleteSystemAnnouncement(item.announcementId);
      }
    }

    function setSystemAnnouncementStatus(announcementId,status){
      setLoading(true,status === 'active' ? '啟用公告...' : '停用公告...');
      callServer('adminSetSystemAnnouncementStatus',state.token,{announcementId,status}).then((res) => {
        if(!isSuccess(res)) return showMessage('#systemAnnouncementsMessage',responseError(res,'更新公告狀態失敗'),'error');
        notifyUserAppInstances_('systemAnnouncementStatusChanged');
        state.systemAnnouncements = [];
        showMessage('#systemAnnouncementsMessage',res.data.message || '公告狀態已更新','success');
        loadSystemAnnouncements(true);
      }).catch((err) => showMessage('#systemAnnouncementsMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function deleteSystemAnnouncement(announcementId){
      setLoading(true,'刪除草稿公告...');
      callServer('adminDeleteSystemAnnouncement',state.token,announcementId).then((res) => {
        if(!isSuccess(res)) return showMessage('#systemAnnouncementsMessage',responseError(res,'刪除公告失敗'),'error');
        notifyUserAppInstances_('systemAnnouncementDeleted');
        state.systemAnnouncements = [];
        resetSystemAnnouncementForm();
        showMessage('#systemAnnouncementsMessage',res.data.message || '草稿公告已刪除','success');
        loadSystemAnnouncements(true);
      }).catch((err) => showMessage('#systemAnnouncementsMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function loadSpecialTasks(force){
      if(state.specialTasks.length && !force) return renderSpecialTasks();

      setLoading(true,'讀取特殊任務...');
      callServer('adminGetSpecialTasks',state.token).then((res) => {
        if(!isSuccess(res)) return showMessage('#specialTasksMessage',responseError(res,'讀取特殊任務失敗'),'error');

        state.specialTasks = res.data.tasks || [];
        renderSpecialTasks();
        showMessage('#specialTasksMessage','特殊任務已更新','success');

        if(state.selectedSpecialTaskId){
          const exists = state.specialTasks.some((task) => String(task.taskId || '') === state.selectedSpecialTaskId);
          if(exists) loadSelectedSpecialTaskResults();
          else closeSpecialTaskWorkspace();
        }
      }).catch((err) => showMessage('#specialTasksMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function resetSpecialTaskForm(){
      $('#specialTaskId').value = '';
      $('#specialTaskName').value = '';
      $('#specialTaskDescription').value = '';
      $('#specialTaskStartAt').value = '';
      $('#specialTaskEndAt').value = '';
      $('#specialTaskRewardType').value = 'groupPoints';
      $('#specialTaskGroupBonusPoints').value = '0';
      $('#specialTaskRewardDescription').value = '';
      $('#specialTaskStatus').value = 'draft';
      setDraftStatusOptionEnabled('#specialTaskStatus',true);
      renderSpecialTaskRewardFields();
    }

    function renderSpecialTaskRewardFields(){
      const type = $('#specialTaskRewardType').value;
      $('#specialTaskPointsField').classList.toggle('hidden',type !== 'groupPoints');
      $('#specialTaskRewardDescriptionField').classList.toggle('hidden',type !== 'other');
    }

    function saveSpecialTask(event){
      event.preventDefault();
      const requestStartedAt = window.performance && typeof window.performance.now === 'function'
        ? window.performance.now()
        : Date.now();

      const payload = {
        taskId:$('#specialTaskId').value.trim(),
        taskName:$('#specialTaskName').value.trim(),
        description:$('#specialTaskDescription').value.trim(),
        startAt:$('#specialTaskStartAt').value,
        endAt:$('#specialTaskEndAt').value,
        rewardType:$('#specialTaskRewardType').value,
        groupBonusPoints:Number($('#specialTaskGroupBonusPoints').value || 0),
        rewardDescription:$('#specialTaskRewardDescription').value.trim(),
        status:$('#specialTaskStatus').value
      };

      if(!payload.taskName || !payload.description){
        showMessage('#specialTasksMessage','請完整輸入任務名稱與說明','error');
        return;
      }

      if(payload.rewardType === 'other' && !payload.rewardDescription){
        showMessage('#specialTasksMessage','其他獎勵必須輸入獎勵說明','error');
        return;
      }

      setLoading(true,'儲存特殊任務...');
      callServer('adminSaveSpecialTask',state.token,payload).then((res) => {
        if(!isSuccess(res)) return showMessage('#specialTasksMessage',responseError(res,'儲存特殊任務失敗'),'error');

        const savedTask = res.data && res.data.task;
        if(savedTask && savedTask.taskId){
          const savedTaskId = String(savedTask.taskId);
          const existingIndex = state.specialTasks.findIndex((task) => String(task.taskId || '') === savedTaskId);

          if(existingIndex >= 0) state.specialTasks.splice(existingIndex,1,savedTask);
          else state.specialTasks.unshift(savedTask);

          state.specialTasks.sort((a,b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
          renderSpecialTasks();
        }else{
          state.specialTasks = [];
        }

        notifyUserAppInstances_('specialTaskChanged');
        resetSpecialTaskForm();
        const requestCompletedAt = window.performance && typeof window.performance.now === 'function'
          ? window.performance.now()
          : Date.now();
        const elapsedSeconds = Math.max(0,(requestCompletedAt - requestStartedAt) / 1000);
        const serverTiming = res.data && res.data.performance ? res.data.performance : null;
        const timingText = serverTiming && Number.isFinite(Number(serverTiming.totalMs))
          ? '（總計 ' + elapsedSeconds.toFixed(1) + ' 秒；後端 ' + (Number(serverTiming.totalMs) / 1000).toFixed(1) + ' 秒）'
          : '（總計 ' + elapsedSeconds.toFixed(1) + ' 秒）';
        showMessage('#specialTasksMessage',(res.data.message || '特殊任務已儲存') + timingText,'success');
      }).catch((err) => showMessage('#specialTasksMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function renderSpecialTasks(){
      const body = $('#specialTasksBody');

      if(!state.specialTasks.length){
        body.innerHTML = '<tr><td colspan="8">目前沒有特殊任務</td></tr>';
        return;
      }

      body.innerHTML = state.specialTasks.map((task) => {
        const id = esc(task.taskId || '');
        const status = task.status || 'draft';
        const summary = task.resultSummary || {};
        const statusClass = status === 'active' ? 'active' : status === 'inactive' ? 'disabled' : '';
        const actionStatus = status === 'active'
          ? '<button class="btn small amber" data-action="task-status" data-id="' + id + '" data-status="inactive">停用</button>'
          : '<button class="btn small green" data-action="task-status" data-id="' + id + '" data-status="active">啟用</button>';
        const deleteButton = status === 'draft' && Number(summary.confirmedCount || 0) === 0
          ? '<button class="btn small red" data-action="task-delete" data-id="' + id + '">刪除</button>'
          : '';

        return '<tr>' +
          '<td><div class="cell-main"><strong>' + esc(task.taskName || '') + '</strong><small>' + esc(truncate(task.description || '',80)) + '</small></div></td>' +
          '<td>' + esc(specialTaskRewardText(task)) + '</td>' +
          '<td>' + esc(formatDisplayPeriod(task.startAt,task.endAt)) + '</td>' +
          '<td><span class="pill ' + statusClass + '">' + esc(moduleStatusLabel(status)) + '</span></td>' +
          '<td><div class="status-summary"><span class="pill">完成 ' + number(summary.confirmedCount || 0) + '</span><span class="pill active">資格 ' + number(summary.eligibleCount || 0) + '</span><span class="pill">已處理 ' + number(summary.processedCount || 0) + esc(summary.processedUnit || '') + '</span></div></td>' +
          '<td>v' + number(task.version || 1) + '</td>' +
          '<td><div class="cell-main"><strong>' + esc(task.updatedAt || '') + '</strong><small>' + esc(task.updatedBy || '') + '</small></div></td>' +
          '<td><div class="row-actions"><button class="btn small" data-action="task-manage" data-id="' + id + '">名單／發獎</button><button class="btn small" data-action="task-edit" data-id="' + id + '">編輯</button>' + actionStatus + deleteButton + '</div></td>' +
        '</tr>';
      }).join('');
    }

    function handleSpecialTaskAction(event){
      const button = event.target.closest('button[data-action]');
      if(!button) return;

      const task = state.specialTasks.find((row) => String(row.taskId || '') === String(button.dataset.id || ''));
      if(!task) return;

      if(button.dataset.action === 'task-edit'){
        $('#specialTaskId').value = task.taskId || '';
        $('#specialTaskName').value = task.taskName || '';
        $('#specialTaskDescription').value = task.description || '';
        $('#specialTaskStartAt').value = task.startAt || '';
        $('#specialTaskEndAt').value = task.endAt || '';
        $('#specialTaskRewardType').value = task.rewardType || 'groupPoints';
        $('#specialTaskGroupBonusPoints').value = Number(task.groupBonusPoints || 0);
        $('#specialTaskRewardDescription').value = task.rewardDescription || '';
        $('#specialTaskStatus').value = task.status || 'draft';
        setDraftStatusOptionEnabled('#specialTaskStatus',task.status === 'draft');
        renderSpecialTaskRewardFields();
        $('#specialTaskForm').scrollIntoView({behavior:'smooth',block:'start'});
        return;
      }

      if(button.dataset.action === 'task-manage'){
        openSpecialTaskWorkspace(task.taskId);
        return;
      }

      if(button.dataset.action === 'task-status'){
        setSpecialTaskStatus(task.taskId,button.dataset.status);
        return;
      }

      if(button.dataset.action === 'task-delete'){
        if(!confirm('確定刪除這個尚未正式使用的草稿任務？')) return;
        deleteSpecialTask(task.taskId);
      }
    }

    function setSpecialTaskStatus(taskId,status){
      setLoading(true,status === 'active' ? '啟用特殊任務...' : '停用特殊任務...');
      callServer('adminSetSpecialTaskStatus',state.token,{taskId,status}).then((res) => {
        if(!isSuccess(res)) return showMessage('#specialTasksMessage',responseError(res,'更新任務狀態失敗'),'error');
        notifyUserAppInstances_('specialTaskStatusChanged');
        state.specialTasks = [];
        showMessage('#specialTasksMessage',res.data.message || '任務狀態已更新','success');
        loadSpecialTasks(true);
      }).catch((err) => showMessage('#specialTasksMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function deleteSpecialTask(taskId){
      setLoading(true,'刪除草稿任務...');
      callServer('adminDeleteSpecialTask',state.token,taskId).then((res) => {
        if(!isSuccess(res)) return showMessage('#specialTasksMessage',responseError(res,'刪除特殊任務失敗'),'error');
        notifyUserAppInstances_('specialTaskDeleted');
        state.specialTasks = [];
        resetSpecialTaskForm();
        if(state.selectedSpecialTaskId === taskId) closeSpecialTaskWorkspace();
        showMessage('#specialTasksMessage',res.data.message || '草稿任務已刪除','success');
        loadSpecialTasks(true);
      }).catch((err) => showMessage('#specialTasksMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function openSpecialTaskWorkspace(taskId){
      state.selectedSpecialTaskId = String(taskId || '');
      state.specialTaskResults = null;
      clearSpecialTaskCsvPreview();

      const task = getSelectedSpecialTask();
      $('#specialTaskWorkspaceTitle').textContent = task ? task.taskName : '任務完成者管理';
      $('#specialTaskWorkspaceMeta').textContent = task ? specialTaskRewardText(task) : '';
      $('#specialTaskWorkspace').classList.remove('hidden');
      $('#specialTaskWorkspace').scrollIntoView({behavior:'smooth',block:'start'});
      loadSelectedSpecialTaskResults();
    }

    function closeSpecialTaskWorkspace(){
      state.selectedSpecialTaskId = '';
      state.specialTaskResults = null;
      clearSpecialTaskCsvPreview();
      $('#specialTaskWorkspace').classList.add('hidden');
    }

    function getSelectedSpecialTask(){
      return state.specialTasks.find((task) => String(task.taskId || '') === String(state.selectedSpecialTaskId || '')) || null;
    }

    function downloadSpecialTaskCsvTemplate(){
      const content = '\uFEFF照顧區,大區,真實姓名\r\n';
      const blob = new Blob([content],{type:'text/csv;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '特殊任務完成者範本.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }

    function handleSpecialTaskCsvFile(event){
      const file = event.target.files && event.target.files[0];
      if(!file) return;

      const reader = new FileReader();
      reader.onload = () => previewSpecialTaskCsv(String(reader.result || ''));
      reader.onerror = () => showMessage('#specialTasksMessage','CSV 檔案讀取失敗','error');
      reader.readAsText(file,'UTF-8');
    }

    function previewSpecialTaskCsv(csvText){
      if(!state.selectedSpecialTaskId){
        showMessage('#specialTasksMessage','請先選擇要管理的特殊任務','error');
        return;
      }

      state.specialTaskCsvText = csvText;
      $('#specialTaskCsvRawPreview').textContent = csvText.length > 20000
        ? csvText.slice(0,20000) + '\n……其餘內容已省略'
        : csvText;
      $('#specialTaskCsvRawPreview').classList.remove('hidden');

      setLoading(true,'比對 CSV 完成者名單...');
      callServer('adminPreviewSpecialTaskCsv',state.token,{
        taskId:state.selectedSpecialTaskId,
        csvText:csvText
      }).then((res) => {
        if(!isSuccess(res)){
          state.specialTaskCsvPreview = null;
          $('#confirmSpecialTaskCsvBtn').disabled = true;
          renderSpecialTaskCsvPreview();
          return showMessage('#specialTasksMessage',responseError(res,'CSV 比對失敗'),'error');
        }

        state.specialTaskCsvPreview = res.data.preview || null;
        const importLocked = selectedSpecialTaskHasSentRewards();
        $('#confirmSpecialTaskCsvBtn').disabled = importLocked ||
          !state.specialTaskCsvPreview ||
          Number(state.specialTaskCsvPreview.summary && state.specialTaskCsvPreview.summary.matchedCount || 0) === 0;
        renderSpecialTaskCsvPreview();
        showMessage('#specialTasksMessage','CSV 比對完成；確認前尚未寫入正式資料','success');
      }).catch((err) => showMessage('#specialTasksMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function clearSpecialTaskCsvPreview(){
      state.specialTaskCsvText = '';
      state.specialTaskCsvPreview = null;
      const fileInput = $('#specialTaskCsvFile');
      if(fileInput) fileInput.value = '';
      $('#specialTaskCsvRawPreview').textContent = '';
      $('#specialTaskCsvRawPreview').classList.add('hidden');
      $('#specialTaskCsvStats').innerHTML = '';
      $('#specialTaskCsvStats').classList.add('hidden');
      $('#specialTaskCsvPreviewBody').innerHTML = '';
      $('#specialTaskCsvPreviewWrap').classList.add('hidden');
      $('#confirmSpecialTaskCsvBtn').disabled = true;
    }

    function renderSpecialTaskCsvPreview(){
      const preview = state.specialTaskCsvPreview;

      if(!preview){
        $('#specialTaskCsvStats').classList.add('hidden');
        $('#specialTaskCsvPreviewWrap').classList.add('hidden');
        return;
      }

      const summary = preview.summary || {};
      $('#specialTaskCsvStats').innerHTML = [
        moduleStatHtml('總列數',summary.totalCount),
        moduleStatHtml('成功比對',summary.matchedCount),
        moduleStatHtml('找不到',summary.notFoundCount),
        moduleStatHtml('欄位不符',summary.fieldMismatchCount),
        moduleStatHtml('不完整／重複',Number(summary.incompleteCount || 0) + Number(summary.duplicateCount || 0))
      ].join('');
      $('#specialTaskCsvStats').classList.remove('hidden');
      $('#specialTaskCsvPreviewWrap').classList.remove('hidden');

      $('#specialTaskCsvPreviewBody').innerHTML = (preview.rows || []).map((row) => {
        return '<tr>' +
          '<td>' + number(row.sourceLine || 0) + '</td>' +
          '<td>' + esc(row.careDistrict || '') + '</td>' +
          '<td>' + esc(row.careArea || '') + '</td>' +
          '<td>' + esc(row.playerName || '') + '</td>' +
          '<td>' + esc(row.groupName || '') + '</td>' +
          '<td><span class="pill ' + (row.matchStatus === 'MATCHED' ? 'active' : 'disabled') + '">' + esc(specialTaskMatchStatusLabel(row.matchStatus)) + '</span></td>' +
          '<td>' + esc(row.errorReason || '') + '</td>' +
        '</tr>';
      }).join('') || '<tr><td colspan="7">CSV 沒有資料列</td></tr>';
    }

    function confirmSpecialTaskCsv(){
      if(!state.selectedSpecialTaskId || !state.specialTaskCsvText || !state.specialTaskCsvPreview) return;

      if(!confirm('確定以目前 CSV 的成功比對資料取代此任務尚未發獎的完成者名單？')) return;

      setLoading(true,'重新驗證並確認完成者名單...');
      callServer('adminConfirmSpecialTaskResults',state.token,{
        taskId:state.selectedSpecialTaskId,
        csvText:state.specialTaskCsvText
      }).then((res) => {
        if(!isSuccess(res)) return showMessage('#specialTasksMessage',responseError(res,'確認完成者名單失敗'),'error');

        notifyUserAppInstances_('specialTaskResultsChanged');
        state.specialTaskResults = res.data.results || null;
        renderSpecialTaskResults();
        clearSpecialTaskCsvPreview();
        state.specialTasks = [];
        showMessage('#specialTasksMessage',res.data.message || '完成者名單已確認','success');
        loadSpecialTasks(true);
      }).catch((err) => showMessage('#specialTasksMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function loadSelectedSpecialTaskResults(){
      if(!state.selectedSpecialTaskId) return;

      setLoading(true,'讀取特殊任務結果...');
      callServer('adminGetSpecialTaskResults',state.token,state.selectedSpecialTaskId).then((res) => {
        if(!isSuccess(res)) return showMessage('#specialTasksMessage',responseError(res,'讀取特殊任務結果失敗'),'error');

        state.specialTaskResults = res.data || null;
        renderSpecialTaskResults();
      }).catch((err) => showMessage('#specialTasksMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function renderSpecialTaskResults(){
      const payload = state.specialTaskResults || {summary:{},groups:[],rows:[]};
      const summary = payload.summary || {};

      $('#specialTaskResultStats').innerHTML = [
        moduleStatHtml('確認完成',summary.confirmedCount),
        moduleStatHtml('符合資格',summary.eligibleCount),
        moduleStatHtml('不符合資格',summary.notEligibleCount),
        moduleStatHtml('已發送',summary.sentCount),
        moduleStatHtml('待領取／待發放',summary.notifiedCount),
        moduleStatHtml('已發放',summary.fulfilledCount),
        moduleStatHtml('待發／失敗',Number(summary.pendingCount || 0) + Number(summary.failedCount || 0))
      ].join('');

      $('#specialTaskGroupStatsBody').innerHTML = (payload.groups || []).map((group) => {
        return '<tr><td>' + esc(group.groupName || group.groupId || '') + '</td><td>' + number(group.completedCount || 0) + '／' + number(group.memberCount || 0) + '</td><td>' + number(group.eligibleCount || 0) + '</td><td>' + number(group.processedCount || 0) + esc(group.processedUnit || '') + '</td><td>' + number(group.failedCount || 0) + '</td></tr>';
      }).join('') || '<tr><td colspan="5">尚未確認完成者</td></tr>';

      $('#specialTaskResultsBody').innerHTML = (payload.rows || []).map((row) => {
        const eligibleText = row.eligible ? '符合資格' : '同組成員未全數得獎';
        const rewardClass = ['SENT','NOTIFIED','FULFILLED'].includes(row.rewardStatus) ? 'active' : row.rewardStatus === 'FAILED' ? 'disabled' : '';
        const detail = row.errorMessage || row.rewardFulfilledAt || row.rewardSentAt || '';
        const action = row.rewardStatus === 'NOTIFIED'
          ? '<button class="btn small green" data-action="special-task-fulfill" data-result-id="' + esc(row.resultId || '') + '">標記已發放</button>'
          : '';

        return '<tr>' +
          '<td><div class="cell-main"><strong>' + esc(row.playerName || row.playerNameSnapshot || '') + '</strong><small>' + esc(row.playerId || '') + '</small></div></td>' +
          '<td>' + esc((row.careDistrictSnapshot || '') + '／' + (row.careAreaSnapshot || '')) + '</td>' +
          '<td><div class="cell-main"><strong>' + esc(row.groupNameSnapshot || '') + '</strong><small>名單 ' + number(row.groupCompletedCount || 0) + '／同組 ' + number(row.groupMemberCount || 0) + ' 人</small></div></td>' +
          '<td><span class="pill ' + (row.eligible ? 'active' : '') + '">' + esc(eligibleText) + '</span></td>' +
          '<td><span class="pill ' + rewardClass + '">' + esc(specialTaskRewardStatusLabel(row.rewardStatus)) + '</span></td>' +
          '<td>' + esc(detail) + '</td>' +
          '<td><div class="row-actions">' + action + '</div></td>' +
        '</tr>';
      }).join('') || '<tr><td colspan="7">尚未確認完成者</td></tr>';

      $('#sendSpecialTaskRewardsBtn').disabled = !(payload.rows || []).length;
    }

    function handleSpecialTaskResultAction(event){
      const button = event.target.closest('button[data-action="special-task-fulfill"]');
      if(!button) return;

      const resultId = String(button.dataset.resultId || '').trim();
      if(!resultId) return;
      if(!confirm('確定此實體／其他獎勵已完成發放？')) return;

      setLoading(true,'更新獎勵發放狀態...');
      callServer('adminMarkSpecialTaskRewardFulfilled',state.token,{resultId}).then((res) => {
        if(!isSuccess(res)) return showMessage('#specialTaskSendResult',responseError(res,'更新獎勵狀態失敗'),'error');
        notifyUserAppInstances_('specialTaskFulfillmentChanged');
        state.specialTaskResults = res.data.results || null;
        renderSpecialTaskResults();
        showMessage('#specialTaskSendResult',res.data.message || '獎勵已標記為已發放','success');
        state.specialTasks = [];
        loadSpecialTasks(true);
      }).catch((err) => showMessage('#specialTaskSendResult',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function sendSelectedSpecialTaskRewards(){
      if(!state.selectedSpecialTaskId) return;
      if(!confirm('確定依已確認的資格快照發送特殊任務獎勵？已成功發送者會依 rewardKey 略過。')) return;

      setLoading(true,'驗證並發送特殊任務獎勵...');
      callServer('adminSendSpecialTaskRewards',state.token,state.selectedSpecialTaskId).then((res) => {
        if(!isSuccess(res)) return showMessage('#specialTaskSendResult',responseError(res,'發送獎勵失敗'),'error');

        notifyUserAppInstances_('specialTaskRewardsChanged');
        const summary = res.data.summary || {};
        const failedDetails = (res.data.details || []).filter((item) => item.status === 'FAILED');
        const lines = [
          '符合資格：' + number(summary.eligibleCount || 0),
          '不符合資格：' + number(summary.notEligibleCount || 0),
          '成功發送：' + number(summary.successCount || 0),
          '已發送略過：' + number(summary.skippedCount || 0),
          '發送失敗：' + number(summary.failedCount || 0)
        ];

        if(failedDetails.length){
          lines.push('', '失敗明細：');
          failedDetails.forEach((item) => lines.push((item.playerName || item.playerId || '未命名') + '｜' + (item.groupName || '未分組') + '｜' + (item.reason || '未知錯誤')));
        }

        state.specialTaskResults = res.data.results || null;
        renderSpecialTaskResults();
        showMessage('#specialTaskSendResult',lines.join('\n'),summary.failedCount ? 'error' : 'success');
        state.specialTasks = [];
        loadSpecialTasks(true);
      }).catch((err) => showMessage('#specialTaskSendResult',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function selectedSpecialTaskHasSentRewards(){
      const task = getSelectedSpecialTask();
      return !!(task && (Number(task.resultSummary && task.resultSummary.sentCount || 0) + Number(task.resultSummary && task.resultSummary.notifiedCount || 0) + Number(task.resultSummary && task.resultSummary.fulfilledCount || 0)) > 0);
    }

    function setDraftStatusOptionEnabled(selector,enabled){
      const select = $(selector);
      if(!select) return;
      const draftOption = select.querySelector('option[value="draft"]');
      if(draftOption) draftOption.disabled = !enabled;
    }

    function formatDisplayPeriod(startAt,endAt){
      if(!startAt && !endAt) return '不限制';
      return (startAt || '立即') + ' ～ ' + (endAt || '不限');
    }

    function moduleStatusLabel(status){
      return {draft:'草稿',active:'啟用',inactive:'停用'}[status] || status || '未設定';
    }

    function specialTaskRewardText(task){
      if(String(task && task.rewardType || '') === 'other') return String(task.rewardDescription || '其他獎勵');
      return '活力組旅程積分 +' + number(task && task.groupBonusPoints || 0);
    }

    function specialTaskMatchStatusLabel(status){
      return {
        MATCHED:'比對成功',
        NOT_FOUND:'找不到',
        FIELD_MISMATCH:'欄位不符',
        INCOMPLETE:'資料不完整',
        DUPLICATE:'重複資料'
      }[status] || status || '';
    }

    function specialTaskRewardStatusLabel(status){
      return {
        NOT_ELIGIBLE:'不符合資格',
        PENDING:'待發送',
        SENT:'已發送',
        NOTIFIED:'待領取／待發放',
        FULFILLED:'已發放',
        FAILED:'發送失敗'
      }[status] || status || '';
    }

    function moduleStatHtml(label,value){
      return '<div class="module-stat"><span>' + esc(label) + '</span><strong>' + number(value || 0) + '</strong></div>';
    }

    function loadSettings(force){
      if(state.settings.length && !force) return renderSettings();

      setLoading(true,'讀取正式系統設定...');
      callServer('adminGetManagedSystemSettings',state.token).then((res) => {
        if(!isSuccess(res)) return showMessage('#settingsMessage',responseError(res,'讀取設定失敗'),'error');

        state.settings = res.data.settings || [];
        state.settingsHealth = res.data.health || null;
        renderSettings();
        showMessage('#settingsMessage','設定已更新','success');
      }).catch((err) => showMessage('#settingsMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function renderSettings(){
      renderSettingsHealth();

      if(!state.settings.length){
        $('#settingsList').innerHTML = '<div class="message">沒有已登記的系統設定</div>';
        return;
      }

      const groups = {};
      state.settings.forEach((setting) => {
        const category = setting.category || '其他設定';
        if(!groups[category]) groups[category] = [];
        groups[category].push(setting);
      });

      $('#settingsList').innerHTML = Object.keys(groups).map((category) => {
        const rows = groups[category].map(renderManagedSettingRow).join('');
        return '<section class="setting-category">' +
          '<h3>' + esc(category) + '</h3>' +
          rows +
        '</section>';
      }).join('');
    }

    function renderManagedSettingRow(setting){
      const type = setting.inputType === 'number'
        ? 'number'
        : setting.inputType === 'password'
          ? 'password'
          : 'text';
      const min = setting.min == null
        ? ''
        : ' min="' + esc(setting.min) + '"';
      const max = setting.max == null
        ? ''
        : ' max="' + esc(setting.max) + '"';
      const minLength = setting.minLength == null
        ? ''
        : ' minlength="' + esc(setting.minLength) + '"';
      const maxLength = setting.maxLength == null
        ? ''
        : ' maxlength="' + esc(setting.maxLength) + '"';
      const step = type === 'number' ? ' step="1"' : '';
      const target = setting.target
        ? '<span class="setting-target">影響：' +
          esc(setting.target) +
          '</span>'
        : '';
      const defaultValue = setting.isSensitive
        ? '（安全設定不顯示）'
        : String(setting.defaultValue == null
          ? ''
          : setting.defaultValue);
      const defaultLabel =
        '<span class="setting-default">系統預設值：' +
        esc(defaultValue) +
        '</span>';

      return '<div class="setting-row">' +
        '<div class="setting-meta">' +
          '<strong>' + esc(setting.label) + '</strong>' +
          '<p>' + esc(setting.note || '') + '</p>' +
          target +
          defaultLabel +
          '<small>' + esc(setting.key) + '</small>' +
        '</div>' +
        '<input type="' + type + '" value="' +
          esc(setting.value || '') +
          '" data-setting-value="' + esc(setting.key) + '"' +
          min + max + minLength + maxLength + step + '>' +
        '<button class="btn small primary" data-action="setting-save" data-key="' +
          esc(setting.key) +
          '">儲存</button>' +
      '</div>';
    }

    function renderSettingsHealth(){
      const health = state.settingsHealth;
      const target = $('#settingsHealth');

      if(!health){
        target.className = 'setting-health';
        target.innerHTML = '';
        return;
      }

      const duplicate = health.duplicateKeys || [];
      const invalid = health.invalidSettings || [];
      const missing = health.missingKeys || [];
      const unknown = health.unknownKeys || [];
      const messages = [];

      if(duplicate.length) messages.push('重複 key：' + duplicate.map((item) => item.key + ' ×' + item.count).join('、'));
      if(invalid.length) messages.push('格式不正確：' + invalid.map((item) => item.key + '（' + item.error + '）').join('、'));
      if(missing.length) messages.push('缺少設定：' + missing.join('、'));
      if(unknown.length) messages.push('未被系統使用：' + unknown.map((item) => item.key).join('、'));

      if(!messages.length){
        target.className = 'setting-health is-healthy';
        target.innerHTML = '<article class="mini-item"><strong>設定對應正常</strong><small>目前設定頁中的每一項都已接入首頁顯示、任務確認視窗、歷史紀錄或實際積分計算。</small></article>';
        return;
      }

      target.className = 'setting-health has-issues';
      target.innerHTML = '<article class="mini-item"><strong>偵測到 ' + number(health.issueCount || messages.length) + ' 個設定問題</strong><small>' + esc(messages.join('\n')) + '</small><small>按「整理重複與無效設定」後，系統會保留最新有效值、補齊缺少 key，並移除未被系統使用的設定列。</small></article>';
    }

    function handleSettingAction(e){
      const b = e.target.closest('button[data-action="setting-save"]');
      if(!b) return;

      const key = b.dataset.key;
      const input = document.querySelector('input[data-setting-value="' + cssEscape(key) + '"]');
      if(!input) return;

      setLoading(true,'儲存設定...');
      callServer('adminUpdateManagedSystemSetting',state.token,{key,value:input.value}).then((res) => {
        if(!isSuccess(res)) return showMessage('#settingsMessage',responseError(res,'儲存失敗'),'error');

        state.settings = [];
        state.settingsHealth = null;
        loadSettings(true);
      }).catch((err) => showMessage('#settingsMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function updateAdminPassword(event){
      event.preventDefault();

      const currentPassword = $('#currentAdminPassword').value.trim();
      const newPassword = $('#newAdminPassword').value.trim();
      const confirmPassword = $('#confirmAdminPassword').value.trim();

      if(!currentPassword || !newPassword || !confirmPassword){
        showMessage('#settingsMessage','請完整輸入目前密碼、新密碼與確認新密碼','error');
        return;
      }

      if(newPassword !== confirmPassword){
        showMessage('#settingsMessage','兩次輸入的新密碼不一致','error');
        return;
      }

      if(newPassword.length < 8 || newPassword.length > 64){
        showMessage('#settingsMessage','新管理者密碼需為 8 至 64 碼','error');
        return;
      }

      setLoading(true,'更新管理者密碼...');
      callServer('adminUpdateAdminPassword',state.token,{
        currentPassword,
        newPassword
      }).then((res) => {
        if(!isSuccess(res)) return showMessage('#settingsMessage',responseError(res,'更新管理者密碼失敗'),'error');

        $('#currentAdminPassword').value = '';
        $('#newAdminPassword').value = '';
        $('#confirmAdminPassword').value = '';
        logout(res.data.message || '管理者密碼已更新，請重新登入。');
      }).catch((err) => showMessage('#settingsMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function normalizeManagedSettings(){
      const health = state.settingsHealth || {};
      const issueCount = Number(health.issueCount || 0);

      if(!issueCount){
        showMessage('#settingsMessage','目前沒有重複、失效或未使用的設定需要整理','success');
        return;
      }

      if(!confirm('確定整理 SystemSettings？\n\n系統會：\n1. 保留每個正式設定 key 的最新有效值。\n2. 補齊缺少的正式設定。\n3. 將格式錯誤的值重設為系統預設值。\n4. 刪除重複列與未被系統使用的設定列。')) return;

      setLoading(true,'整理系統設定...');
      callServer('adminNormalizeManagedSystemSettings',state.token).then((res) => {
        if(!isSuccess(res)) return showMessage('#settingsMessage',responseError(res,'整理失敗'),'error');

        state.settings = res.data && res.data.payload ? res.data.payload.settings || [] : [];
        state.settingsHealth = res.data && res.data.payload ? res.data.payload.health || null : null;
        renderSettings();

        const result = res.data && res.data.result ? res.data.result : {};
        showMessage('#settingsMessage','設定已整理：新增 ' + number(result.createdCount) + '、移除重複 ' + number(result.removedDuplicateCount) + '、移除未使用 ' + number(result.removedUnknownCount) + '、重設失效值 ' + number(result.resetInvalidCount),'success');
      }).catch((err) => showMessage('#settingsMessage',errorMessage(err),'error'))
        .finally(() => setLoading(false));
    }

    function renderMiniList(selector,rows,mapper){
      const target = $(selector);

      target.innerHTML = rows.length
        ? rows.map((row) => {
          const item = mapper(row);
          return '<article class="mini-item"><strong>' + esc(item.title || '') + '</strong><small>' + esc(item.note || '') + '</small><small>' + esc(item.time || '') + '</small></article>';
        }).join('')
        : '<div class="mini-item"><strong>目前沒有資料</strong></div>';
    }

    function callServer(functionName,...args){
      return window.GasBackend.invoke(functionName,args).then((res) => {
        if(functionName !== 'adminLogin' && isAuthError(res && res.error)){
          logout(res.error);
          throw new Error(res.error);
        }
        return res;
      });
    }

    function setLoading(active,text){
      if(active){
        state.loadingDepth += 1;
        if(text) $('#loadingText').textContent = text;
      }else{
        state.loadingDepth = Math.max(0,state.loadingDepth - 1);
      }

      const visible = state.loadingDepth > 0;
      $('#loading').classList.toggle('hidden',!visible);

      if(visible && !$('#loadingText').textContent){
        $('#loadingText').textContent = '處理中...';
      }
    }

    function showMessage(selector,text,type){
      const box = $(selector);
      box.textContent = text || '';
      box.classList.remove('success','error');
      if(type) box.classList.add(type);
    }

    function isSuccess(res){ return !!(res && res.success); }
    function responseError(res,fallback){ return res && res.error ? res.error : fallback; }
    function errorMessage(err){ return typeof err === 'string' ? err : err && err.message ? err.message : '系統錯誤'; }
    function isAuthError(message){ return String(message || '').includes('管理') && String(message || '').includes('登入'); }
    function normalize(value){ return String(value || '').trim().toLowerCase(); }
    function number(value){ return Number(value || 0).toLocaleString('zh-Hant-TW'); }
    function truncate(value,max){ value = String(value || ''); return value.length > max ? value.slice(0,max) + '...' : value; }
    function cssEscape(value){ return window.CSS && CSS.escape ? CSS.escape(value) : String(value || '').replace(/"/g,'\\"'); }
    function esc(value){
      return String(value == null ? '' : value)
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#039;');
    }
