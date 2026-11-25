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

// 製品ではなく、考え方・設計パターン・トレンドを扱う図
export function isConcept(entry) {
  if (productOf(entry.id)) return false;
  const tags = entry.tags || [];
  return tags.includes('概念') || tags.includes('パターン') || entry.reference?.kind === '設計パターン・ユースケース'
    || /^(dwh|trend|semantic|time-series|geospatial)-/.test(entry.id);
}

// 製品の名前：表に当たればその名前、なければ図の名前の「の」「：」より前（「Trino の分散クエリ…」→「Trino」）
export function productName(entry) {
  const known = productOf(entry.id);
  if (known) return known;
  const name = entry.name || entry.id;
  const head = name.split(/\s*(?:の|：|:)\s*/)[0].trim();
  return head && head.length < name.length && head.length <= 32 ? head : name;
}

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
