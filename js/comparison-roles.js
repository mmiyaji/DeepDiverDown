// Correspondences describe responsibilities in the published example diagrams.
// Node IDs are scoped to a model: "source" can be a database or an adapter.
const roles = {
  '読み取り範囲の選択': { 'snowflake-optima-internals':'prune', 'databricks-dynamic-file-pruning':'prune' },
  '読み飛ばしに使う統計': { 'snowflake-optima-internals':'stats', 'databricks-dynamic-file-pruning':'stats' },
  'ストレージへの短期認証情報': { 'snowflake-iceberg-vended-credentials':'credentials', 'databricks-unity-vended-credentials':'credential' },
  'クラウド上のテーブルデータ': { 'snowflake-iceberg-vended-credentials':'files', 'databricks-unity-vended-credentials':'files' },
  'クラスタリングの設定': { 'snowflake-clustering-internals':'key', 'databricks-liquid-clustering-internals':'config' },
  'データ配置の再編成（Snowflake は Classic の例）': { 'snowflake-clustering-internals':'execute', 'databricks-liquid-clustering-internals':'optimize' },
  '再配置前のデータ': { 'snowflake-clustering-internals':'before', 'databricks-liquid-clustering-internals':'oldfiles' },
  '再配置後のデータ': { 'snowflake-clustering-internals':'after', 'databricks-liquid-clustering-internals':'newfiles' },
  '表の状態と統計': { 'snowflake-clustering-internals':'metadata', 'databricks-liquid-clustering-internals':'log' },
  '保守の観測': { 'snowflake-clustering-internals':'monitor', 'databricks-liquid-clustering-internals':'profile' },
  'SQL の受付と計画': { 'snowflake-optimization-internals':'planner', 'databricks-optimization-internals':'planner' },
  '条件による読み取り範囲の絞り込み': { 'snowflake-optimization-internals':'metadata', 'databricks-optimization-internals':'log' },
  '列指向データの保存': { 'snowflake-optimization-internals':'partitions', 'databricks-optimization-internals':'files' },
  'データのスキャン': { 'snowflake-optimization-internals':'scan', 'databricks-optimization-internals':'scan' },
  '結合と集計の実行': { 'snowflake-optimization-internals':'operators', 'databricks-optimization-internals':'operators' },
  '保存済みクエリ結果': { 'snowflake-optimization-internals':'result', 'databricks-optimization-internals':'result' },
  '実行資源のデータキャッシュ': { 'snowflake-optimization-internals':'whcache', 'databricks-optimization-internals':'diskcache' },
  'データ配置の保守': { 'snowflake-optimization-internals':'cluster', 'databricks-optimization-internals':'maintenance' },
  'クエリ実行の観測': { 'snowflake-optimization-internals':'profile', 'databricks-optimization-internals':'profile' },
  '車載アプリ': { 'autosar-classic':'app', 'autosar-adaptive':'app', 'automotive-grade-linux':'ui', 'android-automotive':'app', 'kuksa-vss':'app' },
  'アプリが利用する基盤': { 'autosar-classic':'runtime', 'autosar-adaptive':'runtime', 'automotive-grade-linux':'framework', 'android-automotive':'service' },
  '現場の処理': { 'edge-k3s':'workload', 'kubeedge':'workload', 'aws-iot-greengrass':'component' },
  'エッジでの実行基盤': { 'edge-k3s':'agent', 'kubeedge':'edgecore', 'aws-iot-greengrass':'nucleus' },
  'センサー観測': { 'autoware-autonomous-driving':'sense', 'carla-simulation':'sensor' },
  'イベントの送信元': { 'slack-real-time-messaging':'sender', kafka:'producer', 'trend-agentic-streaming':'source' },
  'イベントの受信先': { 'slack-real-time-messaging':['receiver-a','receiver-b'], kafka:['consumer-1','consumer-2'], 'trend-agentic-streaming':'consumer' },
  'Iceberg 表のスキーマ': { 'iceberg-v3-variant':'schema', 'iceberg-v3-metadata':'schema', 'apache-iceberg':'metadata', 'iceberg-catalog-read':'metadata' },
  'Iceberg ファイルと統計': { 'iceberg-v3-variant':'manifest', 'iceberg-v3-metadata':'data-manifest', 'apache-iceberg':'manifest', 'iceberg-catalog-read':'manifest' },
  'Variant の値の名前辞書': { 'iceberg-v3-variant':'meta', 'iceberg-v3-metadata':'dictionary' },
  '知識・記憶の保存': { graphiti:'graph', hindsight:'store', hydradb:'storage' },
  '知識・記憶の検索': { graphiti:'search', hindsight:'recall', hydradb:'query' },
  'ベクトル検索': { qdrant:'search', 'databricks-ai-search':'query' },
  '監視対象アプリ': { langfuse:'app', 'monitoring-datadog':'app', 'monitoring-newrelic':'app' },
  '観測データの保存': { langfuse:'observations', 'monitoring-datadog':'store', 'monitoring-newrelic':'store' },
  'ワークロードの実行': { 'cloud-spot-capacity':'work', 'spot-ocean':'pods' },
  '容量の管理': { 'cloud-spot-capacity':'manager', 'spot-ocean':'autoscaler' },
  '実行する計算容量': { 'cloud-spot-capacity':['spot','standard'], 'spot-ocean':'nodes' },
  '監視対象': { 'monitoring-datadog':'app', 'monitoring-newrelic':'app', 'monitoring-prometheus':'app' },
  'テレメトリ収集': { 'monitoring-datadog':'collector', 'monitoring-newrelic':'collector', 'monitoring-prometheus':'collector' },
  'データの保存と問い合わせ': { 'monitoring-datadog':'store', 'monitoring-newrelic':'store', 'monitoring-prometheus':'store' },
  '監視画面': { 'monitoring-datadog':'dashboard', 'monitoring-newrelic':'dashboard', 'monitoring-prometheus':'dashboard' },
  'アラートと通知': { 'monitoring-datadog':'alert', 'monitoring-newrelic':'alert', 'monitoring-prometheus':'alert' },
  '取り込みの再開位置': { 'kafka-connect':'offsets', airbyte:'state', debezium:'offset', fivetran:'cursor', 'postgresql-logical-decoding':'offset' },
  'アプリの実行ノード': { 'amazon-eks':'managed', 'azure-aks':'user', 'google-gke':'user', 'amazon-ecs':['fargate','ec2'], nomad:'client', 'docker-swarm':'worker' },
  '状態の復旧': { flink:'checkpoint', 'spark-streaming':'checkpoint', 'spark-structured-streaming':'checkpoint', 'kafka-streams':'changelog' },
  '処理中の状態を保持': { flink:'state', 'spark-structured-streaming':'state', 'kafka-streams':'state' },
  'クエリの計画・調整': { spark:'driver', trino:'control', duckdb:'optimizer', clickhouse:'planner', bigquery:'api', redshift:'leader', 'iceberg-distributed-scan':'planner', 'iceberg-catalog-read':'coordinator', 'sorting-pruning':'query' },
  'データの読み取り・取り込み': { 'kafka-connect':'source', airbyte:'sourceConnector', debezium:'connector', fivetran:'connector', 'postgresql-logical-decoding':'connector', databricks:'ingest', snowflake:'load', 'microsoft-fabric':'pipeline', 'snowflake-ingestion-cdc':['pipe','streaming'], 'databricks-lakeflow':['connector','auto-loader'], 'azure-data-factory':'copy', 'apache-airflow':'ingest' },
  '入力データ': { 'kafka-connect':'database', airbyte:'source', fivetran:'source', debezium:'database', 'spark-streaming':'source', 'spark-structured-streaming':'kafka', flink:'source', 'kafka-streams':'topic', 'google-cloud-dataflow':'pubsub', 'aws-glue':'source', 'azure-data-factory':'source', spark:'input', 'apache-paimon':'source', 'apache-hudi':'cdc', 'etl-elt':'source', 'databricks-lakeflow':'db', 'snowflake-ingestion-cdc':'files', dbt:'raw', snowflake:'source', databricks:'source', 'microsoft-fabric':'source', medallion:'events', 'dwh-star-schema':'source', 'dwh-design-patterns':'source', 'dwh-wide-table':['orders','items'], 'dwh-fact-table-types':'events', 'dwh-aggregate-tables':'late', 'dwh-data-vault':'orders', 'dwh-inmon-cif':['orders','customers','refunds'], 'dwh-slowly-changing-dimensions':'event' },
  'イベントの保管・配信': { kafka:['broker-1','broker-2','broker-3'], 'kafka-connect':'kafka', debezium:'topic', 'postgresql-logical-decoding':'kafka', 'kafka-streams':'output' },
  '出力アダプター': { 'kafka-connect':'sink', airbyte:'destinationConnector' },
  '処理結果の保存先': { 'kafka-connect':'destination', airbyte:'warehouse', fivetran:'destination', flink:'sink', 'spark-streaming':'output', 'spark-structured-streaming':'sink', 'kafka-streams':'output', 'google-cloud-dataflow':'bigquery', 'aws-glue':'target', 'azure-data-factory':'lake', 'databricks-lakeflow':'clean', 'etl-elt':'mart', 'snowflake-ingestion-cdc':'orders' },
  '処理の実行担当': { 'kafka-connect':'worker', debezium:'worker', 'google-cloud-dataflow':'workers', 'azure-data-factory':'ir', 'aws-glue':'job', 'apache-airflow':'worker', temporal:['workflow-a','workflow-b'], spark:['executor-a','executor-b'], 'spark-streaming':'executors', 'spark-structured-streaming':'executor', flink:'operator', 'kafka-streams':'task', trino:['scan','reduce'], 'shuffle-skew':['join','hot'], 'partitioning-sharding':'query-worker', 'iceberg-distributed-scan':'worker', 'iceberg-catalog-read':'worker' },
  '入力の変換・整形': { 'azure-data-factory':'flow', 'google-cloud-dataflow':'transform', 'aws-glue':'job', 'apache-airflow':'transform', 'databricks-lakeflow':'sdp', 'etl-elt':['etl-job','dbt'], dbt:'compute', 'snowflake-ingestion-cdc':'task', databricks:'transform', 'microsoft-fabric':'spark', medallion:'prepare' },
  'クラスタの制御': { kubernetes:'apiserver', openshift:'api', k3s:'server', rke2:'server', 'amazon-eks':'api', 'azure-aks':'api', 'google-gke':'api', 'docker-swarm':'manager', 'amazon-ecs':'scheduler', nomad:'scheduler' },
  '注文 API の実行単位': { kubernetes:'order-api', openshift:'order-api', k3s:'order-api', rke2:'pod', 'amazon-eks':'workload', 'azure-aks':'workload', 'google-gke':'workload', 'docker-swarm':'task', nomad:'allocation' },
  'アプリへの入口': { kubernetes:'service', openshift:'service', k3s:'service', 'amazon-eks':'lb', 'azure-aks':'lb', 'google-gke':'lb', 'amazon-ecs':'alb', 'aws-web':'alb', 'ec-shop':'alb', hybrid:'gateway', 'online-boutique':'frontend-external' },
  '状態を保持するクラスタ': { 'etcd-raft':['member-a','member-b','member-c'], 'docker-swarm':'manager', kubernetes:'etcd', rke2:'etcd', k3s:'datastore' },
  '実行先の決定': { nomad:'scheduler', 'docker-swarm':'scheduler', 'amazon-ecs':'placement', kubernetes:'scheduler', openshift:'controller' },
  '参照時点と履歴の管理': { 'iceberg-v3-metadata':'snapshot', 'apache-iceberg':'snapshot', 'delta-lake':'snapshot', 'apache-paimon':'snapshots', 'apache-hudi':'timeline', 'data-lakehouse':'snapshot', compaction:'snapshot', 'snowflake-time-travel':'history' },
  'ファイルの保存': { 'iceberg-v3-variant':'file', 'iceberg-v3-metadata':'data', 'apache-iceberg':'data', 'delta-lake':'data', 'apache-hudi':['cow','mor'], 'apache-paimon':'runs', 'lsm-compaction':['l0','l1','l2'], 'data-lakehouse':'data', 'iceberg-catalog-read':'data', 'iceberg-rest-catalog':'data', 'apache-polaris':'bucket', 'project-nessie':'files' },
  'SQL の実行': { bigquery:'engine', redshift:'compute', snowflake:'biwh', databricks:'query', 'microsoft-fabric':'sql', 'apache-hudi':'query', 'apache-iceberg':'engine', 'delta-lake':'reader', 'apache-paimon':'reader', compaction:'reader', 'snowflake-query-performance':'clusters', 'databricks-sql-performance':'warehouse' },
  '分析データの保管': { snowflake:'storage', databricks:'storage', redshift:'rms', bigquery:'storage', 'microsoft-fabric':'delta', medallion:'silver', 'data-lakehouse':'data' },
  '管理対象のテーブル': { snowflake:'storage', 'snowflake-time-travel':'current' },
  '統合・再編成するファイル': { compaction:'orders', 'lsm-compaction':['l0','l1','l2'], 'apache-paimon':'runs', 'apache-hudi':['cow','mor'] },
  '資産の管理担当者': { datahub:'user', openmetadata:'steward', 'snowflake-horizon-catalog':'owner', 'microsoft-purview':'steward', 'google-cloud-knowledge-catalog':'owner' },
  '読み取り範囲の絞り込み': { clickhouse:'granules', duckdb:'footer', 'sorting-pruning':'partitions', 'partitioning-sharding':'time-partition', 'iceberg-distributed-scan':'manifest' },
  'ファイルからの読み取り': { clickhouse:'scan', duckdb:'scan', trino:'scan', 'parquet-internals':'reader', 'orc-internals':'reader', 'avro-internals':['task-a','task-b'], 'file-formats':'engine' },
  'ファイル内のデータ単位': { 'parquet-internals':'rowgroup', 'orc-internals':'stripes', 'avro-internals':'blocks' },
  '書き込みスキーマの特定': { 'avro-internals':'header', 'apicurio-registry':'versions' },
  'カタログのアクセス窓口': { 'iceberg-v3-metadata':'catalog', 'apache-polaris':'api', 'project-nessie':'api', 'iceberg-rest-catalog':'api', 'iceberg-catalog-read':'rest' },
  'メタデータの収集': { 'data-catalog-architecture':'collect', datahub:'ingest', openmetadata:'ingest', 'microsoft-purview':'scan', openlineage:'events' },
  '資産の検索・発見': { 'data-catalog-architecture':'catalog', datahub:'portal', openmetadata:'portal', 'amazon-datazone':'published', 'microsoft-purview':'unified', 'fabric-onelake-catalog':'explore', 'google-cloud-knowledge-catalog':'entries', 'databricks-unity-catalog':'catalog' },
  'データへのアクセス制御': { 'data-catalog-architecture':'policy', 'amazon-datazone':'subscription', 'microsoft-purview':'workflow', 'fabric-onelake-catalog':'secure', 'google-cloud-knowledge-catalog':'group', 'snowflake-horizon-catalog':'policy', 'databricks-unity-catalog':'location', 'data-clean-room':'policy', 'snowflake-secure-sharing':'view', 'databricks-open-sharing':'share' },
  'データの公開設定': { 'snowflake-secure-sharing':'share', 'databricks-open-sharing':'share', databricks:'sharing', snowflake:'sharing' },
  '利用側の集計・参照': { 'dwh-design-patterns':'bi', 'dwh-star-schema':'bi', 'dwh-snowflake-schema':['star-report','norm-report'], 'dwh-kimball-bus':'bi', 'dwh-aggregate-tables':'bi', 'dwh-slowly-changing-dimensions':'analytics', 'dwh-wide-table':'report', 'dwh-inmon-cif':['sales','finance'], 'dwh-data-vault':'mart' },
  '分析の土台になるファクト': { 'dwh-star-schema':'fact', 'dwh-snowflake-schema':['star-fact','norm-fact'], 'dwh-kimball-bus':['orders','returns'], 'dwh-slowly-changing-dimensions':'fact', 'dwh-fact-table-types':['transactions','periodic','accumulating','factless'], 'dwh-aggregate-tables':'fact' },
  '変更を管理するリポジトリ': { cicd:'gh', 'argo-cd':'git' },
  'ポリシーの定義': { 'opa-conftest':'policy', 'cilium-hubble':'policy' },
  '観測データの収集': { opentelemetry:'receiver', 'cilium-hubble':'relay' },
  'モデルの登録・配備': { databricks:'ml', 'databricks-mlflow-serving':['registry','deploy'] },
  '決済処理': { 'ec-shop':'pay', 'online-boutique':'paymentservice' },
  '名前解決': { 'aws-web':'r53', hybrid:'dns' },
};

