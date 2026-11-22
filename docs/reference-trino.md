# Trino の分散クエリアーキテクチャ

## 1. Coordinator と Worker

Coordinator が SQL を解析して分散クエリ計画を作る。計画は Stage に分かれ、Worker 上の Task がそれぞれの Stage の処理を実行する。図はスキャンと集約の役割を分けて示す。

## 2. カタログと Connector

Trino のカタログは Connector と接続情報をまとめた設定である。Iceberg Connector は Iceberg のカタログやテーブルメタデータを参照し、Coordinator は処理対象の Split を Task に割り当てる。

## 3. 並列読み取りから結果へ

Worker は Connector を介して対象ファイルを読み、部分集計を作る。Exchange で中間データを次の Stage に渡し、Coordinator が実行結果を取得してクライアントに返す。

## 公式資料

- [Trino · Concepts](https://trino.io/docs/current/overview/concepts.html)
- [Trino · Iceberg connector](https://trino.io/docs/current/connector/iceberg.html)
