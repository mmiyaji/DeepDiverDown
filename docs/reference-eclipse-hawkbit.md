# Eclipse hawkBit の端末更新

## 1. 対象

Eclipse hawkBit によるデバイス向けソフトウェア更新の配布を整理する。

## 2. 機能配置と処理

運用者が更新成果物とロールアウトを管理する。端末の updater は DDI API をポーリングし、対象の成果物を取得してインストールし、結果を報告する。

## 3. 設計と利用上の注意

端末側 updater、署名検証、適用・ロールバックの実装やポリシーは別途必要。hawkBit の導入だけで車載 OTA の安全認証を意味しない。

## 4. 実装例：hawkBit と端末 updater

hawkBit DDI と端末側 updater の組み合わせ。検証とインストールの具体的な実装は利用者が用意する。

| 機能 | 担い手 |
|---|---|
| 更新運用者 | 更新運用者 |
| 更新配布管理 | Eclipse hawkBit |
| 端末の更新クライアント | 端末 updater |
| 端末ソフトウェア | 端末ソフトウェア |
| 更新成果物 | 更新アーティファクト |

[Eclipse hawkBit](https://hawkbit.eclipse.dev/)、[Device integration API](https://hawkbit.eclipse.dev/concepts/device-integration/)。
