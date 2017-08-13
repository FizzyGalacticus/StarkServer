let fs        = require('fs');
let recursive = require('recursive-readdir');
let path      = require('path');

class ServerUtil {
	constructor() {

	}

	static getFilesFromDirectory(directory, typesToIgnore, dirsToIgnore) {
		let ignoreFunc = (file, stats) => {
			if(stats.isDirectory() && dirsToIgnore && dirsToIgnore.indexOf(path.basename(file)) > -1)
				return true;
			else if(stats.isFile() && typesToIgnore && typesToIgnore.indexOf(path.basename(file)) > -1)
				return true;
			else return false;
		};

		return new Promise((resolve, reject) => {
			recursive(directory, ['.htaccess', ignoreFunc],  (err, files) => {
				resolve(files);
				reject(err);
			});
		}).then(files => {return files;}).catch(err => {console.error(err);});
	}

	static checkIfFileExists(file) {
		try {
			return fs.statSync(file).isFile();
		}
		catch(err) {
			if(err.code === 'ENOENT')
				return false;
			else throw err;
		}
	}

	static readFileContents(file) {
		return new Promise((resolve, reject) => {
			fs.readFile(file, (err, data) => {
				resolve(data);
				reject(err);
			})
		});
	}

	static getFileType(file) {
		let suffix = '';
		for (let i = file.length - 1; i >= 0 && file[i] != '.'; i--) {
			suffix += file[i];
		}

		return suffix.split('').reverse().join('');
	}

	static getHostFromUrl(url) {
		let ret = url;
		let httpIndex = ret.indexOf('://');

		if(httpIndex > -1)
			ret = ret.substring(httpIndex+3, ret.length);

		let wwwIndex = ret.indexOf('www');

		if(wwwIndex > -1)
			ret = ret.substring(wwwIndex+4, ret.length);

		return ret;
	}

	static removePortFromHost(host) {
		let indexOfPort = host.indexOf(':');

		if(indexOfPort > -1) 
			return host.substring(0, indexOfPort);

		return host;
	};
}

module.exports = ServerUtil;