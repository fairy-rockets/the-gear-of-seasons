FROM node:18-alpine

VOLUME /app/storage
WORKDIR /app
COPY . .

RUN  apk add --no-cache bash ffmpeg imagemagick tzdata \
  && cp /usr/share/zoneinfo/Asia/Tokyo /etc/localtime \
  && apk del --purge tzdata

RUN npm install -g npm@latest \
 && (cd client && npm ci && npm run build) \
 && (cd server && npm ci && npm run build)

EXPOSE 8888

ENTRYPOINT [ "node" ]
CMD [ "server/dist/cmd/main.js" ]
