var os               = require('os');
var fs               = require('fs');
var path             = require('path');
var http             = require('http');
var https            = require('https');
var HttpDispatcher   = require('httpdispatcher');
var recursive        = require('recursive-readdir');
var simpleNodeLogger = require('simple-node-logger');

const SERVER_VERSION = '1.3.3';

https.globalAgent.options.secureProtocol = 'SSLv3_method';

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

var getFilesFromDirectory = function(directory, filesToIgnore, directoriesToIgnore, callback) {
	var ignoreFunc = function(file, stats) {
		if(stats.isDirectory() && directoriesToIgnore.indexOf(path.basename(file)) > -1)
			return true;
		else if(stats.isFile() && filesToIgnore.indexOf(path.basename(file)) > -1)
			return true;
		else return false;
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

StarkServer = function() {
	var self            = this;
	this.domains        = [];
	this.drivers        = [];
	this.HTTPPort       = 8080;
	this.HTTPSPort      = 8081;
	this.domainIndexSet = {};
	this.mimeTypeLookup = require('mime-types').lookup;
	this.logger         = simpleNodeLogger.createSimpleLogger({
		logFilePath:'StarkServer.log',
		timestampFormat:'YY-MM-DD HH:MM:ss'
	});

	this.handleRequest = function(req, res) {
		try {
			var requestedHost = req.headers.host;
			requestedHost     = removeWWW(requestedHost);
			requestedHost     = removePort(requestedHost);
			
			for(var i in self.domains) {
				if(requestedHost == self.domains[i].host)
					self.domains[i].dispatcher.dispatch(req, res);
			}
	    }
	    catch(err) {
	    	self.logger.error('Problem handling request: ', err);
	    }
	};

	this.HTTPServer = http.createServer(this.handleRequest);
};

StarkServer.prototype.getServerVariables = function(request) {
	var port      = (this.HTTPSServer ? this.HTTPSPort:this.HTTPPort);
	var host      = removePort(request.headers.host);
	var software  = 'StarkServer/' + SERVER_VERSION + ' (' + os.type() + ')';
	var signature = software + 'Server at ' + host + ' Port ' + port;
	var server = {
		server_software     : software,
		server_name         : request.connection.servername,
		request_method      : request.method,
		query_string        : (request.url.split('?').length > 1 ? request.url.split('?')[1]:''),
		http_accept         : request.headers.accept,
		http_accept_encoding: request.headers['accept-encoding'],
		http_accept_language: request.headers['accept-language'],
		http_host           : host,
		htt_user_agent      : request.headers['user-agent'],
		remote_addr         : request.connection.remoteAddress,
		server_admin        : 'web@localhost',
		server_port         : port,
		server_signature    : signature
	};

	return server;
};

StarkServer.prototype.checkIfFileExists = function(file) {
	try {
		return fs.statSync(file).isFile();
	}
	catch(err) {
		if(err.code === 'ENOENT')
			return false;
		else throw err;
	}
};

StarkServer.prototype.setHTTPPort = function(port) {
	this.HTTPPort = port;
};

StarkServer.prototype.setSSLPort = function(port) {
	this.HTTPSPort = port;
};

StarkServer.prototype.setSSLOptions = function(opts) {
	if(!this.checkIfFileExists(opts.cert) || !this.checkIfFileExists(opts.key)) {
		this.logger.error('Invalid SSL cert or key file set in configuration.');
		return;
	}

	var options = {
		cert:fs.readFileSync(opts.cert),
		key :fs.readFileSync(opts.key)
	};

	this.HTTPSServer = https.createServer(options, this.handleRequest);
};

StarkServer.prototype.generateDispatcherRequest = function(dom, file) {
	var requestURL = constructURLFromPath(dom, file);
	var fileType   = getFileType(file);
	var mimeType   = this.mimeTypeLookup(fileType);
	var self       = this;
	var request    = null;
	var response   = null;

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

	var DriverCallback = function(mimeType, page, error) {
		if(error) self.logger.error(error);
		if(mimeType == 'NOT_SUPPORTED_FILE') {
			fs.readFile(page, function(error, res) {
				if(error)
					self.logger.error(error);

				response.writeHead(200, {'Content-Type':mimeType});
				response.end(res);	
			});			
		}
		else {
			response.writeHead(200, {'Content-Type':self.mimeTypeLookup(page)});
			response.end(page);
		}
	};

	var handleGetRequest = function(req, res) {
		request       = req;
		response      = res;
		var sentToDriver = false;

		for(var i in self.drivers) {
			if(self.drivers[i].fileTypes.indexOf(fileType) > -1) {
				var DriverClass               = require('./' + self.drivers[i].driverFile);
				var serverVariables           = self.getServerVariables(req);
				serverVariables.document_root = dom.baseDirectory + '/';
				var driver                    = new DriverClass(serverVariables);
				sentToDriver                  = true;
				driver.onGet(file, req.params, DriverCallback);
			}
		}

		if(!sentToDriver) {
			res.writeHead(200, {'Content-Type': mimeType});

			fs.readFile(file, function(error, response) {
				res.end(response);
			});
		}
	};

	var handlePostRequest = function(req, res) {
		var sentToDriver = false;
		var params    = req.params;//formatParams(req.params);
		request       = req;
		response      = res;

		for(var i in self.drivers) {
			if(self.drivers[i].fileTypes.indexOf(fileType) > -1) {
				var DriverClass               = require('./' + self.drivers[i].driverFile);
				var serverVariables           = self.getServerVariables(req);
				serverVariables.document_root = dom.baseDirectory + '/';
				var driver                    = new DriverClass(serverVariables);
				sentToDriver                  = true;
				driver.onPost(file, params, DriverCallback);
			}
		}

		if(!sentToDriver) {
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

	if(this.domainIndexSet[dom.host] === undefined) {
		if(dom.index !== undefined) {
			if(requestURL == ('/' + dom.index)) {
				dom.dispatcher.onGet('/', handleGetRequest);
				dom.dispatcher.onPost('/', handlePostRequest);
				this.domainIndexSet[dom.host] = true;
			}
		}
		else if(requestURL.indexOf('index') > -1){
			dom.dispatcher.onGet('/', handleGetRequest);
			dom.dispatcher.onPost('/', handlePostRequest);
			this.domainIndexSet[dom.host] = true;
		}
	}
};

StarkServer.prototype.setupNewDomain = function(dom) {
	dom.host       = removeWWW(dom.host);
	dom.dispatcher = new HttpDispatcher();
	var self       = this;

	var filesToIgnore = (dom.filesToIgnore === undefined ? []:dom.filesToIgnore);
	var directoriesToIgnore = (dom.directoriesToIgnore === undefined ? []:dom.directoriesToIgnore);
	
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

	getFilesFromDirectory(dom.baseDirectory, filesToIgnore, directoriesToIgnore, filesReceived);

	dom.dispatcher.onError(function(req, res) {
	    res.writeHead(404);
	    res.end('404 - Page does not exist.');
	});

	if(dom.secure) {
		if(dom.cert !== undefined && dom.key !== undefined) {
			if(!this.checkIfFileExists(dom.cert) || !this.checkIfFileExists(dom.key))
				this.logger.warn('Path to SSL certificate or key invalid for domain: ' + dom.host);
			else {
				var serverOptions = {
					key :fs.readFileSync(dom.key),
					cert:fs.readFileSync(dom.cert)
				};

				this.server = https.createServer(serverOptions, this.handleRequest);
			}

		}
	}
};

/*
 * This function takes a JSON object with the
 * following fields:
 * - host
 * - baseDirectory
 * - allowedFileTypes (optional)
 */
StarkServer.prototype.addDomain = function(dom) {
	this.domains.push(dom);
    this.setupNewDomain(dom);
};

//Takes an array of JSON objects as described above
StarkServer.prototype.addDomains = function(doms) {
	for (var key in doms) {
		if(key !== undefined) {
			this.addDomain(doms[key]);
		}
	}
};

StarkServer.prototype.addDriver = function(driver) {
	this.drivers.push(driver);
};

StarkServer.prototype.addDrivers = function(drivers) {
	for (var key in drivers) {
		if(key !== undefined) {
			this.addDriver(drivers[key]);
		}
	}
};

StarkServer.prototype.setAllowedFileTypes = function(host, types) {
    for (var i = this.domains.length - 1; i >= 0; i--) {
        if(this.domains[i].host == host) {
            this.domains[i].allowedFileTypes = types;
            break;
        }
    }
};

StarkServer.prototype.startHTTP = function() {
	var self = this;
	this.HTTPServer.listen(this.HTTPPort, function(){
		self.logger.info('Listening on: http://localhost:', self.HTTPPort);
	});
};

StarkServer.prototype.startHTTPS = function() {
	var self = this;
	this.HTTPSServer.listen(this.HTTPSPort, function(){
	    self.logger.info('Listening on: https://localhost:', self.HTTPSPort);
	});
};

StarkServer.prototype.start = function() {
	this.startHTTP();
	if(this.HTTPSServer !== undefined) {
		this.startHTTPS();
	}
};

module.exports = new StarkServer();