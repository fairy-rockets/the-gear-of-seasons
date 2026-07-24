FROM node:22-alpine

VOLUME /app/storage
WORKDIR /app

RUN  apk add --no-cache bash ffmpeg imagemagick tzdata \
  && cp /usr/share/zoneinfo/Asia/Tokyo /etc/localtime \
  && apk del --purge tzdata

COPY . .

RUN npm install -g npm@latest \
 && (cd client && npm ci && npm run build) \
 && (cd server && npm ci && npm run build)

EXPOSE 3000

ENTRYPOINT [ "node" ]
CMD [ "server/dist/cmd/main.js" ]
