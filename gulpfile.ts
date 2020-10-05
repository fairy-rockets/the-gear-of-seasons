import gulp from 'gulp';
import log from 'fancy-log';
import del from 'del';
import colors from 'ansi-colors';
import path from 'path'
import fs from 'fs'

import webpackStream from 'webpack-stream';
import webpack from 'webpack';

import child from 'child_process';
import webpackConfig from "./webpack.config";

const ServerPath = 'github.com/fairy-rockets/the-gear-of-seasons/cmd/the-gear-of-seasons';
const ServerBin  = '.bin/the-gear-of-seasons';

async function buildClient() {
  const stream = webpackStream(webpackConfig, webpack.prototype)
          .on('error', function(err) {
            log(colors.red(err));
            gulp.emit('end');
           })
          .pipe(gulp.dest('_resources/static'));
  const result: boolean = await new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(true)).on('error', reject);
  });
  return result;
}

gulp.task('client:build', buildClient);

function exec(args: string[], options: child.SpawnOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    log(`Spawn % ${args.map((s) => s.indexOf(' ') < 0 ? s : `"${s}"`).join(' ')}`);
    const cmd: string = args.shift()!;
    const p = child.spawn(cmd, args, options);
    p.stderr!.on('data', (err) => {
      log(colors.red(`Error (${cmd}): ${err}`))
    });
    p.once('exit', (code, signal) => {
      if(code === 0) resolve('ok');
      else reject(code || signal);
    });
  });
}

async function buildServer(dst: string, os: string | null = null, arch: string | null = null): Promise<string> {
  fs.mkdirSync(path.dirname(dst), {recursive: true});
  const options: child.SpawnOptions = {};
  const env = Object.create( process.env );
  options.env = env;
  if(os) {
    env['GOOS'] = os;
  }
  if(arch) {
    env['GOARCH'] = arch;
  }
  let cmd: string[] = ['go', 'build', '-o', dst, ServerPath];
  if(os || arch) {
    env['CGO_ENABLED'] = '0';
    // TODO: to link statically:
    // https://github.com/golang/go/issues/9344#issuecomment-156317219
    cmd = ['go', 'build', '-o', dst,
           '-a', '-installsuffix', 'cgo', '-ldflags', '-s', ServerPath];
  }
  await del([dst]);
  await exec(['go', 'generate', ServerPath], options);
  return await exec(cmd, options);
}

gulp.task('server:build', () => buildServer(ServerBin));

let server: child.ChildProcess | null = null;
gulp.task('server:reload', (clbk) => {
  const spawn = () => {
    try {
      server = child.spawn('.bin/the-gear-of-seasons', []);
      server.on('error', (err) => {
        log(colors.red(`Error (server): ${err}`))
      });
      server.stderr!.on('data', (data) => {
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
  return gulp.watch(['**/*.go'], {delay: 2000}, gulp.series('server:build', 'server:reload'));
}));

gulp.task('client:watch', gulp.series('client:build', () => {
  return gulp.watch(['web/**/*.js'], {delay: 100}, gulp.task('client:build'));
}));

gulp.task('build', gulp.parallel('server:build', 'client:build'));
gulp.task('watch', gulp.parallel('server:watch', 'client:watch'));

async function deploy() {
  const exe = 'gear-of-seasons-linux';
  const result = await Promise.all([
    buildServer(exe, 'linux', 'amd64'),
    buildClient()
  ]);
  await exec(['scp', exe, 'hexe.net:/tmp/the-gear-of-seasons'], {});
  await exec(['ssh', 'nodoca', 'mv /tmp/the-gear-of-seasons /opt/books/the-gear-of-seasons'], {});
  await exec(['rsync', '-auz', '--delete', '-e', 'ssh', '_resources', 'nodoca:/opt/books/the-gear-of-seasons'], {});
  await exec(['ssh', 'nodoca', 'docker-compose -f /opt/books/the-gear-of-seasons/docker-compose.yml restart'], {});
  await del(exe);
}
gulp.task('deploy', deploy);

gulp.task('default', gulp.series('build'));

