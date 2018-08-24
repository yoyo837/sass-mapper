'use strict';

const fs = require('fs');
const path = require('path');
const preview = require('cli-source-preview');
const postcss = require('postcss');
const syntax = require('postcss-scss');

const postcssSassMixin = require('./lib/postcss-sass-mixin');
const merge = require('./lib/merge');
const compile = require('./lib/compile');
const getCssMap = require('./lib/css-map');
const getVarMap = require('./lib/var-map');
const getSassMap = require('./lib/sass-map');

/**
 * 编译mixin
 *
 * @param {String} scss
 * @return {Object} Pormise对象
 */
function compileMixin(scss) {
  return postcss([postcssSassMixin])
    .process(scss, {
      syntax,
      from: undefined,
      to: undefined,
    })
    .then(result => {
      return result.css;
    });
}

/**
 * 得到 sass 与 css 的变量映射关系
 * @param {String} entry
 * @param {Object} sources
 * @param {String} varPrefix
 * @return {Object}
 */
async function sassMapper(entry, sources, varPrefix) {
  if (typeof sources !== 'object') {
    varPrefix = sources;
    sources = null;
  }

  console.log(' > 合并 %s', entry);

  const singleScss = merge(entry, sources);

  console.log(' > 编译 mixin');

  let noMixinScss;
  try {
    noMixinScss = await compileMixin(singleScss);
  } catch (err) {
    console.log(err);

    if (err.line) {
      err.message += '\n' + preview(singleScss, err.line);
    }

    throw err;
  }

  console.log(' > 生成 scss 变量表');

  const varMap = getVarMap(noMixinScss, varPrefix);

  console.log(' > 编译 scss, 生成 css/map');

  let compiled;
  try {
    compiled = await compile(noMixinScss);
  } catch (err) {
    if (err.message) {
      const matches = err.message.match(/on\s+line\s+(\d+)/);
      if (matches && matches[1]) {
        err.message += '\n' + preview(noMixinScss, matches[1]);
      }
    }

    throw err;
  }

  console.log(' > 生成 css 与 scss 的行映射表');

  const cssMap = await getCssMap(noMixinScss, compiled.css, compiled.map);

  console.log(' > 生成 scss 变量与 css 规则的映射表');

  const scssCssMap = getSassMap(noMixinScss, compiled.css, cssMap, varMap);

  // 输出调试信息
  /**
   * {
   * 'origin.scss': singleScss,
   * 'no-mixin.scss': noMixinScss,
   * 'compiled.css': compiled.css,
   * 'css-map.json': cssMap,
   * 'var-map.json': varMap,
   * 'sass-css-map.json': scssCssMap,
   *  }
   */

  return scssCssMap;
}

module.exports = sassMapper;
