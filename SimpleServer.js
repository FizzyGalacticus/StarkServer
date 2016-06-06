var fs        = require('fs');
var path      = require('path');
var exec      = require('child_process').exec;
var http      = require('http');
var recursive = require('recursive-readdir');

var removeWWW = function(url) {
	if(url.indexOf('www') > -1)
		return url.substring(4, url.length);

	return url;
};

var removePort = function(host) {
	indexOfPort = host.indexOf(':');

	if(indexOfPort > -1) 
		return host.substring(0, indexOfPort);

	return host;
};

var getFileType = function(file) {
	var suffix = '';
	for (var i = file.length - 1; i >= 0 && file[i] != '.'; i--) {
		suffix += file[i];
	}

	return suffix.split('').reverse().join('');
};

var getFilesFromDirectory = function(directory, callback) {
	var ignoreFunc = function(file, stats) {
	  return (stats.isDirectory() && 
	  		 (path.basename(file) == 'node_modules' ||
	  		  path.basename(file) == '.git'));
	};
	 
	recursive(directory, ['.htaccess', ignoreFunc], function (err, files) {
	  callback(files);
	});
};

var constructURLFromPath = function(dom, filepath) {
	var index = filepath.indexOf(dom.baseDirectory);
	if(index > -1) {
		return filepath.substring(index + dom.baseDirectory.length, filepath.length);
	}

	return '';
};

var executePHP = function(res, file) {
	var cmd = 'php ' + file;
	exec(cmd, function(error, stdout, stderr) {
		res.writeHead(200, {'Content-Type':'text/html'});
		res.end(stdout);
	});
};

SimpleServer = function() {
	var self            = this;
	this.dispatcher     = require('httpdispatcher');
	this.domains        = [];
	this.port           = 8080;
	this.domainIndexSet = {};
	this.mimeTypeLookup = require('mime-types').lookup;

	this.server         = http.createServer(function(req, res) {
		try {
			var requestedHost = req.headers.host;
			requestedHost     = removeWWW(requestedHost);
			requestedHost     = removePort(requestedHost);
			console.log('Received request for: ' + requestedHost);
			
			for(var i in self.domains) {
				if(requestedHost == self.domains[i].host) {
					console.log('Sending request to dom: ' + self.domains[i].host);
					self.domains[i].dispatcher.dispatch(req, res);
				}
			}

	        // self.dispatcher.dispatch(req, res);
	    }
	    catch(err) {
	        console.log(err);
	    }
	});
};

SimpleServer.prototype.setPort = function(port) {
	this.port = port;
};

SimpleServer.prototype.generateDispatcherRequest = function(dom, file) {
	var requestURL = constructURLFromPath(dom, file);
	var mimeType   = this.mimeTypeLookup(getFileType(file));

	var handleGetRequest = function(req, res) {
		if(getFileType(file) == 'php') 
			executePHP(res, file);
		else {
			console.log('Received request for: ' + req.headers.host + req.url, 'Sending back: ' + file);
			res.writeHead(200, {'Content-Type': mimeType});

			fs.readFile(file, function(error, response) {
				res.end(response);
			});
		}
	};

	var handlePostRequest = function(req, res) {
		if(getFileType(file) == 'php') 
			executePHP(res, file);
		else {
			res.writeHead(200, {'Content-Type': mimeType});

			fs.readFile(file, function(error, response) {
				res.end(response);
			});
		}

		if(dom.onPost !== undefined)
			dom.onPost(req.params, file);
	};

	dom.dispatcher.onGet(requestURL, handleGetRequest);
	dom.dispatcher.onPost(requestURL, handlePostRequest);

	console.log('Mapping file to dom: ', 'File: ' + file, 'Domain: ' + dom.host);

	if(this.domainIndexSet[dom.host] === undefined && requestURL.indexOf('index') > -1) {
		dom.dispatcher.onGet('/', handleGetRequest);
		dom.dispatcher.onPost('/', handlePostRequest);
		this.domainIndexSet[dom.host] = true;
	}
};

SimpleServer.prototype.setupNewDomain = function(dom) {
	console.log('Setting up domain: ' + dom.host);
	dom.host       = removeWWW(dom.host);
	dom.dispatcher = require('httpdispatcher');
	var self       = this;
	getFilesFromDirectory(dom.baseDirectory, function(files) {
		if(files !== undefined) {
			for (var i = files.length - 1; i >= 0; i--) {
				if(dom.allowedFileTypes == '*' || dom.allowedFileTypes.indexOf(getFileType(files[i])) > -1) {
					var file = files[i];
					self.generateDispatcherRequest(dom, file);
				}
			}
		}
	});

	dom.dispatcher.onError(function(req, res) {
	    res.writeHead(404);
	    res.end('404 - Page does not exist.');
	});
};

/*
 * This function takes a JSON object with the
 * following fields:
 * - host
 * - baseDirectory
 * - allowedFileTypes (optional)
 */
SimpleServer.prototype.addDomain = function(dom) {
	this.domains.push(dom);
    this.setupNewDomain(dom);
};

//Takes an array of JSON objects as described above
SimpleServer.prototype.addDomains = function(doms) {
	for (var key in doms) {
		if(key !== undefined) {
			this.addDomain(doms[key]);
		}
	}
};

SimpleServer.prototype.setAllowedFileTypes = function(host, types) {
    for (var i = this.domains.length - 1; i >= 0; i--) {
        if(this.domains[i].host == host) {
            this.domains[i].allowedFileTypes = types;
            break;
        }
    }
};

SimpleServer.prototype.start = function() {
	var self = this;
	this.server.listen(this.port, function(){
	    console.log('Listening on: http://localhost:%s', self.port);
	});
};

module.exports = new SimpleServer();