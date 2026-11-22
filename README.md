# DeepDiverDown

設計書・IaC・コードを「根拠付きの構造化モデル」に落とし、3D 図解・動き・指摘・点検で
人間が設計上の問題点と「どこがまだ確かめられていないか」を把握しやすくする実験プロジェクト。

> [!IMPORTANT]
> **個人の学習用プロジェクトです。動作・正確性・継続的な保守を含め、いかなる保証もしません。**
> - 指摘・点検・確度判定の結果は参考情報であり、設計レビューや監査の代わりにはなりません。誤検出・見落としがあります
> - 収録しているモデル・設計書・IaC はすべて説明用のサンプルです（`online-boutique` 以外は架空。Terraform の state も架空）
> - 抽出 CLI は外部 API（Claude API）に設計書を送信します。機密情報を含む資料に使う場合は、各自の責任で利用規約・社内規程を確認してください
> - 予告なく仕様変更・公開停止することがあります。Issue / PR への対応も約束しません

## 現状（2026-11 時点）
| 項目 | 状態 |
|---|---|
| 3D ビューア（3 ビュー × 8 モード・検索・比較・共有・書き出し・設定・スマホ対応） | 動作確認済み |
| 解析（指摘 14 ルール・障害伝播・確度判定・網羅率・点検・索引・比較・ビュー変換） | 単体テスト 24 件 |
| 自動配置 | 動作するが、同じ列に部品が多いと縦に長くなる |
| Terraform / Kubernetes 取り込み | サンプルで確認。実際の本番 state では未検証 |
| 抽出 CLI（Claude API） | `--dry-run` のみ確認。実 API 呼び出しは未検証 |
| GitHub Actions（CI） | 定義のみ。初回 push 時に初めて実行 |

既知の課題：大きなモデル（100 部品超）での表示性能・ラベルの重なり、画面上での部品の編集、日本語フォントは OS 標準に依存。

## 起動
```
npm ci                                       # 依存を取得。postinstall で vendor/ を生成（git 管理外）
                                             # --ignore-scripts で実行した場合は続けて npm run vendor
python -m http.server 8124 --bind 0.0.0.0   # → http://localhost:8124/#ec-shop
npm run gates                                # 点検（不合格なら exit 1）
npm run index                                # models/<id>/index.json（ID 索引・逆引き索引）を生成
```

## 構成
```
docs/             設計書（サンプル）・モデル仕様・AI エージェント向けルール（AGENTS.md）
prompts/          抽出（書き手）/ 検証（検証役）プロンプト
models/<id>/      model.yaml（唯一の正）・actual.yaml（実環境スナップショット）・index.json（生成物）
js/analyze.js     指摘ルール・障害伝播・確度判定・網羅率・点検・索引（ブラウザと Node で共用）
js/scene3d.js     Three.js 描画（回転・拡大縮小・移動、ラベル、パケット）
js/app.js         画面（モード・パネル）
tools/            gates.mjs（点検 CLI）・build-index.mjs（索引生成）・vendor.mjs（同梱物の生成）
vendor/           （生成物・git 管理外）three.js・js-yaml・欧文フォント。ライセンス文付き。画面は外部通信なしで動作
```

## パイプライン（Reverse Spec Flow の考え方を取り入れたもの）
```
設計書 / IaC / コード
   │ prompts/extract-model.md（書き手）── 根拠必須・推測禁止・2 層（構成 / 要件）
   ▼
models/<id>/model.yaml
   │ prompts/verify-model.md（別セッションの検証役）── 根拠が本当に裏付けているか
   ▼
tools/gates.mjs ── 網羅率・参照切れ・未登録の不明・ずれ・要件の紐付け・重大な指摘 → exit 0/1
   ▼
3D ビューア ── 構造 / シナリオ / 障害 / 指摘 / メトリクス / 根拠と確度 / 要件
```

## 画面
| 場所 | 機能 |
|---|---|
| ヘッダー | 検索（部品・ID・要件・根拠の参照先）、開く（YAML）、共有（視点込みのリンクをコピー）、画像（PNG）、レポート（Markdown）、ヘルプ、設定 |
| サイドバー | モデル一覧（点検の合否・網羅率）、表示モード、フロアの表示切替、選択部品の周辺だけ表示 |
| 3D ビュー | 回転 / 移動の切替、視点（斜め・真上・横・裏側）、クリックで選択 |
| 詳細パネル | モードごとの一覧・詳細。狭い画面では下から出るシート |

ビュー：論理構成（機能配置）/ 物理構成（サービス）/ 物理構成（ネットワーク）。`V` キーで切り替え（詳細は docs/model-schema.md）

表示モード：構造 / シナリオ / 障害シミュレーション / 指摘 / メトリクス / 根拠と確度 / 要件 / 比較

