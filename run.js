require('./SimpleServer.js');
var config = require('./config.js');

var server = new SimpleServer();
server.setHTTPPort(config.ports.http);
server.setSSLPort(config.ports.https);
server.addDomains(config.domains);
server.addCGIs(config.cgis);

if(config.ssl !== undefined)
	server.setSSLOptions(config.ssl);

server.start();