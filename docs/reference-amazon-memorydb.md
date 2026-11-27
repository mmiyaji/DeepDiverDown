# Amazon MemoryDB の基本アーキテクチャ

## 1. 概要

Amazon MemoryDB は、Valkey と Redis OSS に互換のある、耐久性を持つインメモリデータベースである。データはすべてメモリに置き、読み取りはマイクロ秒、書き込みは 1 桁ミリ秒のレイテンシーとされる。書き込みは複数 AZ のトランザクションログにも保存するため、キャッシュを別に用意せず主データベースとして使える。2026 年 11 月時点で確認できた公式資料に基づく。

[What is MemoryDB](https://docs.aws.amazon.com/memorydb/latest/devguide/what-is-memorydb.html)

## 2. クラスター・シャード・ノード

データセットはシャードに分割する。各シャードはプライマリ 1 台と、任意で最大 5 台のレプリカを持つ。プライマリは読み書きを受け、レプリカは読み取りだけを受ける。プライマリが落ちるとレプリカの 1 台が昇格する。ノードは EC2 インスタンス上で動き、クラスター内のノードタイプは共通である。クラスターは最大 500 シャード、最大 500 ノードで、レプリカを 1 台ずつ付けた構成で 100 TB 超とされる。クラスターは VPC 内で動き、サブネットグループでノードの置き先サブネットを指定する。

[MemoryDB core components](https://docs.aws.amazon.com/memorydb/latest/devguide/components.html)

## 3. マルチ AZ のトランザクションログ

プライマリは書き込みを分散したマルチ AZ のトランザクションログへ永続化してから、クライアントに成功を返す。この仕組みで、再起動、フェイルオーバー、障害後の復旧でデータを失わずに戻せる。ログ基盤の内部構成（ノード数、ストレージ種別など）は公式資料に記載がなく未確認。

[MemoryDB features](https://docs.aws.amazon.com/memorydb/latest/devguide/servicename-feature-overview.html)

## 4. 一貫性とレプリカ

プライマリは強い一貫性を持ち、読み取りは成功済みの書き込みをすべて反映する。この性質はフェイルオーバー後も保たれる。レプリカは結果整合で、`READONLY` コマンドで読むと直近の書き込みが見えないことがある。遅延は CloudWatch のメトリクスで見る。1 台のレプリカからの読み取りは逐次一貫で、書き込みはプライマリと同じ順序で適用される。

[Consistency](https://docs.aws.amazon.com/memorydb/latest/devguide/consistency.html)

## 5. ElastiCache との違い

| 観点 | MemoryDB | ElastiCache |
| --- | --- | --- |
| 位置づけ | 耐久性のある主データベース | 既存のデータストアの前に置くキャッシュ |
| 書き込み性能（公式の記載） | 1 桁ミリ秒 | マイクロ秒 |
| 耐久性の根拠 | マルチ AZ のトランザクションログ | 本資料の範囲では未確認 |

ElastiCache の耐久性の仕組み（スナップショットやレプリカ昇格の扱い）は、今回取得した MemoryDB 側の比較ページに記載がなく未確認。

[Related services](https://docs.aws.amazon.com/memorydb/latest/devguide/related-services-choose-between-memorydb-and-redis.html)

## 6. 認証・スナップショット・提供状況

認証は ACL とユーザーで行い、ACL は Valkey の ACL ルールに従う。通信は TLS、保存データは AWS KMS のキーで暗号化できる。自動スナップショットは S3 に保存し、保持は最長 35 日である。

エンジンは Valkey と Redis OSS で、公式資料に挙がる版は 6.2、7.0、7.1（ベクトル検索）、Valkey 7.2.6、7.3（Multi-Region 対応）である。7.3 より新しい版の有無は未確認。Redis OSS から Valkey へのアップグレードは可能で、ダウングレードはできない。

リージョンは公式の一覧に米国、カナダ、アジア太平洋、欧州、南米、中国の 21 リージョンが載る（2026 年 11 月に確認した資料時点）。GovCloud など一覧にない領域の提供は未確認。Multi-Region クラスターは 7.3 以降で、対応リージョンは米国 4、欧州 3、アジア太平洋 5 とされる。

[Engine versions](https://docs.aws.amazon.com/memorydb/latest/devguide/engine-versions.html)
[Regions and AZs](https://docs.aws.amazon.com/memorydb/latest/devguide/regionsandazs.html)

## 7. 実装例：AWS 上の MemoryDB クラスター

| 機能 | 具体的な担い手 |
| --- | --- |
| クライアント | VPC 内のアプリ（Valkey / Redis OSS クライアント） |
| 認証 | MemoryDB の ACL とユーザー |
| シャード（書き込み） | 各シャードのプライマリノード |
| レプリカ（読み取り） | 同じシャードのレプリカノード（別 AZ） |
| 耐久性 | マルチ AZ のトランザクションログ（AWS が運用） |
| バックアップ | S3 に保存する自動スナップショット |

運用分担は、ノードの OS・エンジンのパッチと障害検知・復旧を AWS が担い、ノードタイプ、シャード数、レプリカ数、ACL、パラメーターを利用者が決める。ログ基盤は利用者が直接操作できない。代表的な構成であり、導入事例ではない。ノードの AZ 配置の細かい規則と、ログの内部は未確認。
