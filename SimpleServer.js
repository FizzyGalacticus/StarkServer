var fs        = require('fs');
var path      = require('path');
var http      = require('http');
var recursive = require('recursive-readdir');

var removeWWW = function(url) {
	if(url.indexOf('www') > -1)
		return url.substring(4, url.length);

	return url;
};

var getFileType = function(file) {
	var suffix = '';
	for (var i = file.length - 1; i >= 0 && file[i] != '.'; i--) {
		suffix += file[i];
	};

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
		return dom.host + filepath.substring(index + dom.baseDirectory.length, filepath.length);
	}

	return '';
};

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
	    res.end('404 - Could not find ' + req.headers.host + req.url);
	});
};

SimpleServer.prototype.setPort = function(port) {
	this.port = port;
};

SimpleServer.prototype.setupNewDomain = function(dom) {
	dom.host = removeWWW(dom.host);
	var self = this;
	getFilesFromDirectory(dom.baseDirectory, function(files) {
		for (var i = files.length - 1; i >= 0; i--) {
			var file = files[i];

			if(dom.allowedFileTypes.indexOf(getFileType(file)) > -1) {
				console.log(constructURLFromPath(dom, file));
				self.dispatcher.onGet(constructURLFromPath(dom, file), function(req, res) {
					res.writeHead(200, {'Content-Type': 'text/html'});
	        		res.end(fs.readFileSync(file));
				});
			}
		};
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
	// if(dom.host.indexOf(':') == -1)
	// 	dom.host += (':' + this.port);

    this.domains.push(dom);
    this.setupNewDomain(dom);
};

//Takes an array of JSON objects as described above
SimpleServer.prototype.addDomains = function(doms) {
	for (var i = doms.length - 1; i >= 0; i--) {
		this.addDomain(doms[i]);
	};
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