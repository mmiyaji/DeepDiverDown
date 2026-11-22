const AXES = ['制御プレーン', '実行単位と配置', '運用で比較する点'];
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

/* プロダクト比較：左右をドロップダウンで選び、入れ替え・2D/3D・観点表で比べる */
export function renderReferenceComparison(container, registry, currentId) {
  const entries = Object.keys(PRODUCTS).map(id => registry.find(entry => entry.id === id && entry.reference)).filter(Boolean);
  if (entries.length < 2) {
    container.textContent = '比較できるリファレンスが不足しています。';
    return;
  }
  const initial = entries.find(entry => entry.id === currentId) || entries[0];
  const selected = [initial, entries.find(entry => entry.id !== initial.id)];
  let dimension = '2';

  container.innerHTML = `
    <div class="ref-compare-controls">
      <label class="ref-pick">左 <select data-side="0" aria-label="左に表示するプロダクト"></select></label>
      <button type="button" class="b" data-swap title="左右を入れ替える">⇄ 入れ替え</button>
      <label class="ref-pick">右 <select data-side="1" aria-label="右に表示するプロダクト"></select></label>
      <div class="seg ref-dim" role="group" aria-label="表示"><button type="button" data-dim="2" class="on" aria-pressed="true">2D</button><button type="button" data-dim="3" aria-pressed="false">3D</button></div>
    </div>
    <div class="ref-compare-grid">
      <section><iframe></iframe><a target="_blank" rel="noopener">左のリファレンスを開く ↗</a></section>
      <section><iframe></iframe><a target="_blank" rel="noopener">右のリファレンスを開く ↗</a></section>
    </div>
    <h3>比較ポイント</h3>
    <p class="sub">各製品の図で採用した構成を、同じ観点で並べています。行にカーソルを当てると強調します。</p>
    <table class="ref-compare-table"><thead></thead><tbody></tbody></table>`;

  const selects = [...container.querySelectorAll('select[data-side]')];
  const sections = [...container.querySelectorAll('.ref-compare-grid section')];

  function fillOptions() {
    selects.forEach((sel, side) => {
      sel.replaceChildren(...entries.map(entry => {
        const o = document.createElement('option');
        o.value = entry.id; o.textContent = entry.name || entry.id;
        o.disabled = entry.id === selected[1 - side].id; // 反対側と同じものは選べない
        o.selected = entry.id === selected[side].id;
        return o;
      }));
    });
  }

  function update() {
    fillOptions();
    const names = selected.map(entry => entry.name || entry.id);
    selected.forEach((entry, side) => {
      const section = sections[side], iframe = section.querySelector('iframe');
      const url = new URL(location.pathname, location.origin);
      url.hash = `/m/${encodeURIComponent(entry.id)}/struct?d=${dimension}`;
      section.querySelector('a').href = url.href;
      url.searchParams.set('preview', 'reference');
      url.searchParams.set('dim', dimension); // ハッシュだけの変更では再読込されないため、クエリにも入れる
      iframe.title = `${names[side]}の構成図`;
      if (iframe.src !== url.href) iframe.src = url.href;
    });
    const head = container.querySelector('thead'), body = container.querySelector('tbody');
    head.replaceChildren(); body.replaceChildren();
    const addRow = (parent, texts, heading) => {
      const row = parent.insertRow();
      texts.forEach((value, index) => {
        const cell = document.createElement(heading || index === 0 ? 'th' : 'td');
        if (cell.tagName === 'TH') cell.scope = heading ? 'col' : 'row';
        cell.textContent = value;
        row.append(cell);
      });
    };
    addRow(head, ['観点', ...names], true);
    AXES.forEach((axis, index) => addRow(body, [axis, ...selected.map(entry => PRODUCTS[entry.id][index])], false));
  }

  selects.forEach((sel, side) => sel.addEventListener('change', () => {
    selected[side] = entries.find(entry => entry.id === sel.value);
    update();
  }));
  container.querySelector('[data-swap]').addEventListener('click', () => { selected.reverse(); update(); });
  container.querySelectorAll('[data-dim]').forEach(button => button.addEventListener('click', () => {
    dimension = button.dataset.dim;
    container.querySelectorAll('[data-dim]').forEach(b => { b.classList.toggle('on', b === button); b.setAttribute('aria-pressed', b === button); });
    update();
  }));
  update();
}
