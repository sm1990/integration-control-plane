#!/bin/bash

# Copyright (c) 2025, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
#
# WSO2 Inc. licenses this file to you under the Apache License,
# Version 2.0 (the "License"); you may not use this file except
# in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.

# ICP Server Launcher Script
# Usage: ./icp.sh

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
JAR_FILE="$SCRIPT_DIR/icp-server.jar"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$PARENT_DIR/conf/deployment.toml"

if [ ! -f "$JAR_FILE" ]; then
    echo "Error: icp-server.jar not found in $SCRIPT_DIR"
    exit 1
fi

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Warning: Configuration file not found at $CONFIG_FILE"
    echo "Starting ICP Server without custom configuration..."
    java -jar "$JAR_FILE" "$@"
else
    echo "Starting ICP Server with configuration: $CONFIG_FILE"
    export BAL_CONFIG_FILES="$CONFIG_FILE"
    java -jar "$JAR_FILE" "$@"
fi