- **URL**：`#/m/<model>/<mode>?s=<部品>&…` で画面の状態を表す。「共有」は視点（`v=`）も含める
- **YAML の読み込み**：画面へドラッグ＆ドロップ、または「開く」。ブラウザ内（localStorage）に最大 5 件保存し、外部には送信しない。比較モードでドロップすると比較対象として読み込む
- **比較**：`models/registry.json` の `compare` か、読み込んだ YAML と比べる。CLI は `npm run compare -- old.yaml new.yaml`
- **設定**：テーマ・ラベルの大きさ・パケットの速さ・初期の視点・ドラッグの既定・点検しきい値・ルールの有効/無効（ブラウザに保存）

| キー | 操作 |
|---|---|
| `/` | 検索 |
| `R` / `M` | ドラッグを回転 / 移動に |
| `F` / `N` | 選択部品に寄る / 周辺だけ表示 |
| `1`〜`8` | 表示モード |
| `←` `→` | シナリオのステップ |
| `[` | サイドバーの開閉 |
| `V` | ビューの切り替え |
| `?` / `Esc` | ヘルプ / 閉じる・選択解除 |

## 取り込みと抽出（CLI）
| コマンド | 内容 |
|---|---|
| `npm run import:tf -- state.json --out models/<id>/actual.yaml` | `terraform show -json`（または tfstate v4）から実環境スナップショットと IaC 在庫を作る。台数・AZ を取り出す |
| `npm run import:k8s -- manifests.yaml --out models/<id>/actual.yaml` | Kubernetes マニフェスト（または `kubectl get -o yaml`）から部品・台数・接続（`*_ADDR` などの環境変数）を作る。宛先のない参照は `unresolved` |
| `npm run extract -- --id <id> --doc docs/x.md [--actual …]` | Claude API（claude-opus-5-5）で 書き手→形式チェック→検証役→点検。`ant auth login` か `ANTHROPIC_API_KEY` が必要。`--dry-run` で API を呼ばずに確認 |

- モデルの部品と取り込んだ部品は、同じ ID か、根拠の `{ type: iac, ref: <アドレス> }` で対応付く
- 座標（x, y）を省いた部品は自動配置される（`layout: auto` で全部並べ直し）

### 公開サンプルでの試行（online-boutique）
公開デモ [Online Boutique](https://github.com/GoogleCloudPlatform/microservices-demo)（Apache-2.0）の README を要約した設計書（`docs/sample-online-boutique.md`）だけからモデルを起こし、
公開マニフェストを参考に再構成した `samples/online-boutique/kubernetes-manifests.yaml` を取り込んで突き合わせた。
設計書から読み取れなかった接続 4 件、設計書の推測が誤っていた接続 1 件、存在しないサービスへの参照 1 件、全サービスが 1 台構成であることを検出した。

## テスト・CI
`npm test`（`node --test`）で解析処理の単体テスト。`.github/workflows/ci.yml` で push / PR 時に実行（点検はサンプルが意図的に不合格なので報告のみ）。

## 確度
| 状態 | 意味 | 図での表現 |
|---|---|---|
| 事実 | IaC・コード・実環境で確認 | 通常 / 実線 |
| 主張 | 設計書の記述のみ | 半透明・破線 |
| 不明 | 根拠なし（`unknowns` に登録して残す） | ほぼ透明・「？不明」 |
| ずれ | 資料どうしが食い違う | 朱の輪郭・「ずれ」 |

## 収録モデル
| ID | 内容 |
|---|---|
| `ec-shop` | EC サイト注文基盤（設計書 + 実環境スナップショット） |
| `aws-web` | AWS Web 構成（VPC / AZ / サブネット、IaC 根拠、IaC 在庫） |
| `cicd` | CI/CD パイプライン（ワークフロー定義を根拠に） |
| `online-boutique` | 公開デモ Online Boutique（設計書要約 + Kubernetes 取り込み、自動配置） |

詳細は `docs/model-schema.md`。

## 動作環境
Node.js 22 以上（CLI・テスト）、Python 3（静的ファイルの配信。他のサーバーでも可）、WebGL が使えるブラウザ。

## クレジット・ライセンス
- 依存ライブラリ：[three.js](https://threejs.org/)（MIT）、[js-yaml](https://github.com/nodeca/js-yaml)（MIT）、[Inter](https://rsms.me/inter/) / [IBM Plex Mono](https://github.com/IBM/plex)（SIL OFL 1.1）、[Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript)（MIT）。`npm ci` 時に `vendor/` へ各ライセンス文とともに配置
- `docs/sample-online-boutique.md` と `samples/online-boutique/` は [GoogleCloudPlatform/microservices-demo](https://github.com/GoogleCloudPlatform/microservices-demo)（Apache-2.0）の公開情報をもとに独自に要約・再構成したもの（原本の複製ではない）
- 「根拠と確度」の考え方は AWS の [Reverse Spec Flow](https://aws.amazon.com/jp/blogs/news/aidm-introducing-reverse-spec-flow/) の記事を参考にした
- このリポジトリ自体のライセンスは未設定（現時点では著作権者に権利が留保される）
