require('./SimpleServer.js');
var config = require('./config.js');

var server  = new SimpleServer();
server.setPort(1234);
server.addDomains(config.domains);
server.addCGIs(config.cgis);

server.start();