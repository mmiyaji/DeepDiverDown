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

export function renderReferenceComparison(container, registry, currentId) {
  const entries = Object.keys(PRODUCTS).map(id => registry.find(entry => entry.id === id && entry.reference)).filter(Boolean);
  if (entries.length < 2) {
    container.textContent = '比較できるリファレンスが不足しています。';
    return;
  }

  container.innerHTML = `
    <div class="ref-compare-controls">
      <div class="ref-compare-selectors" role="group" aria-label="比較するプロダクト">
        <button type="button" class="b" data-side="0" aria-expanded="false" aria-controls="ref-compare-picker"><strong>左を変更</strong><span></span></button>
        <button type="button" class="b" data-side="1" aria-expanded="false" aria-controls="ref-compare-picker"><strong>右を変更</strong><span></span></button>
      </div>
      <div class="ref-compare-picker" id="ref-compare-picker" role="group" aria-labelledby="ref-compare-picker-title" hidden>
        <h3 id="ref-compare-picker-title"></h3><div class="ref-compare-options"></div>
      </div>
    </div>
    <div class="ref-compare-grid">
      <section><iframe></iframe><a target="_blank" rel="noopener">左のリファレンスを開く</a></section>
      <section><iframe></iframe><a target="_blank" rel="noopener">右のリファレンスを開く</a></section>
    </div>
    <h3>比較ポイント</h3>
    <p>各製品の図で採用した構成を、同じ観点で比較しています。</p>
    <table class="ref-compare-table"><thead></thead><tbody></tbody></table>`;

  const buttons = [...container.querySelectorAll('[data-side]')];
  const sections = [...container.querySelectorAll('.ref-compare-grid section')];
  const picker = container.querySelector('#ref-compare-picker');
  const options = picker.querySelector('.ref-compare-options');
  const initial = entries.find(entry => entry.id === currentId) || entries[0];
  const selected = [initial, entries.find(entry => entry.id !== initial.id)];
  let activeSide = null;

  function showPicker(side) {
    activeSide = side;
    buttons.forEach((button, index) => button.setAttribute('aria-expanded', side === index));
    picker.hidden = side === null;
    if (side === null) return;

    picker.querySelector('h3').textContent = side === 0 ? '左に表示するプロダクト' : '右に表示するプロダクト';
    options.replaceChildren();
    for (const entry of entries) {
      const option = document.createElement('button');
      const current = entry.id === selected[side].id;
      const used = entry.id === selected[1 - side].id;
      option.type = 'button';
      option.className = current ? 'b on' : 'b';
      option.disabled = used;
      option.setAttribute('aria-pressed', current);
      option.textContent = (entry.name || entry.id) + (used ? '（反対側に表示中）' : '');
      option.addEventListener('click', () => {
        selected[side] = entry;
        showPicker(null);
        update();
        buttons[side].focus();
      });
      options.append(option);
    }
    picker.scrollTop = 0;
  }

  function update() {
    const names = selected.map(entry => entry.name || entry.id);
    selected.forEach((entry, side) => {
      const name = names[side];
      buttons[side].querySelector('span').textContent = name;
      const section = sections[side];
      const iframe = section.querySelector('iframe');
      const url = new URL(location.pathname, location.origin);
      url.hash = `/m/${encodeURIComponent(entry.id)}/struct?d=2`;
      section.querySelector('a').href = url.href;
      url.searchParams.set('preview', 'reference');
      iframe.title = `${name}の構成図`;
      if (iframe.src !== url.href) iframe.src = url.href;
    });
    const head = container.querySelector('thead');
    const body = container.querySelector('tbody');
    head.replaceChildren();
    body.replaceChildren();
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

  buttons.forEach((button, side) => button.addEventListener('click', () => showPicker(activeSide === side ? null : side)));
  update();
}
