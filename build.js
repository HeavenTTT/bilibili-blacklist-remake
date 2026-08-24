#!/usr/bin/env node
'use strict';

/*
 * 构建脚本 —— 完全重写版
 * -----------------------------------------------------------
 * 与旧版（bilibili-blacklist/build.js）相比的改进：
 *   1. 模块顺序不再硬编码，改由 build.config.json 的 src.modules 管理；
 *   2. userscript 元数据（@name / @match / @grant / @icon 等）集中到配置；
 *   3. 所有 src 模块统一为“纯代码”，由构建器包进同一个 IIFE，不再依赖
 *      src/main.js 里特殊的去包装逻辑，风格更干净；
 *   4. 输出文件名 / 目录由配置驱动，构建结果可预测、可复用。
 * -----------------------------------------------------------
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'build.config.json'), 'utf8'));

const { userscript = {}, src = {} } = config;
const VERSION = pkg.version;
const outputDir = path.join(ROOT, src.outputDir || 'dist');
const outputBase = src.outputBase || `${pkg.name}.user.js`;
const modules = Array.isArray(src.modules) ? src.modules : [];

/* 生成 userscript 元数据头 */
function buildHeader() {
  const meta = {
    name: userscript.name || pkg.name,
    namespace: userscript.namespace || '',
    version: VERSION,
    author: userscript.author || pkg.author,
    description: userscript.description || pkg.description,
    match: userscript.match || [],
    grant: userscript.grant || [],
    icon: userscript.icon,
    license: userscript.license || pkg.license,
    noframes: userscript.noframes === true,
    downloadURL: userscript.downloadURL,
    updateURL: userscript.updateURL,
  };

  const entries = Object.entries(meta).filter(
    ([, value]) => value !== undefined && value !== null && value !== '' && value !== false
  );
  const keyWidth = Math.max(...entries.map(([key]) => key.length));
  const lines = ['// ==UserScript=='];
  for (const [key, value] of entries) {
    const label = ('// @' + key).padEnd('// @'.length + keyWidth + 1);
    if (value === true) {
      lines.push(label.trimEnd());
    } else if (Array.isArray(value)) {
      for (const item of value) lines.push(label + item);
    } else {
      lines.push(label + value);
    }
  }
  lines.push('// ==/UserScript==', '');
  return lines.join('\n');
}

/* 按配置顺序读取并合并模块 */
function buildBody() {
  const parts = [];
  for (const rel of modules) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) {
      throw new Error(`模块文件不存在: ${full}`);
    }
    const content = fs.readFileSync(full, 'utf8').trim();
    parts.push(content);
  }
  return parts.join('\n\n') + '\n';
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputFile = path.join(outputDir, outputBase);
const output = [
  buildHeader(),
  '(function () {',
  '  "use strict";',
  '',
  buildBody(),
  '})();',
  '',
].join('\n');

fs.writeFileSync(outputFile, output, 'utf8');

console.log('Build completed: ' + outputFile);
console.log('Version: ' + VERSION);
console.log('Modules merged: ' + modules.length);