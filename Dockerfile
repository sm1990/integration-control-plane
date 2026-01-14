# Copyright (c) 2026, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
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

# Stage 1: Build stage with Ballerina and Gradle
FROM ballerina/ballerina:2201.13.1 AS builder

# Install required dependencies (using apk for Alpine-based image)
USER root
RUN apk add --no-cache wget unzip zip bash

# Set working directory
WORKDIR /app

# Copy gradle wrapper and gradle files
COPY gradlew ./
COPY gradlew.bat ./
COPY gradle/ ./gradle/
COPY build.gradle ./
COPY settings.gradle ./
COPY gradle.properties ./

# Copy source code
COPY icp_server/ ./icp_server/
COPY www/ ./www/
COPY conf/ ./conf/
COPY distribution/ ./distribution/

# Make gradlew executable
RUN chmod +x ./gradlew

# Build the project
RUN ./gradlew clean build

# Stage 2: Runtime stage
FROM eclipse-temurin:21-jdk

# Define build argument for ICP version
ARG ICP_VERSION=2.0.0-SNAPSHOT

# Install unzip
RUN apt-get update && \
    apt-get install -y unzip && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /home/wso2

# Copy the distribution zip file from builder stage
COPY --from=builder /app/build/distribution/wso2-integrator-icp-${ICP_VERSION}.zip /home/wso2/

# Unzip the distribution and remove the zip file
RUN unzip wso2-integrator-icp-${ICP_VERSION}.zip && \
    rm wso2-integrator-icp-${ICP_VERSION}.zip

# Set working directory to the unzipped distribution home
WORKDIR /home/wso2/wso2-integrator-icp-${ICP_VERSION}

# Expose ports (HTTPS, GraphQL, Observability, OpenSearch Adaptor)
EXPOSE 9445 9446 9448 9449

# Ensure the script is executable
RUN chmod +x bin/icp.sh

# Run the startup script
ENTRYPOINT ["bin/icp.sh"]
