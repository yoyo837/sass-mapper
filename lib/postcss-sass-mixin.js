'use strict';

const postcss = require('postcss');

// 所有 mixin 声明的缓存对象
const MIXINS = {};

/**
 * 去除引号
 *
 * @param {String} text
 */
function unqoute(text) {
  text = text.trim();

  if (text[0] === '"' || text[0] === "'") {
    return text.substring(1, text.length - 1);
  }
  return text;
}

/**
 * 解析mixin参数
 *
 * "$param1, $param2, $param3" => [ $param1, $param2, $param3 ]
 *
 * @param  {String} params
 * @return {Array}
 */
function parseParams(params) {
  if (!params) {
    return [];
  }

  const points = [0];
  const length = params.length;
  let stack = 0;

  for (let i = 0; i < length; i++) {
    switch (params[i]) {
      case '(':
        stack++;
        break;
      case ')':
        stack--;
        break;
      case ',':
        if (stack === 0) {
          points.push(i);
        }
        break;
      default:
        break;
    }
  }

  points.push(length);

  let from = points.shift();
  let to = from;
  const parsed = [];

  while (to = points.shift()) {
    parsed.push(params.substring(from, to).trim());
    from = to + 1;
  }

  return parsed;
}

/**
 * 解析 inlcude 调用的参数
 *
 * @param {String} raw
 * @return {Object}
 */
function parseCallParams(raw) {
  const start = raw.indexOf('(');

  if (start < 0) {
    return {
      name: raw.trim(),
      params: [],
    };
  }

  if (raw.indexOf('...') > 0) {
    throw new Error('variable arguments in @include is NOT supported!');
  }

  const end = raw.lastIndexOf(')');
  const name = raw.substr(0, start).trim();
  const params = parseParams(raw.substring(start + 1, end).trim());

  const callParams = params.map(param => {
    const val = {
      value: param,
    };
    const idx = param.indexOf(':');
    if (idx > 0) {
      val.name = param.substring(0, idx).trim();
      val.value = param.substring(idx + 1).trim();
    }

    return val;
  });

  return {
    name,
    params: callParams,
  };
}

/**
 * 解析 mixin 声明的参数
 *
 * @param {String} raw
 * @return {Object}
 */
function parseDeclParams(raw) {
  const start = raw.indexOf('(');

  if (start < 0) {
    return {
      name: raw.trim(),
      params: [],
    };
  }

  const end = raw.lastIndexOf(')');
  const name = raw.substr(0, start).trim();
  const params = parseParams(raw.substring(start + 1, end).trim());

  const declParams = params.map(param => {
    const val = {
      name: param,
      default: null,
      rest: false,
    };

    if (param.indexOf('...') > 0) {
      val.name = param.replace(/\s*\.{3}/, '');
      val.rest = true;
    } else {
      const idx = param.indexOf(':');
      if (idx > 0) {
        val.name = param.substring(0, idx).trim();
        val.default = param.substring(idx + 1).trim();
      }
    }

    return val;
  });

  return {
    name,
    params: declParams,
  };
}

/**
 * 替换参数
 *
 * @param {String} text
 * @param {Object} varsMap
 * @return {String}
 */
function replaceVars(text, varsMap) {
  if (!text) {
    return text;
  }

  return text.replace(/(#\{\s*)?(\$[\w-]+)(\s*\})?/g, (total, left, name, right) => {
    left = left || '';
    right = right || '';

    if (name in varsMap) {
      const value = varsMap[name];

      // for `#{ $xxx }`
      if (left && right) {
        const tmp = unqoute(value);
        // unqoute failed
        if (tmp === value && value[0] === '$') {
          return left + value + right;
        }
        return tmp;
      }
      return left + value + right;
    }
    return total;
  });
}

/**
 * 执行规则中的节点替换，将@include替换为@mixin中的内容，并删除原有的@mixin声明
 *
 * @param {Object} rule
 * @param {Array} nodes
 */
