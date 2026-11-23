# PostGIS：空間索引と厳密な判定

## 1. 対象と入力

PostGIS の geometry は平面計算、geography は地理座標を使う。ST_DWithin の geometry は SRID の単位で距離を指定し、geography はメートルで、既定では楕円体を使う。ST_SetSRID と ST_Transform は異なる。

## 2. 保存と読み出し

GiST 空間インデックスは対象形状の外接矩形を用いて候補を絞る。矩形が重なっても実際の形状が交差するとは限らない。ST_Intersects や ST_DWithin のようなインデックス対応の述語では候補について元の形状を確認する。

## 3. 制約と運用

実際のプランは索引の有無、統計と選択率に依存する。ST_DWithin はインデックスを利用できる比較を含むが、常に索引スキャンが選ばれるわけではない。境界、極付近、日付変更線、無効な形状や SRID の違いも検証する。

## 4. 実装例

利用者が PostgreSQL / PostGIS と GiST インデックスを Linux 上で運用し、SQL の ST_DWithin で候補抽出と距離判定を行う。 この図は公開資料に基づく代表的な構成であり、特定環境での実行や耐障害性を検証した導入事例ではない。設定とバージョンにより挙動は変わる。

| 役割 | 担い手 |
|---|---|
| 実行・処理 | Linux 上の PostgreSQL と PostGIS GiST |
| データと設定 | 利用者が管理する保存先と設定 |

## 5. 参考資料

- [PostGIS Spatial Indexing](https://postgis.net/workshops/postgis-intro/indexing.html)
- [PostGIS ST_DWithin](https://postgis.net/docs/ST_DWithin.html)
- [Geometry or Geography](https://postgis.net/documentation/faq/geometry-or-geography/)
