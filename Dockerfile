FROM alpine:latest

RUN apk --no-cache add tzdata ffmpeg && \
    cp /usr/share/zoneinfo/Asia/Tokyo /etc/localtime
