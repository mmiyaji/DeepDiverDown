# dbt の ELT アーキテクチャ

## 1. 範囲
ロード済みの注文データを SQL モデルで staging から mart へ変換し、依存関係と品質テストを実行する流れを示す。

出典 [What is dbt?](https://docs.getdbt.com/docs/introduction)

## 2. 入力とモデル
dbt はウェアハウス内の raw データに対する SQL select を再利用可能なモデルとして管理し、依存関係を DAG として扱う。

## 3. 実行
コンパイルした SQL を対象データプラットフォームで実行し、staging から mart のテーブルやビューを作る。

## 4. テストと文脈
テスト、lineage、契約、メトリクスなどの構造化された文脈が変更影響と品質確認を支える。

出典 [What is dbt?](https://docs.getdbt.com/docs/introduction)

## 5. シナリオ
図は Raw table、dbt project、Model DAG、Warehouse compute、Staging、Mart、Tests の7ノードで、run と test を分けて追う。実行時間やウェアハウス名は未確定とする。

## 6. 参考資料
- [What is dbt?](https://docs.getdbt.com/docs/introduction)
- [Build dbt projects](https://docs.getdbt.com/docs/build/projects)
