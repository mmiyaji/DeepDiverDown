# Databricks：JOIN からの Dynamic File Pruning

## 1. 対象と前提

JOIN の実行中に得たキーを使い、Delta ファイル統計で読み取り候補を絞る。 公式資料を組み合わせた説明用のモデルで、実機の配置や導入事例ではない。

## 2. 構成と役割

- **JOIN 問い合わせ**：小さい側を絞り込んで大きな Delta テーブルと結合する。
- **小さい側の絞り込み**：条件に合うキーを実行時に得る。
- **実行時のキー**：小さい側の結果から大きい側の走査に使うキーの情報を渡す。
- **ファイルの統計**：Delta ログのファイル統計で条件に合う可能性を判定する。
- **ファイルの選択**：実行時のキーとファイル統計から一致しないファイルを読み飛ばす。
- **大きい側のファイル**：対象となる Delta の Parquet データファイル。
- **結合と結果**：候補に残ったファイルを読み、小さい側と結合する。

## 3. 処理の流れ

1. 小さい入力をフィルターし、実際に使われる JOIN キーを得る。
2. 大きい側のファイル統計と照合し、無関係なファイルを除外する。
3. 候補ファイルだけを読み、小さい側と JOIN する。

小さい側のフィルター結果は実行前には分からないため、実行時の JOIN キーを大きい側のファイル選択に渡す。Delta ログのファイル単位の統計と照合し、候補外のファイルを読み飛ばす。データ配置により同じキーが多くのファイルに散らばる場合、読み飛ばせる割合は小さくなる。

## 4. 留意点

Delta テーブルとクエリ形状、対象サイズ・ファイル数などが適用条件となる。MERGE / UPDATE / DELETE における DFP は Photon が必要で、SELECT では Photon が適用範囲を広げる。キー値が全ファイルに広がる場合は効果が小さく、Liquid Clustering の配置が影響する。

## 5. 実装例

AWS 上の Databricks SQL Warehouse が顧客 S3 の Unity Catalog 管理 Delta テーブルに SELECT の JOIN を実行し、適用条件を満たしたときに実行時キーを使ってファイルを読み飛ばす概念例。Photon と対象表の適用条件を確認する。

| 機能 | 担い手 |
| --- | --- |
| JOIN 問い合わせ | JOIN を含む SQL |
| 小さい側の絞り込み | Photon / Spark のフィルター |
| 実行時のキー | JOIN のキー情報 |
| ファイルの統計 | Delta ログのファイル統計 |
| ファイルの選択 | Dynamic File Pruning |
| 大きい側のファイル | S3 の Delta ファイル |
| 結合と結果 | Photon / Spark の JOIN |

## 公式資料

- [Dynamic file pruning](https://docs.databricks.com/aws/en/optimizations/dynamic-file-pruning)
- [Dynamic File Pruning の技術ブログ](https://www.databricks.com/blog/2020/04/30/faster-sql-queries-on-delta-lake-with-dynamic-file-pruning.html)
- [Photon](https://docs.databricks.com/aws/en/compute/photon)
- [管理ストレージ](https://docs.databricks.com/aws/en/connect/unity-catalog/cloud-storage/managed-storage)
