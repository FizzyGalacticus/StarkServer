'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var os = require('os');
var fs = require('fs');
var path = require('path');
var http = require('http');
var https = require('https');
var HttpDispatcher = require('httpdispatcher');
var recursive = require('recursive-readdir');
var simpleNodeLogger = require('simple-node-logger');

var SERVER_VERSION = '1.7';

https.globalAgent.options.secureProtocol = 'SSLv3_method';

var removeWWW = function removeWWW(url) {
	if (url.indexOf('www') > -1) return url.substring(4, url.length);

	return url;
};

var removePort = function removePort(host) {
	var indexOfPort = host.indexOf(':');

	if (indexOfPort > -1) return host.substring(0, indexOfPort);

	return host;
};

var getFileType = function getFileType(file) {
	var suffix = '';
	for (var i = file.length - 1; i >= 0 && file[i] != '.'; i--) {
		suffix += file[i];
	}

	return suffix.split('').reverse().join('');
};

var getFilesFromDirectory = function getFilesFromDirectory(directory, filesToIgnore, directoriesToIgnore, callback) {
	var ignoreFunc = function ignoreFunc(file, stats) {
		if (stats.isDirectory() && directoriesToIgnore.indexOf(path.basename(file)) > -1) return true;else if (stats.isFile() && filesToIgnore.indexOf(path.basename(file)) > -1) return true;else return false;
	};

	recursive(directory, ['.htaccess', ignoreFunc], function (err, files) {
		callback(files);
	});
};

var constructURLFromPath = function constructURLFromPath(dom, filepath) {
	var index = filepath.indexOf(dom.baseDirectory);
	if (index > -1) {
		return filepath.substring(index + dom.baseDirectory.length, filepath.length);
	}

	return '';
};

