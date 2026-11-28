# オブジェクトストレージの違い

自前運用型の S3 互換オブジェクトストレージ

| 観点 | RustFS | MinIO |
| --- | --- | --- |
| 特徴 | **Rust 製の S3 互換オブジェクトストレージ**。S3 互換 API でオブジェクトを読み書きする | **S3 互換のオブジェクトストレージ**。コミュニティ版は 2026-04 にアーカイブされソース公開のみ。後継は AIStor |
| データモデル・実行モデル | 分散構成では複数 Pod が複数の PVC に分散して保存する | オブジェクトをデータ K とパリティ M のシャードに分け、プール内の消失訂正セットへ分散する |
| 一貫性・耐久性の仕組み | 複数 PVC に消失訂正符号化で分散配置する | パリティは EC:N。欠損シャードはヒーリングで再構築する（AIStor 資料の記述） |
| 拡張のしかた | Helm の values で Pod・PVC の数やサイズ、StorageClass を指定する | サーバープールを追加する（構文は **未確認**） |
| 運用の形態 | 自前の Kubernetes に Helm で導入する。AWS の例は EKS、EC2 ノード、EBS CSI | 自前サーバーにロードバランサーと複数ノードを置く。ソースからビルドするか AIStor を導入する |
| 得意な用途 | Kubernetes 上で S3 互換の保存を自前運用する | 自前運用の S3 互換ストレージ（AIStor Enterprise は商用サポート） |
| 注意点 | 台数や冗長化の方針は図に明記がない。S3 互換の範囲は資料での確認が必要 | コミュニティ版は更新されない。AIStor Free は単一ノードのみ。ビットロット対策と IAM は **未確認** |
| ライセンス | Apache-2.0 | コミュニティ版は AGPL v3（アーカイブ済み）。AIStor Free は無料で再配布禁止。AIStor Enterprise は商用ライセンス |

内容は 2026 年 11 月時点の公式資料に基づく。確認できなかった点は「未確認」と書く。

## 選び方

- Kubernetes に Helm で S3 互換ストレージを自前導入する → **RustFS**
- Pod・PVC の数と StorageClass を values で決める → **RustFS**
- 商用サポートつきで複数ノードの S3 互換ストレージを使う → **MinIO**（AIStor Enterprise）
- 単一ノードで無料に試す → **MinIO**（AIStor Free）

## 公式資料

- [RustFS Helm deployment](https://docs.rustfs.com/en/installation/cloud-native)
- [S3 compatibility](https://docs.rustfs.com/en/reference/s3-compatibility)
- [MinIO GitHub リポジトリ](https://github.com/minio/minio)
- [MinIO Pricing](https://www.min.io/pricing)
