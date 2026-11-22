# OpenLineage の基本アーキテクチャ

## 1. 読み方と範囲

受注原本から日次売上までの2つの変換 Job と、その実行時に送られる RunEvent を追う。OpenLineage の Job、Run、Dataset の関係を教材用に単純化している。

出典 [OpenLineage Object Model](https://openlineage.io/docs/1.47.0/spec/object-model/)

## 2. Dataset と Job

Dataset は処理の入力または出力となるデータを表し、Job は Dataset を消費・生成する定義済みの処理を表す。原本、明細、日次売上を別 Dataset として扱う。

出典 [OpenLineage Object Model](https://openlineage.io/docs/1.47.0/spec/object-model/)

## 3. 変換の流れ

整形 Job が受注原本を読み明細を生成し、集計 Job が明細を読み日次売上を生成する。複数 Job の観測をつなぐことで lineage graph を構成できる。

出典 [OpenLineage Object Model](https://openlineage.io/docs/1.47.0/spec/object-model/)

## 4. RunEvent

RunEvent は Job の実行時に送る状態更新で、通常は START と COMPLETE などを含む。各イベントには Job、Run、入力 Dataset、出力 Dataset を含められる。

出典 [OpenLineage Object Model](https://openlineage.io/docs/1.47.0/spec/object-model/)

## 5. 収集と利用

実行基盤やクライアントが RunEvent を収集先へ送る。JobEvent や DatasetEvent は設計時のメタデータ更新であり、Run に結び付く RunEvent とは用途が異なる。

出典 [OpenLineage Object Model](https://openlineage.io/docs/1.47.0/spec/object-model/)

## 6. シナリオ

「原本から日次売上までの lineage」シナリオをクリックすると、Dataset、変換 Job、RunEvent の START/COMPLETE を順に追える。
