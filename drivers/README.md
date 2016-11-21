# StarkServer Drivers
---

StarkServer allows for easy Driver plugins to be added, which in turn makes it possible to use nearly any programming language to create web pages.

Currently, this is done by recognizing certain file extensions and sending them to the appropriate Driver plugin. The plugins will run the scripts, and if successful, will return any output to stdout.

This may not be the best way to handle this, but it certainly is the easiest, and I have not performed exessive research into how other web servers handle this.

# Existing Drivers
---

### PHP.js
This plugin will send any .php files to the php interpreter and will respond with the output from stdout.

Known Issues:
* Currently does not set any $_SERVER variables, and could probably also pass parameters more efficiently

Requirements:
* PHP interpreter in PATH

### Python.js
This plugin sends all .py files to the python interpreter, sending pack any ouput from stdout.

Known Issues:
* Does not yet accept GET or POST parameters

Requirements:
* Python interpreter in PATH

### Node.js
This plugin is special in that it distinguishes between NodeJS files and regular JS files by looking for
```JavaScript
//NODE
```
as the first six letters in the .js file. If this is found, then the file is sent through the node interpreter and the output from stdout is returned to the server.

Known Issues:
* None

Requirements:
* Node interpreter in PATH
* Must have "//NODE" at the very beginning of .js files that are to be interpreted by Node
* (Unfortunately) currently only works on *nix systems with bash

### Exe.js
This plugin allows the output from a standard executable file to be sent to a web client.

Known Issues:
* Passing double quotes (e.g. ' **"** ') as a paramter may yield unintended results.

Requirements:
* None

# Layout of Driver plugin
---
If you are interested in adding a Driver for a new language (which I would greatly appreciate!), or would like to help fix issues and refine existing ones, you will need to know the basic structure of the plugins.

Here is a breakdown of how the existing Drivers look:
```JavaScript
var exec  = require('child_process').exec;

DriverName = function() {};

//This is the function that StarkServer looks for upon a GET request
DriverName.prototype.onGet = function(file, params, callback) {
    this.execute(file, callback, params, {});
};

//This is the function that StarkServer looks for upon a POST request
DriverName.prototype.onPost = function(file, params, callback) {
    this.execute(file, callback, {}, params);
};

//This function is ultimately called and decides how to handle the request
DriverName.prototype.execute = function(file, callback, getParams, postParams) {
    var cmd  = 'INTERPRETER ' + file + ' PARAMS';
    var self = this;
    exec(cmd, function(error, stdout, stderr) {
        callback(self.getMimeType(), stdout);
    });
};

//This function simply returns the MIME type of the file,
//so that the browser knows how to handle it
DriverName.prototype.getMimeType = function() {
    return 'text/html';
};

//Don't forget to export a new instance of your Driver!
module.exports = new DriverName();
```

Even though this has been my model, you can have a Driver plugin declared however you deem necessary in order to perform exactly as it should. The only requirements are that the exported module contains an ```onGet``` and ```onPost``` method, each taking the ```file```, ```params```, and ```callback``` parameters. The callback parameters must be the MIME type of the file, and the contents. There is also an optional third argument, ```error```, should anything go awry.

If your Driver decides that it doesn't want to handle the file that was sent to it, simply return 'NOT_SUPPORTED_FILE' as the MIME type, and the file path back to the callback.