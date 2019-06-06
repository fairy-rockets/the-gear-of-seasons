
# How to build

## Prerequirements

#### ServerSide

```bash
echo 'for logging'
go get -u "github.com/sirupsen/logrus"
go get -u "github.com/fatih/color"

echo 'networking'
go get -u "golang.org/x/net/context"
go get -u "github.com/julienschmidt/httprouter"

echo 'data serialization'
go get -u "gopkg.in/yaml.v2"

echo 'imaging'
go get -u "github.com/rwcarlsen/goexif"
go get -u "github.com/disintegration/imaging"
go get -u "github.com/nfnt/resize"
go get -u "github.com/oliamb/cutter"
go get -u "github.com/nfnt/resize"

echo 'video'
sudo apt get install ffmpeg
# mac OS:
#   brew install ffmpeg
# Fedora or CentOS:
#   sudo dnf install ffmpeg ffmpeg-devel
#   sudo yum install ffmpeg ffmpeg-devel

echo 'embedding markdown'
go get -u "gopkg.in/russross/blackfriday.v2"
echo 'workaround: https://github.com/russross/blackfriday/issues/491'
go mod edit -replace=gopkg.in/russross/blackfriday.v2@v2.0.1=github.com/russross/blackfriday/v2@v2.0.1
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
npm run watch
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
