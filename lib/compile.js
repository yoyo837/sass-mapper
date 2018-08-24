'use strict';

const path = require('path');
const fs = require('fs');
const cp = require('child_process');
const os = require('os');
const rmdir = require('rimraf');

function exec (cmd, cwd) {
  return new Promise((resolve, reject) => {
    cp.exec(cmd, {
      cwd,
    }, function (err, stdout, stderr) {
      if (err) {
        reject(err);
      } else {
        resolve({
          stdout: stdout.toString(),
          stderr: stderr.toString(),
        });
      }
    });
  });
}

async function compile (scss) {
  // compile with source map
  const tmpdir = path.join(os.tmpdir(), 'sass-' + Date.now() + parseInt(Math.random() * 100, 10));
  const scssFile = 'index.scss';
  const cssFile = 'index.css';

  // write entry file data
  fs.mkdirSync(tmpdir);
  fs.writeFileSync(path.join(tmpdir, scssFile), scss, 'utf8');

  // compile scss
  await exec(`sass ${scssFile} ${cssFile}`, tmpdir);

  const css = fs.readFileSync(path.join(tmpdir, cssFile), 'utf8');
  const map = fs.readFileSync(path.join(tmpdir, cssFile + '.map'), 'utf8');

  // remove tmpdir
  rmdir.sync(tmpdir);

  return {
    css,
    map: JSON.parse(map),
  };
}

module.exports = compile;
