import { compareRoles, mechanism } from './comparison-roles.js?v=performance-compare1';

const AXES = ['制御プレーン', '実行単位と配置', '運用で比較する点'];
const EXPLANATIONS = [
  { ids: ['autosar-classic', 'autosar-adaptive'], summary: 'どちらも車載ソフトウェアの標準ですが、Classic はマイクロコントローラー向けの層、Adaptive は高性能 ECU のサービスとアプリを扱います。', points: ['Classic の図は Application SWC、RTE、BSW と ECU の接続を示します。', 'Adaptive の図は ARA と通信・実行・永続化の機能を示します。'] },
  { ids: ['edge-k3s', 'kubeedge'], summary: 'どちらもエッジでワークロードを動かす構成ですが、管理側と端末側の結び方が異なります。', points: ['K3s の例は Server と Agent からなる自主管理クラスタです。', 'KubeEdge の例は Kubernetes 管理側の CloudCore と端末側の EdgeCore を接続します。'] },
  { ids: ['automotive-grade-linux', 'android-automotive'], summary: 'どちらも車載アプリを動かす基盤です。図は AGL の Linux 層と、Android Automotive の車両 API・VHAL を中心に示します。', points: ['AGL の例は HMI、フレームワーク、サービスと Linux の層を示します。', 'Android Automotive の例は Car Service、VHAL と模擬車両実装へのアクセスを示します。'] },
  {
    ids: ['slack-real-time-messaging', 'kafka'],
    summary: 'どちらもイベントを送信元から複数の受信先へ届けます。Slack の記事は接続中のクライアントへの配信、Kafka の図はログと購読位置を扱います。',
    points: ['Slack の例では Channel Server から購読中の Gateway へ配信し、各 Gateway が WebSocket 接続へ転送します。', 'Kafka の例ではイベントをログに保存し、Consumer が購読位置に基づいて読み取ります。'],
  },
  {
    ids: ['monitoring-datadog', 'monitoring-newrelic'],
    summary: 'どちらもアプリやホストの情報を収集し、SaaS で調査と通知を行います。図では収集部品とサービス側の境界を比較できます。',
    points: ['Datadog の例ではホストの Agent がインフラ情報やログを収集し、APM Agent がトレースを受け取ります。', 'New Relic の例ではアプリ内 APM Agent とホストの Infrastructure Agent を使い、NRDB と NRQL で対象データを分析します。'],
  },
  {
    ids: ['kafka-streams', 'flink'],
    summary: 'どちらも状態を持つストリーム処理を扱います。図では Kafka Streams の変更ログと、Flink のチェックポイントを使った復旧を比較できます。',
    points: ['Kafka Streams はアプリケーション内の処理トポロジーとローカル状態ストアを使います。', 'Flink の例はイベント時刻とウォーターマークでウィンドウを進め、状態と入力位置をチェックポイントから復元します。'],
  },
  {
    ids: ['kafka-connect', 'airbyte'],
    summary: 'どちらも外部データを取り込み、進捗を使って処理を再開します。図ではデータの受け渡し先と再開位置の扱いを比較できます。',
    points: ['Kafka Connect の例は変更イベントをログへ発行し、出力側が購読します。', 'Airbyte の例は Source と Destination の同期で、書き込みが確認された State を次の同期に渡します。'],
  },
  {
    ids: ['amazon-eks', 'azure-aks'],
    summary: 'どちらも管理された Kubernetes の制御プレーンとノード群でアプリケーションを実行します。図ではノード群の分け方とサービスの担い手を比較できます。',
    points: ['EKS の図では Managed Node Group の EC2 にアプリケーションを配置します。', 'AKS の図では System と User のノードプールを分け、アプリケーションを User プールに配置します。'],
  },
];
const PRODUCTS = {
  'amazon-eks': [
    'AWS が Kubernetes の制御プレーンを運用する。',
    'Pod を配置する。図の Managed Node Group は利用者の AWS アカウント内の EC2 を使う。',
    'ノードグループのサブネット・容量・更新条件を決める。Fargate や Auto Mode では運用分担が変わる。',
  ],
  'azure-aks': [
    'Azure が Kubernetes の制御プレーンを運用する。',
    'Pod を配置する。System と User は AKS のノードプールモードで、基盤用とアプリ用の配置を分けられる。',
    'ノードプールごとに VM・スケール設定・更新方針を決める。アプリを System プールから分離するには配置条件も確認する。',
  ],
  'google-gke': [
    'Google Cloud が Kubernetes の制御プレーンを運用する。',
    'Pod を配置する。図は Standard のノードプールを使う。Autopilot では GKE がノードのプロビジョニングを担う。',
    'Standard でノード構成を選ぶか、Autopilot でノード管理を委ねるかを決める。',
  ],
  kubernetes: [
    'API サーバー、etcd、コントローラー、スケジューラーがクラスタ状態を管理する。',
    'Deployment が希望状態を宣言し、スケジューラーと kubelet が Pod の配置と起動を担う。',
    '図の基本構成では、制御プレーン、ノード、ネットワークなどの運用方法を決める。',
  ],
  openshift: [
    'Kubernetes を基に、OpenShift が認証や Route などのプラットフォーム機能を組み合わせる。',
    'Deployment と Pod を使う。Route で Service を外部に公開できる。',
    'Kubernetes の配置条件に加え、Route、Ingress Controller、DNS の構成を確認する。',
  ],
  k3s: [
    'K3s Server が Kubernetes の制御プレーンを実行する。図は単一 Server 構成で、組み込み SQLite はその構成で使えるデータストアの一例。',
    'Kubernetes の Pod を配置し、対象ノードの kubelet が起動する。',
    '単一 Server の停止に備える要件がある場合は、データストアと Server の HA 構成を検討する。',
  ],
  rke2: [
    'RKE2 Server が Kubernetes の制御プレーンを実行し、図の構成では etcd を使う。',
    'Agent が固定登録アドレス経由で参加し、選ばれたノードの kubelet が Pod を起動する。',
    '固定登録アドレス、Server の可用性、etcd の定足数を設計する。',
  ],
  'amazon-ecs': [
    'AWS が ECS のスケジューラーと制御プレーンを運用する。',
    'Service が Task Definition に沿った Task の希望数を維持する。Task は Fargate や EC2 上で実行できる。',
    '実行容量を Fargate に委ねるか、EC2 の容量や配置を管理するかを決める。',
  ],
  nomad: [
    'Nomad Server がクラスタ状態を保持し、評価とスケジューリングを行う。',
    'Job の Task Group を Allocation として Client に割り当てる。タスクの再起動と再配置は別のポリシー。',
    'Client の容量、ドライバー、再起動と再配置のポリシーを確認する。',
  ],
  'docker-swarm': [
    'Swarm Manager が Raft でクラスタ状態を管理し、タスクを配置する。',
    'Service の希望状態に合わせ、Task を Worker へ配置する。停止した Task は必要に応じて置き換える。',
    'Manager の定足数と Worker の配置条件を確認する。公開ポートは routing mesh などの方式を選ぶ。',
  ],
};

