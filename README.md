# StarkServer

StarkServer is a simple, easy to use, and highly configurable web server written for NodeJS. I wanted a way to have a website up in seconds, without all of the extra gunk offered by other webservers.

With StarkServer, you can:
* Specify certain filetypes you'd like to serve.
* Host multiple domains from the same server (virtual hosts).
* Serve over HTTP and HTTPS.
* Easily write new Drivers to output to the web in *any* language.

### Tech

StarkServer uses the following technologies to serve your pages:

* [node.js]
  - fs
  - path
  - http
  - https
  - recursive-readdir
  - mime-types
  - simple-node-logger

### Installation

StarkServer requires [Node.js](https://nodejs.org/) v4.5+ to run.

Download and extract the [latest release](https://github.com/FizzyGalacticus/StarkServer/archive/master.zip).

Install the dependencies.

```sh
$ cd StarkServer
$ npm install
```

### Configure
There exists a JSON config file that is already setup with the options that are needed, just with generic inputs. You will need to make sure the ports are the ones you wish to bind to, the baseDirectory is set (the directory of your website), and any Drivers are setup if you need them. An example from my config looks like this:

```js
var config = {
    ports: {
        http: 80,
        https:443
    },
    ssl: {
        cert:'/home/www/certs/fullchain.pem',
        key: '/home/www/certs/key.pem'
    },
    domains: {
        localhost:{
                host            :['localhost', '127.0.0.1', 'hostname'],
                baseDirectory   :'/home/www/mywebsite',
                allowedFileTypes:['js','css','html'],
                index:'index.html',
                filesToIgnore: ['.gitignore'],
                directoriesToIgnore:['.git']
        }
    },
    drivers: {
        name: {
            DriverFile: 'drivers/php.js',
            fileTypes:['php']
        }
    }
};

module.exports = config;
```

### Run
Running the following should begin the server with your configurations.
```sh
$ node run.js
```

If this fails, try running as root/administrator. By default, you must be root to bind to port 80 and 443.
```sh
$ sudo node run.js
```

### Development

Want to contribute? That would be awesome!

I use [Waffle.io](https://waffle.io/FizzyGalacticus/StarkServer) to keep track of issues for this project.

License
-------

Apache 2.0