// Explicit method names from the examples distinguish techniques even when
// the models have no service catalog IDs.
const methods = {
  'snowflake-optima-internals': { prune:'式向けの追加メタデータや索引も使って micro-partition を除外', stats:'micro-partition の通常統計と、対象となる式向けの追加メタデータ' },
  'databricks-dynamic-file-pruning': { prune:'JOIN の実行時キーとファイル統計から Delta ファイルを除外', stats:'Delta ログのファイル単位の列統計' },
  'snowflake-iceberg-vended-credentials': { credentials:'外部カタログが発行し、Snowflake が取得・更新して読み取る', files:'Snowflake が一時認証情報で外部 Iceberg データにアクセス' },
  'databricks-unity-vended-credentials': { credential:'Unity Catalog が発行し、外部エンジンが取得・更新する', files:'外部エンジンが一時認証情報で Unity Catalog 管理データにアクセス' },
  'snowflake-optimization-internals': { metadata:'micro-partition ごとの列統計で候補を絞る', partitions:'Snowflake 管理テーブルの micro-partition', operators:'Virtual Warehouse のクエリ演算', result:'永続化されたクエリ結果', whcache:'稼働中ウェアハウスのデータキャッシュ', cluster:'Automatic Clustering による再編成' },
  'databricks-optimization-internals': { log:'Delta ログのファイル統計で候補を絞る', files:'Delta テーブルの Parquet ファイル', operators:'Photon と対応しない演算の実行経路', result:'ローカルとサーバーレスのリモート結果キャッシュ', diskcache:'計算ノード上のディスクキャッシュ', maintenance:'Predictive Optimization と OPTIMIZE による再編成' },
  'kafka-streams': { changelog:'内部トピックの変更ログを再読し、ローカルの状態ストアを復元する。' },
  flink: { checkpoint:'成功したチェックポイントから演算子の状態と入力位置を復元する。' },
  'kafka-connect': { offsets:'コネクターのオフセットと購読グループのコミット位置' },
  airbyte: { state:'Destination が確認した State' },
  fivetran: { cursor:'増分同期の cursor' },
  debezium: { offset:'CDC のソースオフセット' },
  'postgresql-logical-decoding': { offset:'CDC のソースオフセット' },
  'apache-iceberg': { snapshot:'Iceberg Snapshot' },
  'delta-lake': { snapshot:'トランザクションログから構成する Snapshot' },
  'apache-hudi': { timeline:'Hudi Timeline' },
  'apache-paimon': { snapshots:'Paimon Snapshot' },
  'parquet-internals': { rowgroup:'Row Group' },
  'orc-internals': { stripes:'Stripe' },
  'avro-internals': { blocks:'Data Block' },
};

function realizations(model, ids) {
  return (model.implementations || []).flatMap(impl => Object.values(impl.nodes || {})
    .filter(node => [].concat(node.realizes || []).some(key => ids.includes(key))));
}

function comparisonDifference(pair, sides) {
  const strategies = pair.map((item, side) => sides[side].map(id => methods[item.id]?.[id]).filter(Boolean));
  if (strategies.every(s => s.length) && strategies[0].join() !== strategies[1].join()) return '実現方法の違い';
  if (sides[0].length !== sides[1].length) return '図での部品の分け方が異なる';
  const services = pair.map(({model}, i) => new Set([...sides[i].map(id => model.nodes[id]), ...realizations(model, sides[i])]
    .map(n => n.svc).filter(Boolean)));
  if (services.every(s => s.size) && ![...services[0]].some(s => services[1].has(s))) return '実装例のサービスが異なる';
  return '';
}

// Explanations are scoped to the configurations depicted in the repository.
const notes = {
  'kafka-connect': {offsets:'入力元の読み取り位置と、出力側の購読グループが次に読む位置を記録する。'},
  airbyte: {state:'Source が送った State までの書き込みを Destination が確認し、次回の同期に渡す。'},
  fivetran: {cursor:'初回同期の後は cursor に進捗を記録し、増分同期の境界にする。'},
  'amazon-eks': {managed:'図では EC2 の Managed Node Group に注文 API の Pod を配置する。'},
  'azure-aks': {user:'システム用とアプリ用にプールを分け、注文 API の Pod を User プールに置く。'},
  'google-gke': {user:'図では Standard のノードプールを分け、注文 API をアプリ用プールに置く。'},
};

