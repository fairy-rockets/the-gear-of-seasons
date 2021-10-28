FROM node:16-alpine

VOLUME /app/storage
WORKDIR /app
COPY . .

RUN  apk add --no-cache bash ffmpeg tzdata \
  && cp /usr/share/zoneinfo/Asia/Tokyo /etc/localtime \
  && apk del --purge tzdata

RUN npm install -g npm@latest \
 && (cd lib && npm ci && npm run build) \
 && (cd client && npm ci && npm run build) \
 && (cd server && npm ci && npm run build)

EXPOSE 8888

ENTRYPOINT [ "node" ]
CMD [ "server/dist/main.js" ]
