// サイドバーの製品ツリー：モデル ID から製品を判定する。上から順に最初に当たった製品へ入れる。
// どれにも当たらないモデル（概念・設計パターンなど）は、分類の直下に置く。
export const PRODUCTS = [
  { name: 'Apache Spark', match: /^spark(-|$)/ },
  { name: 'Apache Kafka', match: /^kafka(-|$)/ },
  { name: 'Apache Iceberg', match: /^(apache-)?iceberg(-|$)/ },
  { name: 'Snowflake', match: /^(snowflake|cortex-data-agent)(-|$)/ },
  { name: 'Databricks', match: /^databricks(-|$)/ },
  { name: 'Microsoft Fabric', match: /^(microsoft-)?fabric(-|$)/ },
  { name: 'dbt', match: /^dbt(-|$)/ },
  { name: 'Redis', match: /^redis(-|$)/ },
  { name: 'TimescaleDB', match: /^timescaledb(-|$)/ },
  { name: 'TiDB', match: /^tidb(-|$)/ },
  { name: 'Prometheus', match: /^(monitoring-)?prometheus(-|$)/ },
  { name: 'PostGIS', match: /^postgis(-|$)/ },
  { name: 'H3', match: /^(geospatial-)?h3(-|$)/ },
  { name: 'K3s', match: /^(edge-)?k3s(-|$)/ },
  { name: 'AUTOSAR', match: /^autosar(-|$)/ },
];

export const productOf = id => PRODUCTS.find(p => p.match.test(id))?.name || null;

// 製品名で始まる図の名前は、製品の下では残りの部分だけを見せる（「Apache Spark の基本アーキテクチャ」→「基本アーキテクチャ」）
export function shortName(name, product) {
  if (!name || !product) return name;
  for (const alias of [product, product.replace(/^Apache /, '')]) {
    if (!name.startsWith(alias)) continue;
    // 「の」「：」が続くとき、または別の英単語が続くとき（「Spark SQL：…」）だけ省く。「Spark と Celeborn」は省かない
    const after = name.slice(alias.length);
    if (!/^(\s*の|\s*[：:]|\s+[A-Za-z])/.test(after)) continue;
    const rest = after.replace(/^[\s：:]+/, '').replace(/^の\s*/, '');
    if (rest) return rest;
  }
  return name;
}
