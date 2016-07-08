# Orchestrator
This is a sample Node app to orchestrate the startup of applications on a system. This was created for a specific application and so should be heavily modified for any specific use.

## Install
The app can be deployed as a Windows Service and set to startup automatically - this should be the primary way to ensure the nMarket application and associated apps are started on each server. This requires the .NET Framework 3.5 to be installed on the server.

To install the app, type:

* node install.js

To install the app, type:

* node uninstall.js

## Improvements
Currently there is no command interface for the app, it simply attempts to do the 5 steps defined above. A future version would be more useful if there was a command interface that allowed you to:

* Shutdown services that were started
* Startup/shutdown services granularly instead of all at once
* Handle a failover scenario from one region to another
* Add a command to startup new listeners that aren't currently running (in the event that the app no longer requires a recycle for adding environments)
