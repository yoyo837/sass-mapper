'use strict';

const expect = require('chai').expect;
const fs = require('fs');
const path = require('path');
const sassMapper = require('../index');

describe('sass mapper', function () {
  it('should get correct scss var map', async function () {
    const sources = {
      'core.scss': fs.readFileSync(path.join(__dirname, 'assets/core.scss'), 'utf8'),
      'icon.scss': fs.readFileSync(path.join(__dirname, 'assets/icon.scss'), 'utf8'),
      'button.scss': fs.readFileSync(path.join(__dirname, 'assets/button.scss'), 'utf8'),
    };
    const scssVarMap = await sassMapper('button.scss', sources, '$btn-');

    // fs.writeFileSync(path.join(__dirname, 'assets/result.json'), JSON.stringify(scssVarMap, null, 2), 'utf8');

    expect(scssVarMap).to.have.property('selectors');
    expect(scssVarMap).to.have.property('vars');
  });
});
