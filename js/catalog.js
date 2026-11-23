/* サービスカタログ（マルチクラウド・オンプレミス）
 *   node.svc に "<provider>:<service>" で指定する（例 gcp:gke / azure:aks / oci:adb / cloudflare:waf / onprem:fw / k8s:deployment）
 *   provider を省いた "ecs" などは AWS とみなす（従来のモデルとの互換）
 * 各サービス：abbr（略称）、name、cat（カテゴリ色）、shape（cyl / queue。省略は箱）、infra（論理構成で隠す基盤部品）、icon（公式アイコンを探すキーワード）
 * 公式アイコンは同梱しない。icons/ に各社の配布物を置き、npm run icons で対応表（icons/manifest.json）を作る */
(function () {
  const CAT = { compute: '#ED7100', db: '#C925D1', net: '#8C4FFF', storage: '#7AA116', int: '#E7157B', sec: '#DD344C', mgmt: '#2E73B8', devtools: '#3B48CC', ext: '#6d6a63' };
  const PROVIDERS = {
    aws: { label: 'AWS', color: '#FF9900' },
    gcp: { label: 'Google Cloud', color: '#4285F4' },
    azure: { label: 'Microsoft Azure', color: '#0078D4' },
    oci: { label: 'Oracle Cloud', color: '#C74634' },
    cloudflare: { label: 'Cloudflare', color: '#F38020' },
    onprem: { label: 'オンプレミス', color: '#6d6a63' },
    k8s: { label: 'Kubernetes', color: '#326CE5' },
  };
  const S = (abbr, name, cat, more = {}) => ({ abbr, name, cat, ...more });
  const I = true; // infra
  const SERVICES = {
    aws: {
      route53: S('R53', 'Route 53', 'net', { infra: I, icon: ['Route-53'] }),
      cloudfront: S('CF', 'CloudFront', 'net', { infra: I, icon: ['CloudFront'] }),
      waf: S('WAF', 'AWS WAF', 'sec', { infra: I, icon: ['WAF'] }),
      alb: S('ALB', 'Application LB', 'net', { infra: I, icon: ['Elastic-Load-Balancing', 'Application-Load-Balancer'] }),
      nat: S('NAT', 'NAT Gateway', 'net', { infra: I, icon: ['NAT-Gateway'] }),
      apigw: S('APIGW', 'API Gateway', 'int', { infra: I, icon: ['API-Gateway'] }),
      ecs: S('ECS', 'ECS Fargate', 'compute', { icon: ['Elastic-Container-Service', 'Fargate'] }),
      eks: S('EKS', 'EKS', 'compute', { icon: ['Elastic-Kubernetes-Service'] }),
      ec2: S('EC2', 'EC2', 'compute', { icon: ['Arch_Amazon-EC2_'] }),
      lambda: S('λ', 'Lambda', 'compute', { icon: ['Arch_AWS-Lambda_'] }),
      aurora: S('Aurora', 'Aurora', 'db', { shape: 'cyl', icon: ['Aurora'] }),
      rds: S('RDS', 'RDS', 'db', { shape: 'cyl', icon: ['Arch_Amazon-RDS_'] }),
      dynamodb: S('DDB', 'DynamoDB', 'db', { shape: 'cyl', icon: ['DynamoDB'] }),
      elasticache: S('Redis', 'ElastiCache', 'db', { shape: 'cyl', icon: ['ElastiCache'] }),
      s3: S('S3', 'S3', 'storage', { shape: 'cyl', icon: ['Simple-Storage-Service'] }),
      glue: S('Glue', 'AWS Glue', 'int', { icon: ['Arch_AWS-Glue_'] }),
      athena: S('Athena', 'Amazon Athena', 'db', { icon: ['Arch_Amazon-Athena_'] }),
      sqs: S('SQS', 'SQS', 'int', { shape: 'queue', icon: ['Simple-Queue-Service'] }),
      msk: S('MSK', 'Amazon MSK', 'int', { shape: 'queue', icon: ['Managed-Streaming-for-Apache-Kafka'] }),
      mskconnect: S('MSKC', 'MSK Connect', 'int', { icon: ['Managed-Streaming-for-Apache-Kafka'] }),
      sns: S('SNS', 'SNS', 'int', { icon: ['Simple-Notification-Service'] }),
      eventbridge: S('EB', 'EventBridge', 'int', { icon: ['EventBridge'] }),
      stepfunctions: S('SFN', 'Step Functions', 'int', { icon: ['Step-Functions'] }),
      cognito: S('Cog', 'Cognito', 'sec', { icon: ['Cognito'] }),
      secrets: S('SM', 'Secrets Manager', 'sec', { infra: I, icon: ['Secrets-Manager'] }),
      cloudwatch: S('CW', 'CloudWatch', 'mgmt', { infra: I, icon: ['Arch_Amazon-CloudWatch_'] }),
      ecr: S('ECR', 'ECR', 'compute', { shape: 'cyl', icon: ['Elastic-Container-Registry'] }),
      codebuild: S('CB', 'CodeBuild', 'devtools', { icon: ['CodeBuild'] }),
      codedeploy: S('CD', 'CodeDeploy', 'devtools', { icon: ['CodeDeploy'] }),
      codepipeline: S('CP', 'CodePipeline', 'devtools', { icon: ['CodePipeline'] }),
      directconnect: S('DX', 'Direct Connect', 'net', { infra: I, icon: ['Direct-Connect'] }),
      approval: S('承認', '手動承認', 'mgmt'),
      github: S('GH', 'GitHub', 'ext'),
    },
    gcp: {
      gke: S('GKE', 'Google Kubernetes Engine', 'compute', { icon: ['google_kubernetes_engine', 'GKE'] }),
      cloudrun: S('Run', 'Cloud Run', 'compute', { icon: ['cloud_run'] }),
      gce: S('GCE', 'Compute Engine', 'compute', { icon: ['compute_engine'] }),
      functions: S('Fn', 'Cloud Functions', 'compute', { icon: ['cloud_functions'] }),
      clb: S('LB', 'Cloud Load Balancing', 'net', { infra: I, icon: ['cloud_load_balancing'] }),
      cdn: S('CDN', 'Cloud CDN', 'net', { infra: I, icon: ['cloud_cdn'] }),
      armor: S('Armor', 'Cloud Armor', 'sec', { infra: I, icon: ['cloud_armor'] }),
      dns: S('DNS', 'Cloud DNS', 'net', { infra: I, icon: ['cloud_dns'] }),
      nat: S('NAT', 'Cloud NAT', 'net', { infra: I, icon: ['cloud_nat'] }),
      cloudsql: S('SQL', 'Cloud SQL', 'db', { shape: 'cyl', icon: ['cloud_sql'] }),
      spanner: S('Spanner', 'Cloud Spanner', 'db', { shape: 'cyl', icon: ['cloud_spanner', 'spanner'] }),
      firestore: S('FS', 'Firestore', 'db', { shape: 'cyl', icon: ['firestore'] }),
      memorystore: S('Redis', 'Memorystore', 'db', { shape: 'cyl', icon: ['memorystore'] }),
      gcs: S('GCS', 'Cloud Storage', 'storage', { shape: 'cyl', icon: ['cloud_storage'] }),
      pubsub: S('Pub/Sub', 'Pub/Sub', 'int', { shape: 'queue', icon: ['pubsub'] }),
      bigquery: S('BQ', 'BigQuery', 'db', { shape: 'cyl', icon: ['bigquery'] }),
      secretmanager: S('SM', 'Secret Manager', 'sec', { infra: I, icon: ['secret_manager'] }),
      artifact: S('AR', 'Artifact Registry', 'devtools', { shape: 'cyl', icon: ['artifact_registry'] }),
      cloudbuild: S('CB', 'Cloud Build', 'devtools', { icon: ['cloud_build'] }),
      interconnect: S('IC', 'Cloud Interconnect', 'net', { infra: I, icon: ['cloud_interconnect'] }),
    },
    azure: {
      frontdoor: S('AFD', 'Front Door', 'net', { infra: I, icon: ['Front-Door'] }),
      appgw: S('AppGW', 'Application Gateway', 'net', { infra: I, icon: ['Application-Gateway'] }),
      lb: S('LB', 'Load Balancer', 'net', { infra: I, icon: ['Load-Balancers'] }),
      aks: S('AKS', 'Azure Kubernetes Service', 'compute', { icon: ['Kubernetes-Services'] }),
      appservice: S('App', 'App Service', 'compute', { icon: ['App-Services'] }),
      functions: S('Func', 'Azure Functions', 'compute', { icon: ['Function-Apps'] }),
      vm: S('VM', 'Virtual Machines', 'compute', { icon: ['Virtual-Machine'] }),
      sqldb: S('SQL', 'Azure SQL Database', 'db', { shape: 'cyl', icon: ['SQL-Database'] }),
      cosmos: S('Cosmos', 'Cosmos DB', 'db', { shape: 'cyl', icon: ['Azure-Cosmos-DB'] }),
      redis: S('Redis', 'Azure Cache for Redis', 'db', { shape: 'cyl', icon: ['Cache-Redis'] }),
      storage: S('Blob', 'Storage Account', 'storage', { shape: 'cyl', icon: ['Storage-Accounts'] }),
      acr: S('ACR', 'Azure Container Registry', 'storage', { shape: 'cyl', icon: ['Container-Registries'] }),
      servicebus: S('SB', 'Service Bus', 'int', { shape: 'queue', icon: ['Azure-Service-Bus'] }),
      eventhubs: S('EH', 'Event Hubs', 'int', { shape: 'queue', icon: ['Event-Hubs'] }),
      keyvault: S('KV', 'Key Vault', 'sec', { infra: I, icon: ['Key-Vaults'] }),
      entra: S('Entra', 'Microsoft Entra ID', 'sec', { icon: ['Microsoft Entra ID color icon', 'Entra-ID', 'Azure-Active-Directory'] }),
      firewall: S('FW', 'Azure Firewall', 'sec', { infra: I, icon: ['Firewalls'] }),
      nat: S('NAT', 'NAT Gateway', 'net', { infra: I, icon: ['NAT'] }),
      expressroute: S('ER', 'ExpressRoute', 'net', { infra: I, icon: ['ExpressRoute-Circuits'] }),
      vpngw: S('VPN', 'VPN Gateway', 'net', { infra: I, icon: ['Virtual-Network-Gateways'] }),
    },
    oci: {
      lb: S('LB', 'Load Balancer', 'net', { infra: I, icon: ['Load-Balancer'] }),
      oke: S('OKE', 'Container Engine for Kubernetes', 'compute', { icon: ['Container-Engine', 'OKE'] }),
      compute: S('VM', 'Compute', 'compute', { icon: ['Virtual-Machine', 'Compute'] }),
      functions: S('Fn', 'OCI Functions', 'compute', { icon: ['Functions'] }),
      adb: S('ADB', 'Autonomous Database', 'db', { shape: 'cyl', icon: ['Autonomous'] }),
      basedb: S('DB', 'Base Database Service', 'db', { shape: 'cyl', icon: ['Database-System', 'DB-System'] }),
      mysql: S('MySQL', 'MySQL HeatWave', 'db', { shape: 'cyl', icon: ['MySQL'] }),
      objectstorage: S('OS', 'Object Storage', 'storage', { shape: 'cyl', icon: ['Object-Storage'] }),
      streaming: S('Strm', 'Streaming', 'int', { shape: 'queue', icon: ['Streaming'] }),
      waf: S('WAF', 'Web Application Firewall', 'sec', { infra: I, icon: ['WAF'] }),
      vault: S('Vault', 'Vault', 'sec', { infra: I, icon: ['Vault'] }),
      fastconnect: S('FC', 'FastConnect', 'net', { infra: I, icon: ['FastConnect'] }),
      drg: S('DRG', 'Dynamic Routing Gateway', 'net', { infra: I, icon: ['Dynamic-Routing-Gateway', 'DRG'] }),
    },
    cloudflare: {
      dns: S('DNS', 'Cloudflare DNS', 'net', { infra: I, icon: ['dns'] }),
      cdn: S('CDN', 'Cloudflare CDN', 'net', { infra: I, icon: ['cdn', 'cache'] }),
      waf: S('WAF', 'Cloudflare WAF', 'sec', { infra: I, icon: ['waf'] }),
      access: S('Access', 'Cloudflare Access', 'sec', { infra: I, icon: ['access', 'zero-trust'] }),
      tunnel: S('Tunnel', 'Cloudflare Tunnel', 'net', { infra: I, icon: ['tunnel'] }),
      workers: S('Workers', 'Workers', 'compute', { icon: ['workers'] }),
      r2: S('R2', 'R2', 'storage', { shape: 'cyl', icon: ['r2'] }),
    },
    onprem: {
      fw: S('FW', 'ファイアウォール', 'sec', { infra: I }),
      router: S('RTR', 'ルーター', 'net', { infra: I }),
      vpn: S('VPN', 'VPN 装置', 'net', { infra: I }),
      lb: S('LB', 'ロードバランサー', 'net', { infra: I }),
      server: S('SV', '物理サーバー', 'compute'),
      vm: S('VM', '仮想マシン', 'compute'),
      db: S('DB', 'データベース', 'db', { shape: 'cyl' }),
      storage: S('NAS', 'ストレージ', 'storage', { shape: 'cyl' }),
      mq: S('MQ', 'メッセージキュー', 'int', { shape: 'queue' }),
      ad: S('AD', 'Active Directory', 'sec'),
      batch: S('Batch', 'バッチサーバー', 'compute'),
    },
    k8s: {
      deployment: S('Deploy', 'Deployment', 'compute', { icon: ['deploy'] }),
      statefulset: S('STS', 'StatefulSet', 'db', { icon: ['sts'] }),
      daemonset: S('DS', 'DaemonSet', 'compute', { icon: ['ds'] }),
      cronjob: S('Cron', 'CronJob', 'compute', { icon: ['cronjob'] }),
      service: S('Svc', 'Service', 'net', { infra: I, icon: ['svc'] }),
      ingress: S('Ing', 'Ingress', 'net', { infra: I, icon: ['ing'] }),
    },
  };

  let ICONS = {}; // "provider:svc" → 画像 URL（icons/manifest.json）
  function lookup(svc) {
    if (!svc) return null;
    const [p, k] = svc.includes(':') ? svc.split(':') : ['aws', svc];
    const s = SERVICES[p]?.[k];
    if (!s) return null;
    return { ...s, provider: p, key: k, id: `${p}:${k}`, providerLabel: PROVIDERS[p].label, providerColor: PROVIDERS[p].color, color: CAT[s.cat], iconUrl: ICONS[`${p}:${k}`] || null };
  }
  const providerOf = n => lookup(n?.svc)?.provider || n?.provider || null;

  window.Catalog = { CAT, PROVIDERS, SERVICES, lookup, providerOf, setIcons: m => { ICONS = m || {}; } };
  // 互換：従来の AWS カタログ
  window.AWS_CAT = CAT;
  window.AWS = SERVICES.aws;
})();
