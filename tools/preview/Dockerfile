# 見た目の確認用ブラウザ。
#
# **alpine ではだめ。** alpine の chromium は SwANGLE の Vulkan 初期化に失敗して
# (eglInitialize SwANGLE failed) WebGL コンテキストが取れず、歯車もモーメントも
# 描かれない画像が撮れてしまう。mesa-vulkan-swrast / vulkan-loader を足しても直らない。
# debian の chromium なら swiftshader で WebGL2 が動く。
#
# nodejs と puppeteer-core は、リサイズやドラッグを伴うシナリオ(drive.mjs)のためだけに
# 入れている。単に一枚撮るだけなら chromium の --screenshot で足りる。
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-noto-cjk \
      ca-certificates \
      nodejs \
      npm \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /shot
RUN npm i puppeteer-core@23