var StarkServer = function () {
	function StarkServer() {
		var _this = this;

		_classCallCheck(this, StarkServer);

		this.domains = [];
		this.drivers = [];
		this.HTTPPort = 8080;
		this.HTTPSPort = 8081;
		this.domainIndexSet = {};
		this.mimeTypeLookup = require('mime-types').lookup;
		this.logger = simpleNodeLogger.createSimpleLogger({
			logFilePath: 'StarkServer.log',
			timestampFormat: 'YY-MM-DD HH:MM:ss'
		});

		this.handleRequest = function (req, res) {
			try {
				var requestedHost = req.headers.host;
				requestedHost = removeWWW(requestedHost);
				requestedHost = removePort(requestedHost);

				for (var i in _this.domains) {
					if (requestedHost == _this.domains[i].host) _this.domains[i].dispatcher.dispatch(req, res);
				}
			} catch (err) {
				_this.logger.error('Problem handling request: ', err);
			}
		};

		this.HTTPServer = http.createServer(this.handleRequest);
	}

	_createClass(StarkServer, [{
		key: 'getServerletiables',
		value: function getServerletiables(request) {
			var port = this.HTTPSServer ? this.HTTPSPort : this.HTTPPort;
			var host = removePort(request.headers.host);
			var software = 'StarkServer/' + SERVER_VERSION + ' (' + os.type() + ')';
			var signature = software + 'Server at ' + host + ' Port ' + port;
			var server = {
				server_software: software,
				server_name: request.connection.servername,
				request_method: request.method,
				query_string: request.url.split('?').length > 1 ? request.url.split('?')[1] : '',
				http_accept: request.headers.accept,
				http_accept_encoding: request.headers['accept-encoding'],
				http_accept_language: request.headers['accept-language'],
				http_host: host,
				http_user_agent: request.headers['user-agent'],
				remote_addr: request.connection.remoteAddress,
				server_admin: 'web@localhost',
				server_port: port,
				server_signature: signature
			};

			return server;
		}
	}, {
		key: 'checkIfFileExists',
		value: function checkIfFileExists(file) {
			try {
				return fs.statSync(file).isFile();
			} catch (err) {
				if (err.code === 'ENOENT') return false;else throw err;
			}
		}
	}, {
		key: 'setHTTPPort',
		value: function setHTTPPort(port) {
			this.HTTPPort = port;
		}
	}, {
		key: 'setSSLPort',
		value: function setSSLPort(port) {
			this.HTTPSPort = port;
		}
	}, {
		key: 'setSSLOptions',
		value: function setSSLOptions(opts) {
			if (!this.checkIfFileExists(opts.cert) || !this.checkIfFileExists(opts.key)) {
				this.logger.error('Invalid SSL cert or key file set in configuration.');
				return;
			}

			var options = {
				cert: fs.readFileSync(opts.cert),
				key: fs.readFileSync(opts.key)
			};

			this.HTTPSServer = https.createServer(options, this.handleRequest);
			this.HTTPServer = http.createServer(function (req, res) {
				res.writeHead(302, { Location: 'https://' + req.headers.host + req.url });
				res.end();
			});
		}
	}, {
		key: 'generateDispatcherRequest',
		value: function generateDispatcherRequest(dom, file) {
			var _this2 = this;

			var requestURL = constructURLFromPath(dom, file);
			var fileType = getFileType(file);
			var mimeType = this.mimeTypeLookup(fileType);
			var request = null;
			var response = null;

			var formatParams = function formatParams(params) {
				console.log(params);
				var retParams = {};

				try {
					retParams = Object.keys(params)[0];
					retParams = retParams.replace(/[\\]+/g, '');
					retParams = JSON.parse(retParams);
				} catch (err) {
					retParams = params;
				}

				console.log(retParams);
				return retParams;
			};

			var DriverCallback = function DriverCallback(mimeType, page, error) {
				if (error) _this2.logger.error(error);
				if (mimeType == 'NOT_SUPPORTED_FILE') {
					fs.readFile(page, function (error, res) {
						if (error) _this2.logger.error(error);

						response.writeHead(200, { 'Content-Type': mimeType });
						response.end(res);
					});
				} else {
					response.writeHead(200, { 'Content-Type': _this2.mimeTypeLookup(page) });
					response.end(page);
				}
			};

			var handleGetRequest = function handleGetRequest(req, res) {
				request = req;
				response = res;
				var sentToDriver = false;

				for (var i in _this2.drivers) {
					if (_this2.drivers[i].fileTypes.indexOf(fileType) > -1) {
						var DriverClass = require(path.join(__dirname, path.normalize(_this2.drivers[i].driverFile)));
						var serverletiables = _this2.getServerletiables(req);
						serverletiables.document_root = path.normalize(dom.baseDirectory + '/');
						var driver = new DriverClass(serverletiables);
						sentToDriver = true;
						driver.onGet(file, req.params, DriverCallback);
					}
				}

				if (!sentToDriver) {
					res.writeHead(200, { 'Content-Type': mimeType });

					fs.readFile(file, function (error, response) {
						res.end(response);
					});
				}
			};

			var handlePostRequest = function handlePostRequest(req, res) {
				var sentToDriver = false;
				var params = formatParams(req.params);
				request = req;
				response = res;

				for (var i in _this2.drivers) {
					if (_this2.drivers[i].fileTypes.indexOf(fileType) > -1) {
						var DriverClass = require(path.join(__dirname, path.normalize(_this2.drivers[i].driverFile)));
						var serverletiables = _this2.getServerletiables(req);
						serverletiables.document_root = path.normalize(dom.baseDirectory + '/');
						var driver = new DriverClass(serverletiables);
						sentToDriver = true;
						driver.onPost(file, params, DriverCallback);
					}
				}

				if (!sentToDriver) {
					res.writeHead(200, { 'Content-Type': mimeType });

					fs.readFile(file, function (error, response) {
						res.end(response);
					});
				}

				if (dom.onPost !== undefined) dom.onPost(req.params, file);
			};

			dom.dispatcher.onGet(requestURL, handleGetRequest);
			dom.dispatcher.onPost(requestURL, handlePostRequest);

			if (this.domainIndexSet[dom.host] === undefined) {
				if (dom.index !== undefined) {
					if (requestURL == '/' + dom.index) {
						dom.dispatcher.onGet('/', handleGetRequest);
						dom.dispatcher.onPost('/', handlePostRequest);
						this.domainIndexSet[dom.host] = true;
					}
				} else if (requestURL.indexOf('index') > -1) {
					dom.dispatcher.onGet('/', handleGetRequest);
					dom.dispatcher.onPost('/', handlePostRequest);
					this.domainIndexSet[dom.host] = true;
				}
			}
		}
	}, {
		key: 'setupNewDomain',
		value: function setupNewDomain(dom) {
			var _this3 = this;

			dom.host = removeWWW(dom.host);
			dom.dispatcher = new HttpDispatcher();

			var filesToIgnore = dom.filesToIgnore === undefined ? [] : dom.filesToIgnore;
			var directoriesToIgnore = dom.directoriesToIgnore === undefined ? [] : dom.directoriesToIgnore;

			var filesReceived = function filesReceived(files) {
				if (files !== undefined) {
					for (var i = files.length - 1; i >= 0; i--) {
						if (dom.allowedFileTypes == '*' || dom.allowedFileTypes.indexOf(getFileType(files[i])) > -1) {
							var file = path.normalize(files[i]);
							_this3.generateDispatcherRequest(dom, file);
						}
					}
				}
			};

			getFilesFromDirectory(dom.baseDirectory, filesToIgnore, directoriesToIgnore, filesReceived);

			dom.dispatcher.onError(function (req, res) {
				var fourOhFour = dom.error['404'] === undefined ? '404 - Page does not exist.' : dom.error['404'];
				var fourOhFourFilePath = path.normalize(dom.baseDirectory + '/' + fourOhFour);
				var fourOhFourFileExists = _this3.checkIfFileExists(fourOhFourFilePath);

				res.writeHead(404);

				if (fourOhFourFileExists) res.end(fs.readFileSync(fourOhFourFilePath));else res.end(fourOhFour);
			});

			if (dom.secure) {
				if (dom.cert !== undefined && dom.key !== undefined) {
					if (!this.checkIfFileExists(dom.cert) || !this.checkIfFileExists(dom.key)) this.logger.warn('Path to SSL certificate or key invalid for domain: ' + dom.host);else {
						var serverOptions = {
							key: fs.readFileSync(dom.key),
							cert: fs.readFileSync(dom.cert)
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

	}, {
		key: 'addDomain',
		value: function addDomain(dom) {
			if (Array.isArray(dom.host)) {
				var hosts = dom.host;

				for (var i = 0; i < hosts.length; i++) {
					var newDom = {
						host: hosts[i],
						baseDirectory: dom.baseDirectory,
						allowedFileTypes: dom.allowedFileTypes,
						index: dom.index,
						filesToIgnore: dom.filesToIgnore,
						directoriesToIgnore: dom.directoriesToIgnore,
						error: dom.error
					};

					this.domains.push(newDom);
					this.setupNewDomain(newDom);
				}
			} else {
				this.domains.push(dom);
				this.setupNewDomain(dom);
			}
		}

		//Takes an array of JSON objects as described above

	}, {
		key: 'addDomains',
		value: function addDomains(doms) {
			for (var key in doms) {
				if (key !== undefined) {
					this.addDomain(doms[key]);
				}
			}
		}
	}, {
		key: 'addDriver',
		value: function addDriver(driver) {
			this.drivers.push(driver);
		}
	}, {
		key: 'addDrivers',
		value: function addDrivers(drivers) {
			for (var key in drivers) {
				if (key !== undefined) {
					this.addDriver(drivers[key]);
				}
			}
		}
	}, {
		key: 'setAllowedFileTypes',
		value: function setAllowedFileTypes(host, types) {
			for (var i = this.domains.length - 1; i >= 0; i--) {
				if (this.domains[i].host == host) {
					this.domains[i].allowedFileTypes = types;
					break;
				}
			}
		}
	}, {
		key: 'startHTTP',
		value: function startHTTP() {
			var _this4 = this;

			this.HTTPServer.listen(this.HTTPPort, function () {
				_this4.logger.info('Listening on: http://localhost:', _this4.HTTPPort);
			});
		}
	}, {
		key: 'startHTTPS',
		value: function startHTTPS() {
			var _this5 = this;

			this.HTTPSServer.listen(this.HTTPSPort, function () {
				_this5.logger.info('Listening on: https://localhost:', _this5.HTTPSPort);
			});
		}
	}, {
		key: 'start',
		value: function start() {
			this.startHTTP();
			if (this.HTTPSServer !== undefined) {
				this.startHTTPS();
			}
		}
	}]);

	return StarkServer;
}();

module.exports = new StarkServer();