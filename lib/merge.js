'use strict';

const fs = require('fs');
const path = require('path');
const resolve = require('resolve');

const IMPORT_RULE = /(@import\s+)(,?\s*("|')([^'"]+)(\3\s*))+;/g;
const IMPORT_FILE = /("|')([^'"]+)(\1)/g;

function statSync(file) {
  try {
    return fs.statSync(file);
  } catch (err) {
    return false;
  }
}

function mergeFromFs(entry, merged) {
  merged = merged || [];

  const content = fs.readFileSync(entry, 'utf8');
  const baseDir = path.dirname(entry);

  return content.replace(IMPORT_RULE, total => {
    const files = total.match(IMPORT_FILE);
    if (!files) {
      throw new Error(`Invalid import: ${total} @${entry}`);
    }

    return files.map(file => {
      file = file.substring(1, file.length - 1);

      let basename = path.basename(file);
      let fileDir = path.dirname(file);
      const extname = path.extname(basename);
      let real;

      if (!extname) {
        basename += '.scss';
      }

      // 兼容 SASS 的 @import 语法, 文件虽然以下划线开头, 但 import 里的引用却不没有指定下划线 (WTF!!!)
      if (file[0] === '~') {
        fileDir = fileDir.substring(1);
        real = path.join(fileDir, basename);

        try {
          real = resolve.sync(real, { basedir: baseDir });
        } catch (err) {
          console.error(err.stack);
          real = resolve.sync(path.join(fileDir, '_' + basename), { basedir: baseDir });
        }
      } else {
        fileDir = path.resolve(baseDir, fileDir);

        if (statSync(path.join(fileDir, basename))) {
          real = path.join(fileDir, basename);
        } else {
          real = path.join(fileDir, '_' + basename);
        }
      }

      // symbol link will cause different path
      real = fs.realpathSync(real);

      if (merged.indexOf(real) < 0) {
        merged.push(real);
        return mergeFromFs(real, merged);
      }
      return `/* ${real} already loaded ! */`;
    }).join('\n');
  });
}

function mergeFromSources(entry, sources, merged) {
  merged = merged || [];

  if (!(entry in sources)) {
    throw new Error(`Invalid import: entry ${entry} not exists`);
  }

  const content = sources[entry];

  return content.replace(IMPORT_RULE, total => {
    const files = total.match(IMPORT_FILE);
    if (!files) {
      throw new Error(`Invalid import: ${total} @${entry}`);
    }

    return files.map(file => {
      file = file.substring(1, file.length - 1);

      if (merged.indexOf(file) < 0) {
        merged.push(file);

        return mergeFromSources(file, sources, merged);
      }
      return `/* ${file} already loaded ! */`;
    }).join('\n');
  });
}

function merge(entry, sources) {
  if (sources) {
    return mergeFromSources(entry, sources);
  }
  return mergeFromFs(entry);
}

module.exports = merge;
