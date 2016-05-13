var fs       = require('fs');
var http     = require('http');

SimpleServer = function() {
	var self        = this;
	this.dispatcher = require('httpdispatcher');
	this.domains    = [];
	this.port       = 8080;
	this.server     = http.createServer(function(req, res) {
		try {
	        self.dispatcher.dispatch(req, res);
	    }
	    catch(err) {
	        console.log(err);
	    }
	});

	this.dispatcher.onError(function(req, res) {
	    res.writeHead(404);
	    res.end('404 - Could not find ' + req.headers.host);
	});
};

SimpleServer.prototype.setPort = function(port) {
	this.port = port
};

SimpleServer.prototype.addDomains = function(doms) {
    this.domains.push(doms);
};

SimpleServer.prototype.setAllowedFileTypes = function(domain, types) {
    for (var i = this.domains.length - 1; i >= 0; i--) {
        if(this.domains[i].name == domain) {
            this.domains[i].allowedFileTypes = types;
            break;
        }
    };
};

SimpleServer.prototype.start = function() {
	var self = this;
	this.server.listen(this.port, function(){
	    console.log('Listening on: http://localhost:%s', self.port);
	});
}