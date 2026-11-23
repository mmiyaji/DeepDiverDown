# Inmon CIF の統合 EDW と依存型データマート

## 1. モデルの範囲

Bill Inmon の Corporate Information Factory（CIF）が中心に据える統合 EDW と、そこからデータを供給するマートを扱う。架空の注文・顧客・返金システムを入力とし、ODS など CIF の周辺機能は図から省略する。

出典 [Bill Inmon: Data Warehousing 2.0](https://www.embarcadero.com/images/dm/technical-papers/bill-inmon-data-warehousing-2-0-whitepaper.pdf)、[Bill Inmon: A Tale of Two Architectures](https://williaminmon.substack.com/p/a-tale-of-two-architectures-kimball)

## 2. 業務システムから統合する

ソース統合 ETL は業務システムごとの表現を全社で使う定義に対応付ける。たとえば EC 側の顧客番号 C-15 を顧客マスターと照合し、企業内顧客キー E-42 として注文を関連付ける。キーの対応や意味は統合時に決める。

出典 [Bill Inmon: Data Warehousing 2.0](https://www.embarcadero.com/images/dm/technical-papers/bill-inmon-data-warehousing-2-0-whitepaper.pdf)、[Bill Inmon: A Tale of Two Architectures](https://williaminmon.substack.com/p/a-tale-of-two-architectures-kimball)

## 3. 正規化された統合 EDW

CIF の EDW は統合済みで履歴を持つ詳細データの置き場で、この例は第3正規形（3NF）を使う。顧客属性は顧客表、注文単位の項目は注文表、明細単位の項目は注文明細表にあり、キーで関連付ける。返金取引も識別子を持ち、元の注文明細と関連付けて記録する。

出典 [Bill Inmon: Data Warehousing 2.0](https://www.embarcadero.com/images/dm/technical-papers/bill-inmon-data-warehousing-2-0-whitepaper.pdf)、[Bill Inmon: A Tale of Two Architectures](https://williaminmon.substack.com/p/a-tale-of-two-architectures-kimball)

## 4. 依存型データマート

マートは EDW の統合データから作る。営業マートは1注文明細1行で販売時点の地域と受注時金額を提供する。経理マートは日別・通貨別に受注額と返金額を提供する。受注額は注文日、返金額は返金取引日で集計し、後着の返金は該当する経理マートの日付を更新する。

出典 [Bill Inmon: Data Warehousing 2.0](https://www.embarcadero.com/images/dm/technical-papers/bill-inmon-data-warehousing-2-0-whitepaper.pdf)、[Bill Inmon: A Tale of Two Architectures](https://williaminmon.substack.com/p/a-tale-of-two-architectures-kimball)

## 5. Kimball との比較

CIF は全社統合の責務を正規化した EDW に置く。Kimball のバスアーキテクチャは業務プロセス単位のファクト表を段階的に提供し、複数のファクト表に共通の適合ディメンションを使って横断分析を成立させる。両者とも共有の定義で統合する設計で、統合を担う構造と公開までのデータ経路が異なる。

出典 [Bill Inmon: A Tale of Two Architectures](https://williaminmon.substack.com/p/a-tale-of-two-architectures-kimball)、[Kimball Group: Enterprise Data Warehouse Bus Architecture](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/kimball-data-warehouse-bus-architecture/)
