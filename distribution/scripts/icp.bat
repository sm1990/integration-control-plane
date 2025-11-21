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

REM Change to bin directory so relative paths in config work correctly
cd /d "!SCRIPT_DIR!"

REM Read ssoEnabled from deployment.toml and update the frontend config file
set SSO_ENABLED=false
if exist "!CONFIG_FILE!" (
    for /f "usebackq tokens=2 delims==" %%a in (`findstr /b /r "^ssoEnabled" "!CONFIG_FILE!"`) do (
        REM Trim whitespace from the value
        for /f "tokens=* delims= " %%b in ("%%a") do set SSO_ENABLED=%%b
    )
)

set WWW_CONFIG_FILE=!PARENT_DIR!\www\public\choreo.env.config.js
if exist "!WWW_CONFIG_FILE!" (
    powershell -Command "(Get-Content '!WWW_CONFIG_FILE!') -replace '\"SSO_ENABLED\": ''(true|false)''', '\"SSO_ENABLED\": ''!SSO_ENABLED!''' | Set-Content '!WWW_CONFIG_FILE!'"
    echo SSO Configuration: Updated frontend config with SSO_ENABLED=!SSO_ENABLED!
) else (
    echo Warning: Frontend config file not found at !WWW_CONFIG_FILE!
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
