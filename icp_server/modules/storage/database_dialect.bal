// Copyright (c) 2025, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
//
// WSO2 Inc. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
//  http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

import ballerina/sql;
import ballerina/time;

// SQL Dialect abstraction for database-specific features

// Datetime conversion utility functions
public isolated function convertUtcToH2DateTime(time:Utc utcTime) returns string|error {
    time:Civil civilTime = time:utcToCivil(utcTime);
    int seconds = <int>civilTime.second;
    if seconds > 59 {
        seconds = 59;
    }
    return string `${civilTime.year}-${civilTime.month.toString().padStart(2, "0")}-${civilTime.day.toString().padStart(2, "0")} ${civilTime.hour.toString().padStart(2, "0")}:${civilTime.minute.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

public isolated function convertUtcToMySQLDateTime(time:Utc utcTime) returns string|error {
    time:Civil civilTime = time:utcToCivil(utcTime);
    int seconds = <int>civilTime.second;

    // Clamp seconds to valid range (0-59)
    if seconds > 59 {
        seconds = 59;
    }

    // Extract nanoseconds from the original UTC tuple (second element)
    decimal nanoSecondDecimal = utcTime[1];
    int nanoSeconds = <int>nanoSecondDecimal;

    // Convert nanoseconds to microseconds (MySQL supports up to 6 decimal places for microseconds)
    int microSeconds = nanoSeconds / 1000;

    // Format: YYYY-MM-DD HH:MM:SS.mmmmmm (6 digit microseconds)
    return string `${civilTime.year}-${civilTime.month.toString().padStart(2, "0")}-${civilTime.day.toString().padStart(2, "0")} ${civilTime.hour.toString().padStart(2, "0")}:${civilTime.minute.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${microSeconds.toString().padStart(6, "0")}`;
}

public isolated function convertUtcToPostgreSQLDateTime(time:Utc utcTime) returns string|error {
    time:Civil civilTime = time:utcToCivil(utcTime);
    int seconds = <int>civilTime.second;

    // Clamp seconds to valid range (0-59)
    if seconds > 59 {
        seconds = 59;
    }

    // Extract nanoseconds from the original UTC tuple (second element)
    decimal nanoSecondDecimal = utcTime[1];
    int nanoSeconds = <int>nanoSecondDecimal;

    // Convert nanoseconds to microseconds (PostgreSQL supports up to 6 decimal places for microseconds)
    int microSeconds = nanoSeconds / 1000;

    // Format: YYYY-MM-DD HH:MM:SS.mmmmmm (6 digit microseconds)
    return string `${civilTime.year}-${civilTime.month.toString().padStart(2, "0")}-${civilTime.day.toString().padStart(2, "0")} ${civilTime.hour.toString().padStart(2, "0")}:${civilTime.minute.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${microSeconds.toString().padStart(6, "0")}`;
}

public isolated function convertUtcToDbDateTime(time:Utc utcTime) returns string|error {
    if dbType == H2 {
        return convertUtcToH2DateTime(utcTime);
    } else if dbType == MSSQL {
        return convertUtcToMySQLDateTime(utcTime); // MSSQL DATETIME2 supports same format as MySQL
    } else if dbType == POSTGRESQL {
        return convertUtcToPostgreSQLDateTime(utcTime);
    } else {
        return convertUtcToMySQLDateTime(utcTime);
    }
}

// Get database-specific TIMESTAMPDIFF function
// MySQL: TIMESTAMPDIFF(unit, start, end)
// MSSQL: DATEDIFF(unit, start, end)
// PostgreSQL: EXTRACT(EPOCH FROM (end - start))
public isolated function getTimestampDiffSeconds(string startColumn, string endTimestamp) returns string {
    if dbType == MSSQL {
        return string `DATEDIFF(SECOND, ${startColumn}, ${endTimestamp})`;
    } else if dbType == POSTGRESQL {
        return string `EXTRACT(EPOCH FROM (${endTimestamp} - ${startColumn}))`;
    } else {
        return string `TIMESTAMPDIFF(SECOND, ${startColumn}, ${endTimestamp})`;
    }
}

// Get database-specific boolean literal
// MySQL/H2: TRUE/FALSE
// MSSQL: 1/0
public isolated function getBooleanLiteral(boolean value) returns string {
    if dbType == MSSQL {
        return value ? "1" : "0";
    } else {
        return value ? "TRUE" : "FALSE";
    }
}

// Global constants for boolean literals
public final string TRUE_LITERAL = getBooleanLiteral(true);
public final string FALSE_LITERAL = getBooleanLiteral(false);

// Create a ParameterizedQuery from a raw SQL string using string:`` template
public isolated function sqlQueryFromString(string sqlString) returns sql:ParameterizedQuery {
    sql:ParameterizedQuery query = ``;
    query.strings = [sqlString];
    return query;
}

// Database type helper functions
public isolated function isMSSQL() returns boolean => dbType == MSSQL;

public isolated function isMySQL() returns boolean => dbType == MYSQL;

public isolated function isH2() returns boolean => dbType == H2;

public isolated function isPostgreSQL() returns boolean => dbType == POSTGRESQL;

// Get database-specific LIMIT clause
// MySQL/H2: LIMIT n
// MSSQL: OFFSET 0 ROWS FETCH NEXT n ROWS ONLY
public isolated function getLimitClause(int rowCount) returns string {
    if dbType == MSSQL {
        return string `OFFSET 0 ROWS FETCH NEXT ${rowCount} ROWS ONLY`;
    } else {
        return string `LIMIT ${rowCount}`;
    }
}

// Append database-specific LIMIT clause to a query
public isolated function appendLimitClause(sql:ParameterizedQuery query, int rowCount) returns sql:ParameterizedQuery {
    if dbType == MSSQL {
        return sql:queryConcat(query, ` OFFSET 0 ROWS FETCH NEXT 1 ROWS ONLY`);
    } else {
        return sql:queryConcat(query, ` LIMIT 1`);
    }
}

// Cast string to timestamp for PostgreSQL (no-op for other databases)
// PostgreSQL requires explicit ::timestamp cast, others handle it automatically
public isolated function timestampCast(string timestampStr) returns string {
    if dbType == POSTGRESQL {
        return string `'${timestampStr}'::timestamp`;
    } else {
        return string `'${timestampStr}'`;
    }
}
