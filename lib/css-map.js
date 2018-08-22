'use strict';

const SourceMapConsumer = require('source-map').SourceMapConsumer;

/**
 * Walk SourceMap
 *
 * @param  {object} scss
 * @param  {object} css
 * @param  {object} map
 * @return {object} css-scss line map
 */
async function getCssMap(scss, css, map) {
  const cssLines = css.split('\n');
  const scssLines = scss.split('\n');
  const smc = await new SourceMapConsumer(map);
  const cssMap = {};

  smc.eachMapping(function (m) {
    const sl = m.originalLine;
    const sc = m.originalColumn;
    const cl = m.generatedLine;
    const cc = m.generatedColumn;

    const c = cssLines[cl - 1].substring(0, cc).trim();
    const s = scssLines[sl - 1].substring(0, sc).trim();

    if (c !== s) {
      return;
    }

    if (cl in cssMap) {
      if (cssMap[cl].indexOf(sl) < 0) {
        cssMap[cl].push(sl);
      }
    } else {
      cssMap[cl] = [sl];
    }
  });

  return cssMap;
}

module.exports = getCssMap;
