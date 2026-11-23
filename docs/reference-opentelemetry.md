# OpenTelemetry の分散トレーシングとサンプリング

## 1. モデルの範囲

架空の注文 API が在庫 API を呼び出す。アプリケーションの通信と、計装が生成した Span を運ぶ収集パイプラインを描く。例では送信側が対象の Span を記録できる構成を前提とする。

出典 [OpenTelemetry Context propagation](https://opentelemetry.io/docs/concepts/context-propagation/)、[Collector Configuration](https://opentelemetry.io/docs/collector/configuration/)

## 2. Trace Context の伝播

注文 API が在庫 API への HTTP リクエストに Trace Context を入れる。在庫 API がこれを復元すると、同じ Trace ID の中に親子関係のある Span を作れる。計装や伝播の欠落は、観測された Span や親子関係に影響する。

出典 [OpenTelemetry Context propagation](https://opentelemetry.io/docs/concepts/context-propagation/)

## 3. OTLP と Collector

SDK の Exporter が各 API の Span を OTLP で Collector に送る。traces パイプラインは Receiver、Processor、Exporter で構成する。業務の HTTP リクエストに載るコンテキストと、OTLP が運ぶ Span データは別の通信として扱う。

出典 [OTLP Specification](https://opentelemetry.io/docs/specs/otlp/)、[Collector Configuration](https://opentelemetry.io/docs/collector/configuration/)

## 4. 保持の判定

Head Sampling は Trace の初期段階で決め、Tail Sampling は収集した Span に基づいて決める。この例は ERROR の Span を含む Trace を保持する。Collector で判定するには、必要な Span を判定までに受け取り、同じ Trace ID を担当するインスタンスに届ける必要がある。上流ですでに破棄された Span は、この判定に使えない。

出典 [OpenTelemetry Sampling](https://opentelemetry.io/docs/concepts/sampling/)、[Tail Sampling Processor](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/tailsamplingprocessor)

## 5. 観測結果と設計の照合

バックエンドで確認できるのは届いた Span である。成功した注文を検索できない場合、設計と照合するときには保持条件、計装やコンテキスト伝播、収集経路を確認する。エラーだけを保持するこの例から、全リクエストに占めるエラー率を読み取ることはできない。

出典 [OpenTelemetry Context propagation](https://opentelemetry.io/docs/concepts/context-propagation/)、[Collector Configuration](https://opentelemetry.io/docs/collector/configuration/)、[OpenTelemetry Sampling](https://opentelemetry.io/docs/concepts/sampling/)
