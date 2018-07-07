import gulp from 'gulp';
import log from 'fancy-log';
import del from 'del';
import colors from 'ansi-colors';

import webpackStream from 'webpack-stream';
import webpack from 'webpack';

import child, { ChildProcess } from 'child_process';

import webpackConfig from './webpack.config.js';

const Repo = 'github.com/fairy-rockets/the-gear-of-seasons';
const Bin = '.bin/the-gear-of-seasons';

/**
 * @returns {Promise<any>}
 */
function buildClient() {
  const stream = webpackStream(webpackConfig, webpack)
          .on('error', function(err) {
            log(colors.red(err));
            this.emit('end');
           })
          .pipe(gulp.dest('_resources/static'));
  return new Promise((resolve, reject) => {
    stream.on('finish', resolve).on('error', reject);
  });
}

gulp.task('client:build', () => {
  return buildClient();
});

/**
 * @param {string[]} args 
 * @param {child.SpawnOptions} [options]
 * @returns {Promise<string>}
 */
function exec(args, options) {
  return new Promise((resolve, reject) => {
    log(`Spawn % ${args.map((s) => s.indexOf(' ') < 0 ? s : `"${s}"`).join(' ')}`);
    const cmd = args.shift();
    const p = child.spawn(cmd, args, options);
    p.stderr.on('data', (err) => {
      log(colors.red(`Error (${cmd}): ${err}`))
    });
    p.once('exit', (code, signal) => {
      if(code === 0) resolve('ok');
      else reject(code || signal);
    });
  });
}

/**
 * @param {string} dst
 * @param {string} [os] 
 * @param {string} [arch] 
 * @returns {Promise<string>}
 */
function buildServer(dst, os, arch) {
  /** @type {child.SpawnOptions} */
  const options = {};
  const env = Object.create( process.env );
  options.env = env;
  if(os) {
    env['GOOS'] = os;
  }
  if(arch) {
    env['GOARCH'] = arch;
  }
  /** @type {string[]} */
  let cmd = ['go', 'build', '-o', dst, Repo];
  if(os || arch) {
    env['CGO_ENABLED'] = '0';
    // TODO: to link statically:
    // https://github.com/golang/go/issues/9344#issuecomment-156317219
    cmd = ['go', 'build', '-o', dst,
           '-a', '-installsuffix', 'cgo', '-ldflags', '-s',
           Repo];
  }
  return del([dst])
    .then(paths => exec(['go', 'generate', Repo]))
    .then(() => exec(cmd, options));
}

gulp.task('server:build', () => {
  return buildServer(Bin);
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

gulp.task('client:watch', ['client:build'], () => {
  return gulp.watch(['frontend/**/*.js'], {debounceDelay: 100}, ['client:build']);
});

gulp.task('build', ['server:build', 'client:build']);
gulp.task('watch', ['server:watch', 'client:watch']);
gulp.task('deploy', [], () => {
  const exe = 'gear-of-seasons-linux';
  return Promise.all([
    buildServer(exe, 'linux', 'amd64'),
    buildClient()
  ])
  .then(() => Promise.all([
      exec(['scp', exe, 'nodoca:/tmp/gear-of-seasons'])
        .then(() => exec(['ssh', 'nodoca', 'mv /tmp/gear-of-seasons /opt/www/fairy-rockets/gear-of-seasons'])),
      exec(['rsync', '-auz', '--delete', '-e', 'ssh', '_resources', 'nodoca:/opt/www/fairy-rockets']),
  ]))
  .then(() => exec(['ssh', 'nodoca', 'supervisorctl restart fairy-rockets']))
  .then(() => del(exe));
});
gulp.task('default', ['build']);

