# Fivetran の基本アーキテクチャ

## 1. Source・Connection・Destination
Fivetran では Source を接続し、Destination を選び、Connection を保存してデータパイプラインを作る。図では基幹 DB の受注テーブルを Connector が読み、クラウドデータウェアハウスへロードする。

出典 [Get Started with Fivetran](https://fivetran.com/docs/getting-started/quickstart)

## 2. Initial sync
最初の履歴同期は Initial sync と呼ばれ、選択したテーブルの履歴を抽出・処理し、Destination へロードする。Source と Destination を Save & Test した後に開始する。

出典 [Get Started with Fivetran](https://fivetran.com/docs/getting-started/quickstart)・[Sync Overview](https://fivetran.com/docs/core-concepts/syncoverview)

## 3. Incremental sync と cursor
Initial sync が成功した後は Incremental sync になり、追加・変更データだけを定期的に抽出・処理・ロードする。同期の進捗を cursor で記録し、増分取得できないテーブルは再インポートになることがある。

出典 [Sync Overview](https://fivetran.com/docs/core-concepts/syncoverview)・[Glossary](https://fivetran.com/docs/getting-started/glossary)

## 4. Destination へのロード
Connector は処理したデータを Destination にロードする。Destination はクラウドデータウェアハウス、データベース、オンラインデータプラットフォームなどを選べる。

出典 [Get Started with Fivetran](https://fivetran.com/docs/getting-started/quickstart)・[Supported Destinations](https://fivetran.com/docs/destinations)

## 5. 変換と失敗時の扱い
変換はロード後に Destination 上で実行できる。同期失敗時は Destination に追加・更新を行わず、接続状態やエラーを確認して復旧する。整合性修復の再同期は通常の増分同期とは区別する。

出典 [Get Started with Fivetran](https://fivetran.com/docs/getting-started/quickstart)・[FAQ](https://fivetran.com/docs/getting-started/faq)・[Glossary](https://fivetran.com/docs/getting-started/glossary)
