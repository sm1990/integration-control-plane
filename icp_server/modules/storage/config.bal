// Database configuration
configurable string dbHost = "localhost";
configurable int dbPort = 5432;
configurable string dbName = "icp_db";
configurable string dbUser = "icp_user";
configurable string dbPassword = "icp_password";
configurable int dbMaxPoolSize = 10;
configurable int maxOpenConnections = 10;
configurable int minIdleConnections = 5;
configurable decimal maxConnectionLifeTime = 1800.0; // 30 minutes
configurable string dbType = "mysql"; 