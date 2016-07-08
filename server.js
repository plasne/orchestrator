// Notes:
// add authentication
// add endpoints for starting/stopping services
// add workflow for failover
// can we get a message when the app server is SUCCESSFUL or FAILED

// references
var config = require("config");
var fs = require("fs");
var spawn = require("child_process").spawn;
var fork = require("child_process").fork;
var q = require("q");
var sql_connection = require("tedious").Connection;
var sql_request = require("tedious").Request;
var os = require("os");
var dns = require("dns");

// variables
const log_path = config.get("log.path");
var log;
var listeners = [];

// replace all prototype
String.prototype.replaceAll = function(str1, str2, ignoreCase)
{
  return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g,"\\$&"),(ignoreCase?"gi":"g")),(typeof(str2)=="string")?str2.replace(/\$/g,"$$$$"):str2);
};

// get a timestamp useful for logging
Date.prototype.ts = function() {
  var yyyy = this.getFullYear().toString();
  var mm = (this.getMonth()+1).toString(); // getMonth() is zero-based
  var dd  = this.getDate().toString();
  var hh  = this.getHours().toString();
  var mi  = this.getMinutes().toString();
  return yyyy + (mm[1]?mm:"0"+mm[0]) + (dd[1]?dd:"0"+dd[0]) + (hh[1]?hh:"0"+hh[0]) + (mi[1]?mi:"0"+mi[0]); // padding
};
var ts = new Date().ts();

// get the ip address
var ip;
dns.lookup(os.hostname(), function (err, add, fam) {
  ip = add;
})

// file copy
function copyFile(source, destination, tokens) {
  var deferred = q.defer();
  var read = fs.createReadStream(source);
  read.setEncoding("utf8");
  var write = fs.createWriteStream(destination);
  read.on("error", function(err) {
    deferred.reject(err);
  });
  write.on("error", function(err) {
    deferred.reject(err);
  });
  write.on("close", function(ex) {
    deferred.resolve();
  });
  read.on("data", function(data) {
    var modified = data;
    tokens.forEach(function(token) {
      modified = modified.replaceAll(token.key, token.value, true);
    });
    write.write(modified);
  });
  read.on("end", function() {
    write.end();
  });
  return deferred.promise;
}

function copyFiles(source, destination, files, tokens, out) {
  var deferred = q.defer();
  if (files.length > 0) {
    var file = files.pop();
    out.write("COPY " + source + "\\" + file + " to " + destination + "\\" + file + ".\r\n");
    copyFile(source + "\\" + file, destination + "\\" + file, tokens).then(function() {
      copyFiles(source, destination, files, tokens, out).then(function() {
        deferred.resolve();
      }, function() {
        deferred.reject();
      });
    }, function(err) {
      out.write("ERR: could not copy file - " + err);
      deferred.reject();
    });
  } else {
    deferred.resolve();
  }
  return deferred.promise;
}

// deploy a new directory and files for the listener
function deployListener(listener, out) {
  var deferred = q.defer();

  // create the deployment directory if it doesn't already exist
  var path = config.get("iso.deploy.destination") + "\\iso-" + listener.company + "." + listener.environment;
  fs.mkdir(path, function(err) {
    if (!err) {

      // build the tokens
      var tokens = [
        { key: "[var:port]", value: listener.port },
        { key: "[var:company]", value: listener.company },
        { key: "[var:directory]", value: listener.directory },
        { key: "[var:environment]", value: listener.environment },
        { key: "[var:ip]", value: ip }
      ];

      // copy the files
      var source = config.get("iso.deploy.source");
      var destination = path;
      var files = config.get("iso.deploy.files").slice();
      copyFiles(source, destination, files, tokens, out).then(function() {
        deferred.resolve(path);
      }, function() {
        deferred.reject();
      });

    } else if (err.code === "EEXIST") {
      // directory already exists
      deferred.resolve(path);
    } else {
      out.write("ERR: couldn't create the ISO directory " + path + ".\r\n");
      deferred.reject();
    }
  });

  return deferred.promise;
}

