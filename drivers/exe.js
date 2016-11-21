var exec = require('child_process').exec;

ExeDriver  = function(server_vars) {
    this.server = server_vars;
};

ExeDriver.prototype.onGet = function(file, params, callback) {
    this.execute(file, callback, 'GET', params);
};

ExeDriver.prototype.onPost = function(file, params, callback) {
    this.execute(file, callback, 'POST', params);
};

ExeDriver.prototype.execute = function(file, callback, mode, params) {
    var self = this;
    var cmd  = file + ' ' + mode + ' ';
    var paramKeys = Object.keys(params);

    for(var i = 0; i < paramKeys.length; i++) {
        var key = paramKeys[i].replace(/'/g,'\'"\'"\'');
        var value = params[key].replace(/'/g,'\'"\'"\'');
        cmd += ' \'' + key + '\' \'' + value + '\'';
    }
    
    exec(cmd, function(error, stdout, stderr) {
        callback(self.getMimeType(), stdout, stderr);
    });
};

ExeDriver.prototype.getMimeType = function() {
    return 'text/html';
};

module.exports = ExeDriver;