function replaceRule(rule, nodes) {
  const parent = rule.parent;

  if (nodes && nodes.length) {
    if (rule.raws.before) {
      const lines = rule.raws.before.split(/\n/);
      rule.raws.before = '\n' + lines[lines.length - 1];
    }

    /**
     * insertBefore(exist, add) -> {Node}
     * exist -> Node | Number
     * add -> Node | Object | String | Array.<Node>
     */
    parent.insertBefore(rule, nodes);
  }

  parent.removeChild(rule);
}

/**
 * 对@include的节点进行clone，并执行rule，返回新的节点
 *
 * @param {Array} includeParams
 * @param {Array} content
 * @param {Object} mixinDecl
 * @return {Array}
 */
function compile(includeParams, content, mixinDecl) {
  const varsMap = {};
  const includeNamedParams = {};
  const includeUnNamedParams = [];
  let rest = null;

  includeParams.forEach((param, i) => {
    if ('name' in param) {
      includeNamedParams[param.name] = param.value;
    } else {
      includeUnNamedParams.push(param);
    }
  });

  // no-rest:
  //  - name -> name
  //  - index -> index
  // rest:
  //  - index ... -> args
  for (let i = 0; i < mixinDecl.params.length; i++) {
    const mixinParam = mixinDecl.params[i];
    const name = mixinParam.name;
    let value = null;

    if (mixinParam.rest) {
      rest = {
        name: mixinParam.name,
        value: [],
      };

      for (let j = i; j < includeUnNamedParams.length; j++) {
        if (includeUnNamedParams[i]) {
          rest.value.push(includeUnNamedParams[i].value);
        }
      }

      // ignore rest declare param
      break;
    } else {
      if (name in includeNamedParams) {
        value = includeNamedParams[name];
      } else {
        value = includeUnNamedParams[i] ? includeUnNamedParams[i].value : mixinParam.default;
      }

      varsMap[mixinParam.name] = replaceVars(value, varsMap);
    }
  }

  const cloned = mixinDecl.root.clone();

  // add rest args
  if (rest) {
    const decl = postcss.decl({
      prop: rest.name,
      value: '(' + rest.value.join(', ') + ')',
    });
    cloned.prepend(decl);
  }

  // replace content
  cloned.walkAtRules('content', rule => {
    replaceRule(rule, content);
  });

  // walk expanded at rules
  cloned.walkAtRules('include', rule => {
    walkInclude(rule);
  });

  // walk other at rules
  cloned.walkAtRules(rule => {
    rule.params = replaceVars(rule.params, varsMap);
  });

  // walk rules
  cloned.walkRules(rule => {
    rule.selector = replaceVars(rule.selector, varsMap);
  });

  // walk declares
  cloned.walkDecls(decl => {
    decl.value = replaceVars(decl.value, varsMap);
    decl.prop = replaceVars(decl.prop, varsMap);
  });

  return cloned.nodes;
}

/**
 * 执行@mixin规则
 *
 * @param {Object} rule
 */
function walkMixin(rule) {
  let mixinDecl;

  try {
    mixinDecl = parseDeclParams(rule.params);
  } catch (err) {
    const pos = rule.source.start;
    err.message = err.message + `, <Input> scss source (line: ${pos.line}, column: ${pos.column})`;

    throw err;
  }

  MIXINS[mixinDecl.name] = {
    name: mixinDecl.name,
    params: mixinDecl.params,
    root: rule,
  };

  rule.remove();
}

/**
 * 执行@include规则
 *
 * @param {Object} rule
 */
function walkInclude(rule) {
  let inlcudeDecl;

  try {
    inlcudeDecl = parseCallParams(rule.params);
  } catch (err) {
    console.error(rule.input);
    throw err;
  }

  if (inlcudeDecl.name in MIXINS) {
    const mixinDecl = MIXINS[inlcudeDecl.name];
    const nodes = compile(inlcudeDecl.params, rule.nodes, mixinDecl);

    replaceRule(rule, nodes);
  } else {
    throw new Error(`Cannot find mixin ${inlcudeDecl.name}, include failed!`);
  }
}

module.exports = postcss.plugin('postcss-sass-mixin', options => {
  return root => {
    root.walkAtRules('mixin', rule => {
      walkMixin(rule);
    });

    root.walkAtRules('include', rule => {
      walkInclude(rule);
    });
  };
});
