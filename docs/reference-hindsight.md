# Hindsight のエージェント記憶

## 1. 対象

retain・recall・reflect を使い、エージェントの記憶を保持し検索する。

## 2. 機能配置と処理

エージェントが retain で記憶を渡し、事実の抽出と記憶の保存を行う。recall は関連する記憶を検索し、reflect は記憶に基づき回答を組み立てる。

## 3. 設計上の注意

抽出の誤り、アクセス範囲、個人情報、削除、保存量やモデル利用コストに注意する。reflect と recall は異なる処理である。

## 4. 実装例

自己ホストした Hindsight API と外部 PostgreSQL、設定したモデルを組み合わせる例。Enterprise 専用の Memlake や Cloud 機能は前提にしない。

| 機能 | 担い手 |
|---|---|
| エージェント | 利用するエージェント |
| 記憶の取り込み | Hindsight retain |
| 記憶の保存 | PostgreSQL 記憶データ |
| 記憶の検索 | Hindsight recall |
| 記憶を基にした回答 | Hindsight reflect |
| 抽出・回答用モデル | 設定された LLM |

この例では Hindsight API と PostgreSQL を利用者が管理する別ホストに配置する。利用者がデータ、バックアップ、設定とモデル接続を管理する。モデル提供先は未選定で、資料を組み合わせた未検証の例である。

[Hindsight](https://github.com/vectorize-io/hindsight)、[Recall and reflect](https://hindsight.vectorize.io/blog/2026/07/24/recall-vs-reflect)。

## 5. 実装例：AWS の EKS・Hindsight・RDS for PostgreSQL

Hindsight の OSS Helm チャートを Amazon EKS に適用し、マネージドノードグループの EC2 上で API を稼働させる。チャート内の PostgreSQL を無効にし、外部 DB として pgvector を有効にした RDS for PostgreSQL を指定する。この例は同期 API を使い、専用の Worker Pod は追加しない。

| 機能配置 | 実装での担い手 |
|---|---|
| エージェント | Hindsight SDK から API を使う外部アプリ |
| 取り込み・検索・回答 | Hindsight API の retain・recall・reflect |
| 記憶と索引の永続化 | RDS for PostgreSQL 15 以降と pgvector 0.5.0 以降 |
| 抽出と回答のモデル | 外部の OpenAI API |
| 埋め込みと再ランキング | Hindsight フルイメージに対応する API プロセス内のモデル |

EKS 制御プレーンは AWS 管理 VPC にあり、利用者は Kubernetes API と公開設定を操作できるがサーバーへ直接アクセスしない。AWS は RDS 基盤を運用し、利用者は DB のデータ・アクセス・設定を管理する。OpenAI API は AWS アカウント外である。複数の公式資料を組み合わせた未検証の例で、Hindsight、モデル、RDS 拡張と Helm の対応版、接続と復旧を導入時に検証する。

RDS のエンジン版で対応する `vector` 拡張を確認し、Hindsight 用 DB で有効にする。AWS は Kubernetes と DB 基盤を管理し、Hindsight の設定、モデルへの接続、アプリの更新と復旧手順は運用者が管理する。この構成で使う Hindsight の自己ホスト版は MIT ライセンス。

- [EKS Control Plane](https://docs.aws.amazon.com/eks/latest/best-practices/control-plane.html)
- [Hindsight installation](https://hindsight.vectorize.io/developer/installation)
- [Hindsight storage requirements](https://github.com/vectorize-io/hindsight/blob/main/hindsight-docs/docs/developer/storage.md)
- [Hindsight models](https://hindsight.vectorize.io/developer/models)
- [Hindsight self-hosted licensing](https://hindsight.vectorize.io/cloud-enterprise/overview)
- [RDS for PostgreSQL extension versions](https://docs.aws.amazon.com/AmazonRDS/latest/PostgreSQLReleaseNotes/postgresql-extensions.html)
- [EKS managed node groups](https://docs.aws.amazon.com/eks/latest/userguide/managed-node-groups.html)
