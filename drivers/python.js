var exec  = require('child_process').exec;

PythonDriver = function() {};

PythonDriver.prototype.onGet = function(file, params, callback) {
    this.execute(file, callback, params, {});
};

PythonDriver.prototype.onPost = function(file, params, callback) {
    this.execute(file, callback, {}, params);
};

PythonDriver.prototype.execute = function(file, callback, getParams, postParams) {
    var cmd  = 'python ' + file;
    var self = this;
    exec(cmd, function(error, stdout, stderr) {
        callback(self.getMimeType(), stdout);
    });
};

PythonDriver.prototype.getMimeType = function() {
    return 'text/html';
};

module.exports = new PythonDriver();