const GROUPS = [
  ['自動運転とシミュレーション', ['autoware-autonomous-driving', 'carla-simulation', 'ros2-dds-communication']],
  ['車載 OS とプラットフォーム', ['autosar-classic', 'autosar-adaptive', 'automotive-grade-linux', 'android-automotive', 'kuksa-vss']],
  ['エッジの実行と管理', ['edge-k3s', 'k3s', 'kubeedge', 'aws-iot-greengrass', 'eclipse-hawkbit']],
  ['イベントの配信と接続管理', ['slack-real-time-messaging', 'kafka', 'kafka-connect', 'trend-agentic-streaming']],
  ['Iceberg v3 の内部構造', ['iceberg-v3-variant', 'iceberg-v3-metadata', 'apache-iceberg', 'iceberg-catalog-read', 'parquet-internals']],
  ['エージェントの記憶と知識グラフ', ['graphiti', 'hindsight', 'hydradb', 'trend-graphrag', 'semantic-ontology']],
  ['検索とデータアクセス', ['qdrant', 'databricks-ai-search', 'mcp-toolbox', 'mcp-data-agent']],
  ['リアルタイム分析', ['risingwave', 'flink', 'kafka-streams', 'trend-agentic-streaming']],
  ['AI とシステムの監視', ['langfuse', 'monitoring-datadog', 'monitoring-newrelic', 'opentelemetry']],
  ['オブジェクトストレージ', ['rustfs', 'hydradb', 'data-lakehouse']],
  ['ファイル形式と圧縮', ['file-compression', 'file-formats', 'parquet-internals', 'orc-internals', 'avro-internals']],
  ['スポット容量と Kubernetes', ['cloud-spot-capacity', 'spot-ocean', 'amazon-eks', 'azure-aks', 'google-gke', 'kubernetes']],
  ['監視とオブザーバビリティ', ['monitoring-datadog', 'monitoring-newrelic', 'monitoring-prometheus', 'opentelemetry']],
  ['知識グラフと生成 AI', ['trend-graphrag', 'semantic-ontology', 'databricks-ai-search', 'analytics-agent']],
  ['データプロダクトと管理', ['trend-data-product', 'google-cloud-knowledge-catalog', 'data-catalog-architecture', 'datahub']],
  ['イベントとエージェント', ['trend-agentic-streaming', 'agent-approval', 'kafka', 'kafka-streams']],
  ['セマンティックと知識グラフ', ['semantic-ontology', 'semantic-virtual-graph', 'semantic-shacl', 'dbt-metricflow', 'data-catalog-architecture']],
  ['データの提供とプライバシー', ['dwh-synthetic-data', 'dwh-differential-privacy', 'data-clean-room']],
  ['コンテナの配置と復旧', Object.keys(PRODUCTS)],
  ['外部データの取り込みと再開', ['kafka-connect', 'debezium', 'airbyte', 'fivetran', 'postgresql-logical-decoding']],
  ['イベントログと購読位置', ['kafka', 'kafka-connect', 'kafka-streams', 'postgresql-logical-decoding']],
  ['分析エージェントの構成とツール', ['analytics-agent', 'mcp-data-agent', 'cortex-data-agent', 'databricks-ai-search', 'agent-approval']],
  ['分析指標の定義', ['dbt-metricflow', 'dbt', 'dwh-aggregate-tables', 'analytics-agent']],
  ['機械学習の特徴量と推論', ['feast-feature-store', 'databricks-mlflow-serving']],
  ['ストリームの処理と状態管理', ['flink', 'kafka-streams', 'spark-structured-streaming', 'spark-streaming', 'google-cloud-dataflow']],
  ['分析クエリの実行', ['spark', 'trino', 'clickhouse', 'duckdb']],
  ['テーブルの更新と履歴管理', ['apache-iceberg', 'delta-lake', 'apache-hudi', 'apache-paimon']],
  ['分析基盤のストレージと計算', ['snowflake', 'databricks', 'bigquery', 'redshift', 'microsoft-fabric']],
  ['データパイプラインの構築と実行', ['aws-glue', 'azure-data-factory', 'google-cloud-dataflow', 'databricks-lakeflow', 'apache-airflow']],
  ['取り込み後の変換と更新', ['etl-elt', 'dbt', 'snowflake-ingestion-cdc', 'databricks-lakeflow']],
  ['クエリ性能の診断', ['snowflake-query-performance', 'databricks-sql-performance']],
  ['クラスタリングと条件に応じた読み飛ばし', ['snowflake-optima-internals', 'databricks-liquid-clustering-internals']],
  ['カタログが発行する一時認証情報', ['snowflake-iceberg-vended-credentials', 'databricks-unity-vended-credentials']],
  ['組織間のデータ共有', ['snowflake-secure-sharing', 'databricks-open-sharing', 'data-clean-room']],
  ['データ資産の発見と管理', ['data-catalog-architecture', 'datahub', 'openmetadata', 'amazon-datazone', 'microsoft-purview', 'fabric-onelake-catalog', 'google-cloud-knowledge-catalog', 'snowflake-horizon-catalog', 'databricks-unity-catalog']],
  ['データリネージの収集と利用', ['openlineage', 'datahub', 'openmetadata']],
  ['テーブルカタログとメタデータの解決', ['iceberg-rest-catalog', 'apache-polaris', 'project-nessie', 'iceberg-catalog-read']],
  ['ファイルの符号化と読み取り', ['file-formats', 'parquet-internals', 'orc-internals', 'avro-internals']],
  ['Avro の書き込みスキーマを特定する方法', ['avro-internals', 'apicurio-registry']],
  ['DWH のモデリングと集計', ['dwh-design-patterns', 'dwh-star-schema', 'dwh-snowflake-schema', 'dwh-fact-table-types', 'dwh-kimball-bus', 'dwh-inmon-cif', 'dwh-data-vault', 'dwh-wide-table', 'dwh-aggregate-tables', 'dwh-slowly-changing-dimensions']],
  ['レイク上のデータ構成', ['medallion', 'data-lakehouse']],
  ['配置とスキャン範囲', ['partitioning-sharding', 'sorting-pruning', 'iceberg-distributed-scan']],
  ['シャッフルを伴う分散実行', ['spark', 'shuffle-skew']],
  ['ファイルの統合と読み取りコスト', ['compaction', 'lsm-compaction', 'apache-hudi', 'apache-paimon']],
  ['変更履歴からの復元', ['snowflake-time-travel', 'delta-lake', 'apache-iceberg']],
  ['ジョブの実行と再試行', ['apache-airflow', 'temporal']],
  ['配備と変更の反映', ['cicd', 'argo-cd']],
  ['注文 API の通信をどこで観測するか', ['opentelemetry', 'cilium-hubble']],
  ['ポリシーを検証・適用する場所', ['opa-conftest', 'cilium-hubble']],
  ['Raft のリーダーと定足数', ['etcd-raft', 'docker-swarm']],
  ['注文アプリケーションの構成', ['ec-shop', 'online-boutique', 'aws-web']],
  ['サービスのネットワーク境界', ['aws-web', 'hybrid']],
];

