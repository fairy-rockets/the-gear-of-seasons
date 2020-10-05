[![Build on Linux](https://github.com/fairy-rockets/the-gear-of-seasons/workflows/Build%20on%20Linux/badge.svg)](https://github.com/fairy-rockets/the-gear-of-seasons/actions?query=workflow%3A%22Build+on+Linux%22)
[![Build on macOS](https://github.com/fairy-rockets/the-gear-of-seasons/workflows/Build%20on%20macOS/badge.svg)](https://github.com/fairy-rockets/the-gear-of-seasons/actions?query=workflow%3A%22Build+on+macOS%22)
[![Build on Windows](https://github.com/fairy-rockets/the-gear-of-seasons/workflows/Build%20on%20Windows/badge.svg)](https://github.com/fairy-rockets/the-gear-of-seasons/actions?query=workflow%3A%22Build+on+Windows%22)

# How to build

## Prerequirements

#### ServerSide

```bash
echo 'video'
sudo apt get install ffmpeg
# mac OS:
#   brew install ffmpeg
# Fedora or CentOS:
#   sudo dnf install ffmpeg ffmpeg-devel
#   sudo yum install ffmpeg ffmpeg-devel
```

### ClientSide

```bash
npm install

echo 'to upgrade,'

npm run update
npm update
```

## Iterative and incremental development

```bash
npm run start
```

then,

open [http://localhost:8080/](http://localhost:8080/)(index) or [http://localhost:8081/](http://localhost:8081/)(admin)

## Build

```bash
npm run build
```

## Deploy

```bash
npm run deploy
```
