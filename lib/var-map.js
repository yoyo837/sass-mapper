'use strict';

const postcss = require('postcss');
const syntax = require('postcss-scss');

const VAR_NAME = /\$[\w-]+/g;

class VarMap {
  constructor(varPrefix) {
    this.map = {};
    this.varPrefix = varPrefix;
  }

  getSourceVars(name) {
    const matched = [];
    const queue = Array.isArray(name) ? name : [name];
    let idx = 0;

    while (idx < queue.length) {
      const curr = queue[idx];

      if (curr in this.map) {
        if (curr.indexOf(this.varPrefix) === 0 && matched.indexOf(curr) < 0) {
          matched.push(curr);
        }

        if (this.map[curr]) {
          const vars = this.map[curr];

          for (let i = 0; i < vars.length; i++) {
            if (queue.indexOf(vars[i]) < 0) {
              queue.push(vars[i]);
            }
          }
        }
      }

      idx++;
    }

    return matched;
  }

  findSourceVars(value) {
    const names = value.match(VAR_NAME);
    if (names) {
      return this.getSourceVars(names);
    }

    return [];
  }

  add(name, value) {
    this.map[name] = value.match(VAR_NAME);
  }
}

function getVarMap(scss, varPrefix) {
  const root = postcss().process(scss, { syntax }).result.root;
  const map = new VarMap(varPrefix);

  root.walkDecls(decl => {
    if (decl.parent === root || decl.parent.type === 'atrule' && decl.prop[0] === '$') {
      map.add(decl.prop, decl.value);
    }
  });

  return map;
}

module.exports = getVarMap;
