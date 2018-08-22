'use strict';

const cssParser = require('css');

const DELIMITER = '\n';
const NTH_CHILD_MAP = {
  odd: '2n+1',
  even: '2n',
};
const PSEUDO_ELEMS = [
  'after',
  'before',
  'first-letter',
  'first-line',
  'selection',
  'backdrop',
  'placeholder ',
  'marker ',
  'spelling-error ',
  'grammar-error ',
];

function mergeArray(source, merge) {
  for (let i = 0; i < merge.length; i++) {
    if (source.indexOf(merge[i]) < 0) {
      source.push(merge[i]);
    }
  }
}

/**
 * Walk scss file
 *
 * @param  {String} scss      Scss Source
 * @param  {Array}  scssLines Scss Lines
 * @param  {Object} varMap    Scss Var Map
 * @return {Object} Scss Line to Var Map
 */
function walkScss(scss, scssLines, varMap) {
  let start = -1;
  let end = -1;
  let line = 1;
  const lineVarMap = {};

  do {
    end = scss.indexOf(DELIMITER, start);
    if (scssLines.indexOf(line) >= 0) {
      const value = scss.substring(start, end);
      const vars = varMap.findSourceVars(value);

      if (vars.length) {
        lineVarMap[line] = vars;
      }
    }

    start = end + DELIMITER.length;
    line++;
  } while (end >= 0 && end < scss.length);

  return lineVarMap;
}

/**
 * fix selector, make it standard
 *
 * rules:
 * - :<pseudo-element> -> ::<pseudo-element>
 * - nth-child(odd) -> nth-child(2n+1)
 * - nth-child(even) -> nth-child(2n)
 *
 * @return {String}
 */
function fixSelector(selector) {
  return selector
    .replace(/\s+/g, ' ')
    .replace(/(::?)([\w-]+)/g, (total, prefix, name) => {
      if (PSEUDO_ELEMS.indexOf(name) >= 0 && prefix === ':') {
        return '::' + name;
      }

      return total;
    })
    .replace(/nth-child\(\s*(\w+)\s*\)/, (total, t) => {
      if (t in NTH_CHILD_MAP) {
        return `nth-child(${NTH_CHILD_MAP[t]})`;
      }
      return total;
    });
}

function mergeSelector(selectors) {
  return selectors.map(s => {
    return fixSelector(s);
  }).join(', ');
}

function getPosLines(pos) {
  const lines = [];

  for (let i = pos.start.line; i <= pos.end.line; i++) {
    lines.push(i);
  }

  return lines;
}

function parseCssRule(rule, cssMap, lineVarMap) {
  const decls = {};

  if (rule.declarations && Array.isArray(rule.declarations)) {
    rule.declarations.forEach(decl => {
      if (decl.type === 'declaration') {
        const cssLines = getPosLines(decl.position);
        const scssLines = [];

        cssLines.forEach(line => {
          if (line in cssMap) {
            mergeArray(scssLines, cssMap[line].filter(l => {
              return l in lineVarMap;
            }));
          }
        });

        if (scssLines.length) {
          decls[decl.property] = scssLines;
        }
      }
    });
  }

  if (Object.keys(decls).length) {
    return {
      selector: mergeSelector(rule.selectors),
      decls,
    };
  }
}

/**
 * Walk css rule
 *
 * return [{
 * 	 selector: String,
 * 	 decls: [{
 * 	   <String>: [ ... ],
 * 	   ...
 * 	 }, ...]
 * }, ...]
 *
 * @param  {String} css         Css Source
 * @param  {Object} cssMap      Css-Scss Map
 * @param  {Object} lineVarMap  line-var map
 * @return {Array} Selector List
 */
function walkCss(css, cssMap, lineVarMap) {
  const rules = cssParser.parse(css).stylesheet.rules;
  const selectors = [];

  rules.forEach(item => {
    if (item.type === 'rule') {
      const s = parseCssRule(item, cssMap, lineVarMap);
      if (s) {
        selectors.push(s);
      }
    } else if (Array.isArray(item.rules)) {
      item.rules.forEach(rule => {
        const s = parseCssRule(rule, cssMap, lineVarMap);
        if (s) {
          selectors.push(s);
        }
      });
    }
  });

  return selectors;
}

function getSassMap(scss, css, cssMap, varMap) {
  // retrive css lines
  const scssLines = [];
  for (const i in cssMap) {
    cssMap[i].forEach(line => {
      if (scssLines.indexOf(line) < 0) {
        scssLines.push(line);
      }
    });
  }

  const lineVarMap = walkScss(scss, scssLines, varMap);
  const selectors = walkCss(css, cssMap, lineVarMap);

  return {
    selectors,
    vars: lineVarMap,
  };
}

module.exports = getSassMap;
