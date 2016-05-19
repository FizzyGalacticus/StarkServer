require('./SimpleServer.js');
var domains = require('./config.js');

var server  = new SimpleServer();
server.setPort(1234);
server.addDomains(domains);

server.start();