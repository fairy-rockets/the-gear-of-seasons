# the gear of seasons (季節の歯車)

[Here is a running gear!](https://hexe.net/)

## Pre-requirements

- node.js 22 or higher
- ffmpeg
- ImageMagick 7.0 or higher

## How to build

The server and the client are separate npm packages, each built on its own:

```sh
(cd server && npm ci && npm run build)
(cd client && npm ci && npm run build)
```

## How to test

```sh
(cd server && npm test)
```