// start an ISO listener
function startListener(listener) {
  var delayed = q.delay(2000);
  const out = fs.createWriteStream(log_path + "\\iso-" + listener.company + "." + listener.environment + "-" + ts + ".log", {
    flags: "a",
    defaultEncoding: "utf8"    
  });
  deployListener(listener, out).then(function(path) {
    const child = spawn(config.get("iso.cmd"), [], {
      detached: true,
      shell: true,
      stdio: ["ignore", out, out],
      cwd: path
    });
    log.write("ISO Listener (" + name + ") starting up with PID " + child.pid + "\r\n");
    child.on("close", function(code) {
      if (code === 0) {
        log.write("ISO Listener (" + name + ") shutdown successfully.\r\n");
      } else {
        log.write("ISO Listener (" + name + ") failed (" + code + "), please check the appropriate log.\r\n");
      }
    });
    child.on("error", function(err) {
      out.write("ERR: " + err);
      out.end();
    });
  }, function() {
    out.end();
  });
  return delayed;
}

function startListeners() {
  var deferred = q.defer();
  if (listeners.length > 0) {
    var listener = listeners.pop();
    startListener(listener).then(function() {
      startListeners().then(function() {
        deferred.resolve();
      }, function() {
        deferred.reject();
      });
    }, function() {
      deferred.reject();
    });
  } else {
    deferred.resolve();
  }
  return deferred.promise;
}

// start the mail relay
function startRelay() {
  var deferred = q.defer();
  const out = fs.createWriteStream(log_path + "\\relay-" + ts + ".log", {
    flags: "a",
    defaultEncoding: "utf8"    
  });
  const child = fork(config.get("relay.cmd"), [], {
    silent: true,
    cwd: config.get("relay.path")
  });
  log.write("SMTP Forward starting up with PID " + child.pid + ".\r\n");
  child.stdout.setEncoding("utf8");
  child.stdout.pipe(out);
  child.stderr.pipe(out);
  child.stdout.on("data", function(data) {
    if (data.startsWith("SMTP Forward listening on port 25 for SMTP traffic.")) {
      deferred.resolve();
    }
  });
  child.on("close", function(code) {
    if (code === 0) {
      log.write("SMTP Forward shutdown successfully.\r\n");
      deferred.resolve();
    } else {
      log.write("SMTP Forward failed (" + code + "), please check the appropriate log.\r\n");
      deferred.reject();
    }
  });
  return deferred.promise;
}

// start the app
function startApp() {
  var delayed = q.delay(180000);
  const out = fs.openSync(log_path + "\\app-" + ts + ".log", "a");
  const child = spawn(config.get("app.cmd"), [], {
    detached: false,
    shell: true,
    stdio: ["ignore", out, out],
    cwd: config.get("app.path")
  });
  log.write("nMarket App starting up with PID " + child.pid + ".\r\n");
  child.on("close", function(code) {
    if (code === 0) {
      log.write("nMarket App shutdown successfully.\r\n");
    } else {
      log.write("nMarket App failed (" + code + "), please check the appropriate log.\r\n");
    }
  });
  return delayed;
}

// create the log directory
fs.mkdir(log_path, function(err) {
  if (!err || (err.code === 'EEXIST')) {

    // write the master log
    log = fs.createWriteStream(log_path + "\\log-" + ts + ".log", {
      flags: "a",
      defaultEncoding: "utf8",
      autoClose: true
    });
    log.write("nMarket Orchestrator starting up at " + ts + ".\r\n");

    // get the list of ISO listeners
    var connection = new sql_connection({
      userName: config.get("iso.list.user"),
      password: config.get("iso.list.password"),
      server: config.get("iso.list.server"),
      options: {
        database: config.get("iso.list.database"),
        encrypt: true
      }
    });
    connection.on("connect", function(err) {
      if (!err) {

        // build the SQL query
        var request = new sql_request(config.get("iso.list.query"), function(err, count) {
          if (!err) {

            // start each server type in turn
            startApp().then(function() {
              startRelay();
              startListeners();
            }, function() {
              log.write("ERR: startup halted because of critical falure.\r\n");
            });

          } else {
            log.write("ERR: could not connect to SQL database.\r\n");
            log.write(err + "\r\n");
          }
        });

        // queue each ISO listener
        request.on("row", function(columns) {
          listeners.push({
            company: columns[0].value,
            environment: columns[1].value,
            directory: columns[2].value,
            port: columns[3].value
          });
        });

        // execute the query
        connection.execSql(request);

      } else {
        console.log(err);
      }
    });

  } else {
    console.log("could not create the log dir");
  }
});
