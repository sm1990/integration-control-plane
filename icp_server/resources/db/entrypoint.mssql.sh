#!/bin/bash
# Copyright (c) 2025, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
#
# WSO2 Inc. licenses this file to you under the Apache License,
# Version 2.0 (the "License"); you may not use this file except
# in compliance with the License.
# You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

set -e

# Function to check if SQL Server is ready
wait_for_sql_server() {
    local max_tries=90
    local count=0
    
    echo "Waiting for SQL Server to start..."
    while [ $count -lt $max_tries ]; do
        # Try to connect using sqlcmd18 (go-sqlcmd uses SQLCMDPASSWORD env var)
        if SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -Q "SELECT 1" -b &>/dev/null; then
            echo "SQL Server is ready!"
            return 0
        fi
        count=$((count + 1))
        if [ $((count % 10)) -eq 0 ]; then
            echo "Attempt $count/$max_tries: SQL Server not ready yet..."
        fi
        sleep 3
    done
    
    echo "ERROR: SQL Server failed to start within the expected time"
    return 1
}

# Start SQL Server in the background
echo "Starting SQL Server..."
/opt/mssql/bin/sqlservr &
SQL_PID=$!

# Wait for SQL Server to be ready
if ! wait_for_sql_server; then
    echo "Failed to start SQL Server"
    exit 1
fi

# Run the initialization script
if [ -f /docker-entrypoint-initdb.d/mssql_init.sql ]; then
    echo "Running initialization script..."
    if SQLCMDPASSWORD="$MSSQL_SA_PASSWORD" /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -C -i /docker-entrypoint-initdb.d/mssql_init.sql; then
        echo "Database initialization completed successfully"
    else
        echo "Database initialization failed"
        exit 1
    fi
else
    echo "No initialization script found, skipping..."
fi

echo "SQL Server is ready for connections"

# Keep the container running by waiting for the SQL Server process
wait $SQL_PID
