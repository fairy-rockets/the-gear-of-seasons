import gulp from 'gulp';
import log from 'fancy-log';
import colors from 'ansi-colors';
import webpackStream from 'webpack-stream';
import webpack from 'webpack';
import child from 'child_process';
import runSeq from 'run-sequence';

import webpackConfig from './webpack.config.js';

gulp.task('frontend:build', () => {
  return webpackStream(webpackConfig, webpack)
          .on('error', onError)
          .pipe(gulp.dest("_resources/dist"));
});

gulp.task('server:build', (cont) => {
  const build = child.spawnSync('go', ['build', '-o', '.bin/the-gear-of-seasons', 'github.com/FairyRockets/the-gear-of-seasons']);
  if (build.stderr.length) {
    build.stderr.toString()
      .split('\n')
      .filter(line => line.length > 0)
      .forEach(l => util.log(util.colors.red('Error (go build): ' + l)));
  }
  cont();
});
let server = null;
gulp.task('server:spawn', () => {
  if (server) {
    server.kill();
  }
  server = child.spawn('.bin/the-gear-of-seasons', []);
  server.on('error', () => {
    log(colors.red(`Error (server): ${err}`))
  });
  server.on('exit', () => {
    server = null;
  });
  server.stderr.on('data', (data) => {
    log((`from server:\n${data}`))
  });
  return server;
});

gulp.task('server:reload', (clbk) => runSeq('server:build', 'server:spawn', clbk));

gulp.task('server:watch', ['server:reload'], () => {
  return gulp.watch(['**/*.go'], ['server:reload']);
});

gulp.task('frontend:watch', ['frontend:build'], () => {
  return gulp.watch(['frontend/**/*.js'], ['frontend:build']);
});

gulp.task('build', ['server:build', 'frontend:build']);
gulp.task('watch', ['server:watch', 'frontend:watch']);
gulp.task('default', ['build']);

function onError(err) {
  log(colors.red(err));
  this.emit('end');
}