// Model permalinks and embedded previews keep using the diagram viewer.
if (!location.hash && new URLSearchParams(location.search).get('preview') !== 'reference') {
  location.replace('home.html' + location.search);
}
