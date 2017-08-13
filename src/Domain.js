let util           = require('./ServerUtil.js');
let HttpDispatcher = require('httpdispatcher');

class Domain {
	constructor(hosts, baseDirectory) {
		if(!hosts || !baseDirectory) {
			console.error('Both hosts and baseDirectory must be set for Domain object!');
			return;
		}
		
		this.hosts               = hosts;
		this.baseDirectory       = baseDirectory;
		this.index               = '';
		this.allowedFileTypes    = ['html', 'js', 'css'];
		this.filesToIgnore       = [];
		this.directoriesToIgnore = [];
		this.error               = {};
		this.mimeTypeLookup      = require('mime-types').lookup;
		this.dispatcher          = new HttpDispatcher();
	}

	async init() {
		let files = await util.getFilesFromDirectory(this.baseDirectory, this.filesToIgnore, this.directoriesToIgnore);

		if(files) {
			files.forEach((file) => {
				let fileType = util.getFileType(file);

				if(this.allowedFileTypes.indexOf(fileType) > -1) {
					let url = this.constructUrlFromPath(file);
					this.dispatcher.onGet(`/${url}`, this.onGet);
					this.dispatcher.onPost(`/${url}`, this.onPost);
				}
			});
		}
		else console.error(`Error retrieving files to serve from ${this.baseDirectory}`);
	}

	onGet(req, res) {
		console.log('Received Get Request!');
	}

	onPost(req, res) {

	}

	constructUrlFromPath(filepath) {
		let index = filepath.indexOf(this.baseDirectory);
		if(index > -1) {
			return filepath.substring(index + this.baseDirectory.length, filepath.length);
		}

		return '';
	};

	handleRequest(req, res) {
		this.dispatcher.dispatch(req, res);
	}

	getHosts() {
		return this.hosts;
	}

	setHosts(hosts) {
		this.hosts = hosts;
	}

	getBaseDirectory() {
		return this.baseDirectory;
	}

	setBaseDirectory(baseDirectory) {
		this.baseDirectory = baseDirectory;
	}

	getIndex() {
		return this.index;
	}

	setIndex(index) {
		this.index = index;
	}

	getAllowedFileTypes() {
		return this.allowedFileTypes;
	}

	setAllowedFileTypes(allowedFileTypes) {
		this.allowedFileTypes = allowedFileTypes;
	}

	getFilesToIgnore() {
		return this.filesToIgnore;
	}

	setFilesToIgnore(filesToIgnore) {
		this.filesToIgnore = filesToIgnore;
	}

	getDirectoriesToIgnore() {
		return this.directoriesToIgnore;
	}

	setDirectoriesToIgnore(directoriesToIgnore) {
		this.directoriesToIgnore = directoriesToIgnore;
	}

	getError() {
		return this.error;
	}

	setError(error) {
		this.error = error;
	}
}

module.exports = Domain;

// host               :['127.0.0.1'],
// baseDirectory      :'/home/dustin/dev/personal/locationupdater2/dist',
// allowedFileTypes   :['js','css','html', 'woff', 'woff2', 'php', 'png', 'ico', 'jpg'],
// index              :'index.html', //Optional,
// filesToIgnore      :['.gitignore'], //Optional
// directoriesToIgnore:['.git'], //Optional
// error              : {
// // '404':'404.html' //Optional
// }