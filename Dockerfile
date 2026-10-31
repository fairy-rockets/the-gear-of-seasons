# ツールだけの段。compose.dev.yml の app-dev はこの段でソースをバインドして動かす。
FROM node:26-alpine AS tools

WORKDIR /app

RUN  apk add --no-cache bash ffmpeg imagemagick imagemagick-heic libheif-libde265 tzdata \
  && cp /usr/share/zoneinfo/Asia/Tokyo /etc/localtime \
  && apk del --purge tzdata

# 本番用の段。target を指定しないビルドはこの段になる。
FROM tools

VOLUME /app/storage

COPY . .

RUN npm install -g npm@latest \
 && (cd client && npm ci && npm run build) \
 && (cd server && npm ci && npm run build)

EXPOSE 3000

ENTRYPOINT [ "node" ]
CMD [ "server/dist/cmd/main.js" ]
