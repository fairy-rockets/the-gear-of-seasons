import gulp from 'gulp';
import log from 'fancy-log';
import del from 'del';
import colors from 'ansi-colors';

import webpackStream from 'webpack-stream';
import webpack from 'webpack';

import child, { ChildProcess } from 'child_process';

import webpackConfig from './webpack.config.js';

const ServerPath = 'github.com/fairy-rockets/the-gear-of-seasons/cmds/the-gear-of-seasons';
const ServerBin  = '.bin/the-gear-of-seasons';

async function buildClient() {
  const stream = webpackStream(webpackConfig, webpack)
          .on('error', function(err) {
            log(colors.red(err));
            this.emit('end');
           })
          .pipe(gulp.dest('_resources/static'));
  /**
   * @type {boolean} result
   */
  const result = await new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(true)).on('error', reject);
  });
  return result;
}

gulp.task('client:build', buildClient);

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
async function buildServer(dst, os, arch) {
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
  let cmd = ['go', 'build', '-o', dst, ServerPath];
  if(os || arch) {
    env['CGO_ENABLED'] = '0';
    // TODO: to link statically:
    // https://github.com/golang/go/issues/9344#issuecomment-156317219
    cmd = ['go', 'build', '-o', dst,
           '-a', '-installsuffix', 'cgo', '-ldflags', '-s', ServerPath];
  }
  await del([dst]);
  await exec(['go', 'generate', ServerPath]);
  const result = await exec(cmd, options);
  return result;
}

gulp.task('server:build', () => buildServer(ServerBin));

/** @type {ChildProcess} server */
let server = null;
gulp.task('server:reload', (clbk) => {
  const spawn = () => {
    try {
      server = child.spawn('.bin/the-gear-of-seasons', []);
      server.on('error', (err) => {
        log(colors.red(`Error (server): ${err}`))
      });
      server.stderr.on('data', (data) => {
        //log((`from server:\n${data}`))
      });
    } finally {
      clbk();
    }
  };
  if (!!server) {
    let s = server;
    server.once('exit', (code, signal) => {
      if(signal == null) {
        log(`Killed server@${s.pid} with code=${code}`)
      } else {
        log(`Killed server@${s.pid} with signal=${code}`)
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

gulp.task('server:watch', gulp.series('server:build', 'server:reload', () => {
  return gulp.watch(['**/*.go'], {debounceDelay: 2000}, gulp.series('server:build', 'server:reload'));
}));

gulp.task('client:watch', gulp.series('client:build', () => {
  return gulp.watch(['frontend/**/*.js'], {debounceDelay: 100}, gulp.task('client:build'));
}));

gulp.task('build', gulp.parallel('server:build', 'client:build'));
gulp.task('watch', gulp.parallel('server:watch', 'client:watch'));

async function deploy() {
  const exe = 'gear-of-seasons-linux';
  const result = await Promise.all([
    buildServer(exe, 'linux', 'amd64'),
    buildClient()
  ]);
  await exec(['scp', exe, 'hexe.net:/tmp/the-gear-of-seasons']);
  await exec(['ssh', 'nodoca', 'mv /tmp/the-gear-of-seasons /opt/books/the-gear-of-seasons']);
  await exec(['rsync', '-auz', '--delete', '-e', 'ssh', '_resources', 'nodoca:/opt/books/the-gear-of-seasons']);
  await exec(['ssh', 'nodoca', 'docker-compose -f /opt/books/the-gear-of-seasons/docker-compose.yml restart']);
  await del(exe);
}
gulp.task('deploy', deploy);

gulp.task('default', gulp.series('build'));

