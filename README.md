# Orchestrator
This Node.js app starts up the nMarket application by performing the following steps:

1. Startup the main app
2. Startup the SMTP Forward app
3. Query the core database to get a list of all environments
4. Copy the necessary startup files for each ISO Listener (1 per environment)
5. Startup each ISO Listener

## Config
Inside the /config folder should be a file called default.json (there is a sample in this project called default.sample.json that can be renamed). The following options should be configured as described below.

Please note that the "\" is an escape character and so must be written "\\" in UNC paths.

```
{
  "log": {
    "path": "This should be the UNC path to where the startup logs should be written. This path will be created if it doesn't already exist. Example: F:\\ochestrator-logs"
  },
  "app": {
    "path": "This should be the UNC path of the folder containing the BAT file for starting up the main app. Example: F:\\01-NM-AZURE-DEV\\01-NM-AZURE-DEV\\wildfly-8.2.0.Final\\bin",
    "cmd": "This should be the name of the BAT file to startup the main app. Example: 00_start_appsvr.bat"
  },
  "relay": {
    "path": "This should be the UNC path of the folder containing the Node.js file for starting up the SMTP Forward app. Example: F:\\devops\\smtpforward",
    "cmd": "This should be the name of the Node.js file to startup the SMTP Forward app. Example: server.js"
  },
  "iso": {
    "deploy": {
      "source": "This should be the UNC path of the folder containing the ISO listener master files (the ones that will be copied for each instance). Example: F:\\01-NM-AZURE-DEV\\01-NM-AZURE-DEV\\iso",
      "files": This should be an array of files that will be copied from the source directory to each ISO Listener instance directory. Example: ["runISOListener.bat", "servletconfig.xml", "http.log4j.xml"],
      "destination": "This should be the UNC path of the folder that each of the ISO Listener instances will be created in. Example: F:\\01-NM-AZURE-DEV\\01-NM-AZURE-DEV"
    },
    "cmd": "This should be the name of the BAT file that will run in each of the ISO Listener instances to startup the app. Example: runISOListener.bat",
    "list": {
      "server": "This should be the fully qualified DNS name of the SQL Server containing the core database. Example: sample.database.windows.net",
      "database": "This should be the name of the core DB. Example: abbe1-aedb-core01",
      "user": "This should be a username that can run the below query in the database. Example: core",
      "password": "This should be the password to use with the above username.",
      "query": "This should be a query that returns the company name (ex. ACME), environment name (ex. Prod), Azure AD directory (ex. acme.onmicrosoft.com), and port number (ex. 6010) for each instance of the ISO Listener that should be created and started. Example: SELECT c.COMPANY_NAME as company, e.ENVIR_NAME as environment, c.AD_DOMAIN as directory, (6000 + e.AUTH_ENVIR_ID) as port FROM X_AUTH_COMPANY c INNER JOIN X_AUTH_ENVIR_XREF x ON c.AUTH_COMPANY_ID = x.AUTH_COMPANY_ID INNER JOIN X_AUTH_ENVIR e ON e.AUTH_ENVIR_ID = x.AUTH_ENVIR_ID WHERE e.AUTH_ENVIR_ID >= 0;"
    }
  }
}
```

## Logging

The app will create the following logs:

* log-*   This will show all actions that the Orchestrator app is taking.
* app-*   This will detail the startup and operation of the main app.
* relay-* This will detail the startup and operation of the SMTP Forward app.
* iso-*   There will be one of these per ISO Listener detailing its startup and operation

Each time the Orchestrator app is run a new set of logs will be created (a timestamp is appended at the end).

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
