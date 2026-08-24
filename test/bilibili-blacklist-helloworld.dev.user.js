// ==UserScript==
// @name         Bilibili-BlackList HelloWorld -Dev (Loader)
// @namespace    https://github.com/HeavenTTT/bilibili-blacklist
// @version      0.1.0
// @author       HeavenTTT
// @description  [开发专用] 每次打开 B 站页面自动拉取 localhost:5173 的最新构建产物并执行。本加载器只需安装一次。
// @match        *://*.bilibili.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        unsafeWindow
// @connect      localhost
// @connect      127.0.0.1
// @noframes
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  var DEV_URL = 'http://localhost:5173/dist/bilibili-blacklist-helloworld.user.js?t=' + Date.now();

  function fail(msg) {
    console.error('[Bilibili-BlackList HelloWorld Dev] ' + msg + '（请确认已在项目根目录运行 npm run dev）');
  }

  GM_xmlhttpRequest({
    method: 'GET',
    url: DEV_URL,
    timeout: 8000,
    onload: function (res) {
      if (res.status !== 200) {
        fail('拉取构建产物失败，HTTP ' + res.status);
        return;
      }
      var code = res.responseText.replace(/^\/\/\s*==UserScript==[\s\S]*?\/\/\s*==\/UserScript==\s*/, '');
      try {
        eval(code);
        console.log('[Bilibili-BlackList HelloWorld Dev] 已加载最新构建 ' + new Date().toLocaleTimeString());
      } catch (e) {
        console.error('[Bilibili-BlackList HelloWorld Dev] 执行最新构建时出错：', e);
      }
    },
    onerror: function () {
      fail('无法连接本地 dev server');
    },
    ontimeout: function () {
      fail('请求超时');
    }
  });
})();