# DeepDiverDown

設計書・IaC・コードを「根拠付きの構造化モデル」に落とし、3D 図解・動き・指摘・点検で
人間が設計上の問題点と「どこがまだ確かめられていないか」を把握しやすくする実験プロジェクト。

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

詳細は `docs/model-schema.md`。
