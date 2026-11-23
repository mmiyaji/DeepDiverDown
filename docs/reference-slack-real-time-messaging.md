# Slack のリアルタイムメッセージング（2023 年公開記事）

## 1. 対象と範囲
Slack Engineering が 2023 年 4 月 11 日に公開した [Real-time Messaging](https://slack.engineering/real-time-messaging/) に記載された、オンラインのクライアントへメッセージやイベントを配信する構成。記事の公開時点の説明であり、現在の Slack の内部構成を保証するものではない。データベースの製品、永続化の詳細、配送保証や正確な再送方式は記事から特定しない。

## 2. 構成部品と接続
- **クライアント**は起動時に Webapp からトークンと接続情報を取得し、近いリージョンに WebSocket を確立する。
- **Envoy** はエッジで TLS を終端し、Gateway Server へ転送する。記事ではロードバランサーにも使う。
- **Gateway Server（GS）** はステートフルなインメモリのサービスで、接続中の利用者とチャネル購読情報を持つ。複数リージョンに配置される。障害リージョンから健全な近接リージョンへ接続を移す仕組みがある。
- **Webapp** はクライアント API を提供する Hacklang のバックエンド。Gateway は利用者情報と所属チャネルを取得する。
- **Admin Server（AS）** はステートレスな Webapp と Channel Server 間の中継役。チャネル ID と一貫性ハッシュから適切な Channel Server を特定する。
- **Channel Server（CS）** はステートフルなインメモリのサービスで、担当チャネルの履歴の一部を保持し、そのチャネルを購読する Gateway に配信する。ここでいうチャネルは通常の Slack チャネルのほか、ユーザー等を表す抽象的な ID も含む。
- **CHARM と Consul** は Channel Server の一貫性ハッシュリング管理とサービス発見を担う。記事では CS が Consul に登録され、AS と CS が設定を発見する。
- **Presence Server** はオンライン状態をインメモリで管理する。クライアントは Gateway 経由で照会し、表示中の一部の利用者について状態変化の通知を受ける。

## 3. 通常のメッセージと一時イベント
通常のチャットメッセージは、クライアントが **Webapp API → Admin Server → 対象 Channel Server** に送り、Channel Server から購読済みの各リージョンの Gateway を経て、接続中の受信クライアントへ配信される。Gateway は接続初期化時に所属チャネルを取得し、対応する Channel Server を非同期に購読する。チャネルがマッピングされるサーバーは一貫性ハッシュリングで決まる。

入力中表示などの一時イベントはデータベースに永続化されず、クライアントが **WebSocket → Gateway → Channel Server** と送り、購読済み Gateway を経て配信される。通常の投稿と同じ経路に混同しない。リアクションなどの状態変更イベントは、記事では通常メッセージと同様の経路と説明される。

## 4. 設計上の見どころと未確認事項
一貫性ハッシュによる分散、接続先リージョンの分離、チャネル単位の購読とファンアウト、可視範囲に絞ったプレゼンス通知、ステートフルなコンポーネントの置換が主な論点。実際のサーバーの台数、チャネルごとの購読数、WebSocket 再接続後の同期、欠落・重複・順序の保証、記事にない永続化フローは推測しない。記事の性能値は当時の報告であり SLA や現在の性能保証ではない。

## 5. 実装例：記事に示された Slack の構成
機能配置を、記事にある Slack Client、Envoy、Webapp、Admin Server、Channel Server、Gateway Server、Presence Server、CHARM、Consul に対応付けた。リージョン A と B は複数リージョンへの配信を示す説明用の記号で、特定の国や実際のリージョン数を表さない。図の「Slack サービス」枠は記事の機能上の範囲であり、特定のクラウド事業者やアカウント境界を主張しない。

| 機能 | 記事にある担い手 |
|---|---|
| API・初期情報 | Slack Webapp |
| 接続の終端と購読 | Envoy と各リージョンの Gateway Server |
| 通常投稿の振り分け | Admin Server と一貫性ハッシュリング |
| チャネル配信 | Channel Server と購読中の Gateway Server |
| 配置・サービス発見 | CHARM と Consul |
| オンライン状態 | Presence Server と Gateway |

[Slack Engineering: Real-time Messaging](https://slack.engineering/real-time-messaging/)、[Envoy overview](https://www.envoyproxy.io/docs/envoy/latest/intro/what_is_envoy)、[Consul service discovery](https://developer.hashicorp.com/consul/docs/discover)。

2D・3D の領域は公開記事に基づく論理配置であり、サーバーの実ホスト、クラウド、ネットワークの包含関係や現在の構成を表さない。Gateway 以外のサーバーを複数地域に置くことも推定していない。
