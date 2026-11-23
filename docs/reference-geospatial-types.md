# 地理空間データ型と空間検索

## 1. 対象
位置、経路、ポリゴンと、それを距離や交差で検索する処理を扱う。形式（GeoJSON / WKT / WKB）、座標参照系（CRS / SRID）、データ型、索引は別の概念である。

## 2. 型と座標系
PostGIS の geometry は平面上の計算で、ST_DWithin の距離は CRS の単位を使う。経緯度の geometry では度であり、メートルではない。geography は地理座標で地球上の距離を扱い、ST_DWithin の距離はメートル、既定は楕円体計算。geometry 同士の比較には同じ SRID が必要。ST_SetSRID は識別子の設定、ST_Transform は座標変換であり混同しない。Geography の対応関数や性能は geometry と異なる。

## 3. 検索の仕組み
GiST の空間インデックスは外接矩形によって候補を絞り、正確な述語を別途評価する。候補の矩形の重なりだけでは形状の交差を保証しない。ST_DWithin は適用可能なインデックスを使う比較を含むが、実際のプランはデータと統計に依存する。

## 4. 実装例：PostGIS
Linux ホスト上の PostgreSQL と PostGIS に地点を geography として格納し、GiST インデックスと ST_DWithin で半径内を探す。クライアント、DB プロセスとディスクは利用者が運用する代表構成であり、稼働検証済みの導入事例ではない。

| 役割 | 実装 |
|---|---|
| 入力 | SQL クライアント |
| 型と距離 | geography / ST_DWithin |
| 候補 | GiST インデックス |
| 結果 | SQL 結果 |

## 5. 参考資料

- [PostGIS Geometry or Geography](https://postgis.net/documentation/faq/geometry-or-geography/)
- [PostGIS ST_DWithin](https://postgis.net/docs/ST_DWithin.html)
- [PostGIS Spatial Indexing](https://postgis.net/workshops/postgis-intro/indexing.html)
