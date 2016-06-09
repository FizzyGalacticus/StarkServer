var HttpDispatcher = require('httpdispatcher');
var fs             = require('fs');
var path           = require('path');
var http           = require('http');
var recursive      = require('recursive-readdir');

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

SimpleServer = function() {
	var self            = this;
	this.domains        = [];
	this.cgis           = [];
	this.port           = 8080;
	this.domainIndexSet = {};
	this.mimeTypeLookup = require('mime-types').lookup;

	this.server         = http.createServer(function(req, res) {
		try {
			var requestedHost = req.headers.host;
			requestedHost     = removeWWW(requestedHost);
			requestedHost     = removePort(requestedHost);
			
			for(var i in self.domains) {
				if(requestedHost == self.domains[i].host)
					self.domains[i].dispatcher.dispatch(req, res);
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
	var fileType   = getFileType(file);
	var mimeType   = this.mimeTypeLookup(fileType);
	var self       = this;
	var request    = null;
	var result     = null;

	var formatParams = function(params) {
		var retParams = {};

		try{
	        retParams = Object.keys(params)[0];
	        retParams = params.replace(/[\\]+/g, '');
	        retParams = JSON.parse(params);
	    }
	    catch(err) {
	        retParams = params;
	    }

	    return retParams;
	};

	var CGICallback = function(mimeType, page) {
		result.writeHead(200, {'Content-Type':mimeType});
		result.end(page);
	};

	var handleGetRequest = function(req, res) {
		request       = req;
		result        = res;
		var sentToCGI = false;

		for(var i in self.cgis) {
			if(self.cgis[i].fileTypes.indexOf(fileType) > -1) {
				var cgi = require('./' + self.cgis[i].cgiFile);
				cgi.onGet(file, req.params, CGICallback);
				sentToCGI = true;
			}
		}

		if(!sentToCGI) {
			res.writeHead(200, {'Content-Type': mimeType});

			fs.readFile(file, function(error, response) {
				res.end(response);
			});
		}
	};

	var handlePostRequest = function(req, res) {
		var sentToCGI = false;
		var params    = req.params;//formatParams(req.params);
		request       = req;
		result        = res;

		for(var i in self.cgis) {
			if(self.cgis[i].fileTypes.indexOf(fileType) > -1) {
				var cgi = require('./' + self.cgis[i].cgiFile);
				cgi.onPost(file, params, CGICallback);
				sentToCGI = true;
			}
		}

		if(!sentToCGI) {
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

	if(this.domainIndexSet[dom.host] === undefined && requestURL.indexOf('index') > -1) {
		dom.dispatcher.onGet('/', handleGetRequest);
		dom.dispatcher.onPost('/', handlePostRequest);
		this.domainIndexSet[dom.host] = true;
	}
};

SimpleServer.prototype.setupNewDomain = function(dom) {
	dom.host       = removeWWW(dom.host);
	dom.dispatcher = new HttpDispatcher();
	var self       = this;
	
	var filesReceived = function(files) {
		if(files !== undefined) {
			for (var i = files.length - 1; i >= 0; i--) {
				if(dom.allowedFileTypes == '*' || dom.allowedFileTypes.indexOf(getFileType(files[i])) > -1) {
					var file = files[i];
					self.generateDispatcherRequest(dom, file);
				}
			}
		}
	};

	getFilesFromDirectory(dom.baseDirectory, filesReceived);

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

SimpleServer.prototype.addCGI = function(cgi) {
	this.cgis.push(cgi);
};

SimpleServer.prototype.addCGIs = function(cgis) {
	for (var key in cgis) {
		if(key !== undefined) {
			this.addCGI(cgis[key]);
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