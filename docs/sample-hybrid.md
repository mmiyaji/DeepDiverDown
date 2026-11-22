# ハイブリッド受注基盤（架空）

## 1. 概要
受注処理をクラウドと社内拠点に分散した架空の構成。

## 2. インターネット入口
利用者は Cloudflare の DNS、WAF、CDN を経由し、Azure の Application Gateway（2 台）にアクセスする。Cloudflare 側の台数は対象外とする。

## 3. 受注処理
Application Gateway は 3 ゾーンに分かれた AKS（3 台）に転送する。アプリは Azure SQL（2 台）、Service Bus（2 台）、Key Vault（2 台）を利用する。

## 4. 基幹 DB
AKS は OCI FastConnect を使う接続経路で、OCI の Autonomous Database（2 台）に同期アクセスする。FastConnect は冗長経路を使う。

## 5. 社内拠点
Service Bus の受信処理は VPN 装置（1 台）とファイアウォール（2 台）を経由して基幹サーバー（2 台）に同期で受け渡す。サーバーは社内 DB（1 台）を使う。運用者は社内 VPN 経由で作業する。

## 6. 分析
Azure SQL の受注データを BigQuery に非同期でエクスポートする。分析側の台数は対象外とする。

## 7. 要件
分析先に障害が起きても、受注処理は継続できること。
