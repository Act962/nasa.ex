/**
 * Script do widget ASTRO CHAT instalado no site do cliente (spec 0031, D-1/D-2/D-7).
 * JS puro, sem dependência, desenhado em Shadow DOM para não herdar nem vazar CSS.
 * Todo texto entra por `textContent` (TR-5).
 */

const WIDGET_STYLES = `
:host { all: initial; }
.root { --surface: #fff; --text: #111827; --muted: #6b7280; --border: #e5e7eb; --bubble: #f8fafc; --field: #fff; }
.root.dark { --surface: #0f172a; --text: #e2e8f0; --muted: #94a3b8; --border: #1e293b; --bubble: #0b1220; --field: #0f172a; }
* { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
.root { position: fixed; bottom: 20px; z-index: 2147483000; display: flex; flex-direction: column; gap: 12px; }
.root.right { right: 20px; align-items: flex-end; }
.root.left { left: 20px; align-items: flex-start; }
.orb { position: relative; width: 68px; height: 68px; border: 0; padding: 0; background: transparent; cursor: pointer; animation: float 4.5s ease-in-out infinite; }
.orb img, .orb svg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
.orb:focus-visible { outline: 3px solid var(--accent); outline-offset: 4px; border-radius: 50%; }
.eyes { transform-origin: 50% 52%; animation: blink 5s infinite; }
.badge { position: absolute; top: 2px; right: 0; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 10px; background: #ef4444; color: #fff; font-size: 11px; font-weight: 700; line-height: 20px; text-align: center; display: none; }
.badge.show { display: block; }
.balloon { position: relative; max-width: 260px; background: var(--surface); color: var(--text); border-radius: 16px; padding: 12px 34px 12px 14px; font-size: 14px; line-height: 1.4; box-shadow: 0 10px 30px rgba(15, 23, 42, .18); cursor: pointer; animation: pop .25s ease-out; }
.balloon .close-balloon { position: absolute; top: 6px; right: 8px; border: 0; background: transparent; color: var(--muted); font-size: 16px; cursor: pointer; }
.panel { width: 370px; height: min(580px, calc(100vh - 120px)); background: var(--surface); border-radius: 20px; box-shadow: 0 20px 50px rgba(15, 23, 42, .28); display: none; flex-direction: column; overflow: hidden; animation: pop .2s ease-out; }
.panel.open { display: flex; }
.header { display: flex; align-items: center; gap: 10px; padding: 14px 16px; background: var(--accent); color: #fff; }
.header .avatar { position: relative; width: 38px; height: 38px; flex-shrink: 0; }
.header .avatar img, .header .avatar svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.header .titles { flex: 1; min-width: 0; }
.header .name { font-size: 15px; font-weight: 700; }
.header .company { font-size: 12px; opacity: .85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.header button { border: 0; background: rgba(255,255,255,.18); color: #fff; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; font-size: 16px; }
.messages { flex: 1; overflow-y: auto; padding: 16px; background: var(--bubble); display: flex; flex-direction: column; gap: 8px; }
.bubble { max-width: 82%; padding: 9px 12px; border-radius: 16px; font-size: 14px; line-height: 1.45; white-space: pre-wrap; word-wrap: break-word; }
.bubble.visitor { align-self: flex-end; background: var(--accent); color: #fff; border-bottom-right-radius: 4px; }
.bubble.astro { align-self: flex-start; background: var(--surface); color: var(--text); border: 1px solid var(--border); border-bottom-left-radius: 4px; }
.bubble.team { align-self: flex-start; background: #ecfdf5; color: #064e3b; border: 1px solid #a7f3d0; border-bottom-left-radius: 4px; }
.bubble .author { display: block; font-size: 11px; font-weight: 600; opacity: .7; margin-bottom: 2px; }
.typing { align-self: flex-start; font-size: 12px; color: var(--muted); padding: 4px 2px; display: none; }
.typing.show { display: block; }
.notice { font-size: 12px; color: #b45309; text-align: center; padding: 4px 12px 0; min-height: 0; }
.composer { display: flex; gap: 8px; padding: 12px; border-top: 1px solid var(--border); background: var(--surface); }
.composer textarea { flex: 1; resize: none; border: 1px solid var(--border); border-radius: 12px; padding: 9px 12px; font-size: 14px; max-height: 110px; min-height: 40px; outline: none; color: var(--text); background: var(--field); }
.composer textarea:focus { border-color: var(--accent); }
.composer button { border: 0; background: var(--accent); color: #fff; border-radius: 12px; padding: 0 14px; font-size: 14px; font-weight: 600; cursor: pointer; }
.composer button:disabled { opacity: .5; cursor: default; }
.footer { padding: 6px 12px 10px; font-size: 11px; color: var(--muted); text-align: center; background: var(--surface); }
.footer a { color: var(--muted); }
@keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes blink { 0%, 96%, 100% { transform: scaleY(1); } 98% { transform: scaleY(.1); } }
@keyframes pop { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
@media (max-width: 480px) {
  .root { bottom: 12px; }
  .root.right { right: 12px; } .root.left { left: 12px; }
  .panel.open { position: fixed; inset: 0; width: 100vw; height: 100dvh; border-radius: 0; }
}
`;

