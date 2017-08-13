let os               = require('os');
let fs               = require('fs');
let http             = require('http');
let https            = require('https');
let simpleNodeLogger = require('simple-node-logger');
let util             = require('./ServerUtil.js');
let Domain           = require('./Domain.js');

const SERVER_VERSION = '1.7.0';

https.globalAgent.options.secureProtocol = 'SSLv3_method';

class StarkServer {
	constructor() {
		this.domains        = {};
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
				let requestedHost = util.getHostFromUrl(req.headers.host);
				requestedHost     = util.removePortFromHost(requestedHost);

				let domainKeys = Object.keys(this.domains);
				
				for(let i = 0; i < domainKeys.length; i++) {
					let key = domainKeys[i];
					let domain = this.domains[key];

					if(domain.getHosts().indexOf(requestedHost) > -1)
						domain.handleRequest(req, res);
				}
		    }
		    catch(err) {
		    	this.logger.error('Problem handling request: ', err);
		    }
		};

		this.HTTPServer = http.createServer(this.handleRequest);
	}

	getServerVariables(request) {
		let port      = (this.HTTPSServer ? this.HTTPSPort:this.HTTPPort);
		let host      = util.getHostFromUrl(request.headers.host);
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
			let fourOhFourFileExists = util.checkIfFileExists(fourOhFourFilePath);

			res.writeHead(404);

			if(fourOhFourFileExists)
				res.end(fs.readFileSync(fourOhFourFilePath));
			else res.end(fourOhFour);
		});
	}

	/*
	 * This  takes a JSON object with the
	 * following fields:
	 * - host
	 * - baseDirectory
	 * - allowedFileTypes (optional) =>
	 */

	addDomain(dom) {
		let domain = null;
		if(Array.isArray(dom.host)) {
			domain = new Domain(dom.host, dom.baseDirectory);
		}
		else {
			domain = new Domain([dom.host], dom.baseDirectory);
		}

		domain.setFilesToIgnore(dom.filesToIgnore ? dom.filesToIgnore:[]);
		domain.setDirectoriesToIgnore(dom.directoriesToIgnore ? dom.directoriesToIgnore:[]);
		domain.setError(dom.error ? dom.error:{});

		if(dom.allowedFileTypes)
			domain.setAllowedFileTypes(dom.allowedFileTypes);

		if(dom.index)
			domain.setIndex(dom.index);

		domain.init();
	}

	//Takes an array of JSON objects as described above
	addDomains(doms) {
		for (let key in doms) {
			if(key !== undefined) {
				this.addDomain(doms[key]);
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