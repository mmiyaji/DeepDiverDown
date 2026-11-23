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

## 5. 実装例：AWS（CodeBuild で SHACL バッチ検証）

AWS CodeBuild の検証プロジェクトを開始すると、ビルド環境の `buildspec.yml` に従って S3 から指定したデータと shapes を取得し、固定したリリースの Jena の `shacl validate --shapes SHAPES.ttl --data DATA.ttl` を実行する。

| 機能 | 担い手 |
|---|---|
| 入力データと制約定義 | Amazon S3 上の Turtle |
| 検証処理 | CodeBuild のビルド環境で起動する Apache Jena SHACL CLI |
| 報告の保存 | Amazon S3 上のビルド成果物 |
| 確認と修正 | データ管理担当者 |

CodeBuild のサービスロールには対象オブジェクトの読み取りと成果物の書き込みを許可する。報告の `sh:conforms` と違反項目を確認する。検証結果で配布を制御する場合も、報告を先に保存し、ジョブの実行失敗とデータの非適合を区別する。

- [Apache Jena SHACL CLI](https://jena.apache.org/documentation/shacl/)
- [AWS CodeBuild buildspec](https://docs.aws.amazon.com/codebuild/latest/userguide/build-spec-ref.html)
- [AWS CodeBuild プロジェクト](https://docs.aws.amazon.com/codebuild/latest/userguide/create-project.html)

この構成は公式機能を組み合わせた例であり、実環境での設定、認証、接続と障害復旧は未検証。サービス提供者が基盤を運用し、利用者はデータ、権限とジョブ設定を管理する。内部ホストへの直接アクセスは前提としない。
