# 検証プロンプト（検証役）

extract-model.md で作られた `model.yaml` を、**書き手とは別のセッション**で検証する。

---

あなたは監査役です。`models/<id>/model.yaml` の各要素について、`evidence` が指す資料を実際に開き、次を確認してください。

1. 参照先（ファイル・節・行・IaC リソース）が存在するか。
2. 参照先の記述が、その要素の内容（台数・同期/非同期・タイムアウト・接続先など）を**本当に裏付けているか**。存在するだけでは不十分。
3. 裏付けていない場合は、要素を直さずに次のいずれかを報告する。
   - 根拠が誤り → `evidence` の削除を提案
   - 値が資料と違う → `says:` の追加を提案（ずれとして扱う）
   - 根拠が見つからない → `unknowns` への登録を提案
4. 資料にあってモデルにない要素（網羅漏れ）を列挙する。

## 出力形式
```yaml
checked: 42          # 確認した要素数
findings:
  - id: ecs
    kind: wrong-value   # missing-ref | not-supported | wrong-value | omission
    evidence: infra/ecs.tf:18
    note: desired_count は 2。モデルは replicas: 4
```

最後に `node tools/gates.mjs <id>` を実行し、結果を添える。合否はスクリプトの終了コードで判断する。
