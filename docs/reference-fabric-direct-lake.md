# Microsoft Fabric：Direct Lake と Power BI

2026 年 11 月時点の公式資料に基づく。

## 1. Direct Lake とは

Direct Lake は Power BI セマンティックモデルのテーブル格納モードで、OneLake の Delta テーブルから列をメモリに読み込む。Import は全データの複製を作るが、Direct Lake の更新は参照するファイルを替えるメタデータの更新（フレーミング）だけで、数秒で終わる。

[Direct Lake overview](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-overview)

## 2. クエリの流れ

レポートの操作は DAX クエリになってセマンティックモデルへ届く。Direct Lake と Import のクエリは VertiPaq エンジンが処理する。DirectQuery は元のデータ源へクエリを渡す。

[Direct Lake overview](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-overview)

## 3. 列の読み込みとメモリ

クエリに必要な列だけをメモリに読み込む。そのためデータ量が容量のメモリ上限を超えるモデルでも動くが、ページングが増えると遅くなる。

[Direct Lake overview](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-overview)

## 4. フレーミングと二つのモード

フレーミングは最新の Delta ログを調べて、参照するファイルを更新する。自動更新を有効にすると Delta の変更に追従する。モードは二つある。Direct Lake on OneLake は複数の Fabric データ源の Delta テーブルを使え、DirectQuery にフォールバックしない。Direct Lake on SQL は一つのデータ源の SQL 分析エンドポイントでテーブルの検出と権限確認を行い、SQL ビューや SQL の行レベルセキュリティなどで DirectQuery にフォールバックする。ショートカットの ID の扱いは [OneLake とショートカット](reference-fabric-onelake-shortcuts.md) を参照する。

[Direct Lake overview](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-overview)

## 5. 容量のガードレール

Direct Lake は Fabric の容量（F SKU または P SKU）が必要である。SKU ごとに Parquet ファイル数、行グループ数、行数、モデルサイズの上限がある。F2〜F32 は 1 テーブルあたり 1,000 ファイルと 3 億行で、F64 以上は上限が上がる。超過時は、on OneLake では更新が失敗し、on SQL ではフォールバックが有効なら DirectQuery に切り替わる。Power BI Premium の P SKU は退役が進んでおり、新規は F SKU を使う方針である。

[Direct Lake overview](https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-overview)、[Fabric licenses and capacity](https://learn.microsoft.com/en-us/fabric/enterprise/licenses)

## 6. 実装例 Lakehouse の売上テーブルを Direct Lake で見る

| 機能 | 具体的な担い手 | 設定・成果物 |
|---|---|---|
| レポート | Power BI | セマンティックモデルへの接続 |
| モデル | Direct Lake セマンティックモデル | Delta テーブルを参照 |
| クエリ処理 | VertiPaq | メモリ上の列 |
| データ | OneLake の Lakehouse Tables | Delta Parquet |
| 更新 | フレーミング | 参照ファイルの更新 |
| 切り替え | DirectQuery フォールバック | on SQL のみ |
| 上限 | F SKU のガードレール | 容量の大きさで決まる |

公式資料を組み合わせた代表構成であり、動作検証済みの導入事例ではない。利用者はワークスペース、容量、モデル、権限、Delta テーブルの最適化を管理する。VertiPaq の内部ホストは操作できない。Direct Lake の一部機能は Preview で、GA の範囲は実環境の資料で確認する。
