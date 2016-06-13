require('./SimpleServer.js');
var config = require('./config.js');

var server = new SimpleServer();
server.setHTTPPort(80);
server.setSSLPort(443);
server.addDomains(config.domains);
server.addCGIs(config.cgis);

if(config.ssl !== undefined)
	server.setSSLOptions(config.ssl);

server.start();