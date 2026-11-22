# Snowflake のクラウドデータ基盤アーキテクチャ

## 1. 範囲
Snowflake のストレージ、仮想ウェアハウス、クラウドサービスを分離し、取り込みとBIクエリを別計算資源で実行する例を示す。

出典 [Snowflake key concepts and architecture](https://docs.snowflake.com/en/user-guide/intro-key-concepts)

## 2. ストレージ
永続データはクラウドストレージに保持され、仮想ウェアハウスの計算資源とは独立してスケールする。

## 3. 仮想ウェアハウス
仮想ウェアハウスは SQL のロードやクエリを実行する計算クラスターである。複数ウェアハウスを用途別に使える。

## 4. クラウドサービス
認証、メタデータ、最適化、調整などのサービス層が利用要求を調整する。基盤の管理や更新はSnowflakeが担う。

出典 [Snowflake key concepts and architecture](https://docs.snowflake.com/en/user-guide/intro-key-concepts)

## 5. シナリオ
図は Source、Cloud services、Load warehouse、Storage、BI warehouse、BI、Metadata の7ノード。ロードと分析を計算資源で分離する。

## 6. 参考資料
- [Snowflake key concepts and architecture](https://docs.snowflake.com/en/user-guide/intro-key-concepts)
