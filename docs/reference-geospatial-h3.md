# H3 地理空間インデックス

## 1. 対象
H3 は球面を階層的なセルで表す離散グリッドシステム。セルには六角形だけでなく、各解像度に 12 個の五角形がある。H3Index はセルや有向辺などを表す 64 ビット整数で、セル ID は DB の GiST などの検索索引そのものとは別物。

## 2. 点と集計
緯度経度と解像度からセルを求め、同じ解像度のセル ID で地点を集計・結合する。解像度により粒度、セル数、境界誤差が変わる。緯度経度の引数順序や CRS は API ごとに確認する。セルが同じでも距離や包含が厳密に一致するわけではない。

## 3. 階層と境界
親子関係は論理インデックスとして正確だが、異なる解像度のセルの地理的な包含は近似である。近傍や polygonToCells は検索目的に応じて使い、ポリゴン境界・穴・セル中心基準などによる取りこぼしに注意する。厳密な判定が必要なら元の座標と空間述語で確認する。

## 4. 実装例：Python と H3
利用者の Linux ホストで Python の H3 バインディングを使って GPS ファイルを読み、セル ID と属性を記録し、セル別に件数を集計して出力する。ライブラリはアプリ内で実行され、独立したサーバーではない。バージョン・API と入力座標は実行環境で確認する。

| 役割 | 実装 |
|---|---|
| 入力 | GPS ファイル |
| 変換 | Python の H3 ライブラリ |
| 集計・出力 | Python と出力ファイル |

## 5. 参考資料

- [H3 overview](https://h3geo.org/docs/core-library/overview/)
- [H3 indexing](https://h3geo.org/docs/highlights/indexing/)
- [H3 region functions](https://h3geo.org/docs/api/regions/)
- [H3 terminology](https://h3geo.org/docs/library/terminology/)
- [h3-py documentation](https://uber.github.io/h3-py/)
