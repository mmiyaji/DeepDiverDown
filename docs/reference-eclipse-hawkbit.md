# Eclipse hawkBit の端末更新

## 1. 対象

Eclipse hawkBit によるデバイス向けソフトウェア更新の配布を整理する。

## 2. 機能配置と処理

運用者が更新成果物とロールアウトを管理する。端末の updater は DDI API をポーリングし、対象の成果物を取得してインストールし、結果を報告する。

## 3. 設計と利用上の注意

端末側 updater、署名検証、適用・ロールバックの実装やポリシーは別途必要。hawkBit の導入だけで車載 OTA の安全認証を意味しない。

## 4. 実装例：hawkBit と端末 updater

hawkBit DDI と端末側 updater の組み合わせ。検証とインストールの具体的な実装は利用者が用意する。

| 機能 | 担い手 |
|---|---|
| 更新運用者 | 更新運用者 |
| 更新配布管理 | Eclipse hawkBit |
| 端末の更新クライアント | 端末 updater |
| 端末ソフトウェア | 端末ソフトウェア |
| 更新成果物 | 更新アーティファクト |

この例は利用者が管理する更新サーバーと現場の端末を別々に置く。利用者がサーバー、updater、端末の適用処理、認証と更新物を管理する。公式資料を組み合わせた未検証例であり、具体的な updater、検証や回復方法は未選定である。

[Eclipse hawkBit](https://hawkbit.eclipse.dev/)、[Device integration API](https://hawkbit.eclipse.dev/concepts/device-integration/)。

## 5. 実装例：Linux の hawkBit Compose と SWUpdate 端末

公式の PostgreSQL 付き monolith / UI Compose を管理側の Linux ホストで動かす。必要な DB 初期化と `artifactrepo` のボリュームは公式構成に沿う。この例では PostgreSQL のデータディレクトリーにもホスト上の永続ボリュームを割り当て、端末向け DDI の前に HTTPS 終端を置く。Compose の RabbitMQ は DMF 用で、端末との本経路では DDI を使う。

| 機能配置 | 実装での担い手 |
|---|---|
| 配布管理 | hawkBit UI、Management API、Update Server |
| 配布物とメタデータ | `artifactrepo` の SWU ファイル、PostgreSQL の端末・配備状態 |
| 端末の更新クライアント | 組み込み Linux 上の SWUpdate / Suricatta |
| 更新適用と再起動 | SWUpdate が署名を検証し、待機側 rootfs に書く。端末ポリシーで再起動しブートローダーが起動先を選ぶ |

利用者が管理ホストの Docker Engine、hawkBit と依存サービス、ストレージ、端末の SWUpdate とブート設定を運用する。複数の公式資料を組み合わせた未検証の例で、バージョン互換性、認証、署名、A/B の起動確認と回復処理を導入時に検証する。

端末には DDI の TargetToken を個別に配布し、HTTPS のサーバー証明書検証と SWU の署名検証を設定する。運用者は管理ログインと端末トークンを管理する。更新後の再起動、起動確認、切り戻しは端末側の設計であり、エージェントが結果を DDI に通知する。回線断や電源断からの復旧は、端末側の再試行・ブート設定・ストレージの検証が必要になる。

- [hawkBit monolith with UI and PostgreSQL Compose](https://github.com/eclipse-hawkbit/hawkbit/blob/master/docker/postgres/docker-compose-monolith-with-ui-postgres.yml)
- [hawkBit monolith and artifact volume](https://github.com/eclipse-hawkbit/hawkbit/blob/master/docker/postgres/docker-compose-monolith-dbinit-postgres.yml)
- [hawkBit PostgreSQL and RabbitMQ dependencies](https://github.com/eclipse-hawkbit/hawkbit/blob/master/docker/postgres/docker-compose-deps-postgres.yml)
- [hawkBit DDI authentication](https://github.com/eclipse-hawkbit/hawkbit/wiki/Authentication)
- [SWUpdate Suricatta daemon](https://sbabic.github.io/swupdate/2024.12/suricatta.html)
- [SWUpdate signed images](https://sbabic.github.io/swupdate/signed_images.html)
- [SWUpdate boot and fallback](https://sbabic.github.io/swupdate/swupdate-best-practise.html)
