const http = require('http');
const next = require('next');
const { parse } = require('url');

const port = Number(process.env.PORT) || 3000;
const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  http.createServer((request, response) => {
    handle(request, response, parse(request.url, true));
  }).listen(port, () => {
    console.log(`HunterZone écoute sur le port ${port}`);
  });
}).catch((error) => {
  console.error('Impossible de démarrer HunterZone :', error);
  process.exit(1);
});
