/**
 * groupFellowshipView.js
 * 活力組即時交流看板視圖深層模組 (Group Fellowship View Deep Module)
 * 負責：置頂橫幅渲染、Cache-First 3ms 秒開留言渲染、樂觀發言送出
 */

(function(global) {
  'use strict';

  class GroupFellowshipView {
    constructor({ container = null, chatStore, currentUserId, isLeader = false }) {
      this.container = container || document.getElementById('chatSectionMount') || document.getElementById('homeGroupPosts');
      this.modalContainer = document.getElementById('groupPostModal');
      this.chatStore = chatStore;
      this.currentUserId = currentUserId;
      this.isLeader = isLeader;

      // 訂閱聊天狀態庫
      if (this.chatStore) {
        this.chatStore.onMessagesUpdated = (data) => {
          this.renderMessages(data.messages, data.pinnedPost);
        };
      }

      this.initModalEvents_();
    }

    initModalEvents_() {
      document.querySelectorAll('[data-close-modal="groupPostModal"]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (this.modalContainer) this.modalContainer.classList.add('hidden');
        });
      });

      // 攔截小組公告表單，杜絕瀏覽器原生 Submit 導致的整頁 Reload
      const groupPostForm = document.getElementById('homeGroupPostForm');
      if (groupPostForm) {
        groupPostForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const groupPostInput = document.getElementById('homeGroupPostInput');
          const text = groupPostInput ? groupPostInput.value.trim() : '';
          if (!text) {
            alert('請輸入公告內容');
            return;
          }
          if (this.chatStore) {
            this.chatStore.sendMessage(this.currentUserId, text, true);
          }
          if (groupPostInput) groupPostInput.value = '';
          alert('小組公告已發布！');
        });
      }
    }

    openModal() {
      if (this.modalContainer) {
        this.modalContainer.classList.remove('hidden');
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
            ${this.isLeader ? '<button type="button" class="btn-primary" id="btnSendPinned" style="background-color: #d97706; color:#fff; border:none; border-radius:8px; padding:8px 14px; font-weight:600; cursor:pointer;" title="以隊長身份發布為置頂">置頂</button>' : ''}
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
          this.chatStore.sendMessage(this.currentUserId, text, false);
          input.value = '';
        });
      }

      const btnPinned = this.container.querySelector('#btnSendPinned');
      if (btnPinned) {
        btnPinned.addEventListener('click', () => {
          const text = input.value.trim();
          if (!text) {
            alert('請輸入要置頂的訊息內容');
            return;
          }
          this.chatStore.sendMessage(this.currentUserId, text, true);
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

      msgContainer.innerHTML = messages.map(msg => {
        const isOwn = msg.authorPlayerId === this.currentUserId;
        const authorText = isOwn ? '我' : (msg.authorName || msg.authorPlayerId);
        const bg = isOwn ? '#e0f2fe' : '#ffffff';
        const align = isOwn ? 'flex-end' : 'flex-start';

        return `
          <div style="align-self: ${align}; max-width: 80%; background: ${bg}; border: 1px solid #cbd5e1; border-radius: 12px; padding: 8px 12px;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 2px;">${authorText}</div>
            <div style="font-size: 13px; color: #1e293b; line-height: 1.4;">${this.escapeHtml(msg.content)}</div>
          </div>
        `;
      }).join('');
    }

    escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { GroupFellowshipView };
  }
  global.GroupFellowshipView = GroupFellowshipView;

})(typeof window !== 'undefined' ? window : global);
