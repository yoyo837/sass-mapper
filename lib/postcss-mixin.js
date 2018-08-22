'use strict';

const postcss = require('postcss');

const MIXINS = {};

function unqoute(text) {
  text = text.trim();

  if (text[0] === '"' || text[0] === "'") {
    return text.substring(1, text.length - 1);
  }
  return text;
}

/**
 * 解析参数
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

function replaceRule(rule, nodes) {
  const parent = rule.parent;

  if (nodes && nodes.length) {
    if (rule.raws.before) {
      const lines = rule.raws.before.split(/\n/);
      rule.raws.before = '\n' + lines[lines.length - 1];
    }

    for (let i = 0; i < nodes.length; i++) {
      parent.insertBefore(rule, nodes[i]);
    }
  }

  parent.removeChild(rule);
}

function compile(params, content, mixin) {
  const varsMap = {};
  const namedMap = {};
  let rest = null;

  // extract named params
  params.forEach((param, i) => {
    if ('name' in param) {
      // unset named param
      params[i] = null;
      namedMap[param.name] = param.value;
    }
  });

  // no-rest:
  //  - name -> name
  //  - index -> index
  // rest:
  //  - index ... -> args
  for (let i = 0; i < mixin.params.length; i++) {
    const param = mixin.params[i];
    const name = param.name;
    let value = null;

    if (param.rest) {
      rest = {
        name: param.name,
        value: [],
      };

      for (let j = i; j < params.length; j++) {
        if (params[i]) {
          rest.value.push(params[i].value);
        }
      }

      // ignore rest declare param
      break;
    } else {
      if (name in namedMap) {
        value = namedMap[name];
      } else {
        value = params[i] ? params[i].value : param.default;
      }

      varsMap[param.name] = replaceVars(value, varsMap);
    }
  }

  const cloned = mixin.root.clone();

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

function walkMixin(rule) {
  let ret;

  try {
    ret = parseDeclParams(rule.params);
  } catch (err) {
    const pos = rule.source.start;
    err.message = err.message + `, <Input> scss source (line: ${pos.line}, column: ${pos.column})`;

    throw err;
  }

  MIXINS[ret.name] = {
    name: ret.name,
    params: ret.params,
    root: rule,
  };

  rule.remove();
}

function walkInclude(rule) {
  let ret;

  try {
    ret = parseCallParams(rule.params);
  } catch (err) {
    console.error(rule.input);
    throw err;
  }

  if (ret.name in MIXINS) {
    const mixin = MIXINS[ret.name];
    const nodes = compile(ret.params, rule.nodes, mixin);

    replaceRule(rule, nodes);
  } else {
    throw new Error(`Cannot find mixin ${ret.name}, include failed!`);
  }
}

module.exports = postcss.plugin('compile-mixin', options => {
  return root => {
    root.walkAtRules('mixin', rule => {
      walkMixin(rule);
    });

    root.walkAtRules('include', rule => {
      walkInclude(rule);
    });
  };
});
