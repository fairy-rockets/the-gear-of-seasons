
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
