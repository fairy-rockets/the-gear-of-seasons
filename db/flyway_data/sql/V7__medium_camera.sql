-- 注釈の medium の 'photo' を 'camera' と呼ぶ。入っている値もそのまま 'camera' になる。
ALTER TYPE "annotation_medium" RENAME VALUE 'photo' TO 'camera';
