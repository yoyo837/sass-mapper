'use strict';

const fs = require('fs');
const path = require('path');
const preview = require('cli-source-preview');
const postcss = require('postcss');
const syntax = require('postcss-scss');

const postcssMixin = require('./lib/postcss-mixin');
const merge = require('./lib/merge');
const compile = require('./lib/compile');
const getCssMap = require('./lib/css-map');
const getVarMap = require('./lib/var-map');
const getSassMap = require('./lib/sass-map');

function compileMixin(scss) {
  return postcss([postcssMixin])
    .process(scss, { syntax })
    .then(result => {
      return result.css;
    });
}

function debug(contents) {
  if (!process.env.SASS_DEBUG) {
    return;
  }

  const debugDir = path.join(process.cwd(), '.sass-debug');
  try {
    fs.mkdirSync(debugDir);
  } catch (err) {
    // empty
  }

  for (const file in contents) {
    let data = contents[file];
    if (typeof data !== 'string') {
      data = JSON.stringify(data, null, 2);
    }

    fs.writeFileSync(path.join(debugDir, file), data);
  }

  console.log(' > 调试信息: %s', debugDir);
}

async function sassMapper (entry, sources, varPrefix) {
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

  // output debug
  debug({
    'origin.scss': singleScss,
    'no-mixin.scss': noMixinScss,
    'compiled.css': compiled.css,
    'css-map.json': cssMap,
    'var-map.json': varMap,
    'sass-css-map.json': scssCssMap,
  });

  return scssCssMap;
}

module.exports = sassMapper;
