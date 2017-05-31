let os               = require('os');
let fs               = require('fs');
let path             = require('path');
let http             = require('http');
let https            = require('https');
let HttpDispatcher   = require('httpdispatcher');
let recursive        = require('recursive-readdir');
let simpleNodeLogger = require('simple-node-logger');

const SERVER_VERSION = '1.7';

https.globalAgent.options.secureProtocol = 'SSLv3_method';

let removeWWW = (url) => {
	if(url.indexOf('www') > -1)
		return url.substring(4, url.length);

	return url;
};

let removePort = (host) => {
	let indexOfPort = host.indexOf(':');

	if(indexOfPort > -1) 
		return host.substring(0, indexOfPort);

	return host;
};

let getFileType = (file) => {
	let suffix = '';
	for (let i = file.length - 1; i >= 0 && file[i] != '.'; i--) {
		suffix += file[i];
	}

	return suffix.split('').reverse().join('');
};

let getFilesFromDirectory = (directory, filesToIgnore, directoriesToIgnore, callback) => {
	let ignoreFunc = (file, stats) => {
		if(stats.isDirectory() && directoriesToIgnore.indexOf(path.basename(file)) > -1)
			return true;
		else if(stats.isFile() && filesToIgnore.indexOf(path.basename(file)) > -1)
			return true;
		else return false;
	};
	 
	recursive(directory, ['.htaccess', ignoreFunc],  (err, files) => {
	  callback(files);
	});
};

let constructURLFromPath = (dom, filepath) => {
	let index = filepath.indexOf(dom.baseDirectory);
	if(index > -1) {
		return filepath.substring(index + dom.baseDirectory.length, filepath.length);
	}

	return '';
};

class StarkServer {
	constructor() {
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

		this.handleRequest = (req, res) => {
			try {
				let requestedHost = req.headers.host;
				requestedHost     = removeWWW(requestedHost);
				requestedHost     = removePort(requestedHost);
				
				for(let i in this.domains) {
					if(requestedHost == this.domains[i].host)
						this.domains[i].dispatcher.dispatch(req, res);
				}
		    }
		    catch(err) {
		    	this.logger.error('Problem handling request: ', err);
		    }
		};

		this.HTTPServer = http.createServer(this.handleRequest);
	}

	getServerletiables(request) {
		let port      = (this.HTTPSServer ? this.HTTPSPort:this.HTTPPort);
		let host      = removePort(request.headers.host);
		let software  = 'StarkServer/' + SERVER_VERSION + ' (' + os.type() + ')';
		let signature = software + 'Server at ' + host + ' Port ' + port;
		let server = {
			server_software     : software,
			server_name         : request.connection.servername,
			request_method      : request.method,
			query_string        : (request.url.split('?').length > 1 ? request.url.split('?')[1]:''),
			http_accept         : request.headers.accept,
			http_accept_encoding: request.headers['accept-encoding'],
			http_accept_language: request.headers['accept-language'],
			http_host           : host,
			http_user_agent     : request.headers['user-agent'],
			remote_addr         : request.connection.remoteAddress,
			server_admin        : 'web@localhost',
			server_port         : port,
			server_signature    : signature
		};

		return server;
	}

	checkIfFileExists(file) {
		try {
			return fs.statSync(file).isFile();
		}
		catch(err) {
			if(err.code === 'ENOENT')
				return false;
			else throw err;
		}
	}

	setHTTPPort(port) {
		this.HTTPPort = port;
	}

	setSSLPort(port) {
		this.HTTPSPort = port;
	}

	setSSLOptions(opts) {
		if(!this.checkIfFileExists(opts.cert) || !this.checkIfFileExists(opts.key)) {
			this.logger.error('Invalid SSL cert or key file set in configuration.');
			return;
		}

		let options = {
			cert:fs.readFileSync(opts.cert),
			key :fs.readFileSync(opts.key)
		};

		this.HTTPSServer = https.createServer(options, this.handleRequest);
		this.HTTPServer = http.createServer((req, res) => {
			res.writeHead(302,  {Location: ('https://' + req.headers.host + req.url)});
	    	res.end();
		});
	}