export function comparisonCandidates(registry, currentId) {
  const result = new Map();
  const byId = new Map(registry.map(entry => [entry.id, entry]));
  if (!byId.has(currentId)) return [];
  function add(id, topic) {
    if (id === currentId || !byId.has(id)) return;
    if (!result.has(id)) result.set(id, { entry: byId.get(id), topics: [] });
    result.get(id).topics.push(topic);
  }
  for (const [topic, ids] of GROUPS) {
    if (ids.includes(currentId)) ids.forEach(id => add(id, topic));
  }
  add(byId.get(currentId).reference?.detailOf, '全体構成との対応');
  for (const entry of registry) {
    if (entry.reference?.detailOf === currentId) add(entry.id, '詳細構成との対応');
  }
  return [...result.values()];
}

export function renderReferenceComparison(container, current, candidates, loadModel) {
  let target, reversed = false, dimension = '2';
  function showList(restoreId) {
    container.innerHTML = '<h3 class="ref-origin"></h3><p>比較する対象を選んでください。</p><div class="ref-compare-options"></div>';
    container.querySelector('.ref-origin').textContent = current.name;
    const options = container.querySelector('.ref-compare-options');
    for (const { entry, topics } of candidates) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'b ref-candidate';
      const name = document.createElement('strong'), reason = document.createElement('small');
      name.textContent = entry.name;
      reason.textContent = topics.join(' ／ ');
      button.append(name, reason);
      button.addEventListener('click', () => {
        target = entry; reversed = false;
        showPair(topics);
      });
      options.append(button);
      if (entry.id === restoreId) button.focus();
    }
  }

  function showPair(topics) {
    container.innerHTML = `
      <div class="ref-compare-controls">
        <button type="button" class="b" data-list>← 対象を選び直す</button>
        <button type="button" class="b" data-swap>⇄ 左右を入れ替え</button>
        <div class="seg ref-dim" role="group" aria-label="図の表示"><button type="button" data-dim="2">2D</button><button type="button" data-dim="3">3D</button></div>
      </div>
      <h3 class="ref-topic"></h3>
      <section class="ref-assistance" aria-label="比較の解説"><h3>比較の解説</h3><p role="status">解説を読み込み中…</p></section>
      <div class="ref-role-picker" role="group" aria-label="図で照合する役割"><p role="status">部品の対応を読み込み中…</p></div>
      <div class="ref-compare-grid">
        <section><h4></h4><div class="ref-mechanism" aria-live="polite"></div><iframe></iframe><a target="_blank" rel="noopener">構成図を開く ↗</a></section>
        <section><h4></h4><div class="ref-mechanism" aria-live="polite"></div><iframe></iframe><a target="_blank" rel="noopener">構成図を開く ↗</a></section>
      </div>
      <table class="ref-compare-table" aria-label="比較ポイント"><thead></thead><tbody></tbody></table>`;
    container.querySelector('.ref-topic').textContent = topics.join(' ／ ');
    const back = container.querySelector('[data-list]');
    back.onclick = () => showList(target.id);
    back.focus();
    const table = container.querySelector('table');
    const picker = container.querySelector('.ref-role-picker');
    const frames = [...container.querySelectorAll('.ref-compare-grid iframe')];
    const base = [current, target];
    const loaded = Promise.allSettled(base.map(loadModel));
    const assistance = container.querySelector('.ref-assistance');
    let pairModels, comparison, selected = 0;
    function markFrame(frame, side) {
      const parts = new Map();
      comparison.groups.forEach((group, index) => {
        group.sides[side].forEach(id => parts.set(id, [index + 1, group.label, group.difference]));
      });
      comparison.other[side].forEach(id => parts.set(id, [0, '対応未確認']));
      frame.dataset.comparison = JSON.stringify({ model: base[side].id, active: selected + 1, parts: [...parts] });
      frame.contentWindow?.dispatchEvent(new Event('comparison-change'));
    }
    function showRole() {
      if (!comparison) return;
      picker.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.value) === selected)));
      frames.forEach((frame, position) => {
        const side = reversed ? 1 - position : position;
        const group = comparison.groups[selected];
        const ids = group ? group.sides[side] : comparison.other[side];
        const info = frame.previousElementSibling, item = pairModels[side];
        const title = document.createElement('strong');
        title.textContent = (group ? (selected + 1) + '　' : '◇　') +
          (ids.map(id => item.model.nodes[id].label || id).join('、') || '該当する部品なし');
        info.replaceChildren(title);
        if (group) {
          const text = document.createElement('p');
          text.textContent = mechanism(item, ids);
          if (group.difference) {
            const reason = document.createElement('small');
            reason.textContent = '△ ' + group.difference;
            info.prepend(reason);
          }
          if (text.textContent !== ids.map(id => item.model.nodes[id].label || id).join('、')) info.append(text);
        }
        markFrame(frame, side);
      });
    }
    loaded.then(results => {
      if (!container.contains(picker)) return;
      if (results.some(r => r.status !== 'fulfilled')) {
        picker.textContent = 'モデルを読み込めず、部品の対応を表示できませんでした。';
        return;
      }
      pairModels = results.map((result, i) => ({ id: base[i].id, model: result.value }));
      comparison = compareRoles(pairModels);
      const explanation = EXPLANATIONS.find(item => item.ids.every(id => base.some(entry => entry.id === id)));
      const title = document.createElement('h3');
      title.textContent = '比較の解説';
      const note = document.createElement('p');
      note.className = 'sub';
      note.textContent = explanation ? '事前に用意した解説です。構成図に示した例を説明しています。' : 'モデルに記載された役割と実装例から組み立てた解説です。';
      assistance.replaceChildren(title, note);
      if (explanation) {
        const summary = document.createElement('p');
        summary.textContent = explanation.summary;
        const list = document.createElement('ul');
        explanation.points.forEach(point => { const item = document.createElement('li'); item.textContent = point; list.append(item); });
        assistance.append(summary, list);
        const sources = document.createElement('p');
        sources.className = 'sub';
        sources.append('参照資料　');
        base.forEach((entry, index) => {
          if (index) sources.append(' / ');
          const link = document.createElement('a');
          link.href = 'docs/reference-' + encodeURIComponent(entry.id) + '.md';
          link.target = '_blank'; link.rel = 'noopener';
          link.textContent = entry.name;
          sources.append(link);
        });
        assistance.append(sources);
      } else {
        const summary = document.createElement('p');
        summary.textContent = '比較の観点は「' + topics.join('」「') + '」です。';
        assistance.append(summary);
        const list = document.createElement('ul');
        const groups = comparison.groups.filter(group => group.difference).slice(0, 3);
        for (const group of groups) {
          const item = document.createElement('li');
          item.textContent = group.label + 'について、' + base.map((entry, side) =>
            entry.name + 'では' + mechanism(pairModels[side], group.sides[side])).join(' / ');
          list.append(item);
        }
        if (list.children.length) assistance.append(list);
        else {
          const item = document.createElement('p');
          item.textContent = comparison.groups.length
            ? '共通する役割として、' + comparison.groups.map(group => group.label).join('、') + 'を図で照合できます。'
            : 'モデルから対応を確認できる部品はありません。各図の構成とシナリオを確認してください。';
          assistance.append(item);
        }
        const sources = document.createElement('p');
        sources.className = 'sub';
        sources.append('モデルの資料　');
        pairModels.forEach((item, index) => {
          if (index) sources.append(' / ');
          const source = item.model.sources?.find(path => /^docs\/[a-z0-9-]+\.md$/.test(path));
          if (!source) { sources.append(base[index].name + '（資料未指定）'); return; }
          const link = document.createElement('a');
          link.href = source; link.target = '_blank'; link.rel = 'noopener'; link.textContent = base[index].name;
          sources.append(link);
        });
        assistance.append(sources);
      }
      const hint = document.createElement('p');
      hint.textContent = comparison.groups.length ? '同じ番号は共通の役割、△ は実現方法や構成の違いを示します。役割を選ぶと両方の図で強調します。'
        : 'この2つの図では、対応を確認できた共通の役割がありません。';
      picker.replaceChildren(hint);
      function button(value, label) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'b small'; b.value = String(value); b.textContent = label;
        b.onclick = () => { selected = value; showRole(); };
        picker.append(b);
      }
      comparison.groups.forEach((group, i) => button(i, (i + 1) + '　' + group.label + (group.difference ? ' △' : '')));
      if (comparison.other.some(ids => ids.length)) button(-1, '◇ 対応未確認');
      selected = comparison.groups.length ? Math.max(0, comparison.groups.findIndex(g => g.difference)) : -1;
      showRole();
    });
    let tableVersion = 0;
    const entries = () => reversed ? [target, current] : [current, target];
    function drawDiagrams() {
      container.querySelectorAll('[data-dim]').forEach(b => {
        const on = b.dataset.dim === dimension;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
      });
      container.querySelectorAll('.ref-compare-grid section').forEach((section, side) => {
        const entry = entries()[side], iframe = section.querySelector('iframe');
        section.querySelector('h4').textContent = entry.name;
        iframe.title = entry.name + 'の構成図';
        const url = new URL(location.pathname, location.origin);
        url.hash = '/m/' + encodeURIComponent(entry.id) + '/struct?d=' + dimension;
        section.querySelector('a').href = url.href;
        url.searchParams.set('preview', 'reference');
        url.searchParams.set('model', entry.id);
        url.searchParams.set('dim', dimension);
        url.hash += '&w=cloud';
        if (iframe.src !== url.href) iframe.src = url.href;
      });
    }
    async function drawTable() {
      const version = ++tableVersion, pair = entries();
      const body = table.tBodies[0];
      table.tHead.replaceChildren(); body.replaceChildren();
      function row(parent, values) {
        const tr = parent.insertRow();
        values.forEach((value, i) => {
          const heading = parent === table.tHead;
          const cell = document.createElement(heading || i === 0 ? 'th' : 'td');
          if (heading || i === 0) cell.scope = heading ? 'col' : 'row';
          cell.textContent = value;
          tr.append(cell);
        });
      }
      row(table.tHead, ['比較の観点', ...pair.map(e => e.name)]);
      if (pair.every(e => Object.hasOwn(PRODUCTS, e.id))) {
        AXES.forEach((axis, i) => row(body, [axis, ...pair.map(e => PRODUCTS[e.id][i])]));
        return;
      }
      body.insertRow().insertCell().textContent = '比較内容を読み込み中…';
      const loadedModels = await loaded;
      const results = reversed ? [...loadedModels].reverse() : loadedModels;
      if (!container.contains(table) || version !== tableVersion) return;
      body.replaceChildren();
      const fields = [
        ['図の対象', m => m.description],
        ['構成要素', m => Object.values(m.nodes).map(n => n.label).join('、')],
        ['処理シナリオ', m => m.scenarios?.map(s => s.label).join(' ／ ')],
        ['設計上の着目点', m => m.reference?.objectives?.join(' ／ ')],
        ['実装例', m => m.implementations?.map(s => s.label).join(' ／ ')],
      ];
      for (const [label, read] of fields) {
        const values = results.map(r => r.status === 'fulfilled' ? read(r.value) : '読み込み失敗');
        if (values.some(Boolean)) row(body, [label, ...values.map(v => v || '記載なし')]);
      }
    }
    container.querySelector('[data-swap]').onclick = () => { reversed = !reversed; drawDiagrams(); showRole(); drawTable(); };
    container.querySelectorAll('[data-dim]').forEach(b => {
      b.onclick = () => { dimension = b.dataset.dim; drawDiagrams(); };
    });
    drawDiagrams(); drawTable();
  }
  showList();
}
