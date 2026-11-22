# Online Boutique 基本設計（要約）

> 公開されているマイクロサービスのデモアプリ「Online Boutique」（GoogleCloudPlatform/microservices-demo、Apache-2.0）の
> README に書かれている事実を、DeepDiverDown の題材として日本語で要約したもの（原文の翻訳・複製ではない）。
> 出典：https://github.com/GoogleCloudPlatform/microservices-demo
> 設計書としての検証用なので、README に書かれていないこと（台数・タイムアウトなど）はあえて補っていない。

## 1. 概要
Web ベースの EC アプリ。利用者は商品を閲覧し、カートに入れ、購入できる。
11 個のマイクロサービスで構成され、サービス間は gRPC で通信する。Kubernetes 上で動かすことを前提とする。

## 2. 利用者とアクセス
### 2.1 利用者
ブラウザから HTTP でアクセスする。会員登録やログインはなく、セッション ID が自動で発行される。
### 2.2 公開経路
frontend を外部向けのロードバランサー（frontend-external）で公開する。
### 2.3 負荷生成
loadgenerator が、利用者の買い物の流れを模したリクエストを frontend に送り続ける。

## 3. サービス
### 3.1 frontend
Go。Web サイトを HTTP で提供する。商品一覧・カート・購入などの画面を組み立てる。
### 3.2 cartservice
C#。利用者のカートの中身を保存・取得する。
### 3.3 productcatalogservice
Go。JSON ファイルから商品一覧を提供し、商品の検索と個別取得を行う。
### 3.4 currencyservice
Node.js。欧州中央銀行の為替レートで金額を通貨換算する。最も呼び出し回数が多いサービス。
### 3.5 paymentservice
Node.js。カード情報で（模擬的に）課金し、取引 ID を返す。
### 3.6 shippingservice
Go。カートの内容から送料を見積もり、（模擬的に）発送する。
### 3.7 emailservice
Python。注文確認メールを（模擬的に）送る。
### 3.8 checkoutservice
Go。カートを取り出して注文を作り、決済・発送・メール通知をまとめて行う。
### 3.9 recommendationservice
Python。カートの内容をもとに、おすすめ商品を返す。
### 3.10 adservice
Java。与えられた文脈の単語に合う文字広告を返す。
### 3.11 loadgenerator
Python / Locust。2.3 のとおり。

## 4. データ
### 4.1 カートの保存先
cartservice はカートの中身を Redis に保存する。

## 5. ユースケース
### 5.1 商品を見る
frontend が商品一覧を取り、価格を利用者の通貨に換算し、広告とおすすめを添えて表示する。
### 5.2 カートに入れる
frontend が cartservice にカートへの追加を依頼する。
### 5.3 注文する
frontend が checkoutservice に注文を依頼する。checkoutservice はカートを取り出し、決済し、発送し、確認メールを送る。
