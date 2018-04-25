import gulp from 'gulp';
import util from 'gulp-util';
import webpackStream from 'webpack-stream';
import webpack from 'webpack';
import child from 'child_process';

import webpackConfig from './webpack.config.js';

gulp.task('frontend:build', () => {
  return webpackStream(webpackConfig, webpack)
          .on('error', onError)
          .pipe(gulp.dest("_resources/dist"));
});

gulp.task('server:build', () => {
  const build = child.spawnSync('go', ['build', '-o', '.bin/the-gear-of-seasons', 'github.com/FairyRockets/the-gear-of-seasons']);
  if (build.stderr.length) {
    build.stderr.toString()
      .split('\n')
      .filter(line => line.length > 0)
      .forEach(l => util.log(util.colors.red('Error (go build): ' + l)));
  }
  return build;
});
gulp.task('server:watch', ['server:build'], () => {
  return gulp.watch(['**/*.go'], ['server:build']);
});

gulp.task('frontend:watch', ['frontend:build'], () => {
  return gulp.watch(['frontend/**/*.js'], ['frontend:build']);
});

gulp.task('build', ['server:build', 'frontend:build']);
gulp.task('watch', ['server:watch', 'frontend:watch']);
gulp.task('default', ['build']);

function onError(err) {
  util.log(err);
  this.emit('end');
}