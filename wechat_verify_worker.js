addEventListener('fetch', event => {
  event.respondWith(new Response(
    '047b4a152f2926bafc60193a25800cc3a311d1a0',
    { headers: { 'Content-Type': 'text/plain' } }
  ));
});
