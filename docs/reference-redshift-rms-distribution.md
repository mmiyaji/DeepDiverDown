# Amazon Redshift：分散キー・ソートキーとマネージドストレージ

## 1. 範囲
テーブル定義の分散スタイルが行の置き場所を決める仕組みと、書き込んだデータが Redshift Managed Storage（RMS）に永続化され、ローカル SSD に読み出しキャッシュされる関係を扱う。2026 年 11 月時点の公式資料に基づく。

## 2. 分散スタイル
テーブル作成時に AUTO、EVEN、KEY、ALL のいずれかを指定する。省略すると AUTO になる。

- AUTO：サイズに応じて分散スタイルを選ぶ。小さい表は ALL から始まり、大きくなると KEY、さらに EVEN へ変わることがある。変更はバックグラウンドで行われる。
- EVEN：リーダーが行をスライスへラウンドロビンで配る。列の値は見ない。
- KEY：1 列の値で配る。結合キーで分散した 2 つの表は、一致する値が同じスライスに置かれる。
- ALL：全ノードに表全体の写しを置く。ストレージが台数倍になり、更新が重い。更新の少ない表向き。

Redshift にはパーティション定義の概念がなく、分散はクラスター単位で扱われる。

出典 [Distribution styles](https://docs.aws.amazon.com/redshift/latest/dg/c_choosing_dist_sort.html)

## 3. 振り分けとスライス
リーダーノードが SQL を受けて計画を作り、コンピュートノード内のスライスが行を分担する。結合キーが分散キーと一致しない場合の再分散量は、この図の範囲では未検証。

出典 [Data warehouse system architecture](https://docs.aws.amazon.com/redshift/latest/dg/c_high_level_system_architecture.html)

## 4. RMS とローカルキャッシュ
データは計算ノードから分離した RMS に永続化される。RMS は Amazon S3 を使って容量を拡張し、ローカル SSD は高性能なキャッシュとして自動利用される。ソートキーの種類、ブロックの大きさ、ゾーンマップによる読み飛ばしは、今回取得した資料では確認していない（未確認）。

出典 [Data warehouse system architecture](https://docs.aws.amazon.com/redshift/latest/dg/c_high_level_system_architecture.html)

## 5. 実装例 RA3 クラスターの KEY 分散テーブルと RMS

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| ロード・クエリの要求 | SQL クライアント | COPY・INSERT・SELECT を送る |
| テーブル定義 | CREATE TABLE | DISTSTYLE・DISTKEY・SORTKEY |
| リーダー・スライス・ブロック | RA3 のリーダーノードとコンピュートノード | 行の振り分けと並列処理 |
| キャッシュ | RA3 ノードのローカル SSD | 自動管理 |
| 永続化 | Redshift Managed Storage | 利用者の S3 バケットとは別 |
| 自動最適化 | 自動テーブル最適化 | AUTO のテーブルのみ |

AWS がノードと RMS の基盤を運用し、利用者はテーブル設計、データ、権限を管理する。公式資料を組み合わせた代表構成であり、性能は未検証。

出典 [Distribution styles](https://docs.aws.amazon.com/redshift/latest/dg/c_choosing_dist_sort.html)、[Data warehouse system architecture](https://docs.aws.amazon.com/redshift/latest/dg/c_high_level_system_architecture.html)、[Amazon Redshift provisioned clusters overview](https://docs.aws.amazon.com/redshift/latest/mgmt/overview.html)
