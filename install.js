var service = require("node-windows").Service;

// create a new service object (5 min auto-restart)
var svc = new service({
  name: "nMarket Orchestrator",
  description: "This starts up all necessary threads for nMarket.",
  script: "F:\\devops\\orchestrator\\server.js",
  wait: 300
});
 
// listen for the "install" event, which indicates the process is available as a service. 
svc.on("install", function() {
  console.log("This service has been installed as 'nMarket Orchestrator'.");
  svc.start();
});

svc.on("alreadyinstalled", function() {
  console.log("This service is already installed.");
});

svc.on("invalidinstallation", function() {
  console.log("This service failed to install.");
});

svc.install();
