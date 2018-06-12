
# How to build

## Prerequirements

#### ServerSide

```bash
# for logging
go get -u "github.com/Sirupsen/logrus"
go get -u "github.com/fatih/color"

# networking
go get -u "golang.org/x/net/context"
go get -u "github.com/julienschmidt/httprouter"

# data serialization
go get -u "gopkg.in/yaml.v2"

# imaging
go get -u "github.com/rwcarlsen/goexif"
go get -u "github.com/disintegration/imaging"
go get -u "github.com/nfnt/resize"
go get -u "github.com/oliamb/cutter"
go get -u "github.com/nfnt/resize"
```

### ClientSide

```bash
npm install

# to upgrade,

npm run update # update package.json
npm update # update package-lock.json
```

## Iterative and incremental development

```bash
npm run watch
open http://localhost:8080/
```

## Build

```bash
npm run build
```

## Deploy

```bash
npm run deploy
```
