var server = require('./StarkServer.min.js');
var config = require('./config.js');

server.setHTTPPort(config.ports.http);
server.setSSLPort(config.ports.https);
server.addDomains(config.domains);
server.addDrivers(config.drivers);

if(config.ssl !== undefined)
	server.setSSLOptions(config.ssl);

server.start();