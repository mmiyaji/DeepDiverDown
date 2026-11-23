#!/usr/bin/env node
// Download the vendors' public brand assets into the existing, ignored icons/ tree.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { ROOT } from './load.mjs';

const python = process.platform === 'win32' ? 'python' : 'python3';

const assets = [
  ['icon-unity-catalog.svg', 'https://www.databricks.com/sites/default/files/2026-01/icon-unity-catalog.svg'],
  ['icon-databricks-sql.svg', 'https://www.databricks.com/sites/default/files/2026-01/icon-databricks-sql.svg'],
  ['icon-lakeflow.svg', 'https://www.databricks.com/sites/default/files/2026-01/icon-lakeflow.svg'],
  ['icon-orange-Delta-Table.svg', 'https://www.databricks.com/sites/default/files/2023-02/icon-orange-Delta-Table.svg'],
  ['Databricks-Logo-Icon.svg', 'https://www.databricks.com/sites/default/files/2026-05/Databricks-Logo-Icon.svg'],
  ['SearchDataIcon.svg', 'https://www.databricks.com/sites/default/files/2024-11/SearchDataIcon.svg'],
  ['CloudModelIcon.svg', 'https://www.databricks.com/sites/default/files/2025-05/CloudModelIcon.svg'],
];
const snowflakeUrl = 'https://www.snowflake.com/wp-content/uploads/2020/02/Snowflake-Logo-Files.zip';
const snowflakeTemplateUrl = 'https://www.snowflake.com/wp-content/themes/snowflake/assets/img/brand-guidelines/downloads/Snowflake_Template_2026.potx.zip';
// Linked from https://learn.microsoft.com/en-us/fabric/fundamentals/icons.
const fabricUrl = 'https://raw.githubusercontent.com/microsoft/fabric-samples/18b94bc8d5bd208f72493e92b5d0dd67629d3454/docs-samples/Icons.zip';
const fabricIcons = ['fabric_48_color.svg', 'pipeline_48_item.svg', 'lakehouse_48_item.svg',
  'notebook_48_item.svg', 'report_48_item.svg', 'semantic_model_48_item.svg'];
