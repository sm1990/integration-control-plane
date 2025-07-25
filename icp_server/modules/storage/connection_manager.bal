import ballerina/sql;
import ballerinax/mysql;
import ballerinax/mysql.driver as _;
import ballerinax/postgresql;
import ballerinax/postgresql.driver as _;

type Config record {
    string host = dbHost;
    int port = dbPort;
    string name = dbName;
    string username = dbUser;
    string password = dbPassword;
    int maxPoolSize = 10;
};

type MySQLConfig record {
    *Config;
};

enum DatabaseType {
    MYSQL = "mysql",
    POSTGRESQL = "postgresql"
}

public client class DatabaseConnectionManager {
    private final sql:Client dbClient;
    private final string dbType;

    public function init(string dbType) returns error? {
        self.dbType = dbType;
        sql:ConnectionPool pool = {
            maxOpenConnections: maxOpenConnections,
            minIdleConnections: minIdleConnections,
            maxConnectionLifeTime: maxConnectionLifeTime
        };

        if dbType == MYSQL {
            self.dbClient = check new mysql:Client(dbHost, dbUser, dbPassword, dbName, dbPort, connectionPool = pool);
        } else {
            self.dbClient = check new postgresql:Client(dbHost, dbUser, dbPassword, dbName, dbPort, connectionPool = pool);
        }
    }

    public isolated function getClient() returns sql:Client {
       return self.dbClient;
    }

    public isolated function close() returns error? {
        return self.dbClient.close();
    }
}
