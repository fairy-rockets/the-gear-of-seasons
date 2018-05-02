import gulp from 'gulp';
import log from 'fancy-log';
import del from 'del';
import * as colors from 'ansi-colors';

import webpackStream from 'webpack-stream';
import webpack from 'webpack';

import child, { ChildProcess } from 'child_process';

import webpackConfig from './webpack.config.js';

const Repo = 'github.com/FairyRockets/the-gear-of-seasons';
const Bin = '.bin/the-gear-of-seasons';

gulp.task('frontend:build', () => {
  return webpackStream(webpackConfig, webpack)
          .on('error', onError)
          .pipe(gulp.dest("_resources/static"));
});

/**
 * @param {string[]} args 
 * @returns {Promise<string>}
 */
function exec(args) {
  return new Promise((resolve, reject) => {
    log(`Spawn % ${args.map((s) => s.indexOf(' ') < 0 ? s : `"${s}"`).join(' ')}`);
    const cmd = args.shift();
    const p = child.spawn(cmd, args);
    p.stderr.on('data', (err) => {
      log(colors.red(`Error (${cmd}): ${err}`))
    });
    p.once('exit', (code, signal) => {
      if(code === 0) resolve('ok');
      else reject(code || signal);
    });
  });
}

gulp.task('server:build', () => {
  return del(['.bin/*'])
    .then(paths => exec(['go', 'generate', Repo]))
    .then(() => exec(['go', 'build', '-o', Bin, Repo]));
});

/** @type {ChildProcess} server */
let server = null;
gulp.task('server:spawn', ['server:build'], (clbk) => {
  const spawn = () => {
    server = child.spawn('.bin/the-gear-of-seasons', []);
    server.on('error', (err) => {
      log(colors.red(`Error (server): ${err}`))
    });
    server.stderr.on('data', (data) => {
      //log((`from server:\n${data}`))
    });
    clbk();
  };
  if (server) {
    let s = server;
    server.once('exit', (code, signal) => {
      if(signal == null) {
        log(`Killed  server@${s.pid} with code=${code}`)
      } else {
        log(`Killed  server@${s.pid} with signal=${code}`)
      }
      server = null;
      spawn();
    });
    log(`Killing server@${server.pid} ...`)
    server.kill();
  }else{
    spawn();
  }
});

gulp.task('server:reload', ['server:spawn']);

gulp.task('server:watch', ['server:reload'], () => {
  return gulp.watch(['**/*.go'], {debounceDelay: 2000}, ['server:reload']);
});

gulp.task('frontend:watch', ['frontend:build'], () => {
  return gulp.watch(['frontend/**/*.js'], {debounceDelay: 100}, ['frontend:build']);
});

gulp.task('build', ['server:build', 'frontend:build']);
gulp.task('watch', ['server:watch', 'frontend:watch']);
gulp.task('default', ['build']);

function onError(err) {
  log(colors.red(err));
  this.emit('end');
}