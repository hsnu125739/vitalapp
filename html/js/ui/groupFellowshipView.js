/**
 * groupFellowshipView.js
 * 活力組即時交流看板視圖深層模組 (Group Fellowship View Deep Module)
 * 負責：置頂橫幅渲染、Cache-First 3ms 秒開留言渲染、樂觀發言送出
 */

(function(global) {
  'use strict';

  class GroupFellowshipView {
    constructor({ container = null, chatStore, currentUserId, isLeader = false }) {
      this.container = container || (typeof document !== 'undefined' ? (document.getElementById('chatSectionMount') || document.getElementById('homeGroupPosts')) : null);
      this.modalContainer = typeof document !== 'undefined' ? document.getElementById('groupPostModal') : null;
      this.chatStore = chatStore;
      this.currentUserId = currentUserId;
      this.isLeader = isLeader;
      this.isSelectingPin = false;

      // 訂閱聊天狀態庫
      if (this.chatStore) {
        this.chatStore.onMessagesUpdated = (data) => {
          this.renderMessages(data.messages, data.pinnedPost);
        };
      }

      this.initModalEvents_();
    }

    initModalEvents_() {
      if (typeof document === 'undefined') return;
      document.querySelectorAll('[data-close-modal="groupPostModal"]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (this.modalContainer) this.modalContainer.classList.add('hidden');
          this.isSelectingPin = false;
          this.updatePinButtonState_();
        });
      });

      const btnTogglePin = document.getElementById('btnToggleSelectPinnedPost');
      if (btnTogglePin) {
        btnTogglePin.addEventListener('click', () => {
          this.isSelectingPin = !this.isSelectingPin;
          this.updatePinButtonState_();
          if (this.chatStore) {
            this.renderMessages(this.chatStore.messages, this.chatStore.pinnedPost);
          }
        });
      }
    }

    updatePinButtonState_() {
      const btnTogglePin = document.getElementById('btnToggleSelectPinnedPost');
      if (!btnTogglePin) return;
      if (this.isSelectingPin) {
        btnTogglePin.textContent = '取消選擇';
        btnTogglePin.style.background = '#64748b';
      } else {
        btnTogglePin.textContent = '選擇置頂貼文';
        btnTogglePin.style.background = '#e11d48';
      }
    }

    openModal() {
      if (this.modalContainer) {
        this.modalContainer.classList.remove('hidden');
        this.isSelectingPin = false;
        this.updatePinButtonState_();

        // 隊長專屬控制列
        const leaderControls = document.getElementById('groupLeaderAnnouncementControls');
        if (leaderControls) {
          if (this.isLeader) {
            leaderControls.classList.remove('hidden');
          } else {
            leaderControls.classList.add('hidden');
          }
        }

        const mount = document.getElementById('myGroupPostList');
        if (mount) {
          this.container = mount;
          this.render();
        }
        if (this.chatStore) {
          this.chatStore.enterChat();
        }
      }
    }

    render() {
      if (!this.container) return;

      this.container.innerHTML = `
        <section class="chat-section" id="chatSection" style="padding:12px; background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0;">
          <div class="section-title" style="margin: 0 0 10px 0; font-weight:700; color:#1e293b;">
            <span>小組交通看板</span>
            <span class="section-subtitle" style="font-size:12px; color:#64748b; margin-left:8px;">即時同行交通</span>
          </div>

          <!-- 置頂留言橫幅 -->
          <div class="pinned-banner hidden" id="pinnedBanner" style="background:#fef3c7; border:1px solid #fde68a; border-radius:8px; padding:8px 12px; margin-bottom:10px;">
            <span class="pinned-badge" style="color:#b45309; font-weight:700; font-size:12px;">📌 置頂公告</span>
            <div class="pinned-content" id="pinnedContent" style="font-size:13px; color:#92400e; margin-top:2px;">尚無置頂訊息</div>
          </div>

          <!-- 留言清單容器 -->
          <div class="chat-messages-container" id="chatMessagesContainer" style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
            <div style="text-align: center; color: #94a3b8; font-size: 13px; padding: 20px;">
              正在載入小組交流...
            </div>
          </div>

          <!-- 發言輸入列 -->
          <form class="chat-input-bar" id="chatForm" style="display: flex; gap: 8px;">
            <input type="text" class="chat-input" id="chatInput" placeholder="分享今日晨興心得、禱告負擔..." maxlength="200" required autocomplete="off" style="flex:1; border:1px solid #cbd5e1; border-radius:8px; padding:8px 12px; font-size:14px;" />
            <button type="submit" class="btn-primary" id="btnSendChat" style="background:#0284c7; color:#fff; border:none; border-radius:8px; padding:8px 14px; font-weight:600; cursor:pointer;">送出</button>
          </form>
        </section>
      `;

      this.bindEvents();
      if (this.chatStore) {
        this.renderMessages(this.chatStore.messages, this.chatStore.pinnedPost);
      }
    }

    bindEvents() {
      if (!this.container) return;
      const form = this.container.querySelector('#chatForm');
      const input = this.container.querySelector('#chatInput');

      if (form) {
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const text = input.value.trim();
          if (!text) return;
          this.chatStore.sendMessage(this.currentUserId, text, this.currentUserName);
          input.value = '';
        });
      }
    }

    renderMessages(messages, pinnedPost) {
      if (!this.container) return;
      const banner = this.container.querySelector('#pinnedBanner');
      const pinnedContent = this.container.querySelector('#pinnedContent');
      const msgContainer = this.container.querySelector('#chatMessagesContainer');

      if (!msgContainer) return;

      // 1. 置頂橫幅
      if (banner && pinnedContent) {
        if (pinnedPost && pinnedPost.content) {
          pinnedContent.textContent = pinnedPost.content;
          banner.classList.remove('hidden');
        } else {
          banner.classList.add('hidden');
        }
      }

      // 2. 留言清單
      if (!messages || messages.length === 0) {
        msgContainer.innerHTML = `
          <div style="text-align: center; color: #94a3b8; font-size: 13px; padding: 20px;">
            尚無留言，成為第一個分享同伴吧！
          </div>
        `;
        return;
      }

      const showPinBtn = Boolean(this.isLeader && this.isSelectingPin);

      msgContainer.innerHTML = messages.map(msg => {
        const authorId = msg.authorPlayerId || msg.authorId || '';
        const currentId = this.currentUserId || (window.activeApiClient && window.activeApiClient.getPlayerIdFromToken()) || '';
        const authorName = (msg.authorName || '').trim();
        const currentName = (this.currentUserName || '').trim();

        const isOwn = (Boolean(authorId) && Boolean(currentId) && String(authorId).trim() === String(currentId).trim()) ||
                      (Boolean(authorName) && Boolean(currentName) && authorName === currentName);

        const authorText = isOwn ? '我' : (authorName || authorId || '聖徒');
        const bg = isOwn ? '#e0f2fe' : '#ffffff';
        const align = isOwn ? 'flex-end' : 'flex-start';

        const pinBtnHtml = showPinBtn ? `
          <button type="button" class="btn-pin-post"
            data-post-id="${this.escapeAttr(msg.id || msg.postId || '')}"
            data-post-content="${this.escapeAttr(msg.content || '')}"
            data-author-name="${this.escapeAttr(msg.authorName || msg.authorPlayerId || '')}"
            data-author-id="${this.escapeAttr(msg.authorPlayerId || '')}"
            style="background:#fef3c7; border:1px solid #fde68a; border-radius:50%; width:32px; height:32px; font-size:16px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 1px 3px rgba(0,0,0,0.1); transition:transform 0.1s;"
            title="設為小組公告">📌</button>
        ` : '';

        const bubbleHtml = `
          <div style="max-width: 80%; background: ${bg}; border: 1px solid #cbd5e1; border-radius: 12px; padding: 8px 12px;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 2px;">${authorText}</div>
            <div style="font-size: 13px; color: #1e293b; line-height: 1.4;">${this.escapeHtml(msg.content)}</div>
          </div>
        `;

        // 若對話靠右（自己發的），釘選圖示放在左側：[ 📌 ] [ 氣泡 ]
        // 若對話靠左（別人發的），釘選圖示放在右側：[ 氣泡 ] [ 📌 ]
        const contentHtml = isOwn
          ? `${pinBtnHtml}${bubbleHtml}`
          : `${bubbleHtml}${pinBtnHtml}`;

        return `
          <div style="display: flex; align-items: center; justify-content: ${align}; gap: 8px; width: 100%;">
            ${contentHtml}
          </div>
        `;
      }).join('');

      // 綁定釘選按鈕確認與設置事件
      if (showPinBtn) {
        msgContainer.querySelectorAll('.btn-pin-post').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const postId = btn.getAttribute('data-post-id');
            const content = btn.getAttribute('data-post-content');
            const authorName = btn.getAttribute('data-author-name');
            const authorPlayerId = btn.getAttribute('data-author-id');
            if (!content) return;

            const ok = confirm(`確定要將此訊息設為小組公告嗎？\n\n「${content}」`);
            if (!ok) return;

            // 呼叫 chatStore 設定公告
            if (this.chatStore) {
              this.chatStore.setAnnouncement(content, authorName, authorPlayerId, postId);
            }

            // 自動退出選擇模式
            this.isSelectingPin = false;
            this.updatePinButtonState_();
            if (this.chatStore) {
              this.renderMessages(this.chatStore.messages, this.chatStore.pinnedPost);
            }
          });
        });
      }
    }

    escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    escapeAttr(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GroupFellowshipView };
  }
  global.GroupFellowshipView = GroupFellowshipView;

})(typeof window !== 'undefined' ? window : global);
