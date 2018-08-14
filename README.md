
# How to build

## Prerequirements

#### ServerSide

```bash
echo 'for logging'
go get -u "github.com/Sirupsen/logrus"
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