const awsUrl = 'https://d1.awsstatic.com/onedam/marketing-channels/website/public/shared/architecture-icon-release/Icon-package_07312026.5846e92413caa21490223536cc97f1269e44fa92.zip';
const iconArchives = [
  ['aws', awsUrl, ['aws', 'official-download']],
  ['gcp-core', 'https://services.google.com/fh/files/misc/core-products-icons.zip', ['gcp', 'core', 'official-download']],
  ['gcp-legacy', 'https://services.google.com/fh/files/misc/google-cloud-legacy-icons.zip', ['gcp', 'legacy', 'official-download']],
  ['azure', 'https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V25.zip', ['azure', 'official-download']],
  ['entra', 'https://download.microsoft.com/download/3/1/a/31a56038-856a-4489-88e4-ee5a1c4352be/Microsoft%20Entra%20architecture%20icons%20-%20Oct%202023.zip', ['azure', 'entra', 'official-download']],
];
const ociUrl = 'https://docs.oracle.com/iaas/Content/Resources/Assets/OCI-Style-Guide-for-Drawio.zip';
const k8sUrl = 'https://raw.githubusercontent.com/kubernetes/community/0d3d74312c7457a6ee2cfefca9a048e9d2731391/icons/svg/resources/unlabeled/';
const k8sIcons = ['cronjob.svg', 'deploy.svg', 'ds.svg', 'ing.svg', 'sts.svg', 'svc.svg'];
async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(url + ': HTTP ' + response.status);
  return Buffer.from(await response.arrayBuffer());
}
function removeTempDirectory(directory) {
  const target = path.resolve(directory);
  const relative = path.relative(path.resolve(os.tmpdir()), target);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('一時ディレクトリの範囲外です: ' + target);
  }
  fs.rmSync(target, { recursive: true, force: true });
}
const databricksDir = path.join(ROOT, 'icons', 'databricks', 'official');
const snowflakeDir = path.join(ROOT, 'icons', 'snowflake', 'official');
const fabricDir = path.join(ROOT, 'icons', 'fabric', 'official');
const purviewDir = path.join(ROOT, 'icons', 'purview', 'official');
const k8sDir = path.join(ROOT, 'icons', 'k8s', 'official-download');
fs.mkdirSync(databricksDir, { recursive: true });
fs.mkdirSync(snowflakeDir, { recursive: true });
fs.mkdirSync(fabricDir, { recursive: true });
fs.mkdirSync(purviewDir, { recursive: true });
fs.mkdirSync(k8sDir, { recursive: true });
for (const [name, url] of assets) {
  const data = await download(url);
  if (!data.toString('utf8', 0, 300).includes('<svg')) throw new Error('SVG を確認できません: ' + url);
  fs.writeFileSync(path.join(databricksDir, name), data);
}
for (const name of k8sIcons) {
  const data = await download(k8sUrl + name);
  if (!data.toString('utf8').includes('<svg')) throw new Error('SVG を確認できません: ' + name);
  fs.writeFileSync(path.join(k8sDir, name), data);
}
const archive = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-snowflake-')), 'logos.zip');
try {
  fs.writeFileSync(archive, await download(snowflakeUrl));
  const code = 'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); open(sys.argv[2],"wb").write(z.read("Snowflake-Logo-Files/PNG/bug-sno-blue.png"))';
  const result = spawnSync(python, ['-c', code, archive, path.join(snowflakeDir, 'bug-sno-blue.png')], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr);
} finally {
  removeTempDirectory(path.dirname(archive));
}
const fabricArchive = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-fabric-')), 'icons.zip');
try {
  fs.writeFileSync(fabricArchive, await download(fabricUrl));
  const code = 'import sys,zipfile,os; z=zipfile.ZipFile(sys.argv[1]); prefix="v6.1.0/package/dist/svg/"; ' +
    '[(open(os.path.join(sys.argv[2],n),"wb").write(z.read(prefix+n))) for n in sys.argv[4:]]; ' +
    'open(os.path.join(sys.argv[3],"purview_48_color.svg"),"wb").write(z.read(prefix+"purview_48_color.svg"))';
  const result = spawnSync(python, ['-c', code, fabricArchive, fabricDir, purviewDir, ...fabricIcons], { encoding: 'utf8' });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr);
} finally {
  removeTempDirectory(path.dirname(fabricArchive));
}
const vendorTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-vendor-icons-'));
try {
  for (const [name, url, directory] of iconArchives) {
    const archivePath = path.join(vendorTemp, name + '.zip');
    const outputDir = path.join(ROOT, 'icons', ...directory);
    fs.writeFileSync(archivePath, await download(url));
    const result = spawnSync(python, [path.join(ROOT, 'tools', 'extract-official-icon-zip.py'), archivePath, outputDir, name], { encoding: 'utf8' });
    if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr);
    fs.writeFileSync(path.join(outputDir, 'SOURCE.txt'), url + '\n');
    process.stdout.write(result.stdout);
  }
  const ociArchive = path.join(vendorTemp, 'oci.zip');
  const ociDir = path.join(ROOT, 'icons', 'oci', 'official-download');
  fs.writeFileSync(ociArchive, await download(ociUrl));
  const oci = spawnSync(python, [path.join(ROOT, 'tools', 'extract-oci-icons.py'), ociArchive, ociDir], { encoding: 'utf8', timeout: 300000 });
  if (oci.error || (oci.status !== 0 && oci.status !== 2)) throw new Error(oci.error?.message || oci.stderr);
  if (oci.status === 2) process.stderr.write(oci.stderr);
  else {
    fs.writeFileSync(path.join(ociDir, 'SOURCE.txt'), 'Oracle OCI Architecture Diagram Toolkit\n' + ociUrl + '\n');
    process.stdout.write(oci.stdout);
  }
  if (process.platform === 'win32') {
    try {
      const zip = path.join(vendorTemp, 'snowflake-template.zip');
      const potx = path.join(vendorTemp, 'snowflake-template.potx');
      const snowflakeServices = path.join(snowflakeDir, 'services');
      fs.writeFileSync(zip, await download(snowflakeTemplateUrl));
      const unzip = 'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); open(sys.argv[2],"wb").write(z.read("Snowflake_Template_2026.potx"))';
      const extracted = spawnSync(python, ['-c', unzip, zip, potx], { encoding: 'utf8' });
      if (extracted.error || extracted.status !== 0) throw new Error(extracted.error?.message || extracted.stderr);
      const exported = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', path.join(ROOT, 'tools', 'extract-snowflake-icons.ps1'), '-Template', potx, '-OutputDirectory', snowflakeServices], { encoding: 'utf8', timeout: 120000 });
      if (exported.error || (exported.status !== 0 && exported.status !== 2)) throw new Error(exported.error?.message || exported.stderr);
      if (exported.status === 2) process.stderr.write(exported.stderr);
      else {
        fs.writeFileSync(path.join(snowflakeServices, 'SOURCE.txt'), 'Snowflake brand guidelines: https://www.snowflake.com/brand-guidelines/\n' + snowflakeTemplateUrl + '\n');
        process.stdout.write(exported.stdout);
      }
    } catch (error) {
      process.stderr.write('Snowflake のサービスアイコンを取得できませんでした: ' + error.message + '\n');
    }
  } else {
    process.stderr.write('Snowflake のサービスアイコンの SVG 変換には Windows と PowerPoint が必要です。\n');
  }
} finally {
  removeTempDirectory(vendorTemp);
}
fs.writeFileSync(path.join(databricksDir, 'SOURCE.txt'), assets.map(([name, url]) => name + ' ' + url).join('\n') + '\n');
fs.writeFileSync(path.join(snowflakeDir, 'SOURCE.txt'), '公式プレス資料: https://www.snowflake.com/en/news/\n' + snowflakeUrl + '\n');
for (const dir of [fabricDir, purviewDir]) fs.writeFileSync(path.join(dir, 'SOURCE.txt'), '公式アイコン: https://learn.microsoft.com/en-us/fabric/fundamentals/icons\n' + fabricUrl + '\n');
fs.writeFileSync(path.join(k8sDir, 'SOURCE.txt'), 'Kubernetes Community icons: https://github.com/kubernetes/community/tree/main/icons\n' + k8sUrl + '\n');
console.log('公式アイコンを配置しました。npm run icons で対応表を更新してください。');
