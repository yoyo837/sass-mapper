# sass-mapper

sass变量映射器

[![NPM version][npm-image]][npm-url]
[![build status][travis-image]][travis-url]
[![Test coverage][codecov-image]][codecov-url]
[![NPM download][download-image]][download-url]

[npm-image]: https://img.shields.io/npm/v/@no-repeat/sass-mapper.svg?style=flat-square
[npm-url]: https://npmjs.org/package/@no-repeat/sass-mapper
[travis-image]: https://img.shields.io/travis/no-repeat/sass-mapper.svg?style=flat-square
[travis-url]: https://travis-ci.org/no-repeat/sass-mapper
[codecov-image]: https://img.shields.io/codecov/c/github/no-repeat/sass-mapper.svg?style=flat-square
[codecov-url]: https://codecov.io/gh/no-repeat/sass-mapper
[download-image]: https://img.shields.io/npm/dm/@no-repeat/sass-mapper.svg?style=flat-square
[download-url]: https://npmjs.org/package/@no-repeat/sass-mapper

## Installation

```bash
$ npm install @no-repeat/mapper --save
```

Node.js >= 8.0.0 required.

## Getting Started

```js
async function getSassVarMap(merged) {
  const sources = {
    'core.scss': fs.readFileSync(path.join(__dirname, 'assets/core.scss'), 'utf8'),
    'button.scss': fs.readFileSync(path.join(__dirname, 'assets/button.scss'), 'utf8'),
  };
  /**
   * @param {String} entry的name
   * @param {Object} 所有entry的集合
   * @param {String} 需要映射class的sass变量的前缀
   * @return {Object} {selectors: [], vars: {}}
   */
  const sassVarMap = await sassMapper('button.scss', sources, '$btn-');

  return sassVarMap;
}
```
