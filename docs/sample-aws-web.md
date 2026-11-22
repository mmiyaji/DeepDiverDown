# AWS Web アプリ 基盤設計書（サンプル）

> DeepDiverDown の動作確認用の架空の設計書。

## 1. 利用者
一般利用者がブラウザからアクセスする。

## 2. エッジ
Route 53 で名前解決し、CloudFront で配信する。WAF を CloudFront に関連付ける。

## 3. ネットワーク
VPC を 2 AZ（a / c）で構成する。パブリックサブネットに ALB と NAT Gateway を置く。
1 つの AZ が停止してもサービスを継続できること。

## 4. アプリケーション
API は ECS Fargate で 4 タスク（各 AZ 2 タスク）。DB 認証情報は Secrets Manager から取得する。
外部 API は NAT Gateway 経由で呼び出す。

## 5. 非同期処理
画像処理は SQS にジョブを積み、Lambda で処理する。

## 6. データ
Aurora（Multi-AZ）と ElastiCache（Redis）をプライベートサブネットに置く。画像は S3 に保存する。

## 7. リクエストの流れ
利用者 → Route 53 → CloudFront → WAF → ALB → ECS → ElastiCache / Aurora。重い処理は SQS → Lambda → S3。

## 8. 運用
インフラ担当（2 名）が社内 VPN から ECS Exec で調査する。