const ASTRO_EYES_SVG =
  '<svg viewBox="0 0 1438.5 1438.5" aria-hidden="true"><g class="eyes">' +
  '<rect x="486.86" y="615.25" width="128.4" height="270" rx="64.2" fill="#fefefe"/>' +
  '<rect x="745.87" y="615.25" width="128.4" height="270" rx="64.2" fill="#fefefe"/>' +
  "</g></svg>";

export function buildWidgetScript(appOrigin: string): string {
  const config = JSON.stringify({ appOrigin, styles: WIDGET_STYLES, eyes: ASTRO_EYES_SVG });
  return `(function () {
  "use strict";
  var BOOT = ${config};
  try {
    var script = document.currentScript || document.querySelector("script[data-key][src*='astro-chat']");
    var publicKey = script && script.getAttribute("data-key");
    if (!publicKey || window.__astroChatLoaded) return;
    window.__astroChatLoaded = true;

    var apiBase = BOOT.appOrigin + "/api/astro-chat/" + encodeURIComponent(publicKey);
    var tokenStorageKey = "astro_chat_token_" + publicKey;
    var balloonSeenKey = "astro_chat_balloon_" + publicKey;
    var OPEN_POLL_MS = 4000, TYPING_POLL_MS = 2000, CLOSED_POLL_MS = 30000, TYPING_TIMEOUT_MS = 30000;

    function readStorage(storage, key) { try { return storage.getItem(key); } catch (error) { return null; } }
    function writeStorage(storage, key, value) { try { storage.setItem(key, value); } catch (error) {} }

    var visitorToken = readStorage(window.localStorage, tokenStorageKey);
    var state = { isOpen: false, lastMessageId: null, unread: 0, hasConversation: false, isSending: false, typingSince: 0, pollTimer: null, siteConfig: null };

    function callApi(path, options) {
      options = options || {};
      var headers = { "content-type": "application/json" };
      if (visitorToken) headers["x-astro-visitor"] = visitorToken;
      return fetch(apiBase + path, {
        method: options.method || "GET",
        headers: headers,
        credentials: "omit",
        body: options.body ? JSON.stringify(options.body) : undefined
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (responseBody) {
          return { status: response.status, body: responseBody };
        });
      });
    }

    function element(tag, className, text) {
      var node = document.createElement(tag);
      if (className) node.className = className;
      if (text != null) node.textContent = text;
      return node;
    }

    function astroFace(className) {
      var wrapper = element("span", className);
      // Ícone próprio da empresa quando houver; senão, o rosto do ASTRO.
      if (state.siteConfig && state.siteConfig.avatarUrl) {
        var custom = document.createElement("img");
        custom.src = state.siteConfig.avatarUrl;
        custom.alt = "";
        custom.style.borderRadius = "50%";
        custom.style.objectFit = "cover";
        wrapper.appendChild(custom);
        return wrapper;
      }
      var body = document.createElement("img");
      body.src = BOOT.appOrigin + "/orbita/astro-corpo.svg";
      body.alt = "";
      wrapper.appendChild(body);
      wrapper.insertAdjacentHTML("beforeend", BOOT.eyes);
      return wrapper;
    }

    function start(siteConfig) {
      state.siteConfig = siteConfig;
      var host = element("div");
      host.setAttribute("data-astro-chat", "");
      document.body.appendChild(host);
      var shadow = host.attachShadow({ mode: "closed" });
      var style = element("style");
      style.textContent = BOOT.styles;
      shadow.appendChild(style);

      var root = element(
        "div",
        "root " +
          (siteConfig.position === "left" ? "left" : "right") +
          (siteConfig.theme === "dark" ? " dark" : "")
      );
      root.style.setProperty("--accent", siteConfig.accentColor || "#7C3AED");
      shadow.appendChild(root);

      var panel = element("div", "panel");
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", "Chat com " + siteConfig.assistantName);
      var header = element("div", "header");
      header.appendChild(astroFace("avatar"));
      var titles = element("div", "titles");
      titles.appendChild(element("div", "name", siteConfig.assistantName));
      titles.appendChild(element("div", "company", siteConfig.companyName));
      header.appendChild(titles);
      var closeButton = element("button", "", "✕");
      closeButton.setAttribute("aria-label", "Fechar chat");
      header.appendChild(closeButton);
      var messageList = element("div", "messages");
      messageList.setAttribute("aria-live", "polite");
      var typing = element("div", "typing", siteConfig.assistantName + " está digitando…");
      messageList.appendChild(typing);
      var notice = element("div", "notice");
      var composer = element("form", "composer");
      var input = element("textarea");
      input.rows = 1;
      input.maxLength = 2000;
      input.placeholder = "Escreva sua mensagem…";
      var sendButton = element("button", "", "Enviar");
      sendButton.type = "submit";
      composer.appendChild(input);
      composer.appendChild(sendButton);
      var footer = element("div", "footer");
      if (siteConfig.privacyUrl) {
        footer.appendChild(document.createTextNode("Ao conversar você concorda com a "));
        var privacyLink = element("a", "", "Política de Privacidade");
        privacyLink.href = siteConfig.privacyUrl;
        privacyLink.target = "_blank";
        privacyLink.rel = "noopener noreferrer";
        footer.appendChild(privacyLink);
        footer.appendChild(document.createTextNode(" · "));
      }
      footer.appendChild(document.createTextNode("ASTRO por ÓRBITA"));
      panel.appendChild(header);
      panel.appendChild(messageList);
      panel.appendChild(notice);
      panel.appendChild(composer);
      panel.appendChild(footer);

      var balloon = null;
      var orb = element("button", "orb");
      orb.setAttribute("aria-label", "Abrir chat com " + siteConfig.assistantName);
      orb.appendChild(astroFace(""));
      var badge = element("span", "badge");
      orb.appendChild(badge);

      root.appendChild(panel);
      root.appendChild(orb);

      function renderBadge() {
        badge.textContent = String(state.unread);
        badge.className = "badge" + (state.unread > 0 && !state.isOpen ? " show" : "");
      }

      function removeBalloon() {
        if (balloon) { balloon.remove(); balloon = null; }
      }

      function showBalloon(text) {
        if (state.isOpen) return;
        removeBalloon();
        balloon = element("div", "balloon", text);
        var closeBalloon = element("button", "close-balloon", "✕");
        closeBalloon.setAttribute("aria-label", "Fechar aviso");
        closeBalloon.addEventListener("click", function (event) { event.stopPropagation(); removeBalloon(); });
        balloon.appendChild(closeBalloon);
        balloon.addEventListener("click", openPanel);
        root.insertBefore(balloon, orb);
      }

      function appendMessage(message) {
        var bubble = element("div", "bubble " + message.author);
        if (message.author === "team" && message.senderName) bubble.appendChild(element("span", "author", message.senderName));
        bubble.appendChild(document.createTextNode(message.body));
        messageList.insertBefore(bubble, typing);
        state.lastMessageId = message.id;
      }

      function scrollToEnd() { messageList.scrollTop = messageList.scrollHeight; }

      function setTyping(isTyping) {
        state.typingSince = isTyping ? Date.now() : 0;
        typing.className = "typing" + (isTyping ? " show" : "");
      }

      function showNotice(text) { notice.textContent = text || ""; }

      function receive(messages) {
        var hasReply = false;
        messages.forEach(function (message) {
          appendMessage(message);
          if (message.author !== "visitor") {
            hasReply = true;
            if (!state.isOpen) { state.unread += 1; showBalloon(message.body.slice(0, 140)); }
          }
        });
        if (hasReply) setTyping(false);
        if (messages.length) { state.hasConversation = true; scrollToEnd(); renderBadge(); }
      }

      function poll() {
        if (!visitorToken || !state.hasConversation) return Promise.resolve();
        var query = state.lastMessageId ? "?after=" + encodeURIComponent(state.lastMessageId) : "";
        return callApi("/messages" + query).then(function (result) {
          if (result.status === 200 && result.body.items) receive(result.body.items);
          if (result.status === 403) stopAll();
        }).catch(function () {});
      }

      function schedulePoll() {
        clearTimeout(state.pollTimer);
        if (state.typingSince && Date.now() - state.typingSince > TYPING_TIMEOUT_MS) setTyping(false);
        var delay = state.typingSince ? TYPING_POLL_MS : state.isOpen ? OPEN_POLL_MS : CLOSED_POLL_MS;
        state.pollTimer = setTimeout(function () { poll().then(schedulePoll); }, delay);
      }

      function stopAll() {
        clearTimeout(state.pollTimer);
        host.remove();
      }

      function ensureSession() {
        return callApi("/session", { method: "POST", body: { pageUrl: location.href.slice(0, 500) } }).then(function (result) {
          if (result.status === 429) { showNotice("Muitas conversas agora. Tente de novo em instantes."); return false; }
          if (result.status !== 200) return false;
          if (result.body.token) { visitorToken = result.body.token; writeStorage(window.localStorage, tokenStorageKey, visitorToken); }
          state.hasConversation = !!result.body.hasConversation;
          return true;
        });
      }

      var hasLoadedHistory = false;
      function openPanel() {
        removeBalloon();
        state.isOpen = true;
        state.unread = 0;
        renderBadge();
        panel.className = "panel open";
        orb.style.display = window.innerWidth <= 480 ? "none" : "";
        writeStorage(window.sessionStorage, balloonSeenKey, "1");
        if (!hasLoadedHistory) {
          hasLoadedHistory = true;
          Array.prototype.slice.call(messageList.querySelectorAll(".bubble")).forEach(function (bubble) { bubble.remove(); });
          ensureSession().then(function () {
            if (!state.hasConversation) {
              appendMessage({ id: null, author: "astro", body: siteConfig.greeting, senderName: null });
              return;
            }
            state.lastMessageId = null;
            return poll();
          }).then(scrollToEnd);
        }
        setTimeout(function () { input.focus(); }, 50);
        schedulePoll();
      }

      function closePanel() {
        state.isOpen = false;
        panel.className = "panel";
        orb.style.display = "";
        schedulePoll();
      }

      function sendMessage(event) {
        event.preventDefault();
        var text = input.value.trim();
        if (!text || state.isSending) return;
        state.isSending = true;
        sendButton.disabled = true;
        showNotice("");
        var send = visitorToken ? Promise.resolve(true) : ensureSession();
        send.then(function (hasSession) {
          if (!hasSession) return;
          return callApi("/messages", { method: "POST", body: { body: text } }).then(function (result) {
            if (result.status === 429) { showNotice("Calma, aguarde um instante antes de enviar de novo."); return; }
            if (result.status !== 200) { showNotice("Não foi possível enviar agora. Tente de novo."); return; }
            input.value = "";
            state.hasConversation = true;
            receive([result.body.message]);
            setTyping(true);
            schedulePoll();
          });
        }).catch(function () {
          showNotice("Sem conexão. Tente de novo.");
        }).then(function () {
          state.isSending = false;
          sendButton.disabled = false;
        });
      }

      orb.addEventListener("click", function () { state.isOpen ? closePanel() : openPanel(); });
      closeButton.addEventListener("click", closePanel);
      composer.addEventListener("submit", sendMessage);
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.shiftKey) sendMessage(event);
      });

      if (!readStorage(window.sessionStorage, balloonSeenKey)) {
        setTimeout(function () { showBalloon(siteConfig.greeting); }, 2500);
      }
      if (visitorToken) {
        ensureSession().then(function () {
          if (!state.hasConversation) return;
          return callApi("/messages").then(function (result) {
            if (result.status !== 200 || !result.body.items) return;
            var items = result.body.items;
            if (items.length) state.lastMessageId = items[items.length - 1].id;
            hasLoadedHistory = false;
          });
        }).then(schedulePoll);
      }
    }

    fetch(apiBase + "/config", { credentials: "omit" })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (siteConfig) {
        if (!siteConfig) return;
        if (document.body) start(siteConfig);
        else document.addEventListener("DOMContentLoaded", function () { start(siteConfig); });
      })
      .catch(function () {});
  } catch (error) {
    if (window.console) console.warn("[ASTRO CHAT]", error);
  }
})();`;
}
