// Server configuration
configurable int serverPort = 8080;
configurable string serverHost = "0.0.0.0";

// Authentication configuration
configurable string jwtSecret = "your-secret-key-change-in-production";
configurable string jwtIssuer = "icp-server";
configurable string jwtAudience = "icp-users";
configurable int jwtExpiryHours = 24;

// Operational configuration
configurable int heartbeatTimeoutSeconds = 300; // 5 minutes
configurable int schedulerIntervalSeconds = 60; // 1 minute
configurable int maxPendingCommands = 100;

// Logging configuration
configurable string logLevel = "INFO"; // DEBUG, INFO, WARN, ERROR
configurable boolean enableAuditLogging = true;
configurable boolean enableMetrics = true;

// Connection pool and timeout settings
configurable int dbConnectionTimeoutSeconds = 30;
configurable int httpTimeoutSeconds = 30;
configurable int maxRetryAttempts = 3;