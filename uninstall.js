var service = require("node-windows").Service;

// create a new service object (5 min auto-restart)
var svc = new service({
  name: "nMarket Orchestrator",
  description: "This starts up all necessary threads for nMarket.",
  script: "F:\\devops\\orchestrator\\server.js",
  wait: 300
});
 
// listen for the "install" event, which indicates the process is available as a service. 
svc.on("uninstall", function() {
  console.log("The 'nMarket Orchestrator' service has been uninstalled.");
});

svc.uninstall();
