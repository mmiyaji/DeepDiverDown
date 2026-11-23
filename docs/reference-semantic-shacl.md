# SHACL による RDF データ検証

## 1. 対象
業務上必要な形状や制約を定義し、RDF データに対して評価し、違反を修正・再検証する構成。

## 2. 機能配置と処理
設計者は SHACL の shapes graph に対象ノードとプロパティの制約を記述する。例えば注文に顧客が 1 件以上必要であるという条件を定義できる。検証器が shapes graph と data graph を入力として検証し、適合の有無と違反箇所を validation report として出力する。担当者が結果を確認し、データか制約を修正して再検証する。

## 3. 設計上の注意
SHACL はデータを与えた形状に照らして検証する。OWL の推論や、存在しない情報をオープンワールドで扱う意味論とは目的が異なる。データが外部参照を含む場合、検証対象グラフの範囲と推論済み事実を含めるかを明示する。検証結果は入力が完全であることや業務上正しいことを保証しない。報告とデータの公開権限にも注意する。

## 4. 実装例：Apache Jena SHACL
Apache Jena の `shacl validate` に、Turtle 形式の SHACL 形状と RDF データを渡して検証する。コマンドラインによる一例であり、Fuseki の専用操作も別途設定できるが、この図ではサーバーの自動起動や公開を仮定しない。

| 機能 | 担い手 |
|---|---|
| 制約定義 | SHACL shapes の Turtle ファイル |
| 検証対象 | RDF の Turtle ファイル |
| 検証と報告 | Jena SHACL コマンドと validation report |
| 対応 | データ管理担当者 |

[W3C SHACL](https://www.w3.org/TR/shacl/)、[Apache Jena SHACL](https://jena.apache.org/documentation/shacl/)。
