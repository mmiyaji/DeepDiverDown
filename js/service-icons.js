/* 構成図と一覧で、同じローカルのアイコン対応表を読む。 */
export async function loadServiceIcons() {
  const directory = new URL('icons/', location.href);
  try {
    const response = await fetch(new URL('manifest.json', directory));
    if (!response.ok) return {};
    const manifest = await response.json();
    return Object.fromEntries(Object.entries(manifest || {}).flatMap(([id, path]) => {
      if (typeof path !== 'string' || !URL.canParse(path, location.href)) return [];
      const url = new URL(path, location.href);
      return url.origin === directory.origin && url.pathname.startsWith(directory.pathname)
        && /\.(svg|png)$/i.test(url.pathname) && !/%2f|%5c/i.test(url.pathname) ? [[id, url.href]] : [];
    }));
  } catch {
    return {};
  }
}
