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

#!/bin/bash
set -e

# Start MySQL in background
docker-entrypoint.sh mysqld &
MYSQL_PID=$!

# Wait for MySQL to be ready
echo "Waiting for MySQL to start..."
for i in {1..30}; do
    if mysqladmin ping -h localhost -u root -p"$MYSQL_ROOT_PASSWORD" --silent 2>/dev/null; then
        echo "MySQL is up!"
        # Additional wait to ensure MySQL is fully ready for connections
        sleep 3
        # Verify we can actually connect and run a query
        if mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SELECT 1;" >/dev/null 2>&1; then
            echo "MySQL is ready for use!"
            break
        fi
    fi
    echo "Waiting... ($i/30)"
    sleep 2
done

# Execute the initialization script
echo "Running initialization script..."
mysql -u root -p"$MYSQL_ROOT_PASSWORD" </tmp/mysql_init.sql
echo "Database initialized successfully!"

# Keep MySQL running
wait $MYSQL_PID