	generateDispatcherRequest(dom, file) {
		let requestURL = constructURLFromPath(dom, file);
		let fileType   = getFileType(file);
		let mimeType   = this.mimeTypeLookup(fileType);
		let request    = null;
		let response   = null;

		let formatParams = (params) => {
			console.log(params);
			let retParams = {};

			try{
		        retParams = Object.keys(params)[0];
		        retParams = retParams.replace(/[\\]+/g, '');
		        retParams = JSON.parse(retParams);
		    }
		    catch(err) {
		        retParams = params;
		    }

		    console.log(retParams);
		    return retParams;
		};

		let DriverCallback = (mimeType, page, error) => {
			if(error) this.logger.error(error);
			if(mimeType == 'NOT_SUPPORTED_FILE') {
				fs.readFile(page, (error, res) => {
					if(error)
						this.logger.error(error);

					response.writeHead(200, {'Content-Type':mimeType});
					response.end(res);	
				});			
			}
			else {
				response.writeHead(200, {'Content-Type':this.mimeTypeLookup(page)});
				response.end(page);
			}
		};

		let handleGetRequest = (req, res) => {
			request       = req;
			response      = res;
			let sentToDriver = false;

			for(let i in this.drivers) {
				if(this.drivers[i].fileTypes.indexOf(fileType) > -1) {
					let DriverClass               = require(path.join(__dirname, path.normalize(this.drivers[i].driverFile)));
					let serverletiables           = this.getServerletiables(req);
					serverletiables.document_root = path.normalize(dom.baseDirectory + '/');
					let driver                    = new DriverClass(serverletiables);
					sentToDriver                  = true;
					driver.onGet(file, req.params, DriverCallback);
				}
			}

			if(!sentToDriver) {
				res.writeHead(200, {'Content-Type': mimeType});

				fs.readFile(file, (error, response) => {
					res.end(response);
				});
			}
		};

		let handlePostRequest = (req, res) => {
			let sentToDriver = false;
			let params    = formatParams(req.params);
			request       = req;
			response      = res;

			for(let i in this.drivers) {
				if(this.drivers[i].fileTypes.indexOf(fileType) > -1) {
					let DriverClass               = require(path.join(__dirname, path.normalize(this.drivers[i].driverFile)));
					let serverletiables           = this.getServerletiables(req);
					serverletiables.document_root = path.normalize(dom.baseDirectory + '/');
					let driver                    = new DriverClass(serverletiables);
					sentToDriver                  = true;
					driver.onPost(file, params, DriverCallback);
				}
			}

			if(!sentToDriver) {
				res.writeHead(200, {'Content-Type': mimeType});

				fs.readFile(file, (error, response) => {
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
	}

	setupNewDomain(dom) {
		dom.host       = removeWWW(dom.host);
		dom.dispatcher = new HttpDispatcher();

		let filesToIgnore = (dom.filesToIgnore === undefined ? []:dom.filesToIgnore);
		let directoriesToIgnore = (dom.directoriesToIgnore === undefined ? []:dom.directoriesToIgnore);
		
		let filesReceived = (files) => {
			if(files !== undefined) {
				for (let i = files.length - 1; i >= 0; i--) {
					if(dom.allowedFileTypes == '*' || dom.allowedFileTypes.indexOf(getFileType(files[i])) > -1) {
						let file = path.normalize(files[i]);
						this.generateDispatcherRequest(dom, file);
					}
				}
			}
		};

		getFilesFromDirectory(dom.baseDirectory, filesToIgnore, directoriesToIgnore, filesReceived);

		dom.dispatcher.onError((req, res) => {
			let fourOhFour           = (dom.error['404'] === undefined ? '404 - Page does not exist.':dom.error['404']);
			let fourOhFourFilePath   = path.normalize(dom.baseDirectory + '/' + fourOhFour);
			let fourOhFourFileExists = this.checkIfFileExists(fourOhFourFilePath);

			res.writeHead(404);

			if(fourOhFourFileExists)
				res.end(fs.readFileSync(fourOhFourFilePath));
			else res.end(fourOhFour);
		});

		if(dom.secure) {
			if(dom.cert !== undefined && dom.key !== undefined) {
				if(!this.checkIfFileExists(dom.cert) || !this.checkIfFileExists(dom.key))
					this.logger.warn('Path to SSL certificate or key invalid for domain: ' + dom.host);
				else {
					let serverOptions = {
						key :fs.readFileSync(dom.key),
						cert:fs.readFileSync(dom.cert)
					};

					this.server = https.createServer(serverOptions, this.handleRequest);
				}

			}
		}
	}

	/*
	 * This  takes a JSON object with the
	 * following fields:
	 * - host
	 * - baseDirectory
	 * - allowedFileTypes (optional) =>
	 */

	addDomain(dom) {
		if(Array.isArray(dom.host)) {
			let hosts = dom.host;

			for(let i = 0; i < hosts.length; i++) {
				let newDom = {
					host               :hosts[i],
					baseDirectory      :dom.baseDirectory,
					allowedFileTypes   :dom.allowedFileTypes,
					index              :dom.index,
					filesToIgnore      :dom.filesToIgnore,
					directoriesToIgnore:dom.directoriesToIgnore,
					error              :dom.error
				};
				
				this.domains.push(newDom);
				this.setupNewDomain(newDom);
			}
		}
		else {
			this.domains.push(dom);
		    this.setupNewDomain(dom);
		}
	}

	//Takes an array of JSON objects as described above
	addDomains(doms) {
		for (let key in doms) {
			if(key !== undefined) {
				this.addDomain(doms[key]);
			}
		}
	}

	addDriver(driver) {
		this.drivers.push(driver);
	}

	addDrivers(drivers) {
		for (let key in drivers) {
			if(key !== undefined) {
				this.addDriver(drivers[key]);
			}
		}
	}

	setAllowedFileTypes(host, types) {
	    for (let i = this.domains.length - 1; i >= 0; i--) {
	        if(this.domains[i].host == host) {
	            this.domains[i].allowedFileTypes = types;
	            break;
	        }
	    }
	}

	startHTTP() {
		this.HTTPServer.listen(this.HTTPPort, () =>{
			this.logger.info('Listening on: http://localhost:', this.HTTPPort);
		});
	}

	startHTTPS() {
		this.HTTPSServer.listen(this.HTTPSPort, () =>{
		    this.logger.info('Listening on: https://localhost:', this.HTTPSPort);
		});
	}

	start() {
		this.startHTTP();
		if(this.HTTPSServer !== undefined) {
			this.startHTTPS();
		}
	}
}

	

module.exports = new StarkServer();