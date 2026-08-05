// カメラの定数。World と Gear の両方が使うが、World と Gear は互いに import し合って
// いるため、ここに置かないと循環 import になる(Gear のモジュール初期化時に World 側の
// 定数がまだ未初期化で、トップレベルの計算が NaN になる)。

// 縦方向の画角。mat4.perspective はラジアンを取るので、この 45 は 45rad ≡ 約58度として
// 効いている。歴史的な値で、度に直すと歯車の見た目が一回り大きくなってしまうのでこのまま使う。
export const FovY = 45;

// 奥行き dist における画面の半分の高さ = TanHalfFovY * dist。
export const TanHalfFovY = Math.tan(FovY / 2);

// 視点の位置(z)。World.start() の lookAt と揃えること。
export const EyeZ = 3;