export function compareRoles(pair) {
  const used = [new Set(), new Set()], groups = [];
  function collect(label, ids) {
    const sides = ids.map((list, side) => list.filter(id => pair[side].model.nodes[id] && !used[side].has(id)));
    if (sides.some(list => !list.length)) return;
    sides.forEach((list, side) => list.forEach(id => used[side].add(id)));
    groups.push({ label, sides, difference: comparisonDifference(pair, sides) });
  }
  for (const [role, mapping] of Object.entries(roles)) {
    collect(role, pair.map(({id}) => [].concat(mapping[id] || [])));
  }
  // Identical, unambiguous labels of the same kind can also identify a role.
  // A shared shape or a local ID on its own is insufficient.
  const byName = pair.map(({ model }, side) => {
    const map = new Map();
    for (const [id, n] of Object.entries(model.nodes)) {
      if (used[side].has(id) || !n.label) continue;
      const key = JSON.stringify([n.kind, n.label]);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(id);
    }
    return map;
  });
  for (const key of [...byName[0].keys()].sort()) {
    const a = byName[0].get(key), b = byName[1].get(key);
    if (a.length === 1 && b?.length === 1) collect(JSON.parse(key)[1], [a,b]);
  }
  const other = pair.map(({model}, side) => Object.keys(model.nodes).filter(id => !used[side].has(id)));
  return { groups, other };
}

export function mechanism({ id, model }, ids) {
  const labels = ids.map(key => model.nodes[key].label || key);
  const details = ids.map(key => notes[id]?.[key]).filter(Boolean);
  if (details.length) return details.join(' ');
  const method = ids.map(key => methods[id]?.[key]).filter(Boolean);
  if (method.length) return method.join('、');
  const examples = realizations(model, ids).map(n => n.label);
  if (examples.length) return '実装例：' + [...new Set(examples)].join('、');
  return ids.map(key => model.nodes[key].description).filter(Boolean).join(' ') || labels.join('、');
}
