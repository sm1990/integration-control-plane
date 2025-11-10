@echo off
REM Copyright (c) 2025, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
REM
REM WSO2 Inc. licenses this file to you under the Apache License,
REM Version 2.0 (the "License"); you may not use this file except
REM in compliance with the License.
REM You may obtain a copy of the License at
REM
REM      http://www.apache.org/licenses/LICENSE-2.0
REM
REM Unless required by applicable law or agreed to in writing,
REM software distributed under the License is distributed on an
REM "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
REM KIND, either express or implied.  See the License for the
REM specific language governing permissions and limitations
REM under the License.

REM ICP Server Launcher Script
REM Usage: icp.bat

setlocal enabledelayedexpansion
set SCRIPT_DIR=%~dp0
set JAR_FILE=!SCRIPT_DIR!icp-server.jar
for %%A in ("!SCRIPT_DIR!..") do set PARENT_DIR=%%~fA
set CONFIG_FILE=!PARENT_DIR!\conf\deployment.toml

if not exist "!JAR_FILE!" (
    echo Error: icp-server.jar not found in !SCRIPT_DIR!
    exit /b 1
)

if not exist "!CONFIG_FILE!" (
    echo Warning: Configuration file not found at !CONFIG_FILE!
    echo Starting ICP Server without custom configuration...
    java -jar "!JAR_FILE!" %*
) else (
    echo Starting ICP Server with configuration: !CONFIG_FILE!
    set BAL_CONFIG_FILES=!CONFIG_FILE!
    java -jar "!JAR_FILE!" %*